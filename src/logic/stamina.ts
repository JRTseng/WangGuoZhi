import { STAMINA_MAX, type DailyState, type GameState } from '../state/gameState';

/**
 * 體力與每日次數（T019）。全部是純函式，時間由呼叫端傳入。
 * 體力只存「數值 + 上次結算時間」，要用的時候才依經過的時間補算，
 * 所以關掉遊戲的時間也照樣恢復，不需要計時器。
 */

export { STAMINA_MAX };
/** 出征一次扣多少體力 */
export const STAMINA_COST = 20;
/** 多久恢復 1 點體力（毫秒） */
export const STAMINA_REGEN_MS = 5 * 60_000;
/** 測試模式（網址加 ?fast=1）體力恢復快 60 倍：5 秒 1 點 */
export const FAST_STAMINA_REGEN_MS = 5_000;
/** 同一關每天可以出征幾次 */
export const DAILY_STAGE_RUNS = 3;
/** 每天幾點重置（當地時間） */
export const RESET_HOUR = 5;

/** 骨頭幣買體力：價格固定，每天有上限（數字暫定） */
export const STAMINA_PACK = { amount: 60, price: 30, dailyLimit: 3 } as const;
/** 骨頭幣加購某一關的出征次數：每天所有關卡合計有上限（數字暫定） */
export const RUN_PACK = { amount: 1, price: 15, dailyLimit: 5 } as const;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export interface TimeOptions {
  /** 多久恢復 1 點體力；沒給用正式的 5 分鐘 */
  regenMs?: number;
  /** 當地時間與 UTC 的差（分鐘，和 Date#getTimezoneOffset 同方向）；沒給用裝置的時區 */
  tzOffsetMin?: number;
}

/** 依網址參數決定體力恢復速度 */
export function regenMsFromSearch(search: string): number {
  const fast = new URLSearchParams(search).get('fast');
  return fast === '1' || fast === 'true' ? FAST_STAMINA_REGEN_MS : STAMINA_REGEN_MS;
}

const tzOf = (now: number, o?: TimeOptions): number =>
  o?.tzOffsetMin ?? new Date(now).getTimezoneOffset();

/** 把時間平移成「05:00 重置日」的座標：同一個遊戲日會落在同一個整數天 */
const shifted = (now: number, o?: TimeOptions): number =>
  now - tzOf(now, o) * 60_000 - RESET_HOUR * HOUR_MS;

/** 這個時間屬於哪個遊戲日（當地 05:00 換日），例：'2026-11-12' */
export function dayKey(now: number, o?: TimeOptions): string {
  return new Date(shifted(now, o)).toISOString().slice(0, 10);
}

/** 下一次每日重置的時間 */
export function nextResetAt(now: number, o?: TimeOptions): number {
  const s = shifted(now, o);
  return now + (Math.floor(s / DAY_MS) + 1) * DAY_MS - s;
}

const emptyDaily = (day: string): DailyState => ({
  day,
  runs: {},
  extraRuns: {},
  staminaBuys: 0,
  runBuys: 0,
});

/**
 * 把體力恢復與每日重置結算到 now。沒有變化時回傳原本的物件。
 * - 體力低於上限才恢復，最多回到上限；買來超過上限的部分會留著，只是不再恢復。
 * - 系統時間被調回過去：不恢復也不倒扣，從現在重新起算。
 */
export function settle(state: GameState, now: number, o?: TimeOptions): GameState {
  const regen = o?.regenMs ?? STAMINA_REGEN_MS;
  let stamina = state.stamina;
  if (stamina.value >= STAMINA_MAX || now < stamina.updatedAt) {
    if (stamina.updatedAt !== now) stamina = { value: stamina.value, updatedAt: now };
  } else {
    const gained = Math.floor((now - stamina.updatedAt) / regen);
    if (gained > 0) {
      const value = Math.min(STAMINA_MAX, stamina.value + gained);
      stamina = {
        value,
        updatedAt: value >= STAMINA_MAX ? now : stamina.updatedAt + gained * regen,
      };
    }
  }
  const day = dayKey(now, o);
  const daily = state.daily.day === day ? state.daily : emptyDaily(day);
  if (stamina === state.stamina && daily === state.daily) return state;
  return { ...state, stamina, daily };
}

/** 現在有多少體力 */
export function staminaAt(state: GameState, now: number, o?: TimeOptions): number {
  return settle(state, now, o).stamina.value;
}

/** 還要多久體力才會到 need；已經夠了回 0 */
export function msUntilStamina(
  state: GameState,
  need: number,
  now: number,
  o?: TimeOptions,
): number {
  const regen = o?.regenMs ?? STAMINA_REGEN_MS;
  const s = settle(state, now, o).stamina;
  if (s.value >= need) return 0;
  return Math.max(0, s.updatedAt + (need - s.value) * regen - now);
}

