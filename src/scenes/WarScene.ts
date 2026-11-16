import Phaser from 'phaser';
import { COLORS } from '../config';
import { FACTION_NAMES, type Faction } from '../data/dogs';
import type { Resources } from '../data/resources';
import { needFactionPick, playerFaction } from '../logic/faction';
import { formatAmount } from '../logic/format';
import type { Rect } from '../logic/layout';
import { daysToReset } from '../logic/tower';
import {
  WAR_MILESTONES,
  WAR_POINTS,
  claimWarMilestones,
  claimWarResult,
  warAt,
  warClaimable,
  warResult,
  warScores,
} from '../logic/war';
import { getState, setState, timeOptions } from '../state/store';
import { Button } from './components/Button';
import { playSfx } from './components/audio';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
const TINT: Readonly<Record<Faction, { color: number; text: string }>> = {
  dog: { color: 0xb5651d, text: '#8a4a12' },
  cat: { color: 0x5a6fb0, text: '#3c4c86' },
};
const DONE = 0x4f8a3c;
const rewardText = (r: Resources): string =>
  `糧草 ${formatAmount(r.food)}・骨頭幣 ${formatAmount(r.bones)}`;

/**
 * 陣營積分戰（T030）：主頁帳號卡旁邊的陣營徽章進來。
 * 上面是汪國與喵國這週的總分（一條拔河一樣的長條），中間是自己的積分與怎麼賺，
 * 下面一排個人積分獎勵（一顆按鈕全領）。上週有參加的話，最上面會先出現上週的結果讓你領。
 * 右下角可以換陣營。全部單機：對面的分數是遊戲算的，規則在 src/logic/war.ts。
 */
