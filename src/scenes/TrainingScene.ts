import Phaser from 'phaser';
import { COLORS } from '../config';
import { DOGS } from '../data/dogs';
import { busyDogIds } from '../logic/expedition';
import { MAX_LEVEL, dogStats } from '../logic/leveling';
import { trainingLayout, trainingRow, type TrainingLayout } from '../logic/trainingLayout';
import { getState } from '../state/store';
import { drawDogHead } from './components/dogArt';
import { drawExpBar, expLabel } from './components/ExpBar';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;

/**
 * 訓練場（T005）：看每隻狗的等級、經驗條、攻防與升級累積的成長。
 * 經驗來自出征收成（打輸也有一半），這裡只顯示，不花資源。
 * 依等級高到低排；狗多了可以上下捲動。
 */
export class TrainingScene extends Phaser.Scene {
  private layout!: TrainingLayout;
  private rows!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private dragFrom: { y: number; scroll: number } | null = null;
  private ids: string[] = [];

  constructor() {
    super('TrainingScene');
  }

  create(): void {
    resetDebug(this);
    this.scrollY = 0;
    this.dragFrom = null;
    const { w, h, landscape } = viewOf(this);
    const st = getState();
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '訓練場', () => this.scene.start('LobbyScene'));

    const busy = busyDogIds(st);
    const dogs = DOGS.filter((d) => st.owned.includes(d.id))
      .map((d) => ({ d, s: dogStats(st, d) }))
      .sort((a, b) => b.s.level - a.s.level || b.s.power - a.s.power);
    this.ids = dogs.map((x) => x.d.id);
    const l = (this.layout = trainingLayout(w, h, landscape, dogs.length, BAR));

    addText(
      this,
      l.hint.x,
      l.hint.y,
      `出征收成就有經驗，打輸也有一半・等級上限 ${MAX_LEVEL}`,
      14,
      COLORS.inkSoft,
    ).setOrigin(0.5);

    this.rows = this.add.container(0, 0);
    const mask = this.make.graphics();
    mask.fillStyle(0xffffff, 1);
    mask.fillRect(l.list.x - 4, l.list.y, l.list.width + 8, l.list.height);
    this.rows.setMask(mask.createGeometryMask());

    dogs.forEach(({ d, s }, i) => {
      const r = trainingRow(l, i);
      const c = this.add.container(r.x, r.y);
      const g = this.add.graphics();
      g.fillStyle(COLORS.card, 1);
      g.lineStyle(2, COLORS.cardBorder, 1);
      g.fillRoundedRect(0, 0, r.width, r.height, 14);
      g.strokeRoundedRect(0, 0, r.width, r.height, 14);
      const hr = 26;
      drawDogHead(g, 16 + hr, r.height / 2 + 2, hr, d.color, d.accent);
      const tx = 16 + hr * 2 + 14;
      const right = r.width - 14;
      const top = landscape ? 9 : 12;
      const gapY = landscape ? 23 : 26;
      const maxed = s.expNeed === 0;
      drawExpBar(g, tx, top + gapY * 2 + 22, right - tx, 8, s.exp / (s.expNeed || 1), maxed);
      c.add([
        g,
        addText(this, tx, top, d.name, 18, COLORS.ink, true),
        addText(this, tx + 18 * d.name.length + 8, top + 2, `Lv.${s.level}`, 16, '#b5651d', true),
        addText(this, right, top + 2, `戰力 ${s.power}`, 15, COLORS.ink, true).setOrigin(1, 0),
        addText(this, tx, top + gapY, `攻擊 ${s.attack}\u3000防禦 ${s.defense}`, 14, COLORS.ink),
        addText(
          this,
          right,
          top + gapY,
          busy.has(d.id) ? '出征中' : '',
          13,
          '#b0413e',
          true,
        ).setOrigin(1, 0),
        addText(
          this,
          tx,
          top + gapY * 2,
          `升級成長 攻 +${s.growthAttack}\u3000防 +${s.growthDefense}`,
          13,
          COLORS.inkSoft,
        ),
        addText(
          this,
          right,
          top + gapY * 2,
          expLabel(s.exp, s.expNeed),
          13,
          COLORS.inkSoft,
        ).setOrigin(1, 0),
      ]);
      this.rows.add(c);
    });

    // 上下拖曳或滾輪捲動
    const inList = (p: Phaser.Input.Pointer) => p.y >= l.list.y && p.y <= l.list.y + l.list.height;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragFrom = inList(p) ? { y: p.y, scroll: this.scrollY } : null;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragFrom && p.isDown) this.scrollTo(this.dragFrom.scroll - (p.y - this.dragFrom.y));
    });
    this.input.on('pointerup', () => (this.dragFrom = null));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) =>
      this.scrollTo(this.scrollY + dy),
    );

    patchDebug({ backButton: back });
    this.publish();
  }

  private scrollTo(y: number): void {
    const next = Math.min(this.layout.scrollMax, Math.max(0, y));
    if (next === this.scrollY) return;
    this.scrollY = next;
    this.rows.y = -next;
    this.publish();
  }

  private publish(): void {
    const st = getState();
    patchDebug({
      training: {
        list: this.layout.list,
        scrollY: this.scrollY,
        scrollMax: this.layout.scrollMax,
        rows: this.ids.map((id, i) => {
          const d = DOGS.find((x) => x.id === id)!;
          const s = dogStats(st, d);
          const r = trainingRow(this.layout, i);
          return {
            id,
            level: s.level,
            exp: s.exp,
            expNeed: s.expNeed,
            attack: s.attack,
            defense: s.defense,
            power: s.power,
            ...r,
            y: r.y - this.scrollY,
          };
        }),
      },
    });
  }
}
