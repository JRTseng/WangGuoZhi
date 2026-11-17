import { wt } from '../data/worldText';
import { playerFaction } from '../logic/faction';
import Phaser from 'phaser';
import { COLORS } from '../config';
import { DOGS } from '../data/dogs';
import { formatAmount, formatCountdown } from '../logic/format';
import type { Rect } from '../logic/layout';
import {
  SIGNIN_DAYS,
  claimSignin,
  setSigninPick,
  signinPickPool,
  signinRewardText,
  signinStreak,
  signinView,
  type SigninCell,
  type SigninReward,
} from '../logic/signin';
import { signinLayout, signinPickLayout, type SigninLayout } from '../logic/signinLayout';
import { shardsOf } from '../logic/star';
import { findSnack } from '../logic/snacks';
import { nextResetAt } from '../logic/stamina';
import { getState, setState, tick, timeOptions } from '../state/store';
import { Button } from './components/Button';
import { playSfx } from './components/audio';
import { drawDogHead } from './components/dogArt';
import { makeTapArea } from './components/hitArea';
import { addText, drawHeader, openModal, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
const REFRESH_MS = 500;
const DONE = 0x4f8a3c;
const DONE_TEXT = '#4f8a3c';
const GOLD = 0xd99a1c;
const FOOD = 0xf2c14e;
const BONE = 0xf5f0e6;
const OUTLINE = 0x8a6f55;

const SSR = 0xc0392b;
const WARN = '#b5651d';

type IconKind = 'food' | 'bones' | 'snack' | 'shards';

/**
 * 七日簽到（T026）：主頁右上「獎勵」進來。
 * 七張獎勵卡排成一列：領過的打勾、輪到的那張亮起來寫「今天」，下面一顆「簽到領取」。
 * 一天領一次（05:00 換日），要連續簽：漏一天就從第 1 天重來，領完第 7 天也從第 1 天再來。
 * 第 7 天送自選 SSR 碎片：點第 7 天那張卡選狗，隨時可以換；還沒選就按領取會先跳出來選。
 */
export class SigninScene extends Phaser.Scene {
  private layout!: SigninLayout;
  private body!: Phaser.GameObjects.Container;
  private countdown!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private toast: Phaser.GameObjects.Text | null = null;
  private picker: Phaser.GameObjects.Container | null = null;
  /** 上次畫的時候能不能領、累計幾天；變了才重畫 */
  private seen = '';

  constructor() {
    super('SigninScene');
  }

  create(): void {
    resetDebug(this);
    this.toast = null;
    this.picker = null;
    this.seen = '';
    const { w, h } = viewOf(this);
    this.layout = signinLayout(w, h, BAR, SIGNIN_DAYS);
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '每日簽到', () => this.scene.start('LobbyScene'), BAR);
    const L = this.layout;
    this.hint = addText(this, L.hint.x, L.hint.y, '', 14, COLORS.inkSoft).setOrigin(0.5);
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
    if (`${v.ready}:${v.total}:${v.index}:${v.pick}` !== this.seen) this.render();
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
    this.seen = `${v.ready}:${v.total}:${v.index}:${v.pick}`;
    const L = this.layout;
    this.body.removeAll(true);
    this.drawCountdown(v.ready);
    this.hint
      .setText(
        v.broken
          ? '上次沒有連續簽到，這一輪從第 1 天重新開始'
          : '每天簽到領獎勵，連續簽七天一輪・中間漏一天就從第 1 天重來',
      )
      .setColor(v.broken ? WARN : COLORS.inkSoft);
    const streak = signinStreak(st, Date.now(), timeOptions());

    v.cells.forEach((cell, i) => this.drawCard(cell, L.cards[i]));

    this.body.add(
      addText(
        this,
        L.total.x,
        L.total.y,
        `已連續 ${streak} 天・累計 ${formatAmount(v.total)} 天`,
        15,
        COLORS.ink,
        true,
      ).setOrigin(0, 0.5),
    );
    const needPick = v.ready && !!v.cells[v.index].reward.shards && !v.pick;
    const claim = new Button(
      this,
      L.claim,
      !v.ready ? '今天已簽到' : needPick ? wt('選狗狗領取') : `簽到領取（第 ${v.index + 1} 天）`,
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
        streak,
        broken: v.broken,
        pick: v.pick,
        picker: null,
        claim: { ...L.claim },
        cells: v.cells.map((c, i) => ({
          day: c.day,
          status: c.status,
          text: signinRewardText(c.reward),
          food: c.reward.food,
          bones: c.reward.bones,
          snack: c.reward.snack ? { ...c.reward.snack } : null,
          shards: c.reward.shards ? { ...c.reward.shards } : null,
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
    // 自選碎片：多一行告訴玩家點這張卡可以選
    if (cell.reward.shards && !claimed) {
      lines.push(cell.reward.shards.dogId ? '點這裡換一隻' : wt('點這裡選狗狗'));
    }
    const lineH = 17;
    const textTop = c.y + c.height - 34 - lines.length * lineH;
    lines.forEach((line, i) => {
      const tip = !!cell.reward.shards && i === lines.length - 1 && !claimed;
      const t = addText(
        this,
        cx,
        textTop + i * lineH,
        line,
        tip ? 12 : 13,
        tip ? WARN : COLORS.ink,
        !tip,
      ).setOrigin(0.5, 0);
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

    // 自選碎片那張卡整張可以點：選要哪隻 SSR 狗（領過了也能先選下一輪的）
    if (cell.reward.shards) {
      const zone = this.add.container(c.x, c.y);
      makeTapArea(zone, c.width, c.height);
      zone.on('pointerup', () => this.openPicker(false));
      this.body.add(zone);
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
    } else if (kind === 'shards') {
      // 自選 SSR 碎片：選了就畫那隻狗的頭，還沒選畫一個問號
      const dog = DOGS.find((d) => d.id === reward.shards?.dogId);
      g.fillStyle(0xfff6e8, 1);
      g.lineStyle(3, SSR, 1);
      g.fillCircle(x, y, s * 1.35);
      g.strokeCircle(x, y, s * 1.35);
      if (dog) drawDogHead(g, x, y + 2, s * 0.92, dog.color, dog.accent, { breed: dog.breed });
      else this.body.add(addText(this, x, y, '？', 26, '#c0392b', true).setOrigin(0.5));
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
    if (this.picker) return;
    const r = claimSignin(tick(), Date.now(), timeOptions());
    // 第 7 天還沒選狗：先選，選完直接領（少按一次）
    if (r.needPick) this.openPicker(true);
    if (!r.reward) return;
    setState(r.state);
    playSfx('levelup');
    this.render();
    this.showToast(`第 ${r.day} 天：${signinRewardText(r.reward)}`);
  }

  /** 選第 7 天要哪隻 SSR 狗的碎片。claimAfter：選完直接領今天的 */
  private openPicker(claimAfter: boolean): void {
    if (this.picker) return;
    const { w, h } = viewOf(this);
    const pool = signinPickPool(playerFaction(getState()));
    const P = signinPickLayout(w, h, pool.length);
    const st = getState();
    const close = (): void => {
      this.picker?.destroy();
      this.picker = null;
      if (window.__WGZ__?.signin) window.__WGZ__.signin.picker = null;
    };
    const { layer, box } = openModal(this, P.size, close, SSR);
    this.picker = layer;
    layer.add(
      addText(
        this,
        box.x + P.title.x,
        box.y + P.title.y,
        wt('第 7 天要哪隻 SSR 狗狗的碎片？'),
        17,
        COLORS.ink,
        true,
      ).setOrigin(0.5),
    );
    const x = this.add.container(box.x + P.close.x, box.y + P.close.y);
    x.add(
      addText(this, P.close.width / 2, P.close.height / 2, '✕', 20, COLORS.inkSoft, true).setOrigin(
        0.5,
      ),
    );
    makeTapArea(x, P.close.width, P.close.height);
    x.on('pointerup', close);
    layer.add(x);

    const g = this.add.graphics();
    layer.add(g);
    const cells = pool.map((d, i) => {
      const c = P.cells[i];
      const r: Rect = { x: box.x + c.x, y: box.y + c.y, width: c.width, height: c.height };
      const picked = st.signin.pick === d.id;
      const owned = st.owned.includes(d.id);
      const cx = r.x + r.width / 2;
      g.fillStyle(picked ? COLORS.cardSelected : 0xfff6e8, 1);
      g.lineStyle(picked ? 3 : 2, picked ? COLORS.button : COLORS.cardBorder, 1);
      g.fillRoundedRect(r.x, r.y, r.width, r.height, 12);
      g.strokeRoundedRect(r.x, r.y, r.width, r.height, 12);
      const hr = Math.min(26, (r.height - 50) / 2.4);
      drawDogHead(g, cx, r.y + 10 + hr * 1.15, hr, d.color, d.accent, { breed: d.breed });
      const name = addText(this, cx, r.y + r.height - 38, d.name, 14, COLORS.ink, true).setOrigin(
        0.5,
        0,
      );
      const sub = addText(
        this,
        cx,
        r.y + r.height - 20,
        picked ? '已選這隻' : owned ? `碎片 ${shardsOf(st, d.id)}` : '還沒有這隻',
        12,
        picked ? WARN : COLORS.inkSoft,
        picked,
      ).setOrigin(0.5, 0);
      const zone = this.add.container(r.x, r.y);
      makeTapArea(zone, r.width, r.height);
      zone.on('pointerup', () => {
        setState(setSigninPick(getState(), d.id));
        close();
        this.render();
        if (claimAfter) this.claim();
      });
      layer.add([name, sub, zone]);
      return { id: d.id, name: d.name, owned, picked, ...r };
    });
    if (window.__WGZ__?.signin) {
      window.__WGZ__.signin.picker = {
        cells,
        close: { x: box.x + P.close.x, y: box.y + P.close.y, width: 44, height: 44 },
      };
    }
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
  if (r.shards) kinds.push('shards');
  return kinds;
}
