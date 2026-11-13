import Phaser from 'phaser';
import { COLORS } from '../../config';
import { findDog } from '../../data/dogs';
import { ROW_MAX, ROW_NAMES, type RowIndex } from '../../logic/battle';
import { battleRoleOf, resetFormation, setDogRow, teamRows } from '../../logic/formation';
import { formationLayout, formationPanelSize } from '../../logic/formationLayout';
import type { Rect } from '../../logic/layout';
import { getState, setState } from '../../state/store';
import { addText, openModal, patchDebug, viewOf } from '../ui';
import { Button } from './Button';
import { drawDogHead } from './dogArt';
import { makeTapArea } from './hitArea';

/**
 * 陣型面板（T023）：把隊伍裡的狗排到前排、中排、後排，一排最多 3 隻。
 * 點一下狗（亮起來），再點要去的那一排就換過去；「照定位重排」回到預設。
 * 組隊編排與出征選隊伍共用；改動直接寫進狀態（GameState.formation）。
 */
export class FormationPanel {
  private layer: Phaser.GameObjects.Container | null = null;
  private selected: string | null = null;
  private message = '';

  constructor(
    private readonly scene: Phaser.Scene,
    /** 要排的隊伍（狗狗 id，照隊伍順序） */
    private readonly dogIds: readonly string[],
    private readonly onClose: () => void,
  ) {
    this.render();
  }

  destroy(): void {
    this.layer?.destroy();
    this.layer = null;
    patchDebug({ formation: null });
  }

  private close(): void {
    this.destroy();
    this.onClose();
  }

  private tapDog(id: string): void {
    this.selected = this.selected === id ? null : id;
    this.message = '';
    this.render();
  }

  private tapRow(row: RowIndex): void {
    if (!this.selected) {
      this.message = '先點一隻狗，再點要去的那一排';
      this.render();
      return;
    }
    const before = getState();
    const next = setDogRow(before, this.dogIds, this.selected, row);
    const rows = teamRows(before, this.dogIds);
    if (next === before && rows[this.dogIds.indexOf(this.selected)] !== row) {
      this.message = `${ROW_NAMES[row]}滿了（一排最多 ${ROW_MAX} 隻）`;
    } else {
      setState(next);
      this.selected = null;
      this.message = '';
    }
    this.render();
  }

  private render(): void {
    this.layer?.destroy();
    const scene = this.scene;
    const { w, h } = viewOf(scene);
    const { layer, box } = openModal(scene, formationPanelSize(w, h), () => this.close());
    this.layer = layer;
    const l = formationLayout(box);
    const st = getState();
    const rows = teamRows(st, this.dogIds);
    const cx = box.x + box.width / 2;

    layer.add(addText(scene, cx, box.y + 26, '陣型', 23, COLORS.ink, true).setOrigin(0.5));
    layer.add(
      addText(
        scene,
        cx,
        box.y + 58,
        this.message || '點狗狗，再點要去的那一排　前排在右邊面對敵人 ›',
        13,
        this.message ? '#b0413e' : COLORS.inkSoft,
        !!this.message,
      ).setOrigin(0.5),
    );

    const dogs: ({ id: string; row: number; selected: boolean } & Rect)[] = [];
    for (const row of [0, 1, 2] as const) {
      const r = l.rows[row];
      const c = scene.add.container(r.x, r.y);
      const g = scene.add.graphics();
      const count = rows.filter((x) => x === row).length;
      const target = !!this.selected && rows[this.dogIds.indexOf(this.selected)] !== row;
      g.fillStyle(target ? 0xfff0d6 : 0xefe3cf, 1);
      g.lineStyle(target ? 3 : 2, target ? COLORS.button : COLORS.cardBorder, 1);
      g.fillRoundedRect(0, 0, r.width, r.height, 12);
      g.strokeRoundedRect(0, 0, r.width, r.height, 12);
      c.add(g);
      makeTapArea(c, r.width, r.height);
      c.on('pointerup', () => this.tapRow(row));
      layer.add(c);
      layer.add(
        addText(
          scene,
          l.labels[row].x,
          l.labels[row].y,
          `${ROW_NAMES[row]} ${count}/${ROW_MAX}`,
          15,
          COLORS.ink,
          true,
        ).setOrigin(0.5),
      );
      let n = 0;
      this.dogIds.forEach((id, i) => {
        if (rows[i] !== row) return;
        const slot = l.slots[row][n++];
        const d = findDog(id);
        if (!slot || !d) return;
        const on = this.selected === id;
        const chip = scene.add.container(slot.x, slot.y);
        const cg = scene.add.graphics();
        cg.fillStyle(on ? COLORS.cardSelected : COLORS.card, 1);
        cg.lineStyle(on ? 4 : 2, on ? COLORS.button : COLORS.cardBorder, 1);
        cg.fillRoundedRect(0, 0, slot.width, slot.height, 10);
        cg.strokeRoundedRect(0, 0, slot.width, slot.height, 10);
        const hr = Math.min(18, slot.height / 2 - 8);
        drawDogHead(cg, 10 + hr, slot.height / 2 + 2, hr, d.color, d.accent);
        chip.add(cg);
        const tx = 18 + hr * 2;
        const tall = slot.height >= 56;
        chip.add(
          addText(
            scene,
            tx,
            slot.height / 2 - (tall ? 9 : 0),
            d.name,
            15,
            COLORS.ink,
            true,
          ).setOrigin(0, 0.5),
        );
        if (tall) {
          chip.add(
            addText(
              scene,
              tx,
              slot.height / 2 + 11,
              battleRoleOf(d.role) ?? '',
              12,
              '#b5651d',
            ).setOrigin(0, 0.5),
          );
        }
        makeTapArea(chip, slot.width, slot.height);
        chip.on('pointerup', () => this.tapDog(id));
        layer.add(chip);
        dogs.push({ id, row, selected: on, ...slot });
      });
    }

    const reset = new Button(
      scene,
      l.reset,
      '照定位重排',
      () => {
        setState(resetFormation(getState(), this.dogIds));
        this.selected = null;
        this.message = '';
        this.render();
      },
      18,
    );
    reset.setColor(0x8a6f55);
    const close = new Button(scene, l.close, '完成', () => this.close(), 20);
    layer.add([reset, close]);

    patchDebug({
      formation: {
        dogs,
        rows: l.rows,
        selected: this.selected,
        message: this.message,
        reset: l.reset,
        close: l.close,
      },
    });
  }
}
