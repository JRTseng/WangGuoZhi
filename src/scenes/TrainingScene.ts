import Phaser from 'phaser';
import { COLORS } from '../config';
import { DOGS, type DogData } from '../data/dogs';
import { busyDogIds } from '../logic/expedition';
import { formatAmount } from '../logic/format';
import type { Rect } from '../logic/layout';
import { dogStats } from '../logic/leveling';
import {
  DRILL_LABELS,
  DRILL_MAX,
  checkDrill,
  drill,
  type DrillCheck,
  type DrillStat,
} from '../logic/training';
import {
  trainingButtons,
  trainingLayout,
  trainingRow,
  type TrainingLayout,
} from '../logic/trainingLayout';
import { getState, setState } from '../state/store';
import { drawDogHead } from './components/dogArt';
import { drawExpBar, expLabel } from './components/ExpBar';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
const STATS: readonly DrillStat[] = ['attack', 'defense'];
/** 手指移動超過這個距離就當成捲動，不算點按鈕 */
const TAP_SLOP = 8;
/** 按鈕的點擊範圍上下各多留一點，手機比較好按 */
const TAP_PAD = 3;

/**
 * 訓練場（T005、T020）：看每隻狗的等級、經驗條、攻防與升級累積的成長，
 * 並可以花糧草做攻擊或防禦特訓（每次永久 +1）。
 * 進場時依等級高到低排，特訓後順序不變；狗多了可以上下捲動。
 */
export class TrainingScene extends Phaser.Scene {
  private layout!: TrainingLayout;
  private rows!: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;
  private landscape = false;
  private scrollY = 0;
  private dragFrom: { x: number; y: number; scroll: number } | null = null;
  private ids: string[] = [];

  constructor() {
    super('TrainingScene');
  }

  create(): void {
    resetDebug(this);
    this.scrollY = 0;
    this.dragFrom = null;
    const { w, h, landscape } = viewOf(this);
    this.landscape = landscape;
    const st = getState();
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '訓練場', () => this.scene.start('LobbyScene'));

    this.ids = DOGS.filter((d) => st.owned.includes(d.id))
      .map((d) => ({ d, s: dogStats(st, d) }))
      .sort((a, b) => b.s.level - a.s.level || b.s.power - a.s.power)
      .map((x) => x.d.id);
    const l = (this.layout = trainingLayout(w, h, landscape, this.ids.length, BAR));

    this.hint = addText(this, l.hint.x, l.hint.y, '', 14, COLORS.inkSoft).setOrigin(0.5);

    this.rows = this.add.container(0, 0);
    const mask = this.make.graphics();
    mask.fillStyle(0xffffff, 1);
    mask.fillRect(l.list.x - 4, l.list.y, l.list.width + 8, l.list.height);
    this.rows.setMask(mask.createGeometryMask());
    this.renderRows();

