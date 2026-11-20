import Phaser from 'phaser';
import { COLORS, RARITY_COLORS, rarityHex } from '../config';
import { findDog } from '../data/dogs';
import { GEAR_SLOT_LABEL, findGear } from '../data/equipment';
import { gearBonusLabel, ownedCount } from '../logic/equipment';
import { formatAmount, formatCountdown } from '../logic/format';
import {
  MALL_SLOTS,
  buyMall,
  mallBlock,
  mallGoods,
  mallPriceText,
  type MallGood,
} from '../logic/mall';
import { mallLayout, type MallCardLayout, type MallLayout } from '../logic/mallLayout';
import { findSnack, snackCount } from '../logic/snacks';
import { shardsOf } from '../logic/star';
import { nextResetAt } from '../logic/stamina';
import { setState, tick, timeOptions } from '../state/store';
import type { GameState } from '../state/gameState';
import { Button } from './components/Button';
import { playSfx } from './components/audio';
import { drawDogHead } from './components/dogArt';
import { drawGearIcon } from './components/gearArt';
import { headLook } from './components/headLook';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
const FREE = 0x4f8a3c;

/**
 * 商城（T039）：主頁右上「商城」進來。
 * 每天 05:00 換一批，一批六樣（每日禮物、零食、零食大包、角色碎片、稀有碎片、裝備），
 * 用糧草或骨頭幣買，每樣一天能買的次數有限。規則在 src/logic/mall.ts。
 */
export class MallScene extends Phaser.Scene {
  private layout!: MallLayout;
  private body!: Phaser.GameObjects.Container;
  private note!: Phaser.GameObjects.Text;
  private toast: Phaser.GameObjects.Text | null = null;
  private toastText = '';
  /** 畫面上這一批是哪一天的；換日了就重畫 */
  private day = '';

  constructor() {
    super('MallScene');
  }

