import Phaser from 'phaser';
import { COLORS } from '../config';
import { formatAmount, formatCountdown } from '../logic/format';
import type { Rect } from '../logic/layout';
import {
  SIGNIN_DAYS,
  claimSignin,
  signinRewardText,
  signinView,
  type SigninCell,
  type SigninReward,
} from '../logic/signin';
import { signinLayout, type SigninLayout } from '../logic/signinLayout';
import { findSnack } from '../logic/snacks';
import { nextResetAt } from '../logic/stamina';
import { getState, setState, tick, timeOptions } from '../state/store';
import { Button } from './components/Button';
import { playSfx } from './components/audio';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
const REFRESH_MS = 500;
const DONE = 0x4f8a3c;
const DONE_TEXT = '#4f8a3c';
const GOLD = 0xd99a1c;
const FOOD = 0xf2c14e;
const BONE = 0xf5f0e6;
const OUTLINE = 0x8a6f55;

type IconKind = 'food' | 'bones' | 'snack';

/**
 * 七日簽到（T026）：主頁右上「獎勵」進來。
 * 七張獎勵卡排成一列：領過的打勾、輪到的那張亮起來寫「今天」，下面一顆「簽到領取」。
 * 一天領一次（05:00 換日），漏簽不會歸零，領完第 7 天從第 1 天再來。
 */
export class SigninScene extends Phaser.Scene {
  private layout!: SigninLayout;
  private body!: Phaser.GameObjects.Container;
  private countdown!: Phaser.GameObjects.Text;
  private toast: Phaser.GameObjects.Text | null = null;
  /** 上次畫的時候能不能領、累計幾天；變了才重畫 */
  private seen = '';

  constructor() {
    super('SigninScene');
  }

