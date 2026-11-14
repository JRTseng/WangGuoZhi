import Phaser from 'phaser';
import { COLORS } from '../../config';
import { findDog, type DogData } from '../../data/dogs';
import {
  ALL_FILTER,
  ROLE_KEYS,
  SORT_LABEL,
  STATUS_KEYS,
  STATUS_LABEL,
  listDogs,
  nextSort,
  roleKeyOf,
  sortOptions,
  type DogFilter,
  type RoleKey,
  type SortKey,
  type StatusKey,
} from '../../logic/dogFilter';
import { ROW_NAMES, type RowIndex } from '../../logic/battle';
import { TEAM_SIZE, busyDogIds } from '../../logic/expedition';
import {
  LANES,
  ROWS,
  battleRoleOf,
  teamCells,
  teamRows,
  type LaneIndex,
} from '../../logic/formation';
import type { Rect } from '../../logic/layout';
import { dogStats } from '../../logic/leveling';
import {
  clampScroll,
  gridCell,
  gridContentHeight,
  layoutPicker,
  maxScroll,
  type PickerLayout,
} from '../../logic/pickerLayout';
import { dogContext } from '../../logic/team';
import { TEAM_PRESET_NAMES } from '../../logic/teams';
import { getState } from '../../state/store';
import { addText, darken, viewOf } from '../ui';
import { drawDogHead } from './dogArt';
import { makeTapArea } from './hitArea';

export interface DogPickerOptions {
  /** team：組隊編排（列出全部狗，點卡片看資料）；expedition：出征選狗（點卡片選／取消） */
  mode: 'team' | 'expedition';
  /** 選狗區最上緣 */
  top: number;
  /** 卡片格最下緣 */
  bottom: number;
  /** 橫式左欄隊伍格最下緣 */
  slotsBottom?: number;
  /** 可以挑的狗 */
  dogs: () => readonly DogData[];
  /** 目前隊伍 */
  selected: () => readonly string[];
  /** 九宮格下面那行提示前面的說明（例如「隊伍 3/5・戰力 320」） */
  title: () => string;
  /** 五組隊伍的分頁：目前第幾組、每組幾隻、點了換組 */
  teams: {
    index: () => number;
    sizes: () => readonly number[];
    onSwitch: (index: number) => void;
  };
  onSlotTap: (dogId: string) => void;
  onCellTap: (dog: DogData) => void;
  onAuto: () => void;
  /**
   * 把一隻狗拖到九宮格的某一格（2026-11-14）：隊伍裡的狗是換位置，卡片格的狗是上陣。
   * 回傳提示文字表示沒成功（例如隊伍滿了），成功回 null。
   */
  onPlace: (dogId: string, row: RowIndex, lane: LaneIndex) => string | null;
  /** 有彈出視窗開著：九宮格與拖曳先不反應 */
  locked?: () => boolean;
  /** 每次重畫或捲動後呼叫，場景用來更新測試用的除錯資訊 */
  onUpdate?: () => void;
}

export interface PickerCellInfo extends Rect {
  id: string;
  owned: boolean;
  busy: boolean;
  selected: boolean;
  /** 整張卡片都在可見範圍內（沒被捲出去） */
  visible: boolean;
}

/** 卡片格的狗按住這麼久（毫秒）沒滑動就拿起來，可以拖到九宮格 */
const HOLD_MS = 260;
/** 九宮格上的狗、或卡片格橫著滑超過這個距離就拿起來 */
const LIFT_DISTANCE = 10;

/** 捲動超過這個距離才算拖曳，不然當成點擊 */
const DRAG_THRESHOLD = 8;

/**
 * 選狗元件（T015）：3×3 陣型九宮格 + 篩選列 + 可捲動的狗狗卡片格 + 一鍵自動編隊。
 * 九宮格（2026-11-14 Jimmy）：從卡片格按住狗拖到格子上就上陣並站那一格（格子上有狗就換人），
 * 九宮格上的狗可以拖到別格（有隊友就對調）、拖回卡片格或點一下就移出隊伍。
 * 組隊編排與出征選狗共用；篩選、排序、排版的規則都在 src/logic/。
 */
