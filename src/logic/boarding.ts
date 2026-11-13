import { DOGS, findDog } from '../data/dogs';
import { REGIONS, type StageData } from '../data/regions';
import type { BoardingSlot, DogProgress, GameState } from '../state/gameState';
import { createRng, mixSeed } from './battle';
import { expNeeded, levelCapOf, levelUp, progressOf, stageExp } from './leveling';
import { STAMINA_COST, STAMINA_REGEN_MS, type TimeOptions } from './stamina';

/**
 * 訓練場板凳寄宿（T021）：沒上陣的狗放進寄宿位，隨時間慢慢拿經驗，離線也算，不花體力。
 * 全部是純函式，時間由呼叫端傳入。
 *
 * 速度：每過「回滿一場出征體力的時間」（20 體力，正式版 100 分鐘），
 * 拿到「已通關關卡裡經驗最高那一關」的三成。
 *
 * 每個寄宿位只存開始時間、上次結算時間與零頭，要用的時候才補算，
 * 所以每 0.25 秒算一次和離開很久才算一次，結果完全一樣。
 */

/** 寄宿拿到的經驗是出征的幾成 */
export const BOARDING_RATE = 0.3;
/** 一開始有幾個寄宿位 */
export const BOARDING_BASE_SLOTS = 2;
/** 最多幾個寄宿位 */
export const BOARDING_MAX_SLOTS = 3;
/** 打贏這一關（第 1 章 Boss）開最後一個寄宿位 */
export const BOARDING_UNLOCK_STAGE = 'luoyepo-5';

const LEVEL_SEED_SALT = 0xb0a2d;

type Cleared = Pick<GameState, 'cleared'>;

/** 現在有幾個寄宿位 */
export function boardingSlotCount(state: Cleared): number {
  return state.cleared.includes(BOARDING_UNLOCK_STAGE) ? BOARDING_MAX_SLOTS : BOARDING_BASE_SLOTS;
}

/** 寄宿經驗參考哪一關：已通關裡經驗最高的；還沒通過任何關卡就用第 1 關 */
export function boardingStage(state: Cleared): StageData {
  let best = REGIONS[0].stages[0];
  for (const region of REGIONS) {
    for (const s of region.stages) {
      if (state.cleared.includes(s.id) && stageExp(s) > stageExp(best)) best = s;
    }
  }
  return best;
}

/** 每過一場出征的回體時間，寄宿的狗拿多少經驗 */
export function boardingExpPerRun(state: Cleared): number {
  return Math.max(1, Math.round(stageExp(boardingStage(state)) * BOARDING_RATE));
}

/** 一場出征的回體時間（毫秒）：正式版 100 分鐘，測試模式跟著體力變快 */
export function boardingPeriodMs(o?: TimeOptions): number {
  return STAMINA_COST * (o?.regenMs ?? STAMINA_REGEN_MS);
}

/** 每小時大約拿多少經驗（顯示用） */
export function boardingExpPerHour(state: Cleared, o?: TimeOptions): number {
  return Math.round((boardingExpPerRun(state) * 3_600_000) / boardingPeriodMs(o));
}

/** 寄宿中的狗狗 id */
export function boardingDogIds(state: Pick<GameState, 'boarding'>): string[] {
  return state.boarding.map((s) => s.dogId);
}

export type BoardBlock =
  'unknown-dog' | 'not-owned' | 'boarding' | 'in-team' | 'max-level' | 'full';

export const BOARD_BLOCK_LABEL: Record<BoardBlock, string> = {
  'unknown-dog': '不能寄宿',
  'not-owned': '尚未擁有',
  boarding: '寄宿中',
  'in-team': '隊伍中',
  'max-level': '已滿級',
  full: '沒有空位',
};

/** 已經到這隻狗的等級上限（看星數，T007），再給經驗也不會升 */
const atLevelCap = (p: DogProgress): boolean => p.level >= levelCapOf(p);

type BoardState = Pick<GameState, 'owned' | 'dogs' | 'team' | 'boarding' | 'cleared'>;

/** 這隻狗現在能不能放進寄宿位；不能的話回傳原因 */
export function checkBoard(state: BoardState, dogId: string): BoardBlock | null {
  const dog = findDog(dogId);
  if (!dog) return 'unknown-dog';
  if (!state.owned.includes(dogId)) return 'not-owned';
  if (state.boarding.some((s) => s.dogId === dogId)) return 'boarding';
  if (state.team.includes(dogId)) return 'in-team';
  if (atLevelCap(progressOf(state, dog))) return 'max-level';
  if (state.boarding.length >= boardingSlotCount(state)) return 'full';
  return null;
}