    // 上下拖曳或滾輪捲動；沒有拖動就當成點按鈕
    const inList = (p: Phaser.Input.Pointer) => p.y >= l.list.y && p.y <= l.list.y + l.list.height;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragFrom = inList(p) ? { x: p.x, y: p.y, scroll: this.scrollY } : null;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragFrom && p.isDown) this.scrollTo(this.dragFrom.scroll - (p.y - this.dragFrom.y));
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const from = this.dragFrom;
      this.dragFrom = null;
      if (!from || !inList(p)) return;
      if (Math.abs(p.x - from.x) > TAP_SLOP || Math.abs(p.y - from.y) > TAP_SLOP) return;
      this.tapAt(p.x, p.y + this.scrollY);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) =>
      this.scrollTo(this.scrollY + dy),
    );

    patchDebug({ backButton: back });
    this.publish();
  }

  private dog(id: string): DogData {
    return DOGS.find((x) => x.id === id)!;
  }

  /** 依目前狀態重畫整個列表（進場與每次特訓後） */
  private renderRows(): void {
    const st = getState();
    const l = this.layout;
    const landscape = this.landscape;
    const busy = busyDogIds(st);
    this.hint.setText(`花糧草特訓，攻擊或防禦永久 +1・糧草 ${formatAmount(st.resources.food)}`);
    this.rows.removeAll(true);

    this.ids.forEach((id, i) => {
      const d = this.dog(id);
      const s = dogStats(st, d);
      const r = trainingRow(l, i);
      const c = this.add.container(r.x, r.y);
      const g = this.add.graphics();
      g.fillStyle(COLORS.card, 1);
      g.lineStyle(2, COLORS.cardBorder, 1);
      g.fillRoundedRect(0, 0, r.width, r.height, 14);
      g.strokeRoundedRect(0, 0, r.width, r.height, 14);
      const hr = 26;
      const top = landscape ? 9 : 10;
      const gapY = landscape ? 23 : 24;
      drawDogHead(g, 16 + hr, top + gapY + 12, hr, d.color, d.accent);
      const tx = 16 + hr * 2 + 14;
      const right = r.width - 14;
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

      // 特訓按鈕：上面一行「攻擊特訓 3/10」，下面一行花費或狀態
      const buttons = trainingButtons(l, i);
      for (const stat of STATS) {
        const b = buttons[stat];
        const bx = b.x - r.x;
        const by = b.y - r.y;
        const check = checkDrill(st, id, stat);
        g.fillStyle(check.ok ? COLORS.button : COLORS.buttonDisabled, 1);
        g.fillRoundedRect(bx, by, b.width, b.height, 10);
        const cx = bx + b.width / 2;
        c.add([
          addText(
            this,
            cx,
            by + b.height / 2 - 8,
            `${DRILL_LABELS[stat]}特訓 ${check.count}/${DRILL_MAX}`,
            14,
            '#ffffff',
            true,
          ).setOrigin(0.5),
          addText(this, cx, by + b.height / 2 + 9, drillNote(check), 12, '#fff6e8').setOrigin(0.5),
        ]);
      }
      this.rows.add(c);
    });
  }

  /** 點到哪顆特訓按鈕就做一次特訓（y 已加上捲動量） */
  private tapAt(x: number, y: number): void {
    const hit = (b: Rect) =>
      x >= b.x && x <= b.x + b.width && y >= b.y - TAP_PAD && y <= b.y + b.height + TAP_PAD;
    for (let i = 0; i < this.ids.length; i++) {
      const buttons = trainingButtons(this.layout, i);
      for (const stat of STATS) {
        if (!hit(buttons[stat])) continue;
        const r = drill(getState(), this.ids[i], stat);
        if (!r.check.ok) return;
        setState(r.state);
        this.renderRows();
        this.floatText(buttons[stat], `${DRILL_LABELS[stat]} +1`);
        this.publish();
        return;
      }
    }
  }

  /** 特訓成功的回饋：按鈕上方飄一行「攻擊 +1」 */
  private floatText(b: Rect, text: string): void {
    const t = addText(this, b.x + b.width / 2, b.y - 6, text, 18, '#2f7d32', true).setOrigin(0.5);
    t.setStroke('#ffffff', 4);
    this.rows.add(t);
    this.tweens.add({
      targets: t,
      y: t.y - 30,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
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
    const shift = (r: Rect): Rect => ({ ...r, y: r.y - this.scrollY });
    patchDebug({
      training: {
        list: this.layout.list,
        scrollY: this.scrollY,
        scrollMax: this.layout.scrollMax,
        food: st.resources.food,
        rows: this.ids.map((id, i) => {
          const s = dogStats(st, this.dog(id));
          const buttons = trainingButtons(this.layout, i);
          const info = (stat: DrillStat) => {
            const c = checkDrill(st, id, stat);
            return { ...shift(buttons[stat]), count: c.count, cost: c.cost, enabled: c.ok };
          };
          return {
            id,
            level: s.level,
            exp: s.exp,
            expNeed: s.expNeed,
            attack: s.attack,
            defense: s.defense,
            power: s.power,
            drill: { attack: info('attack'), defense: info('defense') },
            ...shift(trainingRow(this.layout, i)),
          };
        }),
      },
    });
  }
}

/** 按鈕第二行：花費、還差多少，或已滿 */
function drillNote(c: DrillCheck): string {
  if (c.reason === 'maxed') return '已滿';
  if (c.reason === 'food') return `糧草 ${formatAmount(c.cost)}（還差 ${formatAmount(c.short)}）`;
  return `糧草 ${formatAmount(c.cost)}`;
}
