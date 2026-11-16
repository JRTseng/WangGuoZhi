import type { Resources } from './resources';
import { LINEUP_SCALE } from './lineupScale';
import {
  EXTRA_STAGES,
  REGIONS,
  STAGE_LINEUPS,
  STAGE_TEAM_CAP,
  parseLineup,
  teamMaxOf,
  type BossData,
  type StageData,
} from './regions';

/**
 * 登天塔（爬塔，Jimmy 2026-11-17）：100 層，每層一位頭目加幾隻小弟，一路變強。
 * 不限制玩家帶誰、怎麼站。每 10 層借用一章的場景、敵軍與頭目的犬種；
 * 第 10、20…100 層是那一章的頭目親自守關。數值都是暫定。
 */

export const TOWER_FLOORS = 100;
/** 每幾層換一章的場景，最後一層是守關頭目 */
export const TOWER_BLOCK = 10;

const PREFIX = 'tower-';

export function towerStageId(floor: number): string {
  return `${PREFIX}${floor}`;
}

/** 這個關卡 id 是塔的第幾層；不是塔的關卡回傳 0 */
export function towerFloorOf(stageId: string): number {
  if (!stageId.startsWith(PREFIX)) return 0;
  const n = Number(stageId.slice(PREFIX.length));
  return Number.isInteger(n) && n >= 1 && n <= TOWER_FLOORS ? n : 0;
}

/** 這一層是不是守關頭目（每 10 層） */
export function isGuardFloor(floor: number): boolean {
  return floor % TOWER_BLOCK === 0;
}

/**
 * 每隻狗該有的戰力：第 1 層 150（主線第 1 章）、第 50 層 560（主線第 10 章頭目）、
 * 第 100 層 1150（滿等滿星的 SSR 才打得動）。
 */
export function towerPerDog(floor: number): number {
  return floor <= 50
    ? 150 + ((560 - 150) * (floor - 1)) / 49
    : 560 + ((1150 - 560) * (floor - 50)) / 50;
}

/** 這一層打贏的獎勵：一路變多，守關頭目那一層三倍 */
export function towerReward(floor: number): Resources {
  const k = isGuardFloor(floor) ? 3 : 1;
  return { food: (200 + 20 * floor) * k, bones: (5 + Math.floor(floor / 2)) * k };
}

/** 守層的小頭目：名字照層數輪，犬種與顏色借那一章的頭目 */
const KEEPER_NAMES = ['守門', '巡梯', '看火', '敲鐘', '掌燈', '持旗', '磨爪', '鎮樓', '望風'];

function buildFloor(floor: number): void {
  const block = Math.floor((floor - 1) / TOWER_BLOCK);
  const region = REGIONS[block % REGIONS.length];
  const last = region.stages[region.stages.length - 1];
  const lineup = STAGE_LINEUPS[last.id];
  const guard = isGuardFloor(floor);
  const boss: BossData = guard
    ? { ...last.boss!, name: `塔主${last.boss!.name}` }
    : { ...last.boss!, name: `${KEEPER_NAMES[(floor - 1) % TOWER_BLOCK]}犬` };
  const enemies = parseLineup(lineup, region.gang, boss);
  const teamMax = teamMaxOf(enemies);
  const perDog = towerPerDog(floor) * (teamMax < STAGE_TEAM_CAP ? 1.08 : 1);
  const stage: StageData = {
    id: towerStageId(floor),
    name: `登天塔 第 ${floor} 層`,
    difficulty: 1 + Math.floor(floor / 5),
    recommendedPower: Math.round((perDog * teamMax) / 10) * 10,
    reward: towerReward(floor),
    enemies,
    scale: LINEUP_SCALE[lineup] ?? 1,
    teamMax,
    boss,
  };
  EXTRA_STAGES.set(stage.id, { stage, region });
}

for (let f = 1; f <= TOWER_FLOORS; f++) buildFloor(f);

/** 第幾層的關卡資料 */
export function towerStage(floor: number): StageData | undefined {
  return EXTRA_STAGES.get(towerStageId(floor))?.stage;
}
