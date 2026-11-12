import { findDog } from '../data/dogs';
import type { DogProgress, GameState } from '../state/gameState';
import { progressOf } from './leveling';

/**
 * 訓練場專項特訓（T020）：花糧草替一隻狗做攻擊或防禦特訓，每次永久 +1。
 * 不給經驗、不加等級。全部是純函式，回傳新的狀態。
 */

/** 每隻狗每項屬性最多特訓幾次 */
export const DRILL_MAX = 10;
/** 第 n 次特訓花 DRILL_COST_STEP × n 糧草（Jimmy 2026-11-12 指定） */
export const DRILL_COST_STEP = 10;

export type DrillStat = 'attack' | 'defense';

export const DRILL_LABELS: Record<DrillStat, string> = {
  attack: '攻擊',
  defense: '防禦',
};

/** 這項屬性已經特訓幾次（舊資料沒有這個欄位就當 0） */
export function drillCount(p: DogProgress, stat: DrillStat): number {
  return (stat === 'attack' ? p.drillAttack : p.drillDefense) ?? 0;
}

/** 已經練了 done 次，下一次要花多少糧草；練滿回傳 0 */
export function drillCost(done: number): number {
  const n = Math.max(0, Math.floor(done));
  return n >= DRILL_MAX ? 0 : DRILL_COST_STEP * (n + 1);
}

export type DrillBlock = 'unknown-dog' | 'not-owned' | 'maxed' | 'food';

/** 現在能不能特訓，以及下一次的花費 */
export interface DrillCheck {
  ok: boolean;
  /** 不能特訓的原因；可以就沒有 */
  reason?: DrillBlock;
  /** 已經特訓幾次 */
  count: number;
  /** 下一次的花費；練滿為 0 */
  cost: number;
  /** 糧草還差多少；夠就是 0 */
  short: number;
}

type DrillState = Pick<GameState, 'resources' | 'owned' | 'dogs'>;

export function checkDrill(state: DrillState, dogId: string, stat: DrillStat): DrillCheck {
  const dog = findDog(dogId);
  if (!dog) return { ok: false, reason: 'unknown-dog', count: 0, cost: 0, short: 0 };
  const count = drillCount(progressOf(state, dog), stat);
  const cost = drillCost(count);
  const short = Math.max(0, cost - state.resources.food);
  const base = { count, cost, short };
  if (!state.owned.includes(dogId)) return { ok: false, reason: 'not-owned', ...base };
  if (count >= DRILL_MAX) return { ok: false, reason: 'maxed', ...base, short: 0 };
  if (short > 0) return { ok: false, reason: 'food', ...base };
  return { ok: true, ...base };
}

/** 做一次特訓：扣糧草、次數 +1。不能特訓時狀態原封不動回傳 */
export function drill<S extends DrillState>(
  state: S,
  dogId: string,
  stat: DrillStat,
): { state: S; check: DrillCheck } {
  const check = checkDrill(state, dogId, stat);
  const dog = findDog(dogId);
  if (!check.ok || !dog) return { state, check };
  const p = progressOf(state, dog);
  const next: DogProgress = {
    ...p,
    drillAttack: drillCount(p, 'attack') + (stat === 'attack' ? 1 : 0),
    drillDefense: drillCount(p, 'defense') + (stat === 'defense' ? 1 : 0),
  };
  return {
    state: {
      ...state,
      resources: { ...state.resources, food: state.resources.food - check.cost },
      dogs: { ...state.dogs, [dogId]: next },
    },
    check,
  };
}

/** 一項屬性練滿總共要花多少糧草 */
export function drillTotalCost(): number {
  let sum = 0;
  for (let i = 0; i < DRILL_MAX; i++) sum += drillCost(i);
  return sum;
}
