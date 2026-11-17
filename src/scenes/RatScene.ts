import Phaser from 'phaser';
import { COLORS } from '../config';
import { RAT_BOSS, RAT_GANG, RAT_KINDS, ratStage } from '../data/rats';
import { findRegionOfStage } from '../data/regions';
import { formatAmount } from '../logic/format';
import type { Rect } from '../logic/layout';
import { rewardText } from '../logic/quests';
import {
  RAT_RAID,
  ratCanFight,
  ratHoursOpen,
  ratHoursText,
  ratTier,
  ratUnlocked,
  ratWavesLeft,
  ratsAt,
} from '../logic/ratRaid';
import { getState, tick, timeOptions } from '../state/store';
import { Button } from './components/Button';
import { DogSprite } from './components/DogSprite';
import { Scenery } from './components/Scenery';
import { addText, drawHeader, patchDebug, resetDebug, viewOf } from './ui';

const BAR = 56;

/**
 * 活動事件「刺青老鼠幫來襲」（T034，Jimmy 2026-11-17）：主頁右上「老鼠幫」進來。
 * 左邊是鼠老大帶著幾隻小弟，右邊是今天還剩幾波、強度、寶物說明與「出擊」。
 * 規則在 src/logic/ratRaid.ts。
 */
export class RatScene extends Phaser.Scene {
  constructor() {
    super('RatScene');
  }

  create(): void {
    resetDebug(this);
    const { w, h } = viewOf(this);
    const st = tick();
    const now = Date.now();
    const o = timeOptions();
    const tier = ratTier(st);
    const stage = ratStage(tier)!;
    new Scenery(
      this,
      { x: 0, y: 0, width: w, height: h },
      findRegionOfStage(stage.id)?.theme ?? 'slope',
      'low',
      0.4,
    );
    this.add.rectangle(0, 0, w, h, 0xf4e9d8, 0.4).setOrigin(0, 0);
    const back = drawHeader(this, '刺青老鼠幫來襲', () => this.scene.start('LobbyScene'), BAR);

    // ---- 左邊：老鼠幫 ----
    const stageW = Math.min(330, w * 0.4);
    const footY = h - 34;
    const ground = this.add.graphics();
    ground.fillStyle(0x000000, 0.12);
    ground.fillEllipse(20 + stageW / 2, footY + 4, stageW * 0.96, 30);
    const mooks: { breed: string; x: number; y: number; s: number }[] = [
      { breed: RAT_KINDS.g.breed, x: 0.2, y: -46, s: 0.62 },
      { breed: RAT_KINDS.s.breed, x: 0.8, y: -40, s: 0.6 },
      { breed: RAT_KINDS.m.breed, x: 0.26, y: 0, s: 0.72 },
      { breed: RAT_KINDS.e.breed, x: 0.84, y: 6, s: 0.78 },
    ];
    for (const m of mooks) {
      const sp = new DogSprite(this, 20 + stageW * m.x, footY + m.y, {
        color: RAT_GANG.color,
        accent: 0xe9dfd2,
        breed: m.breed,
      });
      sp.setScale(m.s);
      this.add.existing(sp);
    }
    const boss = new DogSprite(this, 20 + stageW * 0.54, footY + 4, {
      color: RAT_BOSS.color,
      accent: RAT_BOSS.accent,
      breed: RAT_BOSS.breed,
      fierce: true,
    });
    boss.setScale(1.12);
    this.add.existing(boss);

    // ---- 右邊：資訊 ----
    const px = 20 + stageW + 16;
    const card: Rect = { x: px, y: BAR + 12, width: w - px - 20, height: h - BAR - 24 };
    const g = this.add.graphics();
    g.fillStyle(COLORS.card, 0.96);
    g.lineStyle(2, COLORS.cardBorder, 1);
    g.fillRoundedRect(card.x, card.y, card.width, card.height, 16);
    g.strokeRoundedRect(card.x, card.y, card.width, card.height, 16);

    const left = card.x + 18;
    let y = card.y + 14;
    const line = (text: string, size = 15, color: string = COLORS.ink, bold = false) => {
      const tx = addText(this, left, y, text, size, color, bold);
      tx.setWordWrapWidth(card.width - 36, true);
      y += tx.height + 7;
      return tx;
    };

    const unlocked = ratUnlocked(st);
    const inHours = ratHoursOpen(now, o);
    const left3 = ratWavesLeft(st, now, o);
    let fight: Rect | null = null;

    if (!unlocked) {
      line('還沒出現', 22, COLORS.ink, true);
      line('打倒第一章的頭目之後，刺青老鼠幫就會來搗蛋。', 15, COLORS.inkSoft);
    } else {
      line(`第 ${tier} 級・${RAT_BOSS.name}`, 22, '#5a5266', true);
      line(
        '一群身上貼滿愛心、星星刺青的老鼠，專門偷倉庫裡的好東西。把牠們趕跑，寶物就是你的！',
        14,
        COLORS.inkSoft,
      );
      line(
        `出現時段：${ratHoursText()}・今天還剩 ${left3}／${RAT_RAID.dailyWins} 波`,
        15,
        COLORS.ink,
        true,
      );
      line(
        `老大加 ${stage.enemies.length - 1} 隻小弟・可上陣 ${stage.teamMax} 隻・建議戰力 ${formatAmount(stage.recommendedPower)}・不耗體力`,
        14,
      );
      line(
        `打贏：${rewardText(stage.reward)}，再加 ${RAT_RAID.lootRolls} 樣隨機寶物`,
        15,
        '#8a5a12',
        true,
      );
      line('寶物有糧草、骨頭幣、經驗零食、裝備（必有一件）、角色碎片。', 14, '#8a5a12');
      line(`已經趕跑 ${ratsAt(st, now, o).total} 波`, 13, COLORS.inkSoft);

      const btnW = Math.min(250, card.width - 36);
      fight = {
        x: card.x + card.width - 18 - btnW,
        y: card.y + card.height - 58,
        width: btnW,
        height: 46,
      };
      const can = ratCanFight(st, stage.id, now, o);
      const label = !inHours ? '老鼠幫還沒來' : left3 <= 0 ? '今天都趕跑了，明天再來' : '出擊';
      const b = new Button(
        this,
        fight,
        label,
        () => this.scene.start('ExpeditionScene', { stageId: stage.id, chapter: -1 }),
        can ? 19 : 16,
      );
      b.setEnabled(can);
      if (!can) fight = null;
    }

    patchDebug({
      backButton: back,
      rats: {
        open: unlocked && inHours,
        tier,
        wavesLeft: left3,
        total: getState().rats.total,
        fight,
      },
    });
  }
}
