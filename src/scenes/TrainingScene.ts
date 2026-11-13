import Phaser from 'phaser';
import { COLORS, rarityHex } from '../config';
import { DOGS, type DogData } from '../data/dogs';
import { DEFAULT_SKILL_LINES } from '../data/skillLines';
import { boardingSlotCount } from '../logic/boarding';
import { busyDogIds } from '../logic/expedition';
import { formatAmount } from '../logic/format';
import type { Rect } from '../logic/layout';
import { MAX_LEVEL, STAR_MAX, dogStats } from '../logic/leveling';
import { SKILL_LINE_MAX, setSkillLine, skillLineOf } from '../logic/skillShow';
import { checkStarUp, starUp, type StarCheck } from '../logic/star';
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
  trainingLineButton,
  trainingRow,
  type TrainingLayout,
} from '../logic/trainingLayout';
import type { GameState } from '../state/gameState';
import { getState, setState, tick } from '../state/store';
import { makeTapArea } from './components/hitArea';
import { drawDogHead } from './components/dogArt';
import { drawExpBar, expLabel } from './components/ExpBar';
import { closeTextPrompt, isTextPromptOpen, openTextPrompt } from './components/TextPrompt';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
/** 多久結算一次寄宿經驗並更新數字（T021） */
const REFRESH_MS = 500;
const STATS: readonly DrillStat[] = ['attack', 'defense'];
/** 升星按鈕的顏色（金色系，和特訓的橘色分開） */
const STAR_BUTTON_COLOR = 0xc98a12;
/** 手指移動超過這個距離就當成捲動，不算點按鈕 */
const TAP_SLOP = 8;
/** 按鈕的點擊範圍上下各多留一點，手機比較好按 */
const TAP_PAD = 3;
/** 「改台詞」按鈕比較小，點擊範圍上下左右多留一些 */
const LINE_TAP_PAD = 8;
/** 「改台詞」按鈕的顏色（深藍，和大絕招字卡同色系） */
const LINE_BUTTON_COLOR = 0x3d5a94;

