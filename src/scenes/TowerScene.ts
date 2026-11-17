import Phaser from 'phaser';
import { COLORS } from '../config';
import { TOWER_GEARS } from '../data/equipment';
import { findRegionOfStage } from '../data/regions';
import { TOWER_FLOORS, isGuardFloor, towerStage } from '../data/tower';
import { formatAmount } from '../logic/format';
import type { Rect } from '../logic/layout';
import { perkText } from '../logic/levelSkills';
import { rewardText } from '../logic/quests';
import {
  daysToReset,
  sweepPlan,
  towerAt,
  towerNextFloor,
  towerOpen,
  towerSweep,
} from '../logic/tower';
import { getState, setState, tick, timeOptions } from '../state/store';
import { Button } from './components/Button';
import { playSfx } from './components/audio';
import { drawDogHead } from './components/dogArt';
import { Scenery } from './components/Scenery';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;
const GOLD = 0xd99a1c;
const DONE = 0x4f8a3c;

/**
 * 登天塔（Jimmy 2026-11-17）：主頁「爬塔」進來。
 * 左邊一座塔，亮到這週爬到的那一層；右邊是下一層的頭目、獎勵與「挑戰」，
 * 換週之後多一顆「一鍵通關」，直接回到上週的高度並領完獎勵。規則在 src/logic/tower.ts。
 */
