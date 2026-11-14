import Phaser from 'phaser';
import { COLORS, RARITY_COLORS, rarityHex } from '../config';
import { DOGS, findDog, type DogData } from '../data/dogs';
import {
  GEAR_SLOTS,
  GEAR_SLOT_LABEL,
  findGear,
  type GearData,
  type GearSlot,
} from '../data/equipment';
import {
  DROP_RATE,
  equip,
  equipBest,
  gearBonusLabel,
  gearOf,
  ownedCount,
  ownedGears,
  spareCount,
  totalGear,
  unequip,
  wearersOf,
} from '../logic/equipment';
import { gearCard, gearLayout, gearScrollMax, type GearLayout } from '../logic/gearLayout';
import type { Rect } from '../logic/layout';
import { dogStats } from '../logic/leveling';
import { getState, setState } from '../state/store';
import { DogSprite } from './components/DogSprite';
import { drawGearIcon } from './components/gearArt';
import { makeTapArea } from './components/hitArea';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
/** 手指移動超過這個距離就當成捲動，不算點卡片 */
const TAP_SLOP = 8;
type Tab = 'all' | GearSlot;
const TABS: readonly Tab[] = ['all', ...GEAR_SLOTS];

export interface GearSceneData {
  /** 一進來先看哪隻狗；沒給就是主頁那隻 */
  dogId?: string;
  /** 按返回要回哪個畫面；沒給就回主頁 */
  back?: string;
}

/**
 * 倉庫（T014）：左邊是一隻狗（左右箭頭換狗）和牠的五個裝備格，右邊是擁有的裝備，可以依部位篩選。
 * 點右邊的裝備就穿上，再點一次脫下；沒有多的、被別隻狗穿走的，點了會從牠身上換過來。
 * 點左邊的裝備格會跳到那個部位的分頁。標題列右邊「一鍵穿上」幫這隻狗挑沒人穿的裡面最好的。
 */
export class GearScene extends Phaser.Scene {
  private layout!: GearLayout;
  private dogId = '';
  private backTo = 'LobbyScene';
  private tab: Tab = 'all';
  private scrollY = 0;
  private dragFrom: { x: number; y: number; scroll: number } | null = null;
  private left!: Phaser.GameObjects.Container;
  private tabsLayer!: Phaser.GameObjects.Container;
  private cards!: Phaser.GameObjects.Container;
  private items: GearData[] = [];
  private note = '';

  constructor() {
    super('GearScene');
  }

  init(data: GearSceneData): void {
    const st = getState();
    const want = data?.dogId ?? st.lobbyDogId;
    this.dogId = st.owned.includes(want) ? want : st.owned[0];
    this.backTo = data?.back ?? 'LobbyScene';
    this.tab = 'all';
    this.scrollY = 0;
    this.dragFrom = null;
    this.note = '';
  }

  create(): void {
    resetDebug(this);
    const { w, h } = viewOf(this);
    const l = (this.layout = gearLayout(w, h, BAR));
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '倉庫', () => this.scene.start(this.backTo));

    // 標題列右邊：一鍵穿上
    const ab = l.auto;
    const ac = this.add.container(ab.x, ab.y).setDepth(51);
    const ag = this.add.graphics();
    ag.fillStyle(COLORS.harvest, 1);
    ag.fillRoundedRect(0, 0, ab.width, ab.height, 12);
    ac.add([
      ag,
      addText(this, ab.width / 2, ab.height / 2, '一鍵穿上', 16, '#ffffff', true).setOrigin(0.5),
    ]);
    makeTapArea(ac, ab.width, ab.height);
    ac.on('pointerup', () => this.autoEquip());

    this.left = this.add.container(0, 0);
    this.tabsLayer = this.add.container(0, 0);
    this.cards = this.add.container(0, 0);
    const mask = this.make.graphics();
    mask.fillStyle(0xffffff, 1);
    mask.fillRect(l.list.x - 4, l.list.y, l.list.width + 8, l.list.height);
    this.cards.setMask(mask.createGeometryMask());

