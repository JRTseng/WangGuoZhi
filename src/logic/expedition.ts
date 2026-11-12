import { DOGS, findDog } from '../data/dogs';
import { findStage } from '../data/regions';
import type { Resources } from '../data/resources';
import type { Expedition, GameState } from '../state/gameState';
import {
  BATTLE_TEAM_MAX,
  BATTLE_TEAM_MIN,
  DEFEAT_REWARD_RATE,
  createRng,
  mixSeed,
  resolveBattle,
  scaleReward,
  type BattleDog,
  type BattleResult,
} from './battle';
import { addExp, dogStats, expeditionExp, progressOf, sumUps, type DogExpGain } from './leveling';
import { isStageUnlocked } from './progress';
import { MINUTE_MS } from './timeScale';

/** 一支出征隊伍最多幾隻 */
export const TEAM_SIZE = BATTLE_TEAM_MAX;
/** 一支出征隊伍最少幾隻 */
export const TEAM_MIN = BATTLE_TEAM_MIN;

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
 * 開始出征。檢查：關卡存在且已解鎖、1 到 5 隻、不重複、狗存在且擁有、沒有正在出征。
 * minuteMs 為「1 分鐘」的毫秒數，測試模式可傳 1000。
 * seed 為這一仗的亂數種子，出發時就定下來；沒給就由時間與出征編號算出。
 */
export function startExpedition(
  state: GameState,
  stageId: string,
  dogIds: readonly string[],
  now: number,
  minuteMs: number = MINUTE_MS,
  seed?: number,
): Result<StartError> {
  const stage = findStage(stageId);
  if (!stage) return { ok: false, error: 'stage-not-found' };
  if (!isStageUnlocked(state, stageId)) return { ok: false, error: 'stage-locked' };
  if (dogIds.length < TEAM_MIN || dogIds.length > TEAM_SIZE)
    return { ok: false, error: 'wrong-team-size' };
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
    team: dogIds.flatMap((id) => battleDogOf(state, id) ?? []),
    startedAt: now,
    endsAt: now + stage.durationMin * minuteMs,
    seed: (seed ?? mixSeed(now, state.nextExpeditionNo)) >>> 0,
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

/** 把狗狗轉成戰鬥用的攻防等級：攻防 = 基礎值 + 升級成長值 */
export function battleDogOf(state: Pick<GameState, 'dogs'>, dogId: string): BattleDog | undefined {
  const d = findDog(dogId);
  if (!d) return undefined;
  const s = dogStats(state, d);
  return {
    id: d.id,
    name: d.name,
    attack: s.attack,
    defense: s.defense,
    level: s.level,
    hasSkill: !!d.skill,
  };
}

/** 關卡的敵人名字：Boss 關只有 Boss 一隻，其餘是三隻野犬（暫定） */
export function enemyNamesOf(stageId: string): string[] {
  const boss = findStage(stageId)?.boss;
  return boss ? [boss.name] : ['野犬甲', '野犬乙', '野犬丙'];
}

type BattleSource = Pick<Expedition, 'stageId' | 'team' | 'seed'>;

/**
 * 這次出征的戰鬥（勝負 + 回合紀錄）。只看關卡、出發當下的隊伍攻防與種子，
 * 所以收成前、收成後（用歷史紀錄，狗已經升級）算出來都一樣。
 */
export function expeditionBattle(exp: BattleSource): BattleResult {
  return resolveBattle({
    team: exp.team,
    recommendedPower: findStage(exp.stageId)?.recommendedPower ?? 0,
    enemyNames: enemyNamesOf(exp.stageId),
    seed: exp.seed,
  });
}

/** 這次出征的獎勵：勝利全額，敗北只拿一部分 */
export function expeditionReward(exp: Pick<Expedition, 'stageId'>, win: boolean): Resources {
  const stage = findStage(exp.stageId);
  const full = stage ? { ...stage.reward } : { food: 0, bones: 0 };
  return win ? full : scaleReward(full, DEFEAT_REWARD_RATE);
}

/** 升級亂數的種子：由這一仗的種子與隊伍位置算出，所以同一次出征怎麼收成結果都一樣 */
const LEVEL_SEED_SALT = 0x7005;

/**
 * 這次出征讓隊伍每隻狗拿到的經驗與升級結果（打輸一半）。
 * 回傳新的養成進度與每隻狗的收穫，不改原狀態。
 */
export function expeditionGrowth(
  state: Pick<GameState, 'dogs'>,
  exp: Pick<Expedition, 'stageId' | 'dogIds' | 'seed'>,
  win: boolean,
): { dogs: GameState['dogs']; gains: DogExpGain[] } {
  const stage = findStage(exp.stageId);
  const amount = stage ? expeditionExp(stage, win) : 0;
  const dogs = { ...state.dogs };
  const gains: DogExpGain[] = [];
  exp.dogIds.forEach((id, i) => {
    const d = findDog(id);
    if (!d) return;
    const before = progressOf(state, d);
    const r = addExp(before, d.role, amount, createRng(mixSeed(exp.seed, i + 1, LEVEL_SEED_SALT)));
    dogs[id] = r.progress;
    gains.push({
      dogId: id,
      exp: r.gained,
      fromLevel: before.level,
      toLevel: r.progress.level,
      ...sumUps(r.ups),
    });
  });
  return { dogs, gains };
}

/**
 * 收成：先結算戰鬥，再加資源與經驗（經驗滿了自動升級）、釋放狗狗、寫一筆歷史（含勝負）。
 * 打贏才記為通過該關（解鎖下一關）；打輸只拿部分獎勵與一半經驗，狗狗一樣回家。
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

  const { win } = expeditionBattle(exp);
  const reward = expeditionReward(exp, win);
  const growth = expeditionGrowth(state, exp, win);
  return {
    ok: true,
    state: {
      ...state,
      resources: {
        food: state.resources.food + reward.food,
        bones: state.resources.bones + reward.bones,
      },
      dogs: growth.dogs,
      expeditions: state.expeditions.filter((e) => e.id !== expeditionId),
      cleared:
        !win || state.cleared.includes(exp.stageId)
          ? state.cleared
          : [...state.cleared, exp.stageId],
      history: [
        ...state.history,
        {
          id: exp.id,
          stageId: exp.stageId,
          dogIds: [...exp.dogIds],
          team: exp.team.map((d) => ({ ...d })),
          startedAt: exp.startedAt,
          endsAt: exp.endsAt,
          collectedAt: now,
          reward,
          win,
          seed: exp.seed,
          gains: growth.gains,
        },
      ],
    },
  };
}
