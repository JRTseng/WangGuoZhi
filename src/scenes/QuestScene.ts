import Phaser from 'phaser';
import { COLORS } from '../config';
import type { Resources } from '../data/resources';
import {
  QUEST_TABS,
  QUEST_TAB_LABEL,
  claimAll,
  claimQuest,
  claimableCount,
  mainProgress,
  questList,
  rewardText,
  type QuestTab,
  type QuestView,
} from '../logic/quests';
import { questLayout, type QuestLayout } from '../logic/questLayout';
import { formatCountdown } from '../logic/format';
import type { Rect } from '../logic/layout';
import { nextResetAt } from '../logic/stamina';
import type { GameState } from '../state/gameState';
import { getState, setState, tick, timeOptions } from '../state/store';
import { Button } from './components/Button';
import { playSfx } from './components/audio';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
const REFRESH_MS = 500;
const DOT = 0xe0452b;
const DONE = 0x4f8a3c;

/** 上次看的分頁；從別的畫面回來時沿用 */
let lastTab: QuestTab | null = null;

/**
 * 任務（T011）：主頁左側「任務」進來。
 * 左邊分頁（主線／每日／成就，有獎勵可領就亮紅點）與「全部領取」，右邊是任務卡：
 * 完成的按「領取」，還沒完成的主線與每日任務按「前往」直接去做。
 */
export class QuestScene extends Phaser.Scene {
  private layout!: QuestLayout;
  private tab: QuestTab = 'main';
  private body!: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;
  private toast: Phaser.GameObjects.Text | null = null;
  private seen: GameState | null = null;

  constructor() {
    super('QuestScene');
  }

