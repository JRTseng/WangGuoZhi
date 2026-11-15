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
import { countQuest } from '../logic/quests';
import { SNACKS, feedBlock, feedSnack, snackCount } from '../logic/snacks';
import { Button } from './components/Button';
import { checkStarUp, starReadyCount, starUp, starUpAll, type StarCheck } from '../logic/star';
import {
  TRAINING_SORT_LABEL,
  nextTrainingSort,
  sortTrainingDogs,
  type TrainingSortKey,
} from '../logic/trainingSort';
import {
  DRILL_LABELS,
  DRILL_MAX,
  DRILL_HOLD_DELAY_MS,
  DRILL_HOLD_REPEAT_MS,
  checkDrill,
  drill,
  type DrillCheck,
  type DrillStat,
} from '../logic/training';
import {
  trainingButtons,
  trainingLayout,
  trainingFeedButton,
  trainingLineButton,
  trainingRow,
  type TrainingLayout,
} from '../logic/trainingLayout';
import type { GameState } from '../state/gameState';
import { getState, setState, tick } from '../state/store';
import { playSfx } from './components/audio';
import { makeTapArea } from './components/hitArea';
import { drawDogHead } from './components/dogArt';
import { headLook } from './components/headLook';
import { drawExpBar, expLabel } from './components/ExpBar';
import { closeTextPrompt, isTextPromptOpen, openTextPrompt } from './components/TextPrompt';
import { addText, drawHeader, openModal, patchDebug, resetDebug, viewOf } from './ui';

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
const FEED_BUTTON_COLOR = 0xc0522b;

/**
 * 訓練場（T005、T020、T021、T007）：看每隻狗的等級、經驗條、攻防與升級累積的成長，
 * 可以花糧草做攻擊或防禦特訓（每次永久 +1），也可以花碎片升星（提高攻防與等級上限）。
 * 右上角進「板凳寄宿」。每張卡片右邊的「改台詞」可以替狗狗填放大絕招時喊的台詞（T017）。
 * 長按特訓按鈕會自動連續特訓，放開、練滿或糧草不夠就停。說明列右邊的「全部升星」一次把碎片夠的狗都升到不能再升。
 * 說明列右邊的「排序」按鈕可以換排序條件（稀有度、等級、戰力、可升星、定位），會記住上次選的。
 * 進場與換排序時才重排，特訓或升星後順序不變（免得按鈕跳走）；狗多了可以上下捲動。
 */
export class TrainingScene extends Phaser.Scene {
  private layout!: TrainingLayout;
  private rows!: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;
  private landscape = false;
  private scrollY = 0;
  private dragFrom: { x: number; y: number; scroll: number } | null = null;
  private ids: string[] = [];
  /** 餵零食的視窗；沒開為 null */
  private feed: {
    layer: Phaser.GameObjects.Container;
    dogId: string;
    level: number;
    exp: number;
    rows: { id: string; count: number; enabled: boolean; one: Rect; ten: Rect }[];
    close: Rect;
  } | null = null;
  private boardingButton!: Rect;
  private boardingLabel!: Phaser.GameObjects.Text;
  private seenDogs: GameState['dogs'] | null = null;
  private sortLabel!: Phaser.GameObjects.Text;
  private starAllBg!: Phaser.GameObjects.Graphics;
  private starAllLabel!: Phaser.GameObjects.Text;
  /** 長按連續特訓：按住的是哪一顆、計時器、已經自動練了幾次 */
  private hold: {
    index: number;
    stat: DrillStat;
    timer: Phaser.Time.TimerEvent;
    done: number;
  } | null = null;

  constructor() {
    super('TrainingScene');
  }

