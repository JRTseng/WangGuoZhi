import type { GameState } from '../state/gameState';

/**
 * 受傷外觀（T014，Jimmy 2026-11-12）：純外觀，不影響任何數值。
 * 剛出征回來的狗會貼 OK 繃、在主頁舔傷口休息一下；打輸的話出戰的狗全部掛彩，還會戴上頭套。
 * 過一陣子自己恢復。狀態只記「到什麼時候為止」與程度，要用時才看有沒有過期。
 */

/** 0 沒事；1 剛回來，貼 OK 繃；2 打輸掛彩，OK 繃加頭套 */
export type WoundLevel = 0 | 1 | 2;

/** 打贏回來休息多久、打輸掛彩多久（暫定） */
export const REST_MS = 3 * 60_000;
export const HURT_MS = 10 * 60_000;

type HasWounds = Pick<GameState, 'wounds'>;

/** 這隻狗現在的樣子（過期了就是沒事） */
export function woundLevel(state: Partial<HasWounds>, dogId: string, now: number): WoundLevel {
  const w = state.wounds?.[dogId];
  return w && w.until > now ? w.level : 0;
}

/**
 * 一仗打完：出戰的狗打贏記成「剛回來」、打輸記成「掛彩」。
 * 原本還在掛彩的不會因為打贏一場就變輕；順便把過期的清掉。
 */
export function markWounds(
  state: HasWounds,
  dogIds: readonly string[],
  win: boolean,
  now: number,
): GameState['wounds'] {
  const out: GameState['wounds'] = {};
  for (const [id, w] of Object.entries(state.wounds)) if (w.until > now) out[id] = w;
  const level = win ? 1 : 2;
  const until = now + (win ? REST_MS : HURT_MS);
  for (const id of dogIds) {
    const old = out[id];
    out[id] = old
      ? { level: old.level > level ? old.level : level, until: Math.max(old.until, until) }
      : { level, until };
  }
  return out;
}

/** 讀檔時的整理：只留擁有的狗、還沒過期的；時間不能比「現在＋最長掛彩時間」還晚 */
export function sanitizeWounds(
  raw: unknown,
  isOwned: (dogId: string) => boolean,
  now: number,
): GameState['wounds'] {
  const out: GameState['wounds'] = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (!isOwned(id) || typeof v !== 'object' || v === null) continue;
    const { until, level } = v as { until?: unknown; level?: unknown };
    if (typeof until !== 'number' || !Number.isFinite(until) || until <= now) continue;
    if (level !== 1 && level !== 2) continue;
    out[id] = { level, until: Math.min(Math.floor(until), now + HURT_MS) };
  }
  return out;
}
