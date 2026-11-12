import { DOGS, findDog } from '../data/dogs';
import { findStage } from '../data/regions';
import type { Resources } from '../data/resources';
import type { ExpeditionRecord, GameState } from '../state/gameState';
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
import { runBlock, spendRun, type TimeOptions } from './stamina';

/** 一支出征隊伍最多幾隻 */
export const TEAM_SIZE = BATTLE_TEAM_MAX;
/** 一支出征隊伍最少幾隻 */
export const TEAM_MIN = BATTLE_TEAM_MIN;

export type RunError =
  | 'stage-not-found'
  | 'stage-locked'
  | 'wrong-team-size'
  | 'duplicate-dog'
  | 'dog-not-found'
  | 'dog-not-owned'
  | 'no-runs'
  | 'no-stamina';

export type RunResult =
  { ok: true; state: GameState; record: ExpeditionRecord } | { ok: false; error: RunError };

/** 出征紀錄只留最近幾筆（重播戰鬥與結算用），不讓存檔越長越大 */
export const HISTORY_MAX = 30;

/**
 * 目前不能出征的狗狗 id。T019 起出征當下就打完，沒有狗會「出征中」，所以是空的；
 * 選狗畫面的狀態篩選還留著這個概念，之後 T021 板凳寄宿會用到。
 */
export function busyDogIds(state?: GameState): Set<string> {
  void state;
  return new Set();
}

/** 可出征的狗狗 id：擁有的，依 DOGS 順序 */
export function idleDogIds(state: GameState): string[] {
  const busy = busyDogIds(state);
  return DOGS.map((d) => d.id).filter((id) => state.owned.includes(id) && !busy.has(id));
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

type BattleSource = Pick<ExpeditionRecord, 'stageId' | 'team' | 'seed'>;

/**
 * 這次出征的戰鬥（勝負 + 回合紀錄）。只看關卡、出發當下的隊伍攻防與種子，
 * 所以結算當下和之後用紀錄重播（狗已經升級）算出來都一樣。
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
export function expeditionReward(exp: Pick<ExpeditionRecord, 'stageId'>, win: boolean): Resources {
  const stage = findStage(exp.stageId);
  const full = stage ? { ...stage.reward } : { food: 0, bones: 0 };
  return win ? full : scaleReward(full, DEFEAT_REWARD_RATE);
}

/** 升級亂數的種子：由這一仗的種子與隊伍位置算出，所以同一次出征怎麼算結果都一樣 */
const LEVEL_SEED_SALT = 0x7005;

/**
 * 這次出征讓隊伍每隻狗拿到的經驗與升級結果（打輸一半）。
 * 回傳新的養成進度與每隻狗的收穫，不改原狀態。
 */
export function expeditionGrowth(
  state: Pick<GameState, 'dogs'>,
  exp: Pick<ExpeditionRecord, 'stageId' | 'dogIds' | 'seed'>,
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
 * 出征（T019）：沒有等待時間，按下去就打完。
 * 檢查：關卡存在且已解鎖、1 到 5 隻、不重複、狗存在且擁有、今天還有次數、體力夠。
 * 通過就扣體力與次數、結算戰鬥、加資源與經驗（經驗滿了自動升級）、寫一筆紀錄。
 * 打贏才記為通過該關（解鎖下一關）；打輸只拿部分獎勵與一半經驗。
 * seed 為這一仗的亂數種子；沒給就由時間與出征編號算出。
 */
export function runExpedition(
  state: GameState,
  stageId: string,
  dogIds: readonly string[],
  now: number,
  opts: TimeOptions & { seed?: number; auto?: boolean } = {},
): RunResult {
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
  const block = runBlock(state, stageId, now, opts);
  if (!block.ok) return { ok: false, error: block.reason };

  const paid = spendRun(state, stageId, now, opts);
  const exp = {
    stageId,
    dogIds: [...dogIds],
    team: dogIds.flatMap((id) => battleDogOf(state, id) ?? []),
    seed: (opts.seed ?? mixSeed(now, state.nextExpeditionNo)) >>> 0,
  };
  const { win } = expeditionBattle(exp);
  const reward = expeditionReward(exp, win);
  const growth = expeditionGrowth(state, exp, win);
  const record: ExpeditionRecord = {
    id: `exp-${state.nextExpeditionNo}`,
    ...exp,
    at: now,
    reward,
    win,
    gains: growth.gains,
    ...(opts.auto ? { auto: true } : {}),
  };
  return {
    ok: true,
    record,
    state: {
      ...paid,
      resources: {
        food: paid.resources.food + reward.food,
        bones: paid.resources.bones + reward.bones,
      },
      dogs: growth.dogs,
      nextExpeditionNo: state.nextExpeditionNo + 1,
      cleared:
        !win || state.cleared.includes(stageId) ? state.cleared : [...state.cleared, stageId],
      history: [...state.history, record].slice(-HISTORY_MAX),
    },
  };
}