export class DogPicker {
  filter: DogFilter = { ...ALL_FILTER };
  sort: SortKey = 'power';
  layout!: PickerLayout;
  cells: PickerCellInfo[] = [];
  scrollY = 0;
  scrollMax = 0;

  private readonly layer: Phaser.GameObjects.Container;
  private grid: Phaser.GameObjects.Container | null = null;
  private maskShape: Phaser.GameObjects.Graphics | null = null;
  private readonly bar: Phaser.GameObjects.Graphics;
  private baseCells: (Omit<PickerCellInfo, 'visible'> & { baseY: number })[] = [];
  private dragFrom: { y: number; scroll: number } | null = null;
  private dragged = false;
  /** 這次按下去按到哪隻狗（九宮格上的或卡片格裡的），還沒拿起來 */
  private press: { id: string; from: 'board' | 'roster'; x: number; y: number } | null = null;
  private holdTimer: number | null = null;
  /** 拿在手上拖著的狗 */
  private lift: {
    id: string;
    from: 'board' | 'roster';
    ghost: Phaser.GameObjects.Container;
  } | null = null;
  /** 九宮格下面那行提示暫時換成的訊息（例如隊伍滿了） */
  private notice = '';

  /** 這次按下到放開之間有沒有拖曳捲動（有的話放開時不算點擊） */
  get wasDragged(): boolean {
    return this.dragged;
  }

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly o: DogPickerOptions,
  ) {
    // 卡片格（depth 0）捲動時會跑到篩選列、按鈕底下；其他東西都放在它上面，才不會被看不見的卡片擋住點擊
    this.layer = scene.add.container(0, 0).setDepth(1);
    this.bar = scene.add.graphics().setDepth(1);
    const input = scene.input;
    input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragged = false;
      this.dragFrom = this.inGrid(p) ? { y: p.y, scroll: this.scrollY } : null;
      this.startPress(p);
    });
    input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      if (this.lift) {
        this.lift.ghost.setPosition(p.x, p.y);
        return;
      }
      if (this.press) {
        const dx = p.x - this.press.x;
        const dy = p.y - this.press.y;
        const far = Math.hypot(dx, dy) >= LIFT_DISTANCE;
        // 九宮格上的狗一滑就拿起來；卡片格要橫著滑（直著滑是捲動）
        if (far && (this.press.from === 'board' || Math.abs(dx) > Math.abs(dy))) {
          this.startLift(p);
          return;
        }
        if (far) this.cancelPress();
      }
      if (!this.dragFrom) return;
      const dy = p.y - this.dragFrom.y;
      if (!this.dragged && Math.abs(dy) < DRAG_THRESHOLD) return;
      this.dragged = true;
      this.scrollTo(this.dragFrom.scroll - dy);
    });
    input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.dragFrom = null;
      if (this.lift) this.drop(p);
      else if (this.press?.from === 'board' && !this.dragged && !this.o.locked?.()) {
        // 點一下九宮格上的狗：移出隊伍
        const id = this.press.id;
        this.cancelPress();
        if (this.boardCellAt(p)?.id === id) this.o.onSlotTap(id);
        return;
      }
      this.cancelPress();
    });
    input.on('wheel', (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      if (this.inGrid(p)) this.scrollTo(this.scrollY + dy);
    });
  }

  /** 篩選、排序後目前列出的狗 */
  listed(): DogData[] {
    const st = getState();
    return listDogs(this.o.dogs(), this.filter, this.sort, dogContext(st));
  }

  scrollTo(y: number): void {
    const next = clampScroll(y, this.scrollMax);
    if (next === this.scrollY) return;
    this.scrollY = next;
    this.applyScroll();
    this.o.onUpdate?.();
  }

  render(): void {
    const { w, h, landscape } = viewOf(this.scene);
    const l = (this.layout = layoutPicker({
      w,
      h,
      landscape,
      top: this.o.top,
      bottom: this.o.bottom,
      slotsBottom: this.o.slotsBottom,
      roleCount: ROLE_KEYS.length + 1,
      statusCount: STATUS_KEYS.length + 1,
    }));
    const st = getState();
    const busy = busyDogIds(st);
    const selected = this.o.selected();
    this.layer.removeAll(true);

    // ---- 標題、自動編隊、隊伍格 ----
    const sizes = this.o.teams.sizes();
    l.teamTabs.forEach((r, i) =>
      this.chip(
        r,
        `${TEAM_PRESET_NAMES[i]}${sizes[i] ? ` ${sizes[i]}` : ''}`,
        this.o.teams.index() === i,
        () => {
          if (this.o.locked?.() || this.o.teams.index() === i) return;
          this.notice = '';
          this.o.teams.onSwitch(i);
        },
      ),
    );
    this.chip(l.autoButton, '⚡ 自動編隊', true, () => this.o.onAuto(), COLORS.harvest);
    this.drawBoard(l, selected);

    // ---- 篩選、排序 ----
    const roles: (RoleKey | 'all')[] = ['all', ...ROLE_KEYS];
    roles.forEach((key, i) =>
      this.chip(l.roleChips[i], key === 'all' ? '全部' : key, this.filter.role === key, () =>
        this.setFilter({ role: key }),
      ),
    );
    const statuses: (StatusKey | 'all')[] = ['all', ...STATUS_KEYS];
    statuses.forEach((key, i) =>
      this.chip(
        l.statusChips[i],
        key === 'all' ? '全部狀態' : STATUS_LABEL[key],
        this.filter.status === key,
        () => this.setFilter({ status: key }),
      ),
    );
    const sorts = sortOptions(this.o.dogs());
    if (!sorts.includes(this.sort)) this.sort = 'power';
    this.chip(l.sortChip, `排序：${SORT_LABEL[this.sort]}`, false, () => {
      this.sort = nextSort(this.sort, sorts);
      this.scrollY = 0;
      this.render();
    });

    // ---- 狗狗卡片格（可捲動） ----
    this.grid?.destroy();
    this.maskShape?.destroy();
    this.maskShape = this.scene.make.graphics({}, false);
    this.maskShape.fillStyle(0xffffff, 1).fillRect(l.grid.x, l.grid.y, l.grid.width, l.grid.height);
    this.grid = this.scene.add.container(0, 0);
    this.grid.setMask(this.maskShape.createGeometryMask());

    const dogs = this.listed();
    this.scrollMax = maxScroll(
      gridContentHeight(dogs.length, l.columns, l.cellHeight, l.gap),
      l.grid.height,
    );
    this.scrollY = clampScroll(this.scrollY, this.scrollMax);
    this.baseCells = dogs.map((d, i) => {
      const r = gridCell(i, l);
      const info = {
        id: d.id,
        owned: st.owned.includes(d.id),
        busy: busy.has(d.id),
        selected: selected.includes(d.id),
      };
      this.drawCell(d, r, info, st.lobbyDogId === d.id);
      return { ...info, ...r, baseY: r.y };
    });
    if (dogs.length === 0) {
      this.layer.add(
        addText(
          this.scene,
          l.grid.x + l.grid.width / 2,
          l.grid.y + Math.min(60, l.grid.height / 2),
          '沒有符合條件的狗狗\n點「全部」看所有狗狗',
          16,
          COLORS.inkSoft,
        )
          .setOrigin(0.5)
          .setAlign('center'),
      );
    }
    this.applyScroll();
    this.o.onUpdate?.();
  }

  /** 給 Playwright 用的除錯資訊 */
  debug(): NonNullable<WgzDebugState['picker']> {
    const l = this.layout;
    const roles = ['all', ...ROLE_KEYS];
    const statuses = ['all', ...STATUS_KEYS];
    return {
      filter: { role: this.filter.role, status: this.filter.status },
      sort: this.sort,
      roleChips: l.roleChips.map((r, i) => ({ key: roles[i], ...r })),
      statusChips: l.statusChips.map((r, i) => ({ key: statuses[i], ...r })),
      sortChip: l.sortChip,
      autoButton: l.autoButton,
      teamTabs: l.teamTabs.map((r, i) => ({ index: i, active: this.o.teams.index() === i, ...r })),
      teamIndex: this.o.teams.index(),
      slots: this.slotRects(),
      rows: teamRows(getState(), this.o.selected()),
      board: this.boardCells(),
      boardRows: l.boardRows,
      notice: this.notice,
      lifting: this.lift?.id ?? null,
      grid: l.grid,
      cells: this.cells,
      scrollY: this.scrollY,
      scrollMax: this.scrollMax,
    };
  }

  // ---- 內部 ----

  private setFilter(patch: Partial<DogFilter>): void {
    this.filter = { ...this.filter, ...patch };
    this.scrollY = 0;
    this.render();
  }

  private inGrid(p: Phaser.Input.Pointer): boolean {
    const g = this.layout?.grid;
    return !!g && p.x >= g.x && p.x <= g.x + g.width && p.y >= g.y && p.y <= g.y + g.height;
  }

  private applyScroll(): void {
    const g = this.layout.grid;
    if (this.grid) this.grid.y = -this.scrollY;
    this.cells = this.baseCells.map(({ baseY, ...c }) => {
      const y = baseY - this.scrollY;
      return { ...c, y, visible: y >= g.y - 0.5 && y + c.height <= g.y + g.height + 0.5 };
    });
    // 右側捲動條：放不下才出現
    this.bar.clear();
    if (this.scrollMax > 0) {
      const content = g.height + this.scrollMax;
      const bh = Math.max(24, (g.height * g.height) / content);
      const by = g.y + ((g.height - bh) * this.scrollY) / this.scrollMax;
      this.bar.fillStyle(COLORS.inkHex, 0.35);
      this.bar.fillRoundedRect(g.x + g.width + 4, by, 4, bh, 2);
    }
  }

  private chip(r: Rect, label: string, active: boolean, onTap: () => void, color?: number): void {
    const c = this.scene.add.container(r.x, r.y);
    const g = this.scene.add.graphics();
    const fill = active ? (color ?? COLORS.button) : COLORS.card;
    g.fillStyle(fill, 1);
    g.lineStyle(2, active ? fill : COLORS.cardBorder, 1);
    g.fillRoundedRect(0, 0, r.width, r.height, 12);
    g.strokeRoundedRect(0, 0, r.width, r.height, 12);
    c.add([
      g,
      addText(
        this.scene,
        r.width / 2,
        r.height / 2,
        label,
        14,
        active ? '#ffffff' : COLORS.ink,
        true,
      ).setOrigin(0.5),
    ]);
    makeTapArea(c, r.width, r.height);
    // 拖曳捲動後手指剛好放在按鈕上，不算點擊
    c.on('pointerup', () => {
      if (!this.dragged) onTap();
    });
    this.layer.add(c);
  }

  /** 九宮格每一格現在站誰（空格 id 為 null） */
  private boardCells(): ({ row: RowIndex; lane: LaneIndex; id: string | null } & Rect)[] {
    const selected = this.o.selected();
    const cells = teamCells(getState(), selected);
    const out: ({ row: RowIndex; lane: LaneIndex; id: string | null } & Rect)[] = [];
    for (const row of ROWS) {
      for (const lane of LANES) {
        const at = cells.findIndex((c) => c.row === row && c.lane === lane);
        out.push({
          row,
          lane,
          id: at >= 0 ? selected[at] : null,
          ...this.layout.boardCells[row][lane],
        });
      }
    }
    return out;
  }

  /** 照隊伍順序列出 5 個位置：有狗的是牠站的那一格，其餘是還空著的格子（測試用） */
  private slotRects(): ({ id: string | null } & Rect)[] {
    const board = this.boardCells();
    const free = board.filter((c) => !c.id);
    return Array.from({ length: TEAM_SIZE }, (_, i) => {
      const id = this.o.selected()[i] ?? null;
      const c = id ? board.find((x) => x.id === id)! : free.shift()!;
      return { id, x: c.x, y: c.y, width: c.width, height: c.height };
    });
  }

  private boardCellAt(p: { x: number; y: number }) {
    return this.boardCells().find(
      (c) => p.x >= c.x && p.x <= c.x + c.width && p.y >= c.y && p.y <= c.y + c.height,
    );
  }

  private drawBoard(l: PickerLayout, selected: readonly string[]): void {
    const g = this.scene.add.graphics();
    this.layer.add(g);
    for (const row of ROWS) {
      const r = l.boardRows[row];
      g.fillStyle(0xefe3cf, 1);
      g.lineStyle(2, COLORS.cardBorder, 1);
      g.fillRoundedRect(r.x, r.y, r.width, r.height, 10);
      g.strokeRoundedRect(r.x, r.y, r.width, r.height, 10);
      this.layer.add(
        addText(
          this.scene,
          l.boardLabels[row].x,
          l.boardLabels[row].y,
          ROW_NAMES[row],
          12,
          COLORS.inkSoft,
          true,
        ).setOrigin(0.5),
      );
    }
    for (const c of this.boardCells()) {
      const d = c.id ? findDog(c.id) : undefined;
      const lifted = !!d && this.lift?.id === d.id;
      g.fillStyle(d && !lifted ? COLORS.cardSelected : 0xf7efe0, 1);
      g.lineStyle(
        d && !lifted ? 3 : 2,
        d && !lifted ? COLORS.button : COLORS.cardBorder,
        d ? 1 : 0.6,
      );
      g.fillRoundedRect(c.x, c.y, c.width, c.height, 9);
      g.strokeRoundedRect(c.x, c.y, c.width, c.height, 9);
      if (!d || lifted) continue;
      if (c.height >= 64) {
        // 高的格子：頭在上、名字與定位在下
        const hr = Math.min(22, (c.height - 48) / 2);
        drawDogHead(g, c.x + c.width / 2, c.y + 7 + hr, hr, d.color, d.accent);
        this.layer.add([
          addText(
            this.scene,
            c.x + c.width / 2,
            c.y + c.height - 26,
            d.name,
            14,
            COLORS.ink,
            true,
          ).setOrigin(0.5),
          addText(
            this.scene,
            c.x + c.width / 2,
            c.y + c.height - 10,
            battleRoleOf(d.role) ?? '',
            11,
            '#b5651d',
          ).setOrigin(0.5),
        ]);
      } else {
        // 矮的格子：頭在左、名字在右
        const hr = Math.min(18, c.height / 2 - 6);
        drawDogHead(g, c.x + 8 + hr, c.y + c.height / 2 + 2, hr, d.color, d.accent);
        this.layer.add(
          addText(
            this.scene,
            c.x + 14 + hr * 2,
            c.y + c.height / 2,
            d.name,
            c.width >= 100 ? 15 : 12,
            COLORS.ink,
            true,
          ).setOrigin(0, 0.5),
        );
      }
    }
    const empty = selected.length === 0;
    this.layer.add(
      addText(
        this.scene,
        l.boardHint.x,
        l.boardHint.y,
        this.notice ||
          `${this.o.title()}・${empty ? '把狗狗拖到格子上' : '拖曳換位置・點一下移出'}`,
        12,
        this.notice ? '#b0413e' : COLORS.inkSoft,
        !!this.notice,
      ).setOrigin(0.5),
    );
  }

  // ---- 拖曳 ----

  private startPress(p: Phaser.Input.Pointer): void {
    this.cancelPress();
    if (this.o.locked?.() || !this.layout) return;
    const cell = this.boardCellAt(p);
    if (cell?.id) {
      this.press = { id: cell.id, from: 'board', x: p.x, y: p.y };
      return;
    }
    if (!this.inGrid(p)) return;
    const card = this.cells.find(
      (c) => p.x >= c.x && p.x <= c.x + c.width && p.y >= c.y && p.y <= c.y + c.height,
    );
    // 沒擁有、寄宿中的不能拿
    if (!card || !card.owned || card.busy) return;
    this.press = { id: card.id, from: 'roster', x: p.x, y: p.y };
    // 用真實時間算長按：Phaser 的計時器在畫面掉幀時會變慢，按起來忽長忽短
    this.holdTimer = window.setTimeout(() => {
      this.holdTimer = null;
      if (!this.scene.sys.isActive()) return;
      if (this.press && !this.dragged && !this.lift) this.startLift(this.scene.input.activePointer);
    }, HOLD_MS);
  }

  private cancelPress(): void {
    this.press = null;
    if (this.holdTimer !== null) window.clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }

  private startLift(p: Phaser.Input.Pointer): void {
    if (!this.press) return;
    const { id, from } = this.press;
    this.cancelPress();
    const d = findDog(id);
    if (!d) return;
    this.dragged = true;
    this.dragFrom = null;
    this.notice = '';
    const ghost = this.scene.add.container(p.x, p.y).setDepth(60);
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.card, 0.95);
    g.lineStyle(3, COLORS.button, 1);
    g.fillRoundedRect(-40, -40, 80, 80, 12);
    g.strokeRoundedRect(-40, -40, 80, 80, 12);
    drawDogHead(g, 0, -8, 22, d.color, d.accent);
    ghost.add([g, addText(this.scene, 0, 26, d.name, 14, COLORS.ink, true).setOrigin(0.5)]);
    this.lift = { id, from, ghost };
    this.render();
  }

  private drop(p: Phaser.Input.Pointer): void {
    const lift = this.lift!;
    this.lift = null;
    lift.ghost.destroy();
    const cell = this.boardCellAt(p);
    if (cell) {
      this.notice = this.o.onPlace(lift.id, cell.row, cell.lane) ?? '';
    } else if (lift.from === 'board' && this.inGrid(p)) {
      // 從九宮格拖回卡片格：移出隊伍
      this.o.onSlotTap(lift.id);
    }
    this.render();
  }

  private drawCell(
    d: DogData,
    r: Rect,
    s: { owned: boolean; busy: boolean; selected: boolean },
    isLobby: boolean,
  ): void {
    const expedition = this.o.mode === 'expedition';
    const c = this.scene.add.container(r.x, r.y);
    const g = this.scene.add.graphics();
    g.fillStyle(
      !s.owned ? darken(COLORS.card, 0.6) : s.selected ? COLORS.cardSelected : COLORS.card,
      1,
    );
    g.lineStyle(
      s.selected ? 4 : 2,
      s.selected ? COLORS.button : s.owned ? COLORS.cardBorder : 0x4a3e33,
      1,
    );
    g.fillRoundedRect(0, 0, r.width, r.height, 14);
    g.strokeRoundedRect(0, 0, r.width, r.height, 14);
    const hr = Math.min(30, r.height * 0.19);
    drawDogHead(g, r.width / 2, hr + 16, hr, d.color, d.accent, { dark: !s.owned });
    c.add(g);

    const nameY = hr * 2 + 22;
    c.add(
      addText(
        this.scene,
        r.width / 2,
        nameY,
        d.name,
        18,
        s.owned ? COLORS.ink : '#d8cbb8',
        true,
      ).setOrigin(0.5, 0),
    );
    c.add(
      addText(
        this.scene,
        r.width / 2,
        nameY + 24,
        s.owned
          ? `Lv.${dogStats(getState(), d).level}・戰力 ${dogStats(getState(), d).power}`
          : '未擁有',
        13,
        s.owned ? COLORS.inkSoft : '#b9a48c',
      ).setOrigin(0.5, 0),
    );
    if (r.height >= 140) {
      const tags = [d.rarity, roleKeyOf(d), d.size].filter(Boolean).join('・');
      c.add(
        addText(
          this.scene,
          r.width / 2,
          nameY + 44,
          tags,
          12,
          s.owned ? '#b5651d' : '#b9a48c',
        ).setOrigin(0.5, 0),
      );
    }

    const badges: [string, string][] = [];
    if (s.busy) badges.push(['寄宿中', '#8a6f55']);
    else if (s.selected) badges.push([expedition ? '✓ 已選' : '隊伍', '#b5651d']);
    if (!s.owned) badges.push(['🔒', '#4a3e33']);
    if (!expedition && isLobby) {
      c.add(
        addText(this.scene, 6, 6, '主頁', 12, '#ffffff', true)
          .setBackgroundColor('#4f8a3c')
          .setPadding(5, 2, 5, 2),
      );
    }
    badges.forEach(([t, bg], i) => {
      c.add(
        addText(this.scene, r.width - 6, 6 + i * 22, t, 12, '#ffffff', true)
          .setOrigin(1, 0)
          .setBackgroundColor(bg)
          .setPadding(5, 2, 5, 2),
      );
    });
    // 出征選狗：寄宿中的不能選，整張變淡
    if (expedition && s.busy) c.setAlpha(0.55);

    makeTapArea(c, r.width, r.height);
    c.on('pointerup', (p: Phaser.Input.Pointer) => {
      // 拖曳捲動中、或卡片被捲到可見範圍外，都不算點擊
      if (this.dragged || !this.inGrid(p)) return;
      this.o.onCellTap(d);
    });
    this.grid!.add(c);
  }
}