/** 還要多久恢復下一點；體力已滿回 0 */
export function msUntilNextPoint(state: GameState, now: number, o?: TimeOptions): number {
  const s = settle(state, now, o).stamina;
  return s.value >= STAMINA_MAX ? 0 : msUntilStamina(state, s.value + 1, now, o);
}

/** 這一關今天還能出征幾次（含加購的） */
export function runsLeft(state: GameState, stageId: string, now: number, o?: TimeOptions): number {
  const d = settle(state, now, o).daily;
  return Math.max(0, DAILY_STAGE_RUNS + (d.extraRuns[stageId] ?? 0) - (d.runs[stageId] ?? 0));
}

/** 這一關今天總共可以出征幾次（含加購的） */
export function runsTotal(state: GameState, stageId: string, now: number, o?: TimeOptions): number {
  return DAILY_STAGE_RUNS + (settle(state, now, o).daily.extraRuns[stageId] ?? 0);
}

export type RunBlock =
  | { ok: true }
  | { ok: false; reason: 'no-runs' | 'no-stamina'; /** 還要等多久（毫秒） */ waitMs: number };

/** 現在能不能出征這一關；不能的話說明原因與還要等多久（次數用完優先顯示） */
export function runBlock(
  state: GameState,
  stageId: string,
  now: number,
  o?: TimeOptions,
): RunBlock {
  if (runsLeft(state, stageId, now, o) <= 0) {
    return { ok: false, reason: 'no-runs', waitMs: nextResetAt(now, o) - now };
  }
  if (staminaAt(state, now, o) < STAMINA_COST) {
    return {
      ok: false,
      reason: 'no-stamina',
      waitMs: msUntilStamina(state, STAMINA_COST, now, o),
    };
  }
  return { ok: true };
}

/** 扣一次出征的體力與次數；呼叫前要先用 runBlock 確認可以出征 */
export function spendRun(
  state: GameState,
  stageId: string,
  now: number,
  o?: TimeOptions,
): GameState {
  const s = settle(state, now, o);
  return {
    ...s,
    // 從滿體力往下扣的那一刻開始計時恢復
    stamina: { value: s.stamina.value - STAMINA_COST, updatedAt: s.stamina.updatedAt },
    daily: { ...s.daily, runs: { ...s.daily.runs, [stageId]: (s.daily.runs[stageId] ?? 0) + 1 } },
  };
}

export type BuyError = 'not-enough-bones' | 'daily-limit';
export type BuyResult = { ok: true; state: GameState } | { ok: false; error: BuyError };

/** 今天還能買幾次體力 */
export function staminaBuysLeft(state: GameState, now: number, o?: TimeOptions): number {
  return Math.max(0, STAMINA_PACK.dailyLimit - settle(state, now, o).daily.staminaBuys);
}

/** 今天還能加購幾次出征次數 */
export function runBuysLeft(state: GameState, now: number, o?: TimeOptions): number {
  return Math.max(0, RUN_PACK.dailyLimit - settle(state, now, o).daily.runBuys);
}

/** 用骨頭幣買體力（可以超過上限） */
export function buyStamina(state: GameState, now: number, o?: TimeOptions): BuyResult {
  const s = settle(state, now, o);
  if (s.daily.staminaBuys >= STAMINA_PACK.dailyLimit) return { ok: false, error: 'daily-limit' };
  if (s.resources.bones < STAMINA_PACK.price) return { ok: false, error: 'not-enough-bones' };
  return {
    ok: true,
    state: {
      ...s,
      resources: { ...s.resources, bones: s.resources.bones - STAMINA_PACK.price },
      stamina: { value: s.stamina.value + STAMINA_PACK.amount, updatedAt: s.stamina.updatedAt },
      daily: { ...s.daily, staminaBuys: s.daily.staminaBuys + 1 },
    },
  };
}

/** 用骨頭幣替某一關加購出征次數 */
export function buyRun(state: GameState, stageId: string, now: number, o?: TimeOptions): BuyResult {
  const s = settle(state, now, o);
  if (s.daily.runBuys >= RUN_PACK.dailyLimit) return { ok: false, error: 'daily-limit' };
  if (s.resources.bones < RUN_PACK.price) return { ok: false, error: 'not-enough-bones' };
  return {
    ok: true,
    state: {
      ...s,
      resources: { ...s.resources, bones: s.resources.bones - RUN_PACK.price },
      daily: {
        ...s.daily,
        runBuys: s.daily.runBuys + 1,
        extraRuns: {
          ...s.daily.extraRuns,
          [stageId]: (s.daily.extraRuns[stageId] ?? 0) + RUN_PACK.amount,
        },
      },
    },
  };
}