/**
 * 訓練場（T005、T020、T021、T007）：看每隻狗的等級、經驗條、攻防與升級累積的成長，
 * 可以花糧草做攻擊或防禦特訓（每次永久 +1），也可以花碎片升星（提高攻防與等級上限）。
 * 右上角進「板凳寄宿」。每張卡片右邊的「改台詞」可以替狗狗填放大絕招時喊的台詞（T017）。
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
  private boardingButton!: Rect;
  private boardingLabel!: Phaser.GameObjects.Text;
  private seenDogs: GameState['dogs'] | null = null;

  constructor() {
    super('TrainingScene');
  }

  create(): void {
    resetDebug(this);
    this.scrollY = 0;
    this.dragFrom = null;
    const { w, h, landscape } = viewOf(this);
    this.landscape = landscape;
    const st = tick();
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '訓練場', () => this.scene.start('LobbyScene'));

    // 右上角：進板凳寄宿（T021）
    const bb = (this.boardingButton = { x: w - 8 - 112, y: 6, width: 112, height: BAR - 12 });
    const bc = this.add.container(bb.x, bb.y).setDepth(51);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.harvest, 1);
    bg.fillRoundedRect(0, 0, bb.width, bb.height, 12);
    this.boardingLabel = addText(this, bb.width / 2, bb.height / 2, '', 16, '#ffffff', true);
    bc.add([bg, this.boardingLabel.setOrigin(0.5)]);
    makeTapArea(bc, bb.width, bb.height);
    bc.on('pointerup', () => this.scene.start('BoardingScene'));

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

    // 寄宿中的狗經驗會自己漲：定時結算，有變才重畫
    this.time.addEvent({
      delay: REFRESH_MS,
      loop: true,
      callback: () => {
        if (tick().dogs === this.seenDogs) return;
        this.renderRows();
        this.publish();
      },
    });

    // 離開訓練場時把打字視窗收掉
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, closeTextPrompt);

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
    this.seenDogs = st.dogs;
    this.boardingLabel.setText(`寄宿 ${st.boarding.length}/${boardingSlotCount(st)} ›`);
    this.hint.setText(`糧草特訓永久 +1・碎片升星・糧草 ${formatAmount(st.resources.food)}`);
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
      const lb = trainingLineButton(l, i);
      g.fillStyle(LINE_BUTTON_COLOR, 1);
      g.fillRoundedRect(lb.x - r.x, lb.y - r.y, lb.width, lb.height, 13);
      const tx = 16 + hr * 2 + 14;
      const right = r.width - 14;
      const maxed = s.expNeed === 0;
      drawExpBar(g, tx, top + gapY * 2 + 22, right - tx, 8, s.exp / (s.expNeed || 1), maxed);
      let lv: Phaser.GameObjects.Text;
      let stars: Phaser.GameObjects.Text;
      c.add([
        g,
        addText(this, tx, top, d.name, 18, COLORS.ink, true),
        (lv = addText(
          this,
          tx + 18 * d.name.length + 8,
          top + 2,
          `Lv.${s.level}`,
          16,
          '#b5651d',
          true,
        )),
        // 星數：亮的幾顆是金色，其餘灰色（空心星在手機字型上看起來和實心一樣，所以用顏色分）
        (stars = addText(
          this,
          lv.x + lv.width + 8,
          top + 3,
          '★'.repeat(s.star),
          13,
          '#d99a1c',
          true,
        )),
        addText(
          this,
          stars.x + stars.width,
          top + 3,
          '★'.repeat(STAR_MAX - s.star),
          13,
          '#d9cdbb',
          true,
        ),
        addText(
          this,
          16 + hr,
          top + gapY + 12 + hr + 4,
          d.rarity ?? '',
          12,
          d.rarity ? rarityHex(d.rarity) : COLORS.inkSoft,
          true,
        ).setOrigin(0.5, 0),
        addText(this, right, top + 2, `戰力 ${s.power}`, 15, COLORS.ink, true).setOrigin(1, 0),
        addText(this, tx, top + gapY, `攻擊 ${s.attack}\u3000防禦 ${s.defense}`, 14, COLORS.ink),
        addText(
          this,
          lb.x - r.x - 8,
          top + gapY,
          busy.has(d.id) ? '寄宿中' : '',
          13,
          '#2f7d32',
          true,
        ).setOrigin(1, 0),
        // 「改台詞」小按鈕（T017）
        addText(
          this,
          lb.x - r.x + lb.width / 2,
          lb.y - r.y + lb.height / 2,
          '改台詞 ›',
          13,
          '#ffffff',
          true,
        ).setOrigin(0.5),
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
          maxed && s.levelCap < MAX_LEVEL
            ? `等級上限 ${s.levelCap}・升星可提高`
            : expLabel(s.exp, s.expNeed),
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
      // 升星按鈕（T007）：上面「升星」，下面碎片「有幾個／要幾個」
      {
        const b = buttons.star;
        const bx = b.x - r.x;
        const by = b.y - r.y;
        const check = checkStarUp(st, id);
        g.fillStyle(check.ok ? STAR_BUTTON_COLOR : COLORS.buttonDisabled, 1);
        g.fillRoundedRect(bx, by, b.width, b.height, 10);
        const cx = bx + b.width / 2;
        c.add([
          addText(this, cx, by + b.height / 2 - 8, '升星', 14, '#ffffff', true).setOrigin(0.5),
          addText(this, cx, by + b.height / 2 + 9, starNote(check), 12, '#fff6e8').setOrigin(0.5),
        ]);
      }
      this.rows.add(c);
    });
  }

  /** 點到哪顆特訓按鈕就做一次特訓（y 已加上捲動量） */
  private tapAt(x: number, y: number): void {
    if (isTextPromptOpen()) return;
    const hit = (b: Rect, padX = 0, padY = TAP_PAD) =>
      x >= b.x - padX && x <= b.x + b.width + padX && y >= b.y - padY && y <= b.y + b.height + padY;
    for (let i = 0; i < this.ids.length; i++) {
      if (hit(trainingLineButton(this.layout, i), LINE_TAP_PAD, LINE_TAP_PAD)) {
        this.editLine(this.ids[i]);
        return;
      }
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
      if (hit(buttons.star)) {
        const r = starUp(tick(), this.ids[i], Date.now());
        if (!r.check.ok) return;
        setState(r.state);
        this.renderRows();
        this.floatText(buttons.star, `升星！★${r.check.star + 1}`, '#b8860b');
        this.publish();
        return;
      }
    }
  }

  /** 開打字視窗，替這隻狗填放大絕招時喊的台詞；清空或按「恢復預設」就用回預設台詞 */
  private editLine(id: string): void {
    const d = this.dog(id);
    openTextPrompt({
      title: `${d.name}的招式台詞`,
      note: `放大絕招「${d.skill.name}」時會喊出這句話。\n留空就用預設台詞。`,
      value: getState().skillLines[id] ?? '',
      placeholder: DEFAULT_SKILL_LINES[id] ?? '',
      maxLength: SKILL_LINE_MAX,
      onSubmit: (value) => {
        const next = setSkillLine(getState(), id, value);
        if (next === getState()) return;
        setState(next);
        const i = this.ids.indexOf(id);
        const line = skillLineOf(next.skillLines, DEFAULT_SKILL_LINES, id);
        this.floatText(
          trainingLineButton(this.layout, i),
          line ? `「${line}」` : '已清除',
          '#3d5a94',
        );
      },
      onClose: () => this.publish(),
    });
    this.publish();
  }

  /** 特訓成功的回饋：按鈕上方飄一行「攻擊 +1」 */
  private floatText(b: Rect, text: string, color = '#2f7d32'): void {
    // 靠右的按鈕（升星）字比較長，往左收一點免得超出卡片
    const x = Math.min(b.x + b.width / 2, viewOf(this).w - 16 - text.length * 9);
    const t = addText(this, x, b.y - 6, text, 18, color, true).setOrigin(0.5);
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
        lineEditor: isTextPromptOpen(),
        boardingButton: {
          ...this.boardingButton,
          count: st.boarding.length,
          slots: boardingSlotCount(st),
        },
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
            boarding: st.boarding.some((b) => b.dogId === id),
            level: s.level,
            exp: s.exp,
            expNeed: s.expNeed,
            attack: s.attack,
            defense: s.defense,
            power: s.power,
            drill: { attack: info('attack'), defense: info('defense') },
            star: (() => {
              const c = checkStarUp(st, id);
              return {
                ...shift(buttons.star),
                star: c.star,
                shards: c.shards,
                cost: c.cost,
                enabled: c.ok,
              };
            })(),
            levelCap: s.levelCap,
            skillLine: {
              ...shift(trainingLineButton(this.layout, i)),
              skill: this.dog(id).skill.name,
              line: skillLineOf(st.skillLines, DEFAULT_SKILL_LINES, id),
              custom: !!st.skillLines[id],
            },
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
  if (c.reason === 'food') return `糧草 ${formatAmount(c.cost)}・差 ${formatAmount(c.short)}`;
  return `糧草 ${formatAmount(c.cost)}`;
}

/** 升星按鈕第二行：手上的碎片／需要的碎片，或已滿星 */
function starNote(c: StarCheck): string {
  return c.reason === 'maxed' ? '已滿星' : `碎片 ${c.shards}/${c.cost}`;
}
