import Phaser from 'phaser';
import { COLORS, RARITY_COLORS, rarityHex } from '../config';
import { findDog, type DogData } from '../data/dogs';
import {
  GACHA_MAX_PULLS,
  GACHA_RATES,
  RARITIES,
  collection,
  featuredDogs,
  pull,
  pullsToPity,
  type PullItem,
} from '../logic/gacha';
import { grantExclusives, totalGear } from '../logic/equipment';
import type { Rect } from '../logic/layout';
import {
  RESULT_SUMMARY_HEIGHT,
  recruitLayout,
  resultCells,
  type RecruitLayout,
} from '../logic/recruitLayout';
import { getState, setState } from '../state/store';
import { Button } from './components/Button';
import { drawDogHead } from './components/dogArt';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
const BANNER_COLOR = 0xa83a2b;
const BANNER_EDGE = 0xe8c26a;
/** 結果卡片一張接一張跳出來的間隔 */
const REVEAL_STEP_MS = 90;

/**
 * 召募（抽卡，T007）：主頁「召募」進來。
 * 上面是看板（主打的狗、機率、保底），中間顯示這次抽到的狗，下面兩顆按鈕抽 1 隻或 10 隻。
 * 抽到沒有的狗就加入，重複的換成碎片（到訓練場升星）。規則在 src/logic/gacha.ts。
 * 目前不花資源、不限次數（Jimmy 2026-11-11），之後再接骨頭幣與每日免費。
 */
export class RecruitScene extends Phaser.Scene {
  private layout!: RecruitLayout;
  private landscape = false;
  private results!: Phaser.GameObjects.Container;
  private pityText!: Phaser.GameObjects.Text;
  private ownedText!: Phaser.GameObjects.Text;
  private items: PullItem[] = [];
  /** 這次召募附了幾件專屬裝備（T014） */
  private gifts = 0;
  private cells: Rect[] = [];
  /** 這次結果的卡片還有幾張沒跳完 */
  private revealing = 0;

  constructor() {
    super('RecruitScene');
  }

  create(): void {
    resetDebug(this);
    this.items = [];
    this.cells = [];
    this.revealing = 0;
    const { w, h, landscape } = viewOf(this);
    this.landscape = landscape;
    const l = (this.layout = recruitLayout(w, h, landscape, BAR));
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '召募', () => this.scene.start('LobbyScene'));
    this.ownedText = addText(this, w - 14, BAR / 2, '', 15, COLORS.barText, true)
      .setOrigin(1, 0.5)
      .setDepth(51);

    this.drawBanner();
    this.results = this.add.container(0, 0);
    addText(
      this,
      l.note.x,
      l.note.y,
      '目前免費、不限次數・重複的狗會換成碎片',
      13,
      COLORS.inkSoft,
    ).setOrigin(0.5);
    new Button(this, l.buttons.one, '召募 1 次', () => this.doPull(1), 21);
    new Button(
      this,
      l.buttons.ten,
      `召募 ${GACHA_MAX_PULLS} 次`,
      () => this.doPull(GACHA_MAX_PULLS),
      21,
    ).setColor(BANNER_COLOR);

