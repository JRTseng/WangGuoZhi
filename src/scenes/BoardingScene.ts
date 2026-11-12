import Phaser from 'phaser';
import { COLORS } from '../config';
import { DOGS, type DogData } from '../data/dogs';
import {
  BOARD_BLOCK_LABEL,
  board,
  boardingExpPerHour,
  boardingSlotCount,
  checkBoard,
  unboard,
  type BoardBlock,
} from '../logic/boarding';
import {
  boardingButton,
  boardingLayout,
  boardingRow,
  type BoardingLayout,
} from '../logic/boardingLayout';
import type { Rect } from '../logic/layout';
import { dogStats } from '../logic/leveling';
import type { GameState } from '../state/gameState';
import { getState, setState, tick, timeOptions } from '../state/store';
import { drawDogHead } from './components/dogArt';
import { drawExpBar, expLabel } from './components/ExpBar';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
/** 多久把寄宿經驗結算一次並更新畫面 */
const REFRESH_MS = 500;
/** 手指移動超過這個距離就當成捲動，不算點按鈕 */
const TAP_SLOP = 8;
/** 按鈕的點擊範圍上下各多留一點，手機比較好按 */
const TAP_PAD = 4;

/** 名單的排序：能寄宿的在前（等級低的先），隊伍裡與滿級的在後 */
function benchOrder(st: GameState): string[] {
  const boarded = new Set(st.boarding.map((s) => s.dogId));
  const rank = (b: BoardBlock | null) => (b === null || b === 'full' ? 0 : 1);
  return DOGS.filter((d) => st.owned.includes(d.id) && !boarded.has(d.id))
    .map((d) => ({ d, s: dogStats(st, d), r: rank(checkBoard(st, d.id)) }))
    .sort((a, b) => a.r - b.r || a.s.level - b.s.level || a.s.power - b.s.power)
    .map((x) => x.d.id);
}

/**
 * 板凳寄宿（T021）：訓練場底下的子畫面。
 * 上面是寄宿位（放了狗的顯示這次累積的經驗，可以接回），
 * 下面是還沒寄宿的狗，按「寄宿」放進空位；隊伍裡的狗不能放。
 * 經驗隨時間自己加，這裡每 0.5 秒更新一次數字。
 */
export class BoardingScene extends Phaser.Scene {
  private layout!: BoardingLayout;
  private fixed!: Phaser.GameObjects.Container;
  private rows!: Phaser.GameObjects.Container;
  private mask: Phaser.GameObjects.Graphics | null = null;
  private landscape = false;
  private scrollY = 0;
  private dragFrom: { x: number; y: number; scroll: number } | null = null;
  private ids: string[] = [];
  private seen: GameState | null = null;

  constructor() {
    super('BoardingScene');
  }

  create(): void {
    resetDebug(this);
    this.scrollY = 0;
    this.dragFrom = null;
    this.mask = null;
    const { w, h, landscape } = viewOf(this);
    this.landscape = landscape;
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '板凳寄宿', () => this.scene.start('TrainingScene'));
    this.fixed = this.add.container(0, 0);
    this.rows = this.add.container(0, 0);
    tick();
    this.render();

