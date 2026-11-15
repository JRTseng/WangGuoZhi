import { findDog } from '../data/dogs';
import type { GameState } from '../state/gameState';
import { addExp, levelCapOf, progressOf, sumUps, type DogExpGain } from './leveling';

/**
 * 經驗零食（Jimmy 2026-11-15）：打贏關卡會掉，在訓練場餵給狗狗就加經驗，
 * 讓沒上陣的狗也能練起來。全部是純函式。
 */

export type SnackId = 'small' | 'mid' | 'big';

export interface SnackData {
  id: SnackId;
  name: string;
  /** 餵一個加多少經驗 */
  exp: number;
  color: number;
}

export const SNACKS: readonly SnackData[] = [
  { id: 'small', name: '小肉乾', exp: 100, color: 0xb9774a },
  { id: 'mid', name: '香烤肉排', exp: 400, color: 0xc0522b },
  { id: 'big', name: '大骨頭', exp: 1500, color: 0xd99a1c },
];

export function findSnack(id: string): SnackData | undefined {
  return SNACKS.find((s) => s.id === id);
}

/** 一般關卡掉幾個、頭目關掉幾個 */
export const SNACK_DROP = { normal: 1, boss: 3 } as const;

/**
 * 打贏這一關掉什麼零食：看章節（1～3 章小肉乾、4～7 章香烤肉排、8 章以後大骨頭），
 * 頭目關多掉幾個。每次打贏都有，不看運氣。
 */
export function snackDrop(chapter: number, boss: boolean): { id: SnackId; amount: number } {
  const id: SnackId = chapter <= 3 ? 'small' : chapter <= 7 ? 'mid' : 'big';
  return { id, amount: boss ? SNACK_DROP.boss : SNACK_DROP.normal };
}

export function snackCount(state: Pick<GameState, 'snacks'>, id: string): number {
  return Math.max(0, Math.floor(state.snacks[id] ?? 0));
}

export function addSnacks<S extends Pick<GameState, 'snacks'>>(
  state: S,
  id: SnackId,
  amount: number,
): S {
  if (!(amount > 0)) return state;
  return { ...state, snacks: { ...state.snacks, [id]: snackCount(state, id) + amount } };
}

/** 「小肉乾 ×1」 */
export function snackLabel(id: string, amount: number): string {
  return `${findSnack(id)?.name ?? id} ×${amount}`;
}

export type FeedBlock = 'unknown' | 'not-owned' | 'none-left' | 'maxed';

type FeedState = Pick<GameState, 'owned' | 'dogs' | 'snacks'>;

/** 能不能餵：通過回傳 null */
export function feedBlock(state: FeedState, dogId: string, snackId: string): FeedBlock | null {
  const dog = findDog(dogId);
  if (!dog || !findSnack(snackId)) return 'unknown';
  if (!state.owned.includes(dogId)) return 'not-owned';
  if (snackCount(state, snackId) <= 0) return 'none-left';
  const p = progressOf(state, dog);
  return p.level >= levelCapOf(p) ? 'maxed' : null;
}

/**
 * 餵 count 個零食（不夠就餵到沒有）；狗升到等級上限就停，剩下的不會浪費。
 * 回傳新狀態、實際餵了幾個，以及這次的經驗與升級結果（一個都沒餵是 null）。
 */
export function feedSnack<S extends FeedState>(
  state: S,
  dogId: string,
  snackId: string,
  count: number,
  rng: () => number,
): { state: S; used: number; gain: DogExpGain | null } {
  const dog = findDog(dogId);
  const snack = findSnack(snackId);
  if (!dog || !snack || feedBlock(state, dogId, snackId)) return { state, used: 0, gain: null };
  const before = progressOf(state, dog);
  const want = Math.min(Math.max(1, Math.floor(count) || 1), snackCount(state, snackId));
  let p = before;
  let used = 0;
  let exp = 0;
  const ups = [];
  while (used < want && p.level < levelCapOf(p)) {
    const r = addExp(p, dog.role, snack.exp, rng, dog.rarity);
    p = r.progress;
    exp += r.gained;
    ups.push(...r.ups);
    used++;
  }
  return {
    state: {
      ...state,
      dogs: { ...state.dogs, [dogId]: p },
      snacks: { ...state.snacks, [snackId]: snackCount(state, snackId) - used },
    },
    used,
    gain: { dogId, exp, fromLevel: before.level, toLevel: p.level, ...sumUps(ups) },
  };
}