  create(): void {
    resetDebug(this);
    this.toast = null;
    this.seen = null;
    const { w, h } = viewOf(this);
    this.layout = questLayout(w, h, BAR, QUEST_TABS.length);
    this.add.rectangle(0, 0, w, h, COLORS.background).setOrigin(0, 0);
    const back = drawHeader(this, '任務', () => this.scene.start('LobbyScene'), BAR);
    this.body = this.add.container(0, 0);
    this.hint = addText(this, this.layout.hint.x, this.layout.hint.y, '', 14, COLORS.inkSoft);
    const st = tick();
    // 進來先看有獎勵可領的分頁；都沒有就留在上次看的
    this.tab = QUEST_TABS.find((t) => claimableCount(st, t) > 0) ?? lastTab ?? 'main';
    this.render();
    this.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.refresh() });
    patchDebug({ backButton: back });
  }

  /** 換日時每日任務會清空；倒數每次都更新 */
  private refresh(): void {
    const st = tick();
    if (st.quests !== this.seen?.quests) this.render();
    else this.drawHint(st);
  }

  private drawHint(st: GameState): void {
    let text: string;
    if (this.tab === 'main') {
      const p = mainProgress(st);
      text =
        p.claimed >= p.total
          ? '主線任務全部完成了！'
          : `跟著章節往前打・已完成 ${p.claimed} / ${p.total}`;
    } else if (this.tab === 'daily') {
      const now = Date.now();
      text = `每天 05:00 重新開始・還有 ${formatCountdown(nextResetAt(now, timeOptions()) - now)}`;
    } else {
      text = '慢慢累積，領完一段會換下一段';
    }
    if (this.hint.text !== text) this.hint.setText(text);
  }

  private render(): void {
    const st = getState();
    this.seen = st;
    lastTab = this.tab;
    const L = this.layout;
    this.body.removeAll(true);
    this.drawHint(st);

    // 分頁
    const tabDebug = {} as Record<QuestTab, WgzRect & { count: number }>;
    QUEST_TABS.forEach((t, i) => {
      const r = L.tabs[i];
      const count = claimableCount(st, t);
      const b = new Button(this, r, QUEST_TAB_LABEL[t], () => this.switchTab(t), 19);
      b.setColor(t === this.tab ? COLORS.button : COLORS.bar);
      this.body.add(b);
      if (count > 0) {
        this.body.add(
          this.add.circle(r.x + r.width - 6, r.y + 6, 7, DOT).setStrokeStyle(2, 0xffffff),
        );
      }
      tabDebug[t] = { ...r, count };
    });

    // 全部領取
    const total = claimableCount(st);
    const all = new Button(
      this,
      L.claimAll,
      total > 0 ? `全部領取 ${total}` : '全部領取',
      () => this.claimEverything(),
      17,
    );
    all.setColor(DONE).setEnabled(total > 0);
    this.body.add(all);

    // 任務卡
    const rows = questList(st, this.tab).slice(0, L.cards.length);
    rows.forEach((q, i) => this.drawCard(q, L.cards[i]));
    if (rows.length === 0) {
      const c = L.cards[0];
      this.body.add(addText(this, c.x + 8, c.y + 12, '這裡的任務都領完了，辛苦了！', 17));
    }

    patchDebug({
      resources: { ...st.resources },
      quest: {
        tab: this.tab,
        tabs: tabDebug,
        claimAll: { ...L.claimAll, count: total },
        rows: rows.map((q, i) => {
          const c = L.cards[i];
          return {
            id: q.id,
            title: q.title,
            progress: q.progress,
            target: q.target,
            done: q.done,
            claimed: q.claimed,
            food: q.reward.food,
            bones: q.reward.bones,
            go: q.go ?? null,
            ...c,
            button: { ...L.button, x: c.x + L.button.x, y: c.y + L.button.y },
          };
        }),
      },
    });
  }

  private drawCard(q: QuestView, c: Rect): void {
    const L = this.layout;
    const ready = q.done && !q.claimed;
    const g = this.add.graphics();
    g.fillStyle(ready ? COLORS.cardSelected : COLORS.card, q.claimed ? 0.6 : 1);
    g.lineStyle(2, ready ? COLORS.button : COLORS.cardBorder, 1);
    g.fillRoundedRect(c.x, c.y, c.width, c.height, 12);
    g.strokeRoundedRect(c.x, c.y, c.width, c.height, 12);
    // 底部細細的進度條
    const barX = c.x + 12;
    const barW = L.button.x - 24;
    const barY = c.y + c.height - 9;
    g.fillStyle(COLORS.cardBorder, 0.7);
    g.fillRoundedRect(barX, barY, barW, 4, 2);
    const ratio = q.target > 0 ? Math.min(1, q.progress / q.target) : 0;
    if (ratio > 0) {
      g.fillStyle(q.done ? DONE : COLORS.button, 1);
      g.fillRoundedRect(barX, barY, Math.max(4, barW * ratio), 4, 2);
    }
    this.body.add(g);

    const soft = q.claimed ? COLORS.inkSoft : COLORS.ink;
    const title = addText(this, c.x + 12, c.y + 6, q.title, 15, soft, true);
    // 標題太長就縮一點，不要蓋到按鈕
    const room = L.button.x - 20;
    if (title.width > room) title.setScale(room / title.width);
    this.body.add(title);
    this.body.add(
      addText(this, c.x + 12, c.y + 27, `獎勵：${rewardText(q.reward)}`, 12, COLORS.inkSoft),
    );
    this.body.add(
      addText(
        this,
        c.x + L.button.x - 10,
        c.y + 27,
        `${q.progress} / ${q.target}`,
        12,
        q.done ? '#4f8a3c' : COLORS.inkSoft,
        true,
      ).setOrigin(1, 0),
    );

    const rect = { ...L.button, x: c.x + L.button.x, y: c.y + L.button.y };
    let b: Button;
    if (q.claimed) {
      b = new Button(this, rect, '已領取', () => undefined, 15).setEnabled(false);
    } else if (ready) {
      b = new Button(this, rect, '領取', () => this.claimOne(q.id), 17).setColor(DONE);
    } else if (q.go) {
      const go = q.go;
      b = new Button(this, rect, '前往', () => this.scene.start(go), 17);
    } else {
      b = new Button(this, rect, '未完成', () => undefined, 15).setEnabled(false);
    }
    this.body.add(b);
  }

  private switchTab(tab: QuestTab): void {
    if (tab === this.tab) return;
    playSfx('tap');
    this.tab = tab;
    this.render();
  }

  private claimOne(id: string): void {
    const r = claimQuest(tick(), id);
    if (!r.reward) return;
    setState(r.state);
    this.afterClaim(r.reward, 1);
  }

  private claimEverything(): void {
    const r = claimAll(tick());
    if (r.count === 0) return;
    setState(r.state);
    this.afterClaim(r.reward, r.count);
  }

  private afterClaim(reward: Resources, count: number): void {
    playSfx('levelup');
    this.render();
    this.showToast(`${count > 1 ? `領了 ${count} 個獎勵：` : '領取：'}${rewardText(reward)}`);
  }

  private showToast(text: string): void {
    this.toast?.destroy();
    const { w } = viewOf(this);
    // 放在標題列右邊，不蓋到任務卡
    const t = addText(this, w - 12, BAR / 2, text, 15, '#ffffff', true)
      .setOrigin(1, 0.5)
      .setPadding(14, 8, 14, 8)
      .setBackgroundColor('#4f8a3c')
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