export class TowerScene extends Phaser.Scene {
  private body!: Phaser.GameObjects.Container;
  private toast: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('TowerScene');
  }

  create(): void {
    resetDebug(this);
    this.toast = null;
    const { w, h } = viewOf(this);
    const st = tick();
    const now = Date.now();
    const next = towerNextFloor(st, now, timeOptions());
    const showing = towerStage(next || TOWER_FLOORS)!;
    new Scenery(
      this,
      { x: 0, y: 0, width: w, height: h },
      findRegionOfStage(showing.id)?.theme ?? 'cloud',
      'low',
      0.4,
    );
    this.add.rectangle(0, 0, w, h, 0xf4e9d8, 0.45).setOrigin(0, 0);
    const back = drawHeader(this, '登天塔', () => this.scene.start('LobbyScene'), BAR);
    this.body = this.add.container(0, 0);
    this.render();
    patchDebug({ backButton: back });
  }

  private render(): void {
    const { w, h } = viewOf(this);
    const st = getState();
    const now = Date.now();
    const o = timeOptions();
    const t = towerAt(st, now, o);
    const open = towerOpen(st);
    const next = towerNextFloor(st, now, o);
    const plan = open ? sweepPlan(st, now, o) : null;
    this.body.removeAll(true);

    // ---- 左邊：塔 ----
    const towerW = Math.min(240, w * 0.3);
    const towerRect: Rect = { x: 20, y: BAR + 12, width: towerW, height: h - BAR - 24 };
    this.drawTower(towerRect, t.floor);

    // ---- 右邊：資訊 ----
    const px = towerRect.x + towerRect.width + 16;
    const pw = w - px - 20;
    const card: Rect = { x: px, y: BAR + 12, width: pw, height: h - BAR - 24 };
    const g = this.add.graphics();
    g.fillStyle(COLORS.card, 0.96);
    g.lineStyle(2, COLORS.cardBorder, 1);
    g.fillRoundedRect(card.x, card.y, card.width, card.height, 16);
    g.strokeRoundedRect(card.x, card.y, card.width, card.height, 16);
    this.body.add(g);

    const left = card.x + 18;
    let y = card.y + 14;
    const line = (text: string, size = 15, color: string = COLORS.ink, bold = false) => {
      const tx = addText(this, left, y, text, size, color, bold);
      this.body.add(tx);
      y += size + 9;
      return tx;
    };

    let fight: Rect | null = null;
    let sweep: Rect | null = null;
    const btnW = Math.min(250, (card.width - 36 - 12) / 2);
    const btnY = card.y + card.height - 58;

    if (!open) {
      line('還沒開放', 22, COLORS.ink, true);
      line('打倒第三章的頭目之後，登天塔就會開門。', 15, COLORS.inkSoft);
      line(`一共 ${TOWER_FLOORS} 層，每層一位頭目加幾隻小弟，越上面越強。`, 15, COLORS.inkSoft);
      line('每週一早上 5 點重置，獎勵可以再拿一次。', 15, COLORS.inkSoft);
    } else {
      line(
        `這週爬到 ${t.floor}／${TOWER_FLOORS} 層・歷來最高 ${t.best} 層・${daysToReset(now, o)} 天後重置`,
        14,
        COLORS.inkSoft,
      );
      if (!next) {
        line('這週已經登頂！', 24, '#b07a10', true);
        line('下週一重置後可以再爬一次，一鍵通關直接回到塔頂。', 15, COLORS.inkSoft);
      } else {
        const stage = towerStage(next)!;
        const boss = stage.boss!;
        const hg = this.add.graphics();
        const r = Math.min(46, card.height * 0.16);
        const hx = card.x + card.width - r - 26;
        const hy = card.y + 30 + r + 20;
        hg.fillStyle(isGuardFloor(next) ? 0xc0392b : 0x6b4a2e, 0.18);
        hg.fillCircle(hx, hy, r + 14);
        drawDogHead(hg, hx, hy + 4, r, boss.color, boss.accent, {
          fierce: true,
          breed: boss.breed,
        });
        this.body.add(hg);
        this.body.add(
          addText(
            this,
            hx,
            hy + r + 22,
            `${boss.breed}・${boss.name}`,
            14,
            COLORS.ink,
            true,
          ).setOrigin(0.5),
        );
        line(
          `第 ${next} 層${isGuardFloor(next) ? '　守關頭目' : ''}`,
          24,
          isGuardFloor(next) ? '#c0392b' : COLORS.ink,
          true,
        );
        line(`頭目加 ${stage.enemies.length - 1} 隻小弟・可上陣 ${stage.teamMax} 隻`, 15);
        line(`建議戰力 ${formatAmount(stage.recommendedPower)}・不耗體力`, 15);
        line(`過關獎勵：${rewardText(stage.reward)}`, 15, '#8a5a12', true);
      }
      // 下一件限定裝備
      const gift = TOWER_GEARS.find((x) => !t.gear.includes(x.tower!));
      if (gift) {
        line(
          `第 ${gift.tower} 層限定飾品：${gift.name}（${perkText(gift.perks ?? {})}）`,
          14,
          '#7a3b8a',
          true,
        );
      } else line('五件爬塔限定飾品都拿到了', 14, '#4f8a3c', true);

      if (next) {
        fight = { x: card.x + card.width - 18 - btnW, y: btnY, width: btnW, height: 46 };
        this.body.add(
          new Button(
            this,
            fight,
            `挑戰第 ${next} 層`,
            () =>
              this.scene.start('ExpeditionScene', { stageId: towerStage(next)!.id, chapter: -1 }),
            19,
          ),
        );
      }
      if (plan) {
        sweep = { x: left, y: btnY, width: btnW, height: 46 };
        const b = new Button(this, sweep, `一鍵通關到第 ${plan.to} 層`, () => this.sweep(), 17);
        b.setColor(DONE);
        this.body.add(b);
        this.body.add(
          addText(
            this,
            left,
            btnY - 22,
            `上週爬到第 ${plan.to} 層，一次領：${rewardText(plan.reward)}`,
            13,
            COLORS.inkSoft,
          ),
        );
      }
    }

    patchDebug({
      resources: { ...st.resources },
      tower: {
        open,
        floor: t.floor,
        last: t.last,
        best: t.best,
        next,
        gear: [...t.gear],
        fight,
        sweep,
        sweepTo: plan?.to ?? 0,
      },
    });
  }

  /** 一座十層的塔代表一百層：每一格十層，爬過的亮起來，現在這一格標出層數 */
  private drawTower(r: Rect, floor: number): void {
    const g = this.add.graphics();
    this.body.add(g);
    const tiers = 10;
    const roofH = 26;
    const baseH = 14;
    const tierH = (r.height - roofH - baseH) / tiers;
    const cx = r.x + r.width / 2;
    g.fillStyle(0x6b4a2e, 1);
    g.fillRoundedRect(r.x + 6, r.y + r.height - baseH, r.width - 12, baseH, 4);
    for (let i = 0; i < tiers; i++) {
      // 第 i 格是第 i*10+1～(i+1)*10 層，從下往上畫，越上面越窄
      const wTier = r.width * (0.86 - i * 0.045);
      const y = r.y + r.height - baseH - (i + 1) * tierH;
      const done = floor >= (i + 1) * 10;
      const here = !done && floor >= i * 10;
      g.fillStyle(done ? 0xf2c14e : here ? 0xfff3d0 : 0xd8cbb8, 1);
      g.lineStyle(2, done || here ? GOLD : 0x9c8b78, 1);
      g.fillRect(cx - wTier / 2, y + 5, wTier, tierH - 5);
      g.strokeRect(cx - wTier / 2, y + 5, wTier, tierH - 5);
      // 屋簷
      g.fillStyle(done ? 0xa83a2b : here ? 0xc7832b : 0x8a7a68, 1);
      g.fillTriangle(cx - wTier / 2 - 9, y + 7, cx + wTier / 2 + 9, y + 7, cx + wTier / 2 - 2, y);
      g.fillTriangle(cx - wTier / 2 - 9, y + 7, cx - wTier / 2 + 2, y, cx + wTier / 2 - 2, y);
      // 這一格爬到哪：一條進度
      if (here) {
        const k = (floor - i * 10) / 10;
        g.fillStyle(0xf2c14e, 1);
        g.fillRect(cx - wTier / 2 + 1, y + 6, (wTier - 2) * k, tierH - 7);
      }
      const label = done
        ? `${(i + 1) * 10} ✓`
        : here
          ? `${floor}／${(i + 1) * 10}`
          : `${(i + 1) * 10}`;
      this.body.add(
        addText(
          this,
          cx,
          y + 5 + (tierH - 5) / 2,
          label,
          Math.min(14, tierH - 8),
          done || here ? COLORS.ink : COLORS.inkSoft,
          done || here,
        ).setOrigin(0.5),
      );
    }
    // 塔尖
    const topW = r.width * (0.86 - tiers * 0.045);
    const ty = r.y + r.height - baseH - tiers * tierH;
    g.fillStyle(floor >= TOWER_FLOORS ? GOLD : 0x8a7a68, 1);
    g.fillTriangle(cx - topW / 2, ty, cx + topW / 2, ty, cx, ty - roofH + 4);
  }

  private sweep(): void {
    const r = towerSweep(tick(), Date.now(), timeOptions());
    if (!r.plan) return;
    setState(r.state);
    playSfx('levelup');
    this.render();
    this.showToast(`通關到第 ${r.plan.to} 層：${rewardText(r.plan.reward)}`);
  }

  private showToast(text: string): void {
    this.toast?.destroy();
    const { w } = viewOf(this);
    const t = addText(this, w - 12, BAR / 2, text, 15, '#ffffff', true)
      .setOrigin(1, 0.5)
      .setPadding(14, 8, 14, 8)
      .setBackgroundColor('#4f8a3c')
      .setDepth(60);
    this.toast = t;
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 2600,
      duration: 400,
      onComplete: () => {
        if (this.toast === t) this.toast = null;
        t.destroy();
      },
    });
  }
}