  create(): void {
    resetDebug(this);
    this.toast = null;
    this.seen = '';
    const { w, h } = viewOf(this);
    this.layout = signinLayout(w, h, BAR, SIGNIN_DAYS);
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '每日簽到', () => this.scene.start('LobbyScene'), BAR);
    const L = this.layout;
    addText(
      this,
      L.hint.x,
      L.hint.y,
      '每天來簽到領獎勵，七天一輪・漏簽不會歸零，下次來接著領',
      14,
      COLORS.inkSoft,
    ).setOrigin(0.5);
    this.body = this.add.container(0, 0);
    this.countdown = addText(this, L.countdown.x, L.countdown.y, '', 14, COLORS.inkSoft).setOrigin(
      1,
      0.5,
    );
    tick();
    this.render();
    this.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.refresh() });
    patchDebug({ backButton: back });
  }

  /** 換日時「今天」會跳到下一格；倒數每次都更新 */
  private refresh(): void {
    const st = tick();
    const v = signinView(st, Date.now(), timeOptions());
    if (`${v.ready}:${v.total}` !== this.seen) this.render();
    else this.drawCountdown(v.ready);
  }

  private drawCountdown(ready: boolean): void {
    const now = Date.now();
    const left = formatCountdown(nextResetAt(now, timeOptions()) - now);
    const text = ready ? `今天的還沒領・${left} 後換日` : `下次簽到還有 ${left}`;
    if (this.countdown.text !== text) this.countdown.setText(text);
  }

  private render(): void {
    const st = getState();
    const v = signinView(st, Date.now(), timeOptions());
    this.seen = `${v.ready}:${v.total}`;
    const L = this.layout;
    this.body.removeAll(true);
    this.drawCountdown(v.ready);

    v.cells.forEach((cell, i) => this.drawCard(cell, L.cards[i]));

    this.body.add(
      addText(
        this,
        L.total.x,
        L.total.y,
        `累計簽到 ${formatAmount(v.total)} 天`,
        15,
        COLORS.ink,
        true,
      ).setOrigin(0, 0.5),
    );
    const claim = new Button(
      this,
      L.claim,
      v.ready ? `簽到領取（第 ${v.index + 1} 天）` : '今天已簽到',
      () => this.claim(),
      19,
    );
    claim.setColor(DONE).setEnabled(v.ready);
    this.body.add(claim);

    patchDebug({
      resources: { ...st.resources },
      signin: {
        ready: v.ready,
        index: v.index,
        total: v.total,
        claim: { ...L.claim },
        cells: v.cells.map((c, i) => ({
          day: c.day,
          status: c.status,
          text: signinRewardText(c.reward),
          food: c.reward.food,
          bones: c.reward.bones,
          snack: c.reward.snack ? { ...c.reward.snack } : null,
          ...L.cards[i],
        })),
      },
    });
  }

  private drawCard(cell: SigninCell, c: Rect): void {
    const today = cell.status === 'today';
    const claimed = cell.status === 'claimed';
    const big = cell.day === SIGNIN_DAYS;
    const cx = c.x + c.width / 2;
    const g = this.add.graphics();
    this.body.add(g);
    // 今天那張底下多一圈光
    if (today) {
      g.fillStyle(COLORS.button, 0.25);
      g.fillRoundedRect(c.x - 3, c.y - 3, c.width + 6, c.height + 6, 16);
    }
    g.fillStyle(today ? COLORS.cardSelected : big ? 0xfff3d0 : COLORS.card, 1);
    g.lineStyle(today ? 3 : 2, today ? COLORS.button : big ? GOLD : COLORS.cardBorder, 1);
    g.fillRoundedRect(c.x, c.y, c.width, c.height, 14);
    g.strokeRoundedRect(c.x, c.y, c.width, c.height, 14);
    // 標題底條
    g.fillStyle(today ? COLORS.button : big ? GOLD : COLORS.bar, claimed ? 0.45 : 1);
    g.fillRoundedRect(c.x + 8, c.y + 8, c.width - 16, 24, 12);
    this.body.add(
      addText(this, cx, c.y + 20, `第 ${cell.day} 天`, 14, '#ffffff', true).setOrigin(0.5),
    );

    // 圖示：一種就畫大的，好幾種排成一列
    const kinds = iconsOf(cell.reward);
    const size = kinds.length > 1 ? 13 : 20;
    const step = size * 2 + 6;
    const iy = c.y + 32 + (c.height - 32) * 0.3;
    kinds.forEach((k, i) => {
      const ix = cx + (i - (kinds.length - 1) / 2) * step;
      this.drawIcon(g, k, ix, iy, size, cell.reward);
    });

    // 獎勵文字，一種一行
    const lines = signinRewardText(cell.reward).split('・');
    const lineH = 17;
    const textTop = c.y + c.height - 34 - lines.length * lineH;
    lines.forEach((line, i) => {
      const t = addText(this, cx, textTop + i * lineH, line, 13, COLORS.ink, true).setOrigin(
        0.5,
        0,
      );
      if (t.width > c.width - 10) t.setScale((c.width - 10) / t.width);
      this.body.add(t);
    });

    // 狀態
    const sy = c.y + c.height - 16;
    if (claimed) {
      // 蓋一層淡淡的底，再打勾
      const veil = this.add.graphics();
      veil.fillStyle(COLORS.background, 0.55);
      veil.fillRoundedRect(c.x + 2, c.y + 2, c.width - 4, c.height - 4, 13);
      veil.fillStyle(DONE, 1);
      veil.fillCircle(cx, iy, 17);
      veil.lineStyle(4, 0xffffff, 1);
      veil.beginPath();
      veil.moveTo(cx - 8, iy);
      veil.lineTo(cx - 2, iy + 6);
      veil.lineTo(cx + 9, iy - 6);
      veil.strokePath();
      this.body.add(veil);
      this.body.add(addText(this, cx, sy, '已領取', 13, DONE_TEXT, true).setOrigin(0.5));
    } else if (today) {
      this.body.add(addText(this, cx, sy, '今天', 14, '#b5651d', true).setOrigin(0.5));
    } else if (big) {
      this.body.add(addText(this, cx, sy, '大獎', 13, '#b07a10', true).setOrigin(0.5));
    }
  }

  private drawIcon(
    g: Phaser.GameObjects.Graphics,
    kind: IconKind,
    x: number,
    y: number,
    s: number,
    reward: SigninReward,
  ): void {
    g.lineStyle(2, OUTLINE, 1);
    if (kind === 'food') {
      // 一袋糧草：袋子＋束口
      g.fillStyle(FOOD, 1);
      g.fillEllipse(x, y + s * 0.15, s * 1.5, s * 1.6);
      g.strokeEllipse(x, y + s * 0.15, s * 1.5, s * 1.6);
      g.fillStyle(0xd99a1c, 1);
      g.fillRoundedRect(x - s * 0.4, y - s * 0.95, s * 0.8, s * 0.4, 3);
      g.strokeRoundedRect(x - s * 0.4, y - s * 0.95, s * 0.8, s * 0.4, 3);
    } else if (kind === 'bones') {
      // 骨頭幣：圓幣上一根骨頭
      g.fillStyle(GOLD, 1);
      g.fillCircle(x, y, s);
      g.strokeCircle(x, y, s);
      g.fillStyle(BONE, 1);
      const r = s * 0.2;
      for (const dx of [-1, 1]) {
        g.fillCircle(x + dx * s * 0.48, y - r * 0.9, r);
        g.fillCircle(x + dx * s * 0.48, y + r * 0.9, r);
      }
      g.fillRect(x - s * 0.48, y - r * 0.8, s * 0.96, r * 1.6);
    } else {
      // 零食：照零食的顏色畫一塊，加一點高光
      g.fillStyle(findSnack(reward.snack?.id ?? '')?.color ?? 0xb9774a, 1);
      g.fillRoundedRect(x - s, y - s * 0.65, s * 2, s * 1.3, s * 0.45);
      g.strokeRoundedRect(x - s, y - s * 0.65, s * 2, s * 1.3, s * 0.45);
      g.fillStyle(0xffffff, 0.3);
      g.fillRoundedRect(x - s * 0.7, y - s * 0.42, s * 1.0, s * 0.3, s * 0.15);
    }
  }

  private claim(): void {
    const r = claimSignin(tick(), Date.now(), timeOptions());
    if (!r.reward) return;
    setState(r.state);
    playSfx('levelup');
    this.render();
    this.showToast(`第 ${r.day} 天：${signinRewardText(r.reward)}`);
  }

  private showToast(text: string): void {
    this.toast?.destroy();
    const { w } = viewOf(this);
    // 放在標題列右邊，不蓋到獎勵卡
    const t = addText(this, w - 12, BAR / 2, text, 15, '#ffffff', true)
      .setOrigin(1, 0.5)
      .setPadding(14, 8, 14, 8)
      .setBackgroundColor('#4f8a3c')
      .setDepth(60);
    this.toast = t;
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 2200,
      duration: 400,
      onComplete: () => {
        if (this.toast === t) this.toast = null;
        t.destroy();
      },
    });
  }
}

function iconsOf(r: SigninReward): IconKind[] {
  const kinds: IconKind[] = [];
  if (r.food > 0) kinds.push('food');
  if (r.bones > 0) kinds.push('bones');
  if (r.snack) kinds.push('snack');
  return kinds;
}
