import { findDog } from '../data/dogs';
import type { DogProgress, GameState } from '../state/gameState';
import { STAR_MAX, levelCapForStar, progressOf, starOf } from './leveling';

/**
 * 升星（T007）：重複抽到的狗換成碎片，在訓練場花碎片升星。
 * 每升一星：攻擊、防禦各多基礎值的 10%，等級上限 +10（公式在 src/logic/leveling.ts）。
 * 全部是純函式，回傳新的狀態。
 */

/** 從 star 星升到下一星要幾個碎片（暫定：10 × 目前星數，也就是重複 1、2、3、4 隻）；滿星回傳 0 */
export const STAR_COST_STEP = 10;
export function starUpCost(star: number): number {
  const s = Math.max(1, Math.floor(star));
  return s >= STAR_MAX ? 0 : STAR_COST_STEP * s;
}

export type StarBlock = 'unknown-dog' | 'not-owned' | 'maxed' | 'shards';

/** 現在能不能升星，以及需要的碎片 */
export interface StarCheck {
  ok: boolean;
  /** 不能升星的原因；可以就沒有 */
  reason?: StarBlock;
  /** 目前幾星 */
  star: number;
  /** 手上這隻狗的碎片 */
  shards: number;
  /** 升下一星要幾個碎片；滿星為 0 */
  cost: number;
  /** 碎片還差多少；夠就是 0 */
  short: number;
  /** 目前與升星後的等級上限（滿星兩個一樣） */
  levelCap: number;
  nextLevelCap: number;
}

type StarState = Pick<GameState, 'owned' | 'dogs' | 'shards' | 'boarding'>;

export function shardsOf(state: Pick<GameState, 'shards'>, dogId: string): number {
  return state.shards[dogId] ?? 0;
}

export function checkStarUp(state: Omit<StarState, 'boarding'>, dogId: string): StarCheck {
  const dog = findDog(dogId);
  if (!dog) {
    return {
      ok: false,
      reason: 'unknown-dog',
      star: 1,
      shards: 0,
      cost: 0,
      short: 0,
      levelCap: levelCapForStar(1),
      nextLevelCap: levelCapForStar(1),
    };
  }
  const star = starOf(progressOf(state, dog));
  const shards = shardsOf(state, dogId);
  const cost = starUpCost(star);
  const short = Math.max(0, cost - shards);
  const base = {
    star,
    shards,
    cost,
    short,
    levelCap: levelCapForStar(star),
    nextLevelCap: levelCapForStar(star + 1),
  };
  if (!state.owned.includes(dogId)) return { ok: false, reason: 'not-owned', ...base };
  if (star >= STAR_MAX) return { ok: false, reason: 'maxed', ...base, short: 0 };
  if (short > 0) return { ok: false, reason: 'shards', ...base };
  return { ok: true, ...base };
}

/**
 * 升一星：扣碎片、星數 +1。不能升時狀態原封不動回傳。
 * now 有給的話，寄宿中的狗從現在重新起算：卡在等級上限那段時間不會在升星後一次補發。
 */
export function starUp<S extends StarState>(
  state: S,
  dogId: string,
  now?: number,
): { state: S; check: StarCheck } {
  const check = checkStarUp(state, dogId);
  const dog = findDog(dogId);
  if (!check.ok || !dog) return { state, check };
  const p = progressOf(state, dog);
  const next: DogProgress = { ...p, star: check.star + 1 };
  const wasCapped = p.level >= check.levelCap;
  return {
    state: {
      ...state,
      dogs: { ...state.dogs, [dogId]: next },
      shards: { ...state.shards, [dogId]: check.shards - check.cost },
      boarding:
        wasCapped && now !== undefined
          ? state.boarding.map((b) => (b.dogId === dogId ? { ...b, at: now, carry: 0 } : b))
          : state.boarding,
    },
    check,
  };
}

/** 「★★★☆☆」 */
export function starText(star: number): string {
  const s = Math.min(STAR_MAX, Math.max(0, Math.floor(star)));
  return '★'.repeat(s) + '☆'.repeat(STAR_MAX - s);
}