  create(): void {
    this.feed = null;
    resetDebug(this);
    this.scrollY = 0;
    this.dragFrom = null;
    this.hold = null;
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

    this.ids = this.sortedIds(st);
    const l = (this.layout = trainingLayout(w, h, landscape, this.ids.length, BAR));

    this.hint = addText(this, l.hint.x, l.hint.y, '', 14, COLORS.inkSoft).setOrigin(0, 0.5);

    // 說明列右邊：排序按鈕，點一下換下一種
    const sc = this.add.container(l.sortChip.x, l.sortChip.y);
    const sg = this.add.graphics();
    sg.fillStyle(COLORS.card, 1);
    sg.lineStyle(2, COLORS.cardBorder, 1);
    sg.fillRoundedRect(0, 0, l.sortChip.width, l.sortChip.height, 14);
    sg.strokeRoundedRect(0, 0, l.sortChip.width, l.sortChip.height, 14);
    this.sortLabel = addText(
      this,
      l.sortChip.width / 2,
      l.sortChip.height / 2,
      '',
      14,
      COLORS.ink,
      true,
    ).setOrigin(0.5);
    sc.add([sg, this.sortLabel]);
    makeTapArea(sc, l.sortChip.width, l.sortChip.height);
    sc.on('pointerup', () => this.cycleSort());

    // 排序左邊：全部升星（碎片夠的狗一次升到不能再升）
    const ac = this.add.container(l.starAllChip.x, l.starAllChip.y);
    this.starAllBg = this.add.graphics();
    this.starAllLabel = addText(
      this,
      l.starAllChip.width / 2,
      l.starAllChip.height / 2,
      '',
      14,
      '#ffffff',
      true,
    ).setOrigin(0.5);
    ac.add([this.starAllBg, this.starAllLabel]);
    makeTapArea(ac, l.starAllChip.width, l.starAllChip.height);
    ac.on('pointerup', () => this.starAll());

    this.rows = this.add.container(0, 0);
    const mask = this.make.graphics();
    mask.fillStyle(0xffffff, 1);
    mask.fillRect(l.list.x - 4, l.list.y, l.list.width + 8, l.list.height);
    this.rows.setMask(mask.createGeometryMask());
    this.renderRows();

    // 上下拖曳或滾輪捲動；沒有拖動就當成點按鈕
    const inList = (p: Phaser.Input.Pointer) => p.y >= l.list.y && p.y <= l.list.y + l.list.height;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragFrom = !this.feed && inList(p) ? { x: p.x, y: p.y, scroll: this.scrollY } : null;
      this.stopHold();
      if (this.dragFrom) this.startHold(p.x, p.y + this.scrollY);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragFrom || !p.isDown) return;
      const moved =
        Math.abs(p.x - this.dragFrom.x) > TAP_SLOP || Math.abs(p.y - this.dragFrom.y) > TAP_SLOP;
      // 還沒開始自動特訓就滑動：當成捲動。已經在連續特訓了就不捲，免得按鈕從手指下跑掉
      if (this.hold && this.hold.done > 0) return;
      if (moved) this.stopHold();
      this.scrollTo(this.dragFrom.scroll - (p.y - this.dragFrom.y));
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const from = this.dragFrom;
      this.dragFrom = null;
      // 長按已經自動練過了，放開時不再多算一次
      if (this.stopHold() > 0) return;
      if (!from || !inList(p)) return;
      if (Math.abs(p.x - from.x) > TAP_SLOP || Math.abs(p.y - from.y) > TAP_SLOP) return;
      this.tapAt(p.x, p.y + this.scrollY);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (!this.feed) this.scrollTo(this.scrollY + dy);
    });

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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopHold());
    this.input.on('gameout', () => this.stopHold());

    patchDebug({ backButton: back });
    this.publish();
  }

  private dog(id: string): DogData {
    return DOGS.find((x) => x.id === id)!;
  }

  /** 擁有的狗依目前選的排序條件排好 */
  private sortedIds(st: GameState): string[] {
    return sortTrainingDogs(
      DOGS.filter((d) => st.owned.includes(d.id)),
      st.settings.trainingSort,
      (d) => {
        const s = dogStats(st, d);
        const c = checkStarUp(st, d.id);
        return { level: s.level, power: s.power, star: s.star, shards: c.shards, starCost: c.cost };
      },
    ).map((d) => d.id);
  }

  /** 換下一種排序：記進設定、重排、捲回最上面 */
  private cycleSort(): void {
    if (this.blocked()) return;
    const st = tick();
    const sort: TrainingSortKey = nextTrainingSort(st.settings.trainingSort);
    setState({ ...st, settings: { ...st.settings, trainingSort: sort } });
    this.ids = this.sortedIds(getState());
    this.scrollY = 0;
    this.rows.y = 0;
    this.renderRows();
    this.publish();
  }

  /** 依目前狀態重畫整個列表（進場與每次特訓後） */
  private renderRows(): void {
    const st = getState();
    const l = this.layout;
    const landscape = this.landscape;
    const busy = busyDogIds(st);
    this.seenDogs = st.dogs;
    this.boardingLabel.setText(`寄宿 ${st.boarding.length}/${boardingSlotCount(st)} ›`);
    this.hint.setText(`糧草 ${formatAmount(st.resources.food)}・特訓永久 +1（長按連續練）`);
    this.sortLabel.setText(`排序：${TRAINING_SORT_LABEL[st.settings.trainingSort]}`);
    const ready = starReadyCount(st);
    this.starAllLabel.setText(ready > 0 ? `全部升星 ${ready}` : '全部升星');
    this.starAllBg.clear();
    this.starAllBg.fillStyle(ready > 0 ? STAR_BUTTON_COLOR : COLORS.buttonDisabled, 1);
    this.starAllBg.fillRoundedRect(0, 0, l.starAllChip.width, l.starAllChip.height, 14);
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
      drawDogHead(g, 16 + hr, top + gapY + 12, hr, d.color, d.accent, headLook(st, d.id));
      const lb = trainingLineButton(l, i);
      g.fillStyle(LINE_BUTTON_COLOR, 1);
      g.fillRoundedRect(lb.x - r.x, lb.y - r.y, lb.width, lb.height, 13);
      const fb = trainingFeedButton(l, i);
      g.fillStyle(FEED_BUTTON_COLOR, 1);
      g.fillRoundedRect(fb.x - r.x, fb.y - r.y, fb.width, fb.height, 13);
      const tx = 16 + hr * 2 + 14;
      const right = r.width - 14;
      const maxed = s.expNeed === 0;
      drawExpBar(g, tx, top + gapY * 2 + 22, right - tx, 8, s.exp / (s.expNeed || 1), maxed);
      let lv: Phaser.GameObjects.Text;
      let stars: Phaser.GameObjects.Text;
      let rest: Phaser.GameObjects.Text;
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
        (rest = addText(
          this,
          stars.x + stars.width,
          top + 3,
          '★'.repeat(STAR_MAX - s.star),
          13,
          '#d9cdbb',
          true,
        )),
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
          rest.x + rest.width + 6,
          top + 3,
          busy.has(d.id) ? '寄宿中' : '',
          13,
          '#2f7d32',
          true,
        ),
        // 「零食」小按鈕：餵經驗零食
        addText(
          this,
          fb.x - r.x + fb.width / 2,
          fb.y - r.y + fb.height / 2,
          '零食 ›',
          13,
          '#ffffff',
          true,
        ).setOrigin(0.5),
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
    if (this.blocked()) return;
    const hit = (b: Rect, padX = 0, padY = TAP_PAD) =>
      x >= b.x - padX && x <= b.x + b.width + padX && y >= b.y - padY && y <= b.y + b.height + padY;
    for (let i = 0; i < this.ids.length; i++) {
      if (hit(trainingLineButton(this.layout, i), LINE_TAP_PAD, LINE_TAP_PAD)) {
        this.editLine(this.ids[i]);
        return;
      }
      if (hit(trainingFeedButton(this.layout, i), 4, LINE_TAP_PAD)) {
        playSfx('tap');
        this.openFeed(this.ids[i]);
        return;
      }
      const buttons = trainingButtons(this.layout, i);
      for (const stat of STATS) {
        if (!hit(buttons[stat])) continue;
        this.drillOnce(i, stat);
        return;
      }
      if (hit(buttons.star)) {
        const r = starUp(tick(), this.ids[i], Date.now());
        if (!r.check.ok) return;
        setState(r.state);
        playSfx('levelup');
        this.renderRows();
        this.floatText(buttons.star, `升星！★${r.check.star + 1}`, '#b8860b');
        this.publish();
        return;
      }
    }
  }

  /** 打字視窗或餵零食視窗開著：下面的列表不能點、不能捲 */
  private blocked(): boolean {
    return isTextPromptOpen() || !!this.feed;
  }

  // ---- 餵零食 ----

  /** 開（或重畫）餵零食的視窗：三種零食各有「餵 1」「餵 10」 */
  private openFeed(dogId: string, message = ''): void {
    this.feed?.layer.destroy();
    const st = tick();
    const d = this.dog(dogId);
    const s = dogStats(st, d);
    const maxed = s.expNeed === 0;
    const { layer, box } = openModal(this, { width: 480, height: 318 }, () => this.closeFeed());
    const add = (o: Phaser.GameObjects.GameObject) => (layer.add(o), o);
    const g = this.add.graphics();
    add(g);
    drawDogHead(g, box.x + 44, box.y + 40, 24, d.color, d.accent, headLook(st, d.id));
    add(addText(this, box.x + 80, box.y + 16, `餵「${d.name}」吃零食`, 19, COLORS.ink, true));
    add(
      addText(
        this,
        box.x + 80,
        box.y + 42,
        maxed
          ? `Lv.${s.level}・已經到等級上限（升星可以再提高）`
          : `Lv.${s.level}・經驗 ${formatAmount(s.exp)} / ${formatAmount(s.expNeed)}`,
        14,
        COLORS.inkSoft,
      ),
    );
    if (message) {
      add(
        addText(this, box.x + box.width - 20, box.y + 18, message, 15, '#2f7d32', true).setOrigin(
          1,
          0,
        ),
      );
    }
    const rows = SNACKS.map((snack, i) => {
      const y = box.y + 76 + i * 58;
      const have = snackCount(st, snack.id);
      const ok = feedBlock(st, dogId, snack.id) === null;
      g.fillStyle(0xf4e9d8, 1);
      g.fillRoundedRect(box.x + 16, y, box.width - 32, 50, 12);
      g.fillStyle(snack.color, 1);
      g.fillCircle(box.x + 40, y + 25, 12);
      add(addText(this, box.x + 62, y + 6, snack.name, 16, COLORS.ink, true));
      add(
        addText(
          this,
          box.x + 62,
          y + 28,
          `經驗 +${formatAmount(snack.exp)}・有 ${have} 個`,
          13,
          COLORS.inkSoft,
        ),
      );
      const ten: Rect = { x: box.x + box.width - 26 - 84, y: y + 5, width: 84, height: 40 };
      const one: Rect = { x: ten.x - 8 - 72, y: y + 5, width: 72, height: 40 };
      add(
        new Button(this, one, '餵 1', () => this.feedOnce(dogId, snack.id, 1), 16).setEnabled(ok),
      );
      add(
        new Button(this, ten, '餵 10', () => this.feedOnce(dogId, snack.id, 10), 16).setEnabled(
          ok && have > 1,
        ),
      );
      return { id: snack.id, count: have, enabled: ok, one, ten };
    });
    const close: Rect = {
      x: box.x + box.width / 2 - 70,
      y: box.y + box.height - 54,
      width: 140,
      height: 40,
    };
    add(new Button(this, close, '關閉', () => this.closeFeed(), 17).setColor(COLORS.bar));
    this.feed = { layer, dogId, level: s.level, exp: s.exp, rows, close };
    this.publish();
  }

  private feedOnce(dogId: string, snackId: string, count: number): void {
    const r = feedSnack(tick(), dogId, snackId, count, Math.random);
    if (!r.gain) return;
    setState(r.state);
    const up = r.gain.toLevel > r.gain.fromLevel;
    playSfx(up ? 'levelup' : 'equip');
    this.renderRows();
    this.openFeed(dogId, up ? `升到 Lv.${r.gain.toLevel}！` : `經驗 +${formatAmount(r.gain.exp)}`);
  }

  private closeFeed(): void {
    this.feed?.layer.destroy();
    this.feed = null;
    this.publish();
  }

  /** 做一次特訓並播回饋；不能練（練滿、糧草不夠）回傳 false */
  private drillOnce(i: number, stat: DrillStat): boolean {
    const r = drill(getState(), this.ids[i], stat);
    if (!r.check.ok) return false;
    setState(countQuest(r.state, 'drill'));
    playSfx('equip');
    this.renderRows();
    this.floatText(trainingButtons(this.layout, i)[stat], `${DRILL_LABELS[stat]} +1`);
    this.publish();
    return true;
  }

  /** 手指按在特訓按鈕上：按住一下之後開始自動連續特訓（y 已加上捲動量） */
  private startHold(x: number, y: number): void {
    if (this.blocked()) return;
    for (let i = 0; i < this.ids.length; i++) {
      const buttons = trainingButtons(this.layout, i);
      for (const stat of STATS) {
        const b = buttons[stat];
        const inside =
          x >= b.x && x <= b.x + b.width && y >= b.y - TAP_PAD && y <= b.y + b.height + TAP_PAD;
        if (!inside || !checkDrill(getState(), this.ids[i], stat).ok) continue;
        const tickOnce = () => {
          if (this.drillOnce(i, stat)) hold.done++;
          else hold.timer.remove();
        };
        // 先等一下（分辨點一下和長按），之後固定間隔一直練
        const hold = {
          index: i,
          stat,
          done: 0,
          timer: this.time.delayedCall(DRILL_HOLD_DELAY_MS, () => {
            tickOnce();
            if (this.hold !== hold) return;
            hold.timer = this.time.addEvent({
              delay: DRILL_HOLD_REPEAT_MS,
              loop: true,
              callback: tickOnce,
            });
          }),
        };
        this.hold = hold;
        return;
      }
    }
  }

  /** 停止長按連續特訓；回傳這次長按自動練了幾次 */
  private stopHold(): number {
    const done = this.hold?.done ?? 0;
    this.hold?.timer.remove();
    this.hold = null;
    return done;
  }

  /** 全部升星：碎片夠的狗一次全部升到不能再升 */
  private starAll(): void {
    if (this.blocked()) return;
    const r = starUpAll(tick(), Date.now());
    if (r.ups.length === 0) return;
    setState(r.state);
    playSfx('levelup');
    this.renderRows();
    r.ups.forEach((u) => {
      const i = this.ids.indexOf(u.dogId);
      if (i >= 0) this.floatText(trainingButtons(this.layout, i).star, `升星！★${u.to}`, '#b8860b');
    });
    this.publish();
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
        feed: this.feed
          ? {
              dogId: this.feed.dogId,
              level: this.feed.level,
              exp: this.feed.exp,
              rows: this.feed.rows,
              close: this.feed.close,
            }
          : null,
        boardingButton: {
          ...this.boardingButton,
          count: st.boarding.length,
          slots: boardingSlotCount(st),
        },
        list: this.layout.list,
        sort: st.settings.trainingSort,
        sortChip: this.layout.sortChip,
        starAll: (() => {
          const ready = starReadyCount(st);
          return { ...this.layout.starAllChip, ready, enabled: ready > 0 };
        })(),
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
            feedButton: shift(trainingFeedButton(this.layout, i)),
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