/** 放進寄宿位，從現在開始算。不能放時狀態原封不動回傳 */
export function board<S extends BoardState>(
  state: S,
  dogId: string,
  now: number,
): { state: S; block: BoardBlock | null } {
  const block = checkBoard(state, dogId);
  if (block) return { state, block };
  const slot: BoardingSlot = { dogId, since: now, at: now, carry: 0, exp: 0, levels: 0 };
  return { state: { ...state, boarding: [...state.boarding, slot] }, block: null };
}

/** 加經驗並升級。隨機加成的種子只看「開始寄宿的時間、升到第幾級、哪隻狗」，分幾次算都一樣 */
function gain(
  p: DogProgress,
  dogId: string,
  since: number,
  amount: number,
): { progress: DogProgress; levels: number } {
  const dog = findDog(dogId)!;
  const salt = LEVEL_SEED_SALT + DOGS.indexOf(dog);
  const cap = levelCapOf(p);
  let cur: DogProgress = { ...p, exp: p.exp + amount };
  let levels = 0;
  while (cur.level < cap && cur.exp >= expNeeded(cur.level, cap)) {
    const rng = createRng(mixSeed(since, cur.level + 1, salt));
    cur = levelUp({ ...cur, exp: cur.exp - expNeeded(cur.level, cap) }, dog.role, rng).progress;
    levels++;
  }
  if (cur.level >= cap) cur = { ...cur, exp: 0 };
  return { progress: cur, levels };
}

type SettleState = Pick<GameState, 'dogs' | 'boarding' | 'cleared'>;

/**
 * 把寄宿的經驗結算到 now。沒有任何一隻湊滿 1 點經驗時回傳原本的物件（不用存檔）。
 * 系統時間被調回過去：不倒扣也不多給，從現在重新起算。
 */
export function settleBoarding<S extends SettleState>(state: S, now: number, o?: TimeOptions): S {
  if (state.boarding.length === 0) return state;
  const perRun = boardingExpPerRun(state);
  const period = boardingPeriodMs(o);
  let dogs = state.dogs;
  let changed = false;
  const boarding = state.boarding.map((slot) => {
    const dog = findDog(slot.dogId);
    if (!dog) return slot;
    if (now < slot.at) {
      changed = true;
      return { ...slot, at: now };
    }
    const before = dogs[slot.dogId] ?? progressOf({ dogs }, dog);
    // 滿級的狗留在位子上也不會再拿經驗
    if (atLevelCap(before)) return slot;
    const units = slot.carry + (now - slot.at) * perRun;
    const gained = Math.floor(units / period);
    if (gained <= 0) return slot;
    const r = gain(before, slot.dogId, slot.since, gained);
    dogs = { ...dogs, [slot.dogId]: r.progress };
    changed = true;
    return {
      ...slot,
      at: now,
      carry: units - gained * period,
      exp: slot.exp + gained,
      levels: slot.levels + r.levels,
    };
  });
  return changed ? { ...state, dogs, boarding } : state;
}

/** 從寄宿位接回來：先把經驗結算到現在，再空出位子。這隻狗不在寄宿就只結算 */
export function unboard<S extends SettleState>(
  state: S,
  dogId: string,
  now: number,
  o?: TimeOptions,
): S {
  const settled = settleBoarding(state, now, o);
  if (!settled.boarding.some((s) => s.dogId === dogId)) return settled;
  return { ...settled, boarding: settled.boarding.filter((s) => s.dogId !== dogId) };
}

/** 這個寄宿位還要多久才會拿到下一點經驗（毫秒）；滿級回傳 0 */
export function msUntilNextBoardingExp(
  state: SettleState,
  slot: BoardingSlot,
  now: number,
  o?: TimeOptions,
): number {
  const dog = findDog(slot.dogId);
  if (!dog || atLevelCap(progressOf(state, dog))) return 0;
  const perRun = boardingExpPerRun(state);
  const units = slot.carry + Math.max(0, now - slot.at) * perRun;
  return Math.max(0, Math.ceil((boardingPeriodMs(o) - units) / perRun));
}
