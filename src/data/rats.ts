import { LINEUP_SCALE } from './lineupScale';
import {
  ENEMY_KINDS,
  EXTRA_STAGES,
  REGIONS,
  parseLineup,
  teamMaxOf,
  type BossData,
  type EnemyKind,
  type GangData,
  type StageData,
} from './regions';

/**
 * 刺青老鼠幫（T034，Jimmy 2026-11-17）：活動事件的敵人，汪國和喵國都會遇到。
 * 可愛版的老鼠幫派：身上的「刺青」是愛心、星星、小魚骨這類貼紙一樣的圖案。
 * 一共 10 級，跟著玩家主線打到第幾章；每一級是鼠老大加幾隻小弟。數值都是暫定。
 */

export const RAT_TIERS = 10;

const PREFIX = 'rat-';

export function ratStageId(tier: number): string {
  return `${PREFIX}${tier}`;
}

/** 這個關卡 id 是老鼠幫的第幾級；不是老鼠幫的關卡回傳 0 */
export function ratTierOf(stageId: string): number {
  if (!stageId.startsWith(PREFIX)) return 0;
  const n = Number(stageId.slice(PREFIX.length));
  return Number.isInteger(n) && n >= 1 && n <= RAT_TIERS ? n : 0;
}

export const RAT_GANG: GangData = { name: '刺青幫', color: 0xa9a7b4 };

export const RAT_BOSS: BossData = {
  name: '鼠老大阿刺',
  breed: '鼠老大',
  color: 0x6f6a78,
  accent: 0xe9dfd2,
};

/** 老鼠幫的兵種：打法和主線的兵種一樣，換成老鼠的名字與長相 */
export const RAT_KINDS: Readonly<Record<string, EnemyKind>> = {
  m: { ...ENEMY_KINDS.m, label: '小弟', breed: '刺青鼠' },
  a: { ...ENEMY_KINDS.a, label: '飛毛腿', breed: '刺青鼠' },
  g: { ...ENEMY_KINDS.g, label: '胖墩', breed: '胖胖鼠' },
  s: { ...ENEMY_KINDS.s, label: '彈弓手', breed: '彈弓鼠' },
  l: { ...ENEMY_KINDS.l, label: '搗蛋鬼', breed: '刺青鼠' },
  h: { ...ENEMY_KINDS.h, label: '起司師傅', breed: '彈弓鼠' },
  e: { ...ENEMY_KINDS.e, label: '打手', breed: '大塊鼠' },
};

/** 每一級的陣容：越後面小弟越多、越兇（寫法見 parseLineup） */
function lineupOf(tier: number): string {
  return tier <= 3 ? 'gmg/B' : tier <= 7 ? 'ga/B/sl' : 'gag/B/s';
}

function buildTier(tier: number): void {
  const region = REGIONS[tier - 1];
  // 強度：那一章第 4 關的水準（比章末頭目輕鬆一點）
  const like = region.stages[Math.min(3, region.stages.length - 1)];
  const perDog = like.recommendedPower / like.teamMax;
  const lineup = lineupOf(tier);
  const enemies = parseLineup(lineup, RAT_GANG, RAT_BOSS, RAT_KINDS);
  const teamMax = teamMaxOf(enemies);
  const last = region.stages[region.stages.length - 1];
  const stage: StageData = {
    id: ratStageId(tier),
    name: `刺青老鼠幫 第 ${tier} 級`,
    difficulty: like.difficulty,
    recommendedPower: Math.round((perDog * teamMax) / 10) * 10,
    reward: { ...last.reward },
    enemies,
    scale: LINEUP_SCALE[lineup] ?? 1,
    teamMax,
    boss: RAT_BOSS,
  };
  EXTRA_STAGES.set(stage.id, { stage, region });
}

for (let t = 1; t <= RAT_TIERS; t++) buildTier(t);

/** 第幾級的關卡資料 */
export function ratStage(tier: number): StageData | undefined {
  return EXTRA_STAGES.get(ratStageId(tier))?.stage;
}
