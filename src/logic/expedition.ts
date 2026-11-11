import { DOGS } from '../data/dogs';
import { findStage } from '../data/regions';
import type { Resources } from '../data/resources';
import type { Expedition, GameState } from '../state/gameState';
import { isStageUnlocked } from './progress';
import { MINUTE_MS } from './timeScale';

/** 一支出征隊伍的固定人數 */
export const TEAM_SIZE = 3;

export type StartError =
  | 'stage-not-found'
  | 'stage-locked'
  | 'wrong-team-size'
  | 'duplicate-dog'
  | 'dog-not-found'
  | 'dog-not-owned'
  | 'dog-busy';

export type CollectError = 'expedition-not-found' | 'not-ready';

export type Result<E> = { ok: true; state: GameState } | { ok: false; error: E };

/** 目前出征中的狗狗 id */
export function busyDogIds(state: GameState): Set<string> {
  return new Set(state.expeditions.flatMap((e) => e.dogIds));
}

/** 閒置（可出征）的狗狗 id：擁有且沒在出征，依 DOGS 順序 */
export function idleDogIds(state: GameState): string[] {
  const busy = busyDogIds(state);
  return DOGS.map((d) => d.id).filter((id) => state.owned.includes(id) && !busy.has(id));
}

/**
 * 開始出征。檢查：關卡存在且已解鎖、剛好 3 隻、不重複、狗存在且擁有、沒有正在出征。
 * minuteMs 為「1 分鐘」的毫秒數，測試模式可傳 1000。
 */
export function startExpedition(
  state: GameState,
  stageId: string,
  dogIds: readonly string[],
  now: number,
  minuteMs: number = MINUTE_MS,
): Result<StartError> {
  const stage = findStage(stageId);
  if (!stage) return { ok: false, error: 'stage-not-found' };
  if (!isStageUnlocked(state, stageId)) return { ok: false, error: 'stage-locked' };
  if (dogIds.length !== TEAM_SIZE) return { ok: false, error: 'wrong-team-size' };
  if (new Set(dogIds).size !== dogIds.length) return { ok: false, error: 'duplicate-dog' };
  if (!dogIds.every((id) => DOGS.some((d) => d.id === id))) {
    return { ok: false, error: 'dog-not-found' };
  }
  if (!dogIds.every((id) => state.owned.includes(id))) {
    return { ok: false, error: 'dog-not-owned' };
  }
  const busy = busyDogIds(state);
  if (dogIds.some((id) => busy.has(id))) return { ok: false, error: 'dog-busy' };

  const expedition: Expedition = {
    id: `exp-${state.nextExpeditionNo}`,
    stageId,
    dogIds: [...dogIds],
    startedAt: now,
    endsAt: now + stage.durationMin * minuteMs,
  };
  return {
    ok: true,
    state: {
      ...state,
      expeditions: [...state.expeditions, expedition],
      nextExpeditionNo: state.nextExpeditionNo + 1,
    },
  };
}

/** 總耗時（毫秒） */
export function durationMs(exp: Expedition): number {
  return Math.max(0, exp.endsAt - exp.startedAt);
}

/**
 * 剩餘毫秒，介於 0 到總耗時之間。
 * 系統時間被調快 → 直接變 0（可收成）；被調慢到開始之前 → 最多顯示總耗時，不會變更長。
 */
export function remainingMs(exp: Expedition, now: number): number {
  return Math.min(durationMs(exp), Math.max(0, exp.endsAt - now));
}

/** 是否已可收成 */
export function isComplete(exp: Expedition, now: number): boolean {
  return now >= exp.endsAt;
}

/** 進度 0 到 1 */
export function progress(exp: Expedition, now: number): number {
  const total = durationMs(exp);
  if (total === 0) return 1;
  return 1 - remainingMs(exp, now) / total;
}

/** 這次出征的獎勵（T003 為固定獎勵，T004 會加入勝負） */
export function expeditionReward(exp: Expedition): Resources {
  const stage = findStage(exp.stageId);
  return stage ? { ...stage.reward } : { food: 0, bones: 0 };
}

/**
 * 收成：加資源、釋放狗狗、寫一筆歷史、記為通過該關（解鎖下一關）。
 * 時間未到或找不到則回傳錯誤，狀態不變。
 */
export function collectExpedition(
  state: GameState,
  expeditionId: string,
  now: number,
): Result<CollectError> {
  const exp = state.expeditions.find((e) => e.id === expeditionId);
  if (!exp) return { ok: false, error: 'expedition-not-found' };
  if (!isComplete(exp, now)) return { ok: false, error: 'not-ready' };

  const reward = expeditionReward(exp);
  return {
    ok: true,
    state: {
      ...state,
      resources: {
        food: state.resources.food + reward.food,
        bones: state.resources.bones + reward.bones,
      },
      expeditions: state.expeditions.filter((e) => e.id !== expeditionId),
      cleared: state.cleared.includes(exp.stageId)
        ? state.cleared
        : [...state.cleared, exp.stageId],
      history: [
        ...state.history,
        {
          id: exp.id,
          stageId: exp.stageId,
          dogIds: [...exp.dogIds],
          startedAt: exp.startedAt,
          endsAt: exp.endsAt,
          collectedAt: now,
          reward,
        },
      ],
    },
  };
}