  create(): void {
    resetDebug(this);
    this.toast = null;
    this.toastText = '';
    const { w, h } = viewOf(this);
    this.layout = mallLayout(w, h, BAR);
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '商城', () => this.scene.start('LobbyScene'), BAR);
    this.note = addText(this, this.layout.note.x, this.layout.note.y, '', 13, COLORS.inkSoft);
    this.body = this.add.container(0, 0);
    this.render();
    patchDebug({ backButton: back });
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.refreshClock() });
  }

  private refreshClock(): void {
    const now = Date.now();
    if (this.dayOf(now) !== this.day) this.render();
    else this.setNote(now);
  }

  private dayOf(now: number): string {
    return new Date(nextResetAt(now, timeOptions())).toISOString();
  }

  private setNote(now: number): void {
    const left = formatCountdown(nextResetAt(now, timeOptions()) - now);
    this.note.setText(`每天 05:00 換一批，一批 ${MALL_SLOTS.length} 樣・${left} 後換新`);
  }

  private render(): void {
    const now = Date.now();
    const st = tick(now);
    const L = this.layout;
    const goods = mallGoods(st, now, timeOptions());
    this.day = this.dayOf(now);
    this.body.removeAll(true);
    this.setNote(now);

    this.body.add(
      addText(
        this,
        L.note.right,
        L.note.y,
        `糧草 ${formatAmount(st.resources.food)}\u3000骨頭幣 ${formatAmount(st.resources.bones)}`,
        14,
        COLORS.ink,
        true,
      ).setOrigin(1, 0),
    );

    const g = this.add.graphics();
    this.body.add(g);
    const debug = goods.map((good, i) => {
      const c = L.cards[i];
      const block = mallBlock(st, good.slot, now, timeOptions());
      this.drawCard(g, c, good, st, block);
      return {
        ...c.buy,
        slot: good.slot,
        kind: good.kind,
        text: good.text,
        currency: good.currency,
        price: good.price,
        limit: good.limit,
        left: good.left,
        block,
      };
    });

    patchDebug({
      resources: { ...st.resources },
      mall: { goods: debug, toast: this.toastText },
    });
  }

  private drawCard(
    g: Phaser.GameObjects.Graphics,
    c: MallCardLayout,
    good: MallGood,
    st: GameState,
    block: ReturnType<typeof mallBlock>,
  ): void {
    const sold = good.left <= 0;
    const rarity = this.rarityOf(good);
    g.fillStyle(sold ? 0xe6dccb : COLORS.card, 1);
    g.lineStyle(2, rarity ? RARITY_COLORS[rarity] : COLORS.cardBorder, sold ? 0.5 : 1);
    g.fillRoundedRect(c.card.x, c.card.y, c.card.width, c.card.height, 12);
    g.strokeRoundedRect(c.card.x, c.card.y, c.card.width, c.card.height, 12);
    g.fillStyle(0xf4e9d8, 1);
    g.fillRoundedRect(c.icon.x, c.icon.y, c.icon.width, c.icon.height, 10);
    this.drawIcon(g, c, good, st);

    const t = c.text;
    const title = addText(this, t.x, t.y, good.title, 12, COLORS.inkSoft, true);
    const count = addText(
      this,
      t.x + t.width,
      t.y,
      `今日 ${good.left}/${good.limit}`,
      12,
      sold ? '#b9a48c' : COLORS.inkSoft,
    ).setOrigin(1, 0);
    const name = addText(this, t.x, t.y + 17, good.text, 16, COLORS.ink, true);
    if (name.width > t.width) name.setScale(t.width / name.width);
    const detail = addText(
      this,
      t.x,
      t.y + 39,
      this.detailOf(good, st),
      12,
      rarity ? rarityHex(rarity) : COLORS.inkSoft,
    );
    if (detail.width > t.width) detail.setScale(t.width / detail.width);

    const label = sold
      ? good.currency === 'free'
        ? '今天領過了'
        : '今天賣完了'
      : good.currency === 'free'
        ? '免費領取'
        : mallPriceText(good);
    const buy = new Button(this, c.buy, label, () => this.buy(good.slot), 17);
    buy.setColor(
      block === 'food' || block === 'bones'
        ? COLORS.buttonDisabled
        : good.currency === 'free'
          ? FREE
          : COLORS.button,
    );
    buy.setEnabled(!sold);
    this.body.add([title, count, name, detail, buy]);
  }

  private rarityOf(good: MallGood): keyof typeof RARITY_COLORS | null {
    if (good.item.kind === 'shards') return findDog(good.item.id)?.rarity ?? 'N';
    if (good.item.kind === 'gear') return findGear(good.item.id)?.rarity ?? 'N';
    return null;
  }

  /** 商品名字下面那行小字 */
  private detailOf(good: MallGood, st: GameState): string {
    const item = good.item;
    switch (item.kind) {
      case 'snack': {
        const exp = findSnack(item.id)?.exp ?? 0;
        return `每個經驗 +${formatAmount(exp)}・現在有 ${snackCount(st, item.id)} 個`;
      }
      case 'shards': {
        const dog = findDog(item.id);
        const have = st.owned.includes(item.id) ? '' : '・還沒有這隻';
        return `${dog?.rarity ?? 'N'}・現在有 ${shardsOf(st, item.id)} 片${have}`;
      }
      case 'gear': {
        const gear = findGear(item.id);
        if (!gear) return '';
        return `${gear.rarity}・${GEAR_SLOT_LABEL[gear.slot]}・${gearBonusLabel(gear)}・有 ${ownedCount(st, gear.id)} 件`;
      }
      default:
        return '每天可以領一次';
    }
  }

  private drawIcon(
    g: Phaser.GameObjects.Graphics,
    c: MallCardLayout,
    good: MallGood,
    st: GameState,
  ): void {
    const cx = c.icon.x + c.icon.width / 2;
    const cy = c.icon.y + c.icon.height / 2;
    const item = good.item;
    if (item.kind === 'shards') {
      const dog = findDog(item.id);
      if (!dog) return;
      drawDogHead(g, cx, cy + 2, 17, dog.color, dog.accent, {
        ...(st.owned.includes(dog.id) ? headLook(st, dog.id) : {}),
        breed: dog.breed,
        photo: dog.id,
      });
    } else if (item.kind === 'gear') {
      const gear = findGear(item.id);
      if (gear) drawGearIcon(g, cx, cy, 17, gear);
    } else if (item.kind === 'snack') {
      // 零食：個數多就畫三顆疊在一起
      const color = findSnack(item.id)?.color ?? 0xb9774a;
      const spots =
        item.amount >= 10
          ? [
              [-9, 6],
              [9, 6],
              [0, -8],
            ]
          : [[0, 0]];
      g.lineStyle(2, COLORS.inkHex, 1);
      for (const [dx, dy] of spots) {
        g.fillStyle(color, 1);
        g.fillCircle(cx + dx, cy + dy, 11);
        g.strokeCircle(cx + dx, cy + dy, 11);
        g.fillStyle(0xffffff, 0.3);
        g.fillCircle(cx + dx - 3, cy + dy - 4, 3);
      }
    } else {
      // 糧草：一袋穀子
      g.lineStyle(2, COLORS.inkHex, 1);
      g.fillStyle(0xf2c14e, 1);
      g.fillEllipse(cx, cy + 3, 30, 34);
      g.strokeEllipse(cx, cy + 3, 30, 34);
      g.fillStyle(0xb5651d, 1);
      g.fillRect(cx - 9, cy - 13, 18, 5);
    }
  }

  private buy(slot: number): void {
    const r = buyMall(tick(), slot, Date.now(), timeOptions());
    if (r.block || !r.good) {
      playSfx('tap');
      this.showToast(
        r.block === 'food' ? '糧草不夠' : r.block === 'bones' ? '骨頭幣不夠' : '今天賣完了',
        false,
      );
      this.render();
      return;
    }
    setState(r.state);
    playSfx('levelup');
    this.showToast(`${r.good.currency === 'free' ? '領取' : '買到'}：${r.good.text}`, true);
    this.render();
  }

  private showToast(text: string, good: boolean): void {
    this.toast?.destroy();
    this.toastText = text;
    const { w } = viewOf(this);
    const t = addText(this, w - 12, BAR / 2, text, 15, '#ffffff', true)
      .setOrigin(1, 0.5)
      .setPadding(14, 8, 14, 8)
      .setBackgroundColor(good ? '#4f8a3c' : '#a83a2b')
      .setDepth(60);
    this.toast = t;
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1600,
      duration: 400,
      onComplete: () => {
        if (this.toast === t) this.toast = null;
        t.destroy();
      },
    });
  }
}