    // 清單上下拖曳或滾輪捲動；沒有拖動就當成點卡片
    const inList = (p: Phaser.Input.Pointer) =>
      p.x >= l.list.x && p.y >= l.list.y && p.y <= l.list.y + l.list.height;
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
      this.tapCard(p.x, p.y + this.scrollY);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) =>
      this.scrollTo(this.scrollY + dy),
    );

    patchDebug({ backButton: back });
    this.render();
  }

  private get dog(): DogData {
    return findDog(this.dogId) ?? DOGS[0];
  }

  /** 換到上一隻／下一隻擁有的狗 */
  private switchDog(step: number): void {
    const owned = DOGS.filter((d) => getState().owned.includes(d.id)).map((d) => d.id);
    const i = owned.indexOf(this.dogId);
    this.dogId = owned[(i + step + owned.length) % owned.length];
    this.note = '';
    this.render();
  }

  private setTab(tab: Tab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.scrollY = 0;
    this.render();
  }

  private autoEquip(): void {
    const st = getState();
    const next = equipBest(st, this.dogId);
    this.note = next === st ? '已經穿著手邊最好的了' : `${this.dog.name}換上手邊最好的裝備`;
    setState(next);
    this.render();
  }

  /** 點到哪張卡片：身上穿著的脫下，其他的穿上（y 已加上捲動量） */
  private tapCard(x: number, y: number): void {
    const i = this.items.findIndex((_, k) => {
      const r = gearCard(this.layout, k);
      return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
    });
    const g = this.items[i];
    if (!g) return;
    const st = getState();
    if (st.equipped[this.dogId]?.[g.slot] === g.id) {
      setState(unequip(st, this.dogId, g.slot));
      this.note = `脫下「${g.name}」`;
    } else {
      const r = equip(st, this.dogId, g.id);
      if (!r.ok) {
        if (r.error !== 'exclusive') return;
        this.note = `「${g.name}」是${findDog(g.exclusive ?? '')?.name ?? ''}的專屬裝備，別的狗穿不下`;
        this.render();
        return;
      }
      setState(r.state);
      const from = r.from ? findDog(r.from)?.name : undefined;
      this.note = from ? `從${from}身上換來「${g.name}」` : `「${g.name}」（${g.pun}）：${g.note}`;
    }
    this.render();
  }

  private scrollTo(y: number): void {
    const max = gearScrollMax(this.layout, this.items.length);
    const next = Math.min(max, Math.max(0, y));
    if (next === this.scrollY) return;
    this.scrollY = next;
    this.cards.y = -next;
    this.publish();
  }

  // ---- 畫面 ----

  private render(): void {
    this.renderLeft();
    this.renderTabs();
    this.renderCards();
    this.publish();
  }

  private panel(g: Phaser.GameObjects.Graphics, r: Rect, fill: number, border: number): void {
    g.fillStyle(fill, 1);
    g.lineStyle(2, border, 1);
    g.fillRoundedRect(r.x, r.y, r.width, r.height, 12);
    g.strokeRoundedRect(r.x, r.y, r.width, r.height, 12);
  }

  /** 左邊：狗狗、數字、五個裝備格 */
  private renderLeft(): void {
    const l = this.layout;
    const st = getState();
    const d = this.dog;
    const s = dogStats(st, d);
    const worn = gearOf(st, d.id);
    this.left.removeAll(true);
    const g = this.add.graphics();
    this.panel(g, l.pane, COLORS.card, COLORS.cardBorder);
    this.left.add(g);
    const cx = l.pane.x + l.pane.width / 2;

    // 左右箭頭
    for (const [r, label, step] of [
      [l.prev, '‹', -1],
      [l.next, '›', 1],
    ] as const) {
      const c = this.add.container(r.x, r.y);
      const ag = this.add.graphics();
      ag.fillStyle(COLORS.cardSelected, 1);
      ag.fillRoundedRect(0, 0, r.width, r.height, 10);
      c.add([
        ag,
        addText(this, r.width / 2, r.height / 2 - 2, label, 26, COLORS.ink, true).setOrigin(0.5),
      ]);
      makeTapArea(c, r.width, r.height);
      c.on('pointerup', () => this.switchDog(step));
      this.left.add(c);
    }

    const bonus = (n: number) => (n > 0 ? `（+${n}）` : '');
    this.left.add([
      addText(
        this,
        cx,
        l.pane.y + 8,
        `${d.name}\u3000Lv.${s.level}`,
        18,
        COLORS.ink,
        true,
      ).setOrigin(0.5, 0),
      addText(
        this,
        cx,
        l.pane.y + 32,
        `${d.rarity ?? ''}・戰力 ${s.power}`,
        13,
        d.rarity ? rarityHex(d.rarity) : COLORS.inkSoft,
        true,
      ).setOrigin(0.5, 0),
      addText(
        this,
        cx,
        l.pane.y + 52,
        `攻擊 ${s.attack}${bonus(s.gearAttack)}\u3000防禦 ${s.defense}${bonus(s.gearDefense)}`,
        14,
        COLORS.ink,
      ).setOrigin(0.5, 0),
      addText(this, cx, l.pane.y + 74, this.note, 12, '#b5651d')
        .setOrigin(0.5, 0)
        .setAlign('center')
        .setWordWrapWidth(l.pane.width - 20, true),
    ]);

    const sprite = new DogSprite(this, l.dog.x, l.dog.y, {
      color: d.color,
      accent: d.accent,
      gear: worn,
    });
    sprite.setScale(l.dog.scale);
    sprite.play('idle');
    this.left.add(sprite);

    // 五個裝備格
    GEAR_SLOTS.forEach((slot, i) => {
      const r = l.slots[i];
      const item = worn.find((x) => x.slot === slot);
      const c = this.add.container(r.x, r.y);
      const sg = this.add.graphics();
      sg.fillStyle(item ? 0xffffff : 0xefe3d0, 1);
      sg.lineStyle(
        this.tab === slot ? 3 : 2,
        item ? RARITY_COLORS[item.rarity] : COLORS.cardBorder,
        1,
      );
      sg.fillRoundedRect(0, 0, r.width, r.height, 10);
      sg.strokeRoundedRect(0, 0, r.width, r.height, 10);
      c.add(sg);
      if (item) drawGearIcon(sg, r.width / 2, r.height / 2, 17, item);
      else
        c.add(addText(this, r.width / 2, r.height / 2, '＋', 20, '#c9b79c', true).setOrigin(0.5));
      c.add(
        addText(
          this,
          r.width / 2,
          r.height + 3,
          GEAR_SLOT_LABEL[slot],
          12,
          this.tab === slot ? '#b5651d' : COLORS.inkSoft,
          this.tab === slot,
        ).setOrigin(0.5, 0),
      );
      makeTapArea(c, r.width, r.height + 18);
      c.on('pointerup', () => this.setTab(slot));
      this.left.add(c);
    });
  }

  /** 右邊上面：全部＋五個部位的分頁 */
  private renderTabs(): void {
    const st = getState();
    this.tabsLayer.removeAll(true);
    TABS.forEach((tab, i) => {
      const r = this.layout.tabs[i];
      const on = this.tab === tab;
      const n =
        tab === 'all'
          ? totalGear(st)
          : ownedGears(st, tab).reduce((s, g) => s + ownedCount(st, g.id), 0);
      const c = this.add.container(r.x, r.y);
      const g = this.add.graphics();
      g.fillStyle(on ? COLORS.button : COLORS.card, 1);
      g.lineStyle(2, on ? COLORS.button : COLORS.cardBorder, 1);
      g.fillRoundedRect(0, 0, r.width, r.height, 14);
      g.strokeRoundedRect(0, 0, r.width, r.height, 14);
      c.add([
        g,
        addText(
          this,
          r.width / 2,
          r.height / 2,
          `${tab === 'all' ? '全部' : GEAR_SLOT_LABEL[tab]} ${n}`,
          14,
          on ? '#ffffff' : COLORS.ink,
          true,
        ).setOrigin(0.5),
      ]);
      makeTapArea(c, r.width, r.height);
      c.on('pointerup', () => this.setTab(tab));
      this.tabsLayer.add(c);
    });
  }

  /** 右邊下面：裝備卡片 */
  private renderCards(): void {
    const l = this.layout;
    const st = getState();
    this.items = ownedGears(st, this.tab === 'all' ? undefined : this.tab);
    this.scrollY = Math.min(this.scrollY, gearScrollMax(l, this.items.length));
    this.cards.removeAll(true);
    this.cards.y = -this.scrollY;

    if (this.items.length === 0) {
      const cx = l.list.x + l.list.width / 2;
      const none = totalGear(st) === 0;
      this.cards.add([
        addText(
          this,
          cx,
          l.list.y + 96,
          none ? '倉庫還是空的' : `還沒有${GEAR_SLOT_LABEL[this.tab as GearSlot]}`,
          18,
          COLORS.inkSoft,
          true,
        ).setOrigin(0.5),
        addText(
          this,
          cx,
          l.list.y + 126,
          `出征打贏有 ${Math.round(DROP_RATE * 100)}% 機率撿到一件裝備，越後面的章節越容易撿到好東西`,
          13,
          COLORS.inkSoft,
        ).setOrigin(0.5),
      ]);
      return;
    }

    this.items.forEach((item, i) => {
      const r = gearCard(l, i);
      const mine = st.equipped[this.dogId]?.[item.slot] === item.id;
      const spare = spareCount(st, item.id);
      const others = wearersOf(st, item.id).filter((id) => id !== this.dogId);
      const c = this.add.container(r.x, r.y);
      const g = this.add.graphics();
      g.fillStyle(mine ? COLORS.cardSelected : COLORS.card, 1);
      g.lineStyle(2, RARITY_COLORS[item.rarity], 1);
      g.fillRoundedRect(0, 0, r.width, r.height, 12);
      g.strokeRoundedRect(0, 0, r.width, r.height, 12);
      g.fillStyle(0xffffff, 1);
      g.lineStyle(1.5, COLORS.cardBorder, 1);
      g.fillRoundedRect(8, 8, 48, 48, 8);
      g.strokeRoundedRect(8, 8, 48, 48, 8);
      drawGearIcon(g, 32, 32, 17, item);
      const owner = item.exclusive ? (findDog(item.exclusive)?.name ?? '') : '';
      const status = mine
        ? `${owner ? '專屬・' : ''}穿著中・點一下脫下`
        : item.exclusive && item.exclusive !== this.dogId
          ? `${owner}專屬・別的狗不能穿`
          : owner
            ? `${owner}專屬・點一下穿上`
            : spare > 0
              ? '點一下穿上'
              : `${findDog(others[0])?.name ?? ''}穿著・點一下換過來`;
      c.add([
        g,
        addText(this, 64, 7, item.name, 15, COLORS.ink, true),
        addText(
          this,
          r.width - 10,
          8,
          `×${ownedCount(st, item.id)}`,
          14,
          COLORS.inkSoft,
          true,
        ).setOrigin(1, 0),
        addText(this, 64, 27, item.rarity, 13, rarityHex(item.rarity), true),
        addText(
          this,
          64 + item.rarity.length * 9 + 6,
          27,
          item.pct
            ? gearBonusLabel(item)
            : `${GEAR_SLOT_LABEL[item.slot]}\u3000${gearBonusLabel(item)}`,
          item.pct ? 12 : 13,
          COLORS.ink,
        ),
        addText(this, 64, 45, status, 12, mine ? '#2f7d32' : COLORS.inkSoft, mine),
      ]);
      // 專屬裝備：圖示角落一顆星
      if (item.exclusive) {
        c.add(addText(this, 44, 4, '✦', 15, rarityHex(item.rarity), true).setStroke('#ffffff', 3));
      }
      this.cards.add(c);
    });
  }

  private publish(): void {
    const st = getState();
    const l = this.layout;
    const s = dogStats(st, this.dog);
    patchDebug({
      gear: {
        dogId: this.dogId,
        tab: this.tab,
        note: this.note,
        total: totalGear(st),
        stats: {
          attack: s.attack,
          defense: s.defense,
          power: s.power,
          gearAttack: s.gearAttack,
          gearDefense: s.gearDefense,
        },
        prev: l.prev,
        next: l.next,
        autoButton: l.auto,
        tabs: TABS.map((key, i) => ({ key, active: key === this.tab, ...l.tabs[i] })),
        slots: GEAR_SLOTS.map((slot, i) => ({
          slot,
          gearId: findGear(st.equipped[this.dogId]?.[slot] ?? '')?.id ?? null,
          ...l.slots[i],
        })),
        list: l.list,
        scrollY: this.scrollY,
        scrollMax: gearScrollMax(l, this.items.length),
        items: this.items.map((item, i) => {
          const r = gearCard(l, i);
          const y = r.y - this.scrollY;
          return {
            id: item.id,
            slot: item.slot,
            rarity: item.rarity,
            count: ownedCount(st, item.id),
            spare: spareCount(st, item.id),
            wearing: st.equipped[this.dogId]?.[item.slot] === item.id,
            exclusive: item.exclusive ?? null,
            visible: y >= l.list.y && y + r.height <= l.list.y + l.list.height + 0.5,
            ...r,
            y,
          };
        }),
      },
    });
  }
}