export class WarScene extends Phaser.Scene {
  private body!: Phaser.GameObjects.Container;
  private toast: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('WarScene');
  }

  create(): void {
    resetDebug(this);
    this.toast = null;
    // 還沒選陣營：先去選
    if (needFactionPick(getState())) {
      this.scene.start('FactionScene');
      return;
    }
    const { w, h } = viewOf(this);
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '陣營積分戰', () => this.scene.start('LobbyScene'), BAR);
    this.body = this.add.container(0, 0);
    this.render();
    patchDebug({ backButton: back });
  }

  private render(): void {
    const { w, h } = viewOf(this);
    const now = Date.now();
    const o = timeOptions();
    const st = getState();
    const mine = playerFaction(st);
    const war = warAt(st, now, o);
    const scores = warScores(st, now, o);
    const result = warResult(st, now, o);
    const claimable = warClaimable(st, now, o);
    this.body.removeAll(true);
    const g = this.add.graphics();
    this.body.add(g);
    const put = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      this.body.add(obj);
      return obj;
    };
    const m = 20;
    let y = BAR + 10;

    // ---- 上週的結果（有才出現） ----
    let resultBtn: Rect | null = null;
    if (result) {
      const rh = 44;
      g.fillStyle(result.win ? 0xfff1c9 : 0xeee6da, 1);
      g.lineStyle(2, result.win ? 0xd99a1c : COLORS.cardBorder, 1);
      g.fillRoundedRect(m, y, w - m * 2, rh, 12);
      g.strokeRoundedRect(m, y, w - m * 2, rh, 12);
      const who = FACTION_NAMES[result.faction];
      put(
        addText(
          this,
          m + 14,
          y + rh / 2,
          `上週${who}${result.win ? '贏了！' : '輸了，下週再來'}（${formatAmount(result.scores[result.faction])} 比 ${formatAmount(result.scores[result.faction === 'dog' ? 'cat' : 'dog'])}）・獎勵 ${rewardText(result.reward)}`,
          14,
          COLORS.ink,
          true,
        ).setOrigin(0, 0.5),
      );
      resultBtn = { x: w - m - 108, y: y + 5, width: 100, height: rh - 10 };
      put(new Button(this, resultBtn, '領取', () => this.claimResult(), 17));
      y += rh + 8;
    }

    // ---- 兩邊的總分 ----
    const total = Math.max(1, scores.dog + scores.cat);
    const barX = m;
    const barW = w - m * 2;
    const barH = 30;
    put(
      addText(this, barX, y, `汪國 ${formatAmount(scores.dog)}`, 18, TINT.dog.text, true).setOrigin(
        0,
        0,
      ),
    );
    put(
      addText(
        this,
        barX + barW,
        y,
        `${formatAmount(scores.cat)} 喵國`,
        18,
        TINT.cat.text,
        true,
      ).setOrigin(1, 0),
    );
    put(
      addText(
        this,
        w / 2,
        y + 2,
        `${FACTION_NAMES[scores.leader]}領先・${daysToReset(now, o)} 天後結算`,
        14,
        COLORS.inkSoft,
      ).setOrigin(0.5, 0),
    );
    y += 26;
    // 差距通常很小，長條把差距放大十倍來畫，看得出誰領先
    const share = Math.min(0.9, Math.max(0.1, 0.5 + ((scores.dog - scores.cat) / total) * 10));
    g.fillStyle(TINT.cat.color, 1);
    g.fillRoundedRect(barX, y, barW, barH, barH / 2);
    g.fillStyle(TINT.dog.color, 1);
    g.fillRoundedRect(barX, y, barW * share, barH, { tl: barH / 2, bl: barH / 2, tr: 0, br: 0 });
    g.fillStyle(0xffffff, 1);
    g.fillRect(barX + barW * share - 1.5, y - 3, 3, barH + 6);
    g.lineStyle(2, COLORS.inkHex, 0.5);
    g.strokeRoundedRect(barX, y, barW, barH, barH / 2);
    y += barH + 12;

    // ---- 自己的積分 ----
    const cardH = result ? 60 : 78;
    g.fillStyle(COLORS.card, 1);
    g.lineStyle(2, TINT[mine].color, 1);
    g.fillRoundedRect(m, y, barW, cardH, 14);
    g.strokeRoundedRect(m, y, barW, cardH, 14);
    put(
      addText(
        this,
        m + 16,
        y + (result ? 7 : 10),
        `我為${FACTION_NAMES[mine]}賺的積分`,
        14,
        COLORS.inkSoft,
      ),
    );
    put(
      addText(
        this,
        m + 16,
        y + (result ? 26 : 28),
        formatAmount(war.points),
        result ? 22 : 26,
        TINT[mine].text,
        true,
      ),
    );
    put(
      addText(
        this,
        m + 190,
        y + cardH / 2,
        `出征打贏 +${WAR_POINTS.win}・打輸 +${WAR_POINTS.lose}・爬塔過一層 +${WAR_POINTS.tower}\n自己的積分會直接加在自己陣營的總分上`,
        14,
        COLORS.ink,
      ).setOrigin(0, 0.5),
    );
    y += cardH + 10;

    // ---- 個人積分獎勵 ----
    const btnH = 44;
    const rowH = h - y - btnH - 22;
    const n = WAR_MILESTONES.length;
    const gap = 8;
    const cw = (barW - gap * (n - 1)) / n;
    WAR_MILESTONES.forEach((ms, i) => {
      const x = m + i * (cw + gap);
      const got = war.claimed.includes(i);
      const can = claimable.includes(i);
      g.fillStyle(got ? 0xe4eedc : can ? 0xfff1c9 : COLORS.card, 1);
      g.lineStyle(2, got ? DONE : can ? 0xd99a1c : COLORS.cardBorder, 1);
      g.fillRoundedRect(x, y, cw, rowH, 12);
      g.strokeRoundedRect(x, y, cw, rowH, 12);
      put(
        addText(this, x + cw / 2, y + 8, `${ms.points} 分`, 16, COLORS.ink, true).setOrigin(0.5, 0),
      );
      put(
        addText(
          this,
          x + cw / 2,
          y + (rowH < 84 ? 28 : 30),
          rowH < 84
            ? `糧草 ${formatAmount(ms.reward.food)}・骨頭幣 ${ms.reward.bones}`
            : `糧草 ${formatAmount(ms.reward.food)}\n骨頭幣 ${ms.reward.bones}`,
          rowH < 84 ? 12 : 13,
          COLORS.inkSoft,
        )
          .setOrigin(0.5, 0)
          .setAlign('center'),
      );
      put(
        addText(
          this,
          x + cw / 2,
          y + rowH - 8,
          got ? '已領' : can ? '可以領' : `還差 ${ms.points - war.points}`,
          13,
          got ? '#4f8a3c' : can ? '#b07a10' : COLORS.inkSoft,
          true,
        ).setOrigin(0.5, 1),
      );
    });
    y += rowH + 10;

    // ---- 按鈕 ----
    const switchBtn: Rect = { x: w - m - 150, y, width: 150, height: btnH };
    const claimBtn: Rect = { x: m, y, width: barW - 150 - 12, height: btnH };
    const claim = put(
      new Button(
        this,
        claimBtn,
        claimable.length ? `全部領取（${claimable.length}）` : '還沒有可以領的獎勵',
        () => this.claimMilestones(),
        19,
      ),
    );
    claim.setEnabled(claimable.length > 0);
    const sw = put(
      new Button(this, switchBtn, '換陣營', () => this.scene.start('FactionScene'), 18),
    );
    sw.setColor(0x8a6f55);

    patchDebug({
      war: {
        faction: mine,
        points: war.points,
        dog: scores.dog,
        cat: scores.cat,
        leader: scores.leader,
        claimed: [...war.claimed],
        claimable,
        hasResult: !!result,
        claim: claimBtn,
        result: resultBtn,
        switch: switchBtn,
      },
    });
  }

  private claimMilestones(): void {
    const r = claimWarMilestones(getState(), Date.now(), timeOptions());
    if (!r.reward) return;
    playSfx('tap');
    setState(r.state);
    this.render();
    this.showToast(`領到 ${rewardText(r.reward)}`);
  }

  private claimResult(): void {
    const r = claimWarResult(getState(), Date.now(), timeOptions());
    if (!r.reward) return;
    playSfx('tap');
    setState(r.state);
    this.render();
    this.showToast(`領到 ${rewardText(r.reward)}`);
  }

  private showToast(text: string): void {
    const { w, h } = viewOf(this);
    this.toast?.destroy();
    const t = addText(this, w / 2, h / 2, text, 17, '#ffffff', true)
      .setOrigin(0.5)
      .setPadding(16, 10, 16, 10)
      .setBackgroundColor('#3b2a1a')
      .setDepth(100);
    this.toast = t;
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1400,
      duration: 400,
      onComplete: () => {
        if (this.toast === t) this.toast = null;
        t.destroy();
      },
    });
  }
}