    patchDebug({ backButton: back });
    this.refreshTexts();
    this.renderResults(false);
  }

  /** 看板：標題、主打的三隻、機率與保底 */
  private drawBanner(): void {
    const b = this.layout.banner;
    const g = this.add.graphics();
    g.fillStyle(BANNER_COLOR, 1);
    g.lineStyle(3, BANNER_EDGE, 1);
    g.fillRoundedRect(b.x, b.y, b.width, b.height, 18);
    g.strokeRoundedRect(b.x, b.y, b.width, b.height, 18);
    const cx = b.x + b.width / 2;
    // 內容固定高度約 190，看板比較高時整塊往下置中
    const y0 = b.y + Math.max(0, (b.height - 190) / 2);
    addText(this, cx, y0 + 10, '汪國招賢榜', 22, '#fff6e8', true).setOrigin(0.5, 0);
    addText(this, cx, y0 + 40, '各路狗狗好漢，等你來召募', 13, '#f6d9b8').setOrigin(0.5, 0);

    const featured = featuredDogs(3);
    const step = Math.min(110, (b.width - 40) / featured.length);
    featured.forEach((d, i) => {
      const x = cx + (i - (featured.length - 1) / 2) * step;
      const y = y0 + 92;
      g.fillStyle(0xfff6e8, 1);
      g.lineStyle(3, RARITY_COLORS[d.rarity!], 1);
      g.fillCircle(x, y - 2, 31);
      g.strokeCircle(x, y - 2, 31);
      drawDogHead(g, x, y, 21, d.color, d.accent);
      addText(this, x, y + 32, `${d.rarity} ${d.name}`, 13, '#fff6e8', true).setOrigin(0.5, 0);
    });

    const small = this.landscape ? 12 : 13;
    const rates = [...RARITIES]
      .reverse()
      .map((r) => `${r} ${GACHA_RATES[r]}%`)
      .join('・');
    addText(this, cx, y0 + 148, rates, small, '#f6d9b8').setOrigin(0.5, 0);
    this.pityText = addText(this, cx, y0 + 168, '', small, '#ffe9a8', true).setOrigin(0.5, 0);
  }

  /** 保底倒數與收集數量（抽完會變） */
  private refreshTexts(): void {
    const st = getState();
    const c = collection(st.owned);
    this.ownedText.setText(`已擁有 ${c.owned}/${c.total}`);
    this.pityText.setText(
      `再 ${pullsToPity(st.gacha)} 抽內必出 SSR・${GACHA_MAX_PULLS} 連必出 SR 以上`,
    );
  }

  private doPull(count: number): void {
    const r = pull(getState(), count, Math.random);
    if (r.items.length === 0) return;
    // 新抽到的 SR、SSR 附專屬裝備（T014）
    const before = totalGear(r.state);
    const next = grantExclusives(r.state);
    this.gifts = totalGear(next) - before;
    setState(next);
    this.items = r.items;
    this.refreshTexts();
    this.renderResults(true);
  }

  /** 畫出這次抽到的狗；animate 時卡片一張一張跳出來 */
  private renderResults(animate: boolean): void {
    const l = this.layout;
    this.tweens.killTweensOf(this.results.list);
    this.results.removeAll(true);
    this.cells = resultCells(l, this.items.length);
    const cx = l.results.x + l.results.width / 2;

    if (this.items.length === 0) {
      const g = this.add.graphics();
      g.fillStyle(0xfbf3e6, 1);
      g.lineStyle(2, COLORS.cardBorder, 1);
      g.fillRoundedRect(l.results.x, l.results.y, l.results.width, l.results.height, 16);
      g.strokeRoundedRect(l.results.x, l.results.y, l.results.width, l.results.height, 16);
      this.results.add([
        g,
        addText(
          this,
          cx,
          l.results.y + l.results.height / 2 - 14,
          '按下面的按鈕召募狗狗',
          17,
          COLORS.ink,
          true,
        ).setOrigin(0.5),
        addText(
          this,
          cx,
          l.results.y + l.results.height / 2 + 16,
          '重複抽到的狗會換成碎片，到訓練場升星',
          13,
          COLORS.inkSoft,
        ).setOrigin(0.5),
      ]);
      this.revealing = 0;
      this.publish();
      return;
    }

    const fresh = this.items.filter((i) => i.isNew).length;
    const shards = this.items.reduce((s, i) => s + i.shards, 0);
    const parts = [
      fresh > 0 ? `新夥伴 ${fresh} 隻` : '',
      shards > 0 ? `碎片 +${shards}（到訓練場升星）` : '',
      this.gifts > 0 ? `專屬裝備 +${this.gifts}（到倉庫穿上）` : '',
    ].filter(Boolean);
    this.results.add(
      addText(
        this,
        cx,
        l.results.y + RESULT_SUMMARY_HEIGHT / 2,
        parts.join('・'),
        15,
        COLORS.ink,
        true,
      ).setOrigin(0.5),
    );

    const big = this.items.length === 1;
    this.revealing = animate ? this.items.length : 0;
    this.items.forEach((item, i) => {
      const dog = findDog(item.dogId);
      if (!dog) return;
      const card = this.drawCard(dog, item, this.cells[i], big);
      this.results.add(card);
      if (!animate) return;
      card.setScale(0.2).setAlpha(0);
      this.tweens.add({
        targets: card,
        scale: 1,
        alpha: 1,
        delay: i * REVEAL_STEP_MS,
        duration: 220,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.revealing = Math.max(0, this.revealing - 1);
          if (this.revealing === 0) this.publish();
        },
      });
    });
    this.publish();
  }

  /** 一張結果卡片（原點在卡片中心，方便縮放）：稀有度外框、頭像、名字、「NEW」或碎片 */
  private drawCard(
    d: DogData,
    item: PullItem,
    r: Rect,
    big: boolean,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(r.x + r.width / 2, r.y + r.height / 2);
    const x = -r.width / 2;
    const y = -r.height / 2;
    const color = RARITY_COLORS[item.rarity];
    const g = this.add.graphics();
    const rare = item.rarity === 'SSR' || item.rarity === 'SR';
    if (rare) {
      // 高稀有度：外面多一圈光暈
      g.fillStyle(color, 0.28);
      g.fillRoundedRect(x - 4, y - 4, r.width + 8, r.height + 8, 16);
    }
    g.fillStyle(item.rarity === 'SSR' ? 0xfff4d6 : COLORS.card, 1);
    g.lineStyle(rare ? 4 : 3, color, 1);
    g.fillRoundedRect(x, y, r.width, r.height, 12);
    g.strokeRoundedRect(x, y, r.width, r.height, 12);
    const hr = big ? 40 : Math.min(22, r.width * 0.3);
    const hy = y + (big ? 62 : 16 + hr * 1.25);
    drawDogHead(g, 0, hy, hr, d.color, d.accent);
    c.add(g);

    let ty = hy + hr + (big ? 14 : 8);
    const line = (s: string, size: number, col: string, bold: boolean, gap: number) => {
      c.add(addText(this, 0, ty, s, size, col, bold).setOrigin(0.5, 0));
      ty += gap;
    };
    line(d.name, big ? 24 : 16, COLORS.ink, true, big ? 32 : 20);
    line(item.rarity, big ? 16 : 13, rarityHex(item.rarity), true, big ? 22 : 17);
    if (big) line(`${d.size ?? ''}・${d.breed}`, 13, COLORS.inkSoft, false, 20);
    if (item.isNew) line('NEW!', big ? 16 : 13, '#c0392b', true, 0);
    else line(`碎片 +${item.shards}`, big ? 14 : 12, COLORS.inkSoft, false, 0);
    return c;
  }

  private publish(): void {
    const st = getState();
    const c = collection(st.owned);
    patchDebug({
      recruit: {
        buttons: this.layout.buttons,
        pulls: st.gacha.pulls,
        toPity: pullsToPity(st.gacha),
        owned: c.owned,
        total: c.total,
        revealing: this.revealing > 0,
        results: this.items.map((it, i) => ({ ...this.cells[i], ...it })),
      },
    });
  }
}
