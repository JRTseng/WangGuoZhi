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
import { busyDogIds } from '../../logic/expedition';
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
  /** 隊伍格上方的標題 */
  title: () => string;
  onSlotTap: (dogId: string) => void;
  onCellTap: (dog: DogData) => void;
  onAuto: () => void;
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

/** 捲動超過這個距離才算拖曳，不然當成點擊 */
const DRAG_THRESHOLD = 8;

/**
 * 選狗元件（T015）：5 個隊伍格 + 篩選列 + 可捲動的狗狗卡片格 + 一鍵自動編隊。
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
    });
    input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragFrom || !p.isDown) return;
      const dy = p.y - this.dragFrom.y;
      if (!this.dragged && Math.abs(dy) < DRAG_THRESHOLD) return;
      this.dragged = true;
      this.scrollTo(this.dragFrom.scroll - dy);
    });
    input.on('pointerup', () => (this.dragFrom = null));
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
    this.layer.add(
      addText(
        this.scene,
        l.title.x,
        l.title.y,
        this.o.title(),
        landscape ? 16 : 17,
        COLORS.ink,
        true,
      ),
    );
    this.chip(l.autoButton, '⚡ 自動編隊', true, () => this.o.onAuto(), COLORS.harvest);
    l.slots.forEach((r, i) => this.drawSlot(r, selected[i] ?? null, landscape));

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
      slots: l.slots.map((r, i) => ({ id: this.o.selected()[i] ?? null, ...r })),
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

  private drawSlot(r: Rect, id: string | null, landscape: boolean): void {
    const c = this.scene.add.container(r.x, r.y);
    const g = this.scene.add.graphics();
    g.fillStyle(id ? COLORS.cardSelected : 0xefe3cf, 1);
    g.lineStyle(id ? 3 : 2, id ? COLORS.button : COLORS.cardBorder, 1);
    g.fillRoundedRect(0, 0, r.width, r.height, 12);
    g.strokeRoundedRect(0, 0, r.width, r.height, 12);
    c.add(g);
    const d = id ? findDog(id) : undefined;
    if (d) {
      const hg = this.scene.add.graphics();
      if (landscape) {
        const hr = Math.min(20, r.height / 2 - 6);
        drawDogHead(hg, 14 + hr, r.height / 2 + 2, hr, d.color, d.accent);
        c.add([
          hg,
          addText(this.scene, 26 + hr * 2, r.height / 2, d.name, 17, COLORS.ink, true).setOrigin(
            0,
            0.5,
          ),
          addText(
            this.scene,
            r.width - 12,
            r.height / 2,
            `戰力 ${dogStats(getState(), d).power}`,
            14,
            COLORS.inkSoft,
          ).setOrigin(1, 0.5),
        ]);
      } else {
        drawDogHead(hg, r.width / 2, 34, Math.min(22, r.width / 2 - 8), d.color, d.accent);
        c.add([
          hg,
          addText(this.scene, r.width / 2, 72, d.name, 16, COLORS.ink, true).setOrigin(0.5),
        ]);
      }
      makeTapArea(c, r.width, r.height);
      c.on('pointerup', () => {
        if (!this.dragged) this.o.onSlotTap(d.id);
      });
    } else {
      c.add(
        addText(this.scene, r.width / 2, r.height / 2, '＋ 空位', 14, COLORS.inkSoft).setOrigin(
          0.5,
        ),
      );
    }
    this.layer.add(c);
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
    if (s.busy) badges.push(['出征中', '#8a6f55']);
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
    // 出征選狗：出征中的不能選，整張變淡
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