    // 上下拖曳或滾輪捲動名單；沒有拖動就當成點按鈕
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragFrom = { x: p.x, y: p.y, scroll: this.scrollY };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragFrom && p.isDown && this.inList(this.dragFrom.y)) {
        this.scrollTo(this.dragFrom.scroll - (p.y - this.dragFrom.y));
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const from = this.dragFrom;
      this.dragFrom = null;
      if (!from) return;
      if (Math.abs(p.x - from.x) > TAP_SLOP || Math.abs(p.y - from.y) > TAP_SLOP) return;
      this.tapAt(p.x, p.y);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) =>
      this.scrollTo(this.scrollY + dy),
    );
    this.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.refresh() });

    patchDebug({ backButton: back });
  }

  private inList(y: number): boolean {
    const l = this.layout.list;
    return y >= l.y && y <= l.y + l.height;
  }

  private dog(id: string): DogData {
    return DOGS.find((x) => x.id === id)!;
  }

  /** 定時結算；經驗或等級有變才重畫 */
  private refresh(): void {
    const st = tick();
    if (this.seen && st.boarding === this.seen.boarding && st.dogs === this.seen.dogs) return;
    this.render();
  }

  /** 依目前狀態重畫寄宿位與名單 */
  private render(): void {
    const st = getState();
    this.seen = st;
    const { w, h } = viewOf(this);
    const landscape = this.landscape;
    this.ids = benchOrder(st);
    const l = (this.layout = boardingLayout(w, h, landscape, this.ids.length, BAR));
    this.scrollY = Math.min(this.scrollY, l.scrollMax);
    this.fixed.removeAll(true);
    this.rows.removeAll(true);
    this.rows.y = -this.scrollY;

    const perHour = boardingExpPerHour(st, timeOptions());
    this.fixed.add(
      addText(
        this,
        l.hint.x,
        l.hint.y,
        `寄宿慢慢拿經驗，離線也算・每小時約 ${perHour}`,
        14,
        COLORS.inkSoft,
      ).setOrigin(0.5),
    );

    // ---- 寄宿位 ----
    const open = boardingSlotCount(st);
    const g = this.add.graphics();
    this.fixed.add(g);
    l.slots.forEach((r, i) => {
      const slot = st.boarding[i];
      if (i >= open) {
        this.drawEmptySlot(g, r, '🔒 打贏第 1 章 Boss 開放', true);
      } else if (!slot) {
        this.drawEmptySlot(g, r, this.ids.length > 0 ? '空位・從下面選一隻狗' : '空位', false);
      } else {
        const d = this.dog(slot.dogId);
        const note = `+${slot.exp} 經驗${slot.levels > 0 ? `・升 ${slot.levels} 級` : ''}`;
        this.drawDogCard(this.fixed, g, r, d, st, note, '接回', 0x8a6f55, true);
      }
    });
    this.fixed.add(
      addText(
        this,
        l.listTitle.x,
        l.listTitle.y,
        `板凳上的狗（寄宿位 ${st.boarding.length}/${open}）`,
        landscape ? 13 : 14,
        COLORS.ink,
        true,
      ),
    );

    // ---- 名單（可捲動） ----
    this.mask?.destroy();
    this.mask = this.make.graphics();
    this.mask.fillStyle(0xffffff, 1);
    this.mask.fillRect(l.list.x - 4, l.list.y, l.list.width + 8, l.list.height);
    this.rows.setMask(this.mask.createGeometryMask());
    const rg = this.add.graphics();
    this.rows.add(rg);
    this.ids.forEach((id, i) => {
      const d = this.dog(id);
      const block = checkBoard(st, id);
      const s = dogStats(st, d);
      this.drawDogCard(
        this.rows,
        rg,
        boardingRow(l, i),
        d,
        st,
        expLabel(s.exp, s.expNeed),
        block ? BOARD_BLOCK_LABEL[block] : '寄宿',
        block ? COLORS.buttonDisabled : COLORS.harvest,
        false,
      );
    });
    if (this.ids.length === 0) {
      this.rows.add(
        addText(
          this,
          l.list.x + l.list.width / 2,
          l.list.y + 28,
          '所有的狗都在寄宿了',
          14,
          COLORS.inkSoft,
        ).setOrigin(0.5),
      );
    }
    this.publish();
  }

  private drawEmptySlot(
    g: Phaser.GameObjects.Graphics,
    r: Rect,
    label: string,
    locked: boolean,
  ): void {
    g.fillStyle(locked ? 0xe6d8c2 : 0xfbf3e6, 1);
    g.lineStyle(2, COLORS.cardBorder, locked ? 0.6 : 1);
    g.fillRoundedRect(r.x, r.y, r.width, r.height, 14);
    g.strokeRoundedRect(r.x, r.y, r.width, r.height, 14);
    this.fixed.add(
      addText(
        this,
        r.x + r.width / 2,
        r.y + r.height / 2,
        label,
        this.landscape ? 13 : 15,
        COLORS.inkSoft,
      ).setOrigin(0.5),
    );
  }

  /** 一張狗狗卡片：頭像、名字等級、第二行說明、右邊一顆按鈕。寄宿位多畫一條經驗條 */
  private drawDogCard(
    into: Phaser.GameObjects.Container,
    g: Phaser.GameObjects.Graphics,
    r: Rect,
    d: DogData,
    st: GameState,
    note: string,
    buttonLabel: string,
    buttonColor: number,
    withBar: boolean,
  ): void {
    const s = dogStats(st, d);
    g.fillStyle(COLORS.card, 1);
    g.lineStyle(2, withBar ? COLORS.harvest : COLORS.cardBorder, 1);
    g.fillRoundedRect(r.x, r.y, r.width, r.height, 14);
    g.strokeRoundedRect(r.x, r.y, r.width, r.height, 14);
    const hr = this.landscape ? 19 : 22;
    drawDogHead(g, r.x + 12 + hr, r.y + r.height / 2 + 2, hr, d.color, d.accent);
    const b = boardingButton(this.layout, r);
    g.fillStyle(buttonColor, 1);
    g.fillRoundedRect(b.x, b.y, b.width, b.height, 10);
    const tx = r.x + 12 + hr * 2 + 12;
    const top = r.y + (withBar ? 9 : (r.height - 42) / 2);
    into.add([
      addText(this, tx, top, d.name, 17, COLORS.ink, true),
      addText(this, tx + 17 * d.name.length + 8, top + 2, `Lv.${s.level}`, 15, '#b5651d', true),
      addText(
        this,
        b.x + b.width / 2,
        b.y + b.height / 2,
        buttonLabel,
        15,
        '#ffffff',
        true,
      ).setOrigin(0.5),
    ]);
    if (withBar) {
      drawExpBar(g, tx, top + 27, b.x - tx - 12, 7, s.exp / (s.expNeed || 1), s.expNeed === 0);
      into.add(addText(this, tx, top + 38, note, this.landscape ? 12 : 13, '#2f7d32', true));
    } else {
      into.add(addText(this, tx, top + 24, note, 13, COLORS.inkSoft));
    }
  }

  /** 點到「接回」或「寄宿」按鈕（畫面座標） */
  private tapAt(x: number, y: number): void {
    const l = this.layout;
    const hit = (b: Rect, dy = 0) =>
      x >= b.x &&
      x <= b.x + b.width &&
      y + dy >= b.y - TAP_PAD &&
      y + dy <= b.y + b.height + TAP_PAD;
    const st = getState();
    for (let i = 0; i < st.boarding.length; i++) {
      if (!hit(boardingButton(l, l.slots[i]))) continue;
      setState(unboard(tick(), st.boarding[i].dogId, Date.now(), timeOptions()));
      this.render();
      return;
    }
    if (!this.inList(y)) return;
    for (let i = 0; i < this.ids.length; i++) {
      if (!hit(boardingButton(l, boardingRow(l, i)), this.scrollY)) continue;
      const r = board(tick(), this.ids[i], Date.now());
      if (r.block) return;
      setState(r.state);
      this.render();
      return;
    }
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
    const l = this.layout;
    const open = boardingSlotCount(st);
    const shift = (r: Rect): Rect => ({ ...r, y: r.y - this.scrollY });
    patchDebug({
      boarding: {
        open,
        perHour: boardingExpPerHour(st, timeOptions()),
        slots: l.slots.map((r, i) => {
          const slot = st.boarding[i];
          if (i >= open) return { ...r, state: 'locked' as const };
          if (!slot) return { ...r, state: 'empty' as const };
          const s = dogStats(st, this.dog(slot.dogId));
          return {
            ...r,
            state: 'dog' as const,
            id: slot.dogId,
            exp: slot.exp,
            levels: slot.levels,
            level: s.level,
            button: boardingButton(l, r),
          };
        }),
        list: l.list,
        scrollY: this.scrollY,
        scrollMax: l.scrollMax,
        rows: this.ids.map((id, i) => {
          const r = boardingRow(l, i);
          return {
            ...shift(r),
            id,
            level: dogStats(st, this.dog(id)).level,
            block: checkBoard(st, id),
            button: shift(boardingButton(l, r)),
          };
        }),
      },
    });
  }
}
