import Phaser from 'phaser';
import { COLORS } from '../../config';
import type { DogData } from '../../data/dogs';
import type { Rect } from '../../logic/layout';
import { calcPower } from '../../logic/power';
import { addText, openModal, viewOf } from '../ui';
import { drawDogHead } from './dogArt';
import { makeTapArea } from './hitArea';

export interface DogInfoOptions {
  owned: boolean;
  inTeam: boolean;
  teamFull: boolean;
  isLobby: boolean;
  onToggleTeam: () => void;
  onSetLobby: () => void;
  onClose: () => void;
}

/**
 * 角色資訊面板：頭像、數值、技能。
 * 擁有的狗：下方有「加入／移出隊伍」「設為主頁角色」。
 * 沒擁有的狗：暗色頭像 + 「尚未擁有」。點遮罩關閉。
 */
export class DogInfoPanel {
  readonly layer: Phaser.GameObjects.Container;
  readonly buttons: { team?: Rect; lobby?: Rect } = {};

  constructor(scene: Phaser.Scene, dog: DogData, o: DogInfoOptions) {
    const { landscape } = viewOf(scene);
    const { layer, box } = openModal(
      scene,
      landscape ? { width: 560, height: 340 } : { width: 350, height: 470 },
      o.onClose,
      o.owned ? (dog.color === 0xf7f4ee ? COLORS.cardBorder : dog.color) : 0x6b5a4a,
    );
    this.layer = layer;

    const head = scene.add.graphics();
    const hr = 40;
    const hx = box.x + 24 + hr;
    const hy = box.y + 34 + hr;
    drawDogHead(head, hx, hy, hr, dog.color, dog.accent, { dark: !o.owned });
    layer.add(head);

    const tx = hx + hr + 20;
    const textW = box.x + box.width - tx - 16;
    layer.add(
      addText(
        scene,
        tx,
        box.y + 30,
        o.owned ? `${dog.name}  Lv.${dog.level}` : dog.name,
        26,
        COLORS.ink,
        true,
      ),
    );
    layer.add(
      addText(
        scene,
        tx,
        box.y + 66,
        `${dog.breed}・${dog.role}`,
        15,
        COLORS.inkSoft,
      ).setWordWrapWidth(textW),
    );
    if (!o.owned) {
      layer.add(addText(scene, tx, box.y + 92, '尚未擁有', 16, '#c0392b', true));
    }

    const power = calcPower(dog.baseAttack, dog.baseDefense, dog.level);
    const left = box.x + 24;
    const wrap = box.width - 48;
    let y = box.y + 132;
    const line = (s: string, size: number, color: string = COLORS.ink, bold = false, gap = 30) => {
      const t = addText(scene, left, y, s, size, color, bold).setWordWrapWidth(wrap);
      layer.add(t);
      y += gap;
    };
    line(`性格：${dog.personality}`, 16);
    line(`攻擊 ${dog.baseAttack}\u3000防禦 ${dog.baseDefense}\u3000戰力 ${power}`, 16);
    line(`技能「${dog.skill.name}」：${dog.skill.description}`, 16, '#b5651d', true, 40);

    const by = box.y + box.height - 64;
    if (o.owned) {
      const bw = (box.width - 48 - 12) / 2;
      const teamLabel = o.inTeam ? '移出隊伍' : o.teamFull ? '隊伍已滿' : '加入隊伍';
      const teamColor = o.inTeam ? 0x8a6f55 : o.teamFull ? COLORS.buttonDisabled : COLORS.button;
      this.buttons.team = this.button(
        scene,
        { x: left, y: by, width: bw, height: 48 },
        teamLabel,
        teamColor,
        o.onToggleTeam,
      );
      this.buttons.lobby = this.button(
        scene,
        { x: left + bw + 12, y: by, width: bw, height: 48 },
        o.isLobby ? '主頁角色 ✓' : '設為主頁角色',
        o.isLobby ? COLORS.buttonDisabled : COLORS.harvest,
        o.onSetLobby,
      );
    } else {
      layer.add(
        addText(
          scene,
          box.x + box.width / 2,
          by + 24,
          '招募功能開放後就能取得',
          16,
          COLORS.inkSoft,
        ).setOrigin(0.5),
      );
    }
  }

  private button(
    scene: Phaser.Scene,
    r: Rect,
    label: string,
    color: number,
    onTap: () => void,
  ): Rect {
    const c = scene.add.container(r.x, r.y);
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, r.width, r.height, 14);
    c.add([
      g,
      addText(scene, r.width / 2, r.height / 2, label, 18, '#ffffff', true).setOrigin(0.5),
    ]);
    makeTapArea(c, r.width, r.height);
    c.on('pointerup', onTap);
    this.layer.add(c);
    return r;
  }

  destroy(): void {
    this.layer.destroy();
  }
}
