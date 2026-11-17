import type { GameState } from '../state/gameState';
import { wt } from '../data/worldText';
import Phaser from 'phaser';
import { COLORS, RARITY_COLORS, rarityHex } from '../config';
import { DOGS, findDog, type DogData } from '../data/dogs';
import {
  ACCESSORY_SLOTS,
  BASE_SLOTS,
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
  gearAtStar,
  gearBonusLabel,
  gearOf,
  gearStarOf,
  ownedCount,
  ownedGears,
  spareCount,
  totalGear,
  unequip,
  wearersOf,
} from '../logic/equipment';
import {
  GEAR_STAR_PANEL,
  gearCard,
  gearCardIcon,
  gearLayout,
  gearScrollMax,
  gearStarPanelButtons,
  type GearLayout,
} from '../logic/gearLayout';
import {
  checkGearStarUp,
  gearStarCostLabel,
  gearStarPreview,
  gearStarReadyCount,
  gearStarText,
  gearStarUp,
  gearStarUpAll,
} from '../logic/gearStar';
import type { Rect } from '../logic/layout';
import { dogStats } from '../logic/leveling';
import { getState, setState } from '../state/store';
import { playSfx } from './components/audio';
import { Button } from './components/Button';
import { DogSprite } from './components/DogSprite';
import { drawGearIcon } from './components/gearArt';
import { makeTapArea } from './components/hitArea';
import { addText, drawHeader, openModal, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
/** 手指移動超過這個距離就當成捲動，不算點卡片 */
const TAP_SLOP = 8;
/** 星星與升星按鈕的金色（和訓練場的升星按鈕同一個顏色） */
const STAR_COLOR = 0xc98a12;
const STAR_HEX = '#b8860b';
/** 分頁：全部、五個部位、飾品（頸飾與耳飾合在一頁，T032） */
type Tab = 'all' | GearSlot | 'acc';
const TABS: readonly Tab[] = ['all', ...BASE_SLOTS, 'acc'];
const tabOf = (slot: GearSlot): Tab => (ACCESSORY_SLOTS.includes(slot) ? 'acc' : slot);
const tabLabel = (tab: Tab): string =>
  tab === 'all' ? '全部' : tab === 'acc' ? '飾品' : GEAR_SLOT_LABEL[tab];

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
 * 裝備升星（T036）：點卡片左邊的圖示開升星視窗；標題列「全部升星」把多的同款一次吃掉、能升的都升。
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
  private starAllBg!: Phaser.GameObjects.Graphics;
  private starAllLabel!: Phaser.GameObjects.Text;
  /** 升星視窗；沒開為 null */
  private star: {
    layer: Phaser.GameObjects.Container;
    gearId: string;
    up: Rect;
    close: Rect;
    message: string;
  } | null = null;

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
    this.star = null;
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

    // 一鍵穿上左邊：全部升星（多的同款一次吃掉，能升的都升）
    const sb = l.starAll;
    const sc = this.add.container(sb.x, sb.y).setDepth(51);
    this.starAllBg = this.add.graphics();
    this.starAllLabel = addText(
      this,
      sb.width / 2,
      sb.height / 2,
      '',
      16,
      '#ffffff',
      true,
    ).setOrigin(0.5);
    sc.add([this.starAllBg, this.starAllLabel]);
    makeTapArea(sc, sb.width, sb.height);
    sc.on('pointerup', () => this.starAll());

    this.left = this.add.container(0, 0);
    this.tabsLayer = this.add.container(0, 0);
    this.cards = this.add.container(0, 0);
    const mask = this.make.graphics();
    mask.fillStyle(0xffffff, 1);
    mask.fillRect(l.list.x - 4, l.list.y, l.list.width + 8, l.list.height);
    this.cards.setMask(mask.createGeometryMask());

    // 清單上下拖曳或滾輪捲動；沒有拖動就當成點卡片
    const inList = (p: Phaser.Input.Pointer) =>
      p.worldX >= l.list.x && p.worldY >= l.list.y && p.worldY <= l.list.y + l.list.height;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragFrom =
        !this.star && inList(p) ? { x: p.worldX, y: p.worldY, scroll: this.scrollY } : null;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragFrom && p.isDown)
        this.scrollTo(this.dragFrom.scroll - (p.worldY - this.dragFrom.y));
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const from = this.dragFrom;
      this.dragFrom = null;
      if (!from || !inList(p)) return;
      if (Math.abs(p.worldX - from.x) > TAP_SLOP || Math.abs(p.worldY - from.y) > TAP_SLOP) return;
      this.tapCard(p.worldX, p.worldY + this.scrollY);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (!this.star) this.scrollTo(this.scrollY + dy);
    });

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

  /** 這個分頁裡有哪些裝備 */
  private gearsIn(st: GameState, tab: Tab): GearData[] {
    if (tab === 'all') return ownedGears(st);
    if (tab === 'acc') return ACCESSORY_SLOTS.flatMap((slot) => ownedGears(st, slot));
    return ownedGears(st, tab);
  }

  private setTab(tab: Tab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.scrollY = 0;
    this.render();
  }

  private autoEquip(): void {
    if (this.star) return;
    const st = getState();
    const next = equipBest(st, this.dogId);
    this.note = next === st ? '已經穿著手邊最好的了' : `${this.dog.name}換上手邊最好的裝備`;
    if (next !== st) playSfx('equip');
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
    // 點左邊的圖示：開升星視窗
    const icon = gearCardIcon(gearCard(this.layout, i));
    if (x <= icon.x + icon.width) {
      playSfx('tap');
      this.openStar(g.id);
      return;
    }
    const st = getState();
    if (st.equipped[this.dogId]?.[g.slot] === g.id) {
      setState(unequip(st, this.dogId, g.slot));
      this.note = `脫下「${g.name}」`;
    } else {
      const r = equip(st, this.dogId, g.id);
      if (!r.ok) {
        if (r.error !== 'exclusive') return;
        this.note = wt(
          `「${g.name}」是${findDog(g.exclusive ?? '')?.name ?? ''}的專屬裝備，別的狗穿不下`,
        );
        this.render();
        return;
      }
      setState(r.state);
      playSfx('equip');
      const from = r.from ? findDog(r.from)?.name : undefined;
      this.note = from
        ? `從${from}身上換來「${g.name}」`
        : `「${g.name}」（${g.pun}）：${wt(g.note)}`;
    }
    this.render();
  }

  // ---- 升星（T036） ----

  /** 全部升星：每種一般裝備，多的同款夠就一直升 */
  private starAll(): void {
    if (this.star) return;
    const r = gearStarUpAll(getState());
    if (r.ups.length === 0) {
      this.note = '沒有可以升星的裝備・同一款多拿幾件就能升';
      this.render();
      return;
    }
    setState(r.state);
    playSfx('levelup');
    const first = findGear(r.ups[0].gearId);
    this.note =
      r.ups.length === 1
        ? `「${first?.name ?? ''}」升到 ★${r.ups[0].to}`
        : `${r.ups.length} 種裝備升星了（「${first?.name ?? ''}」★${r.ups[0].to} 等）`;
    this.render();
  }

  /** 開（或重畫）升星視窗 */
  private openStar(gearId: string, message = ''): void {
    const item = findGear(gearId);
    if (!item) return;
    this.star?.layer.destroy();
    const st = getState();
    const check = checkGearStarUp(st, gearId);
    const preview = gearStarPreview(item, check.star);
    const { layer, box } = openModal(this, GEAR_STAR_PANEL, () => this.closeStar());
    const add = (o: Phaser.GameObjects.GameObject) => (layer.add(o), o);
    const g = this.add.graphics();
    add(g);
    g.fillStyle(0xffffff, 1);
    g.lineStyle(2, RARITY_COLORS[item.rarity], 1);
    g.fillRoundedRect(box.x + 18, box.y + 18, 64, 64, 10);
    g.strokeRoundedRect(box.x + 18, box.y + 18, 64, 64, 10);
    drawGearIcon(g, box.x + 50, box.y + 50, 23, item);
    const tx = box.x + 96;
    add(addText(this, tx, box.y + 16, item.name, 19, COLORS.ink, true));
    add(
      addText(
        this,
        tx,
        box.y + 42,
        `${item.rarity}・${GEAR_SLOT_LABEL[item.slot]}`,
        13,
        rarityHex(item.rarity),
        true,
      ),
    );
    add(addText(this, tx, box.y + 60, gearStarText(check.star), 20, STAR_HEX, true));
    if (message) {
      add(
        addText(this, box.x + box.width - 18, box.y + 18, message, 15, '#2f7d32', true).setOrigin(
          1,
          0,
        ),
      );
    }

    // 現在 → 下一星
    g.fillStyle(0xf4e9d8, 1);
    g.fillRoundedRect(box.x + 16, box.y + 94, box.width - 32, 82, 12);
    const lx = box.x + 28;
    add(addText(this, lx, box.y + 101, `現在\u3000${gearBonusLabel(preview.now)}`, 14, COLORS.ink));
    add(
      addText(
        this,
        lx,
        box.y + 123,
        preview.next
          ? `下一星\u3000${gearBonusLabel(preview.next)}`
          : '已經升到最高星，同款的每一件都是這個數字',
        14,
        preview.next ? '#2f7d32' : COLORS.inkSoft,
        !!preview.next,
      ),
    );
    if (check.cost) {
      const unit = check.cost.kind === 'copies' ? '件' : '';
      add(
        addText(
          this,
          lx,
          box.y + 147,
          `需要\u3000${gearStarCostLabel(item, check.cost)}（有 ${check.have}${unit}）`,
          14,
          check.short > 0 ? '#c0392b' : COLORS.ink,
          true,
        ),
      );
      if (check.cost.kind === 'copies') {
        add(
          addText(
            this,
            box.x + box.width - 28,
            box.y + 149,
            '穿著的與最後一件不會用掉',
            12,
            COLORS.inkSoft,
          ).setOrigin(1, 0),
        );
      }
    }

    const { up, close } = gearStarPanelButtons(box);
    add(
      new Button(
        this,
        up,
        check.reason === 'maxed' ? '已滿星' : check.short > 0 ? '材料不夠' : '升星',
        () => this.starOnce(gearId),
        18,
      )
        .setColor(STAR_COLOR)
        .setEnabled(check.ok),
    );
    add(new Button(this, close, '關閉', () => this.closeStar(), 18).setColor(COLORS.bar));
    this.star = { layer, gearId, up, close, message };
    this.publish();
  }

  private starOnce(gearId: string): void {
    const r = gearStarUp(getState(), gearId);
    if (!r.check.ok) return;
    setState(r.state);
    playSfx('levelup');
    const item = findGear(gearId);
    this.note = `「${item?.name ?? ''}」升到 ★${r.check.star + 1}`;
    this.render();
    this.openStar(gearId, `升星！★${r.check.star + 1}`);
  }

  private closeStar(): void {
    this.star?.layer.destroy();
    this.star = null;
    this.publish();
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
    const ready = gearStarReadyCount(getState());
    const sb = this.layout.starAll;
    this.starAllLabel.setText(ready > 0 ? `全部升星 ${ready}` : '全部升星');
    this.starAllBg.clear();
    this.starAllBg.fillStyle(ready > 0 ? STAR_COLOR : COLORS.buttonDisabled, 1);
    this.starAllBg.fillRoundedRect(0, 0, sb.width, sb.height, 12);
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
      c.on('pointerup', () => {
        if (!this.star) this.switchDog(step);
      });
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
      breed: d.breed,
      photo: d.id,
    });
    sprite.setScale(l.dog.scale);
    sprite.play('idle');
    this.left.add(sprite);

    // 五個裝備格＋兩個飾品格
    GEAR_SLOTS.forEach((slot, i) => {
      const r = l.slots[i];
      const item = worn.find((x) => x.slot === slot);
      const c = this.add.container(r.x, r.y);
      const sg = this.add.graphics();
      sg.fillStyle(item ? 0xffffff : 0xefe3d0, 1);
      sg.lineStyle(
        this.tab === tabOf(slot) ? 3 : 2,
        item ? RARITY_COLORS[item.rarity] : COLORS.cardBorder,
        1,
      );
      sg.fillRoundedRect(0, 0, r.width, r.height, 10);
      sg.strokeRoundedRect(0, 0, r.width, r.height, 10);
      c.add(sg);
      const slotStar = item ? gearStarOf(st, item.id) : 0;
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
          this.tab === tabOf(slot) ? '#b5651d' : COLORS.inkSoft,
          this.tab === tabOf(slot),
        ).setOrigin(0.5, 0),
      );
      if (slotStar > 0) {
        c.add(
          addText(this, r.width - 3, 1, `★${slotStar}`, 12, STAR_HEX, true)
            .setOrigin(1, 0)
            .setStroke('#ffffff', 3),
        );
      }
      makeTapArea(c, r.width, r.height + 18);
      c.on('pointerup', () => {
        if (!this.star) this.setTab(tabOf(slot));
      });
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
          : this.gearsIn(st, tab).reduce((s, g) => s + ownedCount(st, g.id), 0);
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
          `${tabLabel(tab)} ${n}`,
          14,
          on ? '#ffffff' : COLORS.ink,
          true,
        ).setOrigin(0.5),
      ]);
      makeTapArea(c, r.width, r.height);
      c.on('pointerup', () => {
        if (!this.star) this.setTab(tab);
      });
      this.tabsLayer.add(c);
    });
  }

  /** 右邊下面：裝備卡片 */
  private renderCards(): void {
    const l = this.layout;
    const st = getState();
    this.items = this.gearsIn(st, this.tab);
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
          none
            ? '倉庫還是空的'
            : this.tab === 'acc'
              ? '還沒有飾品・爬塔每 20 層送一件'
              : `還沒有${tabLabel(this.tab)}`,
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
      drawGearIcon(g, 32, 28, 15, item);
      // 圖示下緣一條「升星」：點圖示開升星視窗，材料夠的時候是金色
      const star = gearStarOf(st, item.id);
      const starCheck = checkGearStarUp(st, item.id);
      const at = gearAtStar(item, star);
      g.fillStyle(
        starCheck.ok ? STAR_COLOR : starCheck.reason === 'maxed' ? COLORS.harvest : 0x9a8c7a,
        1,
      );
      g.fillRoundedRect(8, 41, 48, 15, { tl: 0, tr: 0, bl: 8, br: 8 });
      const owner = item.exclusive ? (findDog(item.exclusive)?.name ?? '') : '';
      const status = mine
        ? `${owner ? '專屬・' : ''}穿著中・點一下脫下`
        : item.exclusive && item.exclusive !== this.dogId
          ? wt(`${owner}專屬・別的狗不能穿`)
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
          32,
          48.5,
          starCheck.reason === 'maxed' ? '滿星' : starCheck.ok ? '可升星' : '升星',
          12,
          '#ffffff',
          true,
        ).setOrigin(0.5),
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
            ? gearBonusLabel(at)
            : `${GEAR_SLOT_LABEL[item.slot]}\u3000${gearBonusLabel(at)}`,
          item.pct ? 12 : 13,
          COLORS.ink,
        ),
        addText(this, 64, 45, status, 12, mine ? '#2f7d32' : COLORS.inkSoft, mine),
      ]);
      // 升過星的：名字後面寫幾星
      if (star > 0) {
        const nameText = c.list[1] as Phaser.GameObjects.Text;
        c.add(addText(this, 64 + nameText.width + 5, 8, `★${star}`, 14, STAR_HEX, true));
      }
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
        starAllButton: l.starAll,
        starReady: gearStarReadyCount(st),
        starPanel: this.star
          ? {
              gearId: this.star.gearId,
              star: gearStarOf(st, this.star.gearId),
              ok: checkGearStarUp(st, this.star.gearId).ok,
              message: this.star.message,
              up: this.star.up,
              close: this.star.close,
            }
          : null,
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
            star: gearStarOf(st, item.id),
            canStar: checkGearStarUp(st, item.id).ok,
            icon: { ...gearCardIcon(r), y },
            visible: y >= l.list.y && y + r.height <= l.list.y + l.list.height + 0.5,
            ...r,
            y,
          };
        }),
      },
    });
  }
}
