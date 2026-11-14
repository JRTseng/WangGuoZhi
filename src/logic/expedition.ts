import { DOGS, findDog } from '../data/dogs';
import { BACKGROUNDS } from '../data/backgrounds';
import { findRegionOfStage, findStage } from '../data/regions';
import type { Resources } from '../data/resources';
import type { ExpeditionRecord, GameState, PendingBattle } from '../state/gameState';
import {
  BATTLE_TEAM_MAX,
  BATTLE_TEAM_MIN,
  DEFEAT_REWARD_RATE,
  createRng,
  mixSeed,
  resolveBattle,
  scaleReward,
  winChance,
  type BattleDog,
  type BattleInput,
  type BattleResult,
} from './battle';
import { addGear, dropNote, grantExclusives, rollDrop } from './equipment';
import { exclusiveGearOf, findGear } from '../data/equipment';
import { battleRoleOf, teamCells } from './formation';
import {
  addExp,
  dogStats,
  expeditionExp,
  initialProgress,
  progressOf,
  sumUps,
  type DogExpGain,
} from './leveling';
import { isStageUnlocked, unlockedBackgrounds } from './progress';
import { runBlock, spendRun, type TimeOptions } from './stamina';
import { markWounds } from './wounds';

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
  | 'dog-busy'
  | 'no-runs'
  | 'no-stamina';

export type RunResult =
  { ok: true; state: GameState; record: ExpeditionRecord } | { ok: false; error: RunError };

/** 出征紀錄只留最近幾筆（重播戰鬥與結算用），不讓存檔越長越大 */
export const HISTORY_MAX = 30;
/** 第一次通關要送的狗已經先從召募抽到時，改送幾個碎片（和重複抽到一樣） */
export const GIFT_DUPLICATE_SHARDS = 10;

/**
 * 目前不能出征的狗狗 id：在訓練場寄宿中的狗（T021）。
 * T019 起出征當下就打完，所以沒有狗會「出征中」。
 */
export function busyDogIds(state?: Pick<GameState, 'boarding'>): Set<string> {
  return new Set((state?.boarding ?? []).map((s) => s.dogId));
}

/** 可出征的狗狗 id：擁有的，依 DOGS 順序 */
export function idleDogIds(state: GameState): string[] {
  const busy = busyDogIds(state);
  return DOGS.map((d) => d.id).filter((id) => state.owned.includes(id) && !busy.has(id));
}

/** 把狗狗轉成戰鬥用的攻防、定位：攻防 = 基礎值 + 升級成長值 + 裝備加成。站位另外由 battleTeamOf 填 */
export function battleDogOf(
  state: Pick<GameState, 'dogs'> & { equipped?: GameState['equipped'] },
  dogId: string,
): BattleDog | undefined {
  const d = findDog(dogId);
  if (!d) return undefined;
  const s = dogStats(state, d);
  const role = battleRoleOf(d.role);
  return {
    id: d.id,
    name: d.name,
    attack: s.attack,
    defense: s.defense,
    level: s.level,
    hasSkill: !!d.skill,
    ...(role ? { role } : {}),
    ...(role === '補血' ? { heal: true } : {}),
    ...(d.rarity === 'SSR' ? { ssr: true } : {}),
    ...(d.rarity ? { rarity: d.rarity } : {}),
    ...(d.afterHeal ? { afterHeal: true } : {}),
    ...(d.trait ? { trait: d.trait } : {}),
  };
}

/** 一支隊伍的戰鬥資料：攻防、定位，加上目前陣型的站位（T023） */
export function battleTeamOf(
  state: Pick<GameState, 'dogs' | 'formation'> & { equipped?: GameState['equipped'] },
  dogIds: readonly string[],
): BattleDog[] {
  const known = dogIds.filter((id) => !!findDog(id));
  const cells = teamCells(state, known);
  return known.map((id, i) => ({
    ...battleDogOf(state, id)!,
    row: cells[i].row,
    lane: cells[i].lane,
  }));
}

/** 這一關最多能上陣幾隻（T018）：跟著敵人數量；找不到關卡就用隊伍上限 */
export function stageTeamMax(stageId: string): number {
  return Math.min(TEAM_SIZE, findStage(stageId)?.teamMax ?? TEAM_SIZE);
}

type BattleSource = Pick<ExpeditionRecord, 'stageId' | 'team' | 'seed'>;

/** 這一仗的開場資料：關卡自己的敵人陣容，加上隊伍與種子 */
export function battleInputOf(exp: BattleSource): BattleInput {
  const stage = findStage(exp.stageId);
  return {
    team: exp.team,
    recommendedPower: stage?.recommendedPower ?? 0,
    enemies: stage?.enemies ?? [],
    scale: stage?.scale ?? 1,
    seed: exp.seed,
  };
}

/**
 * 這次出征的戰鬥（勝負 + 回合紀錄）。只看關卡、出發當下的隊伍與種子，
 * 以及我方放招的時機（ultTurns；沒有就是自動放招），所以之後用紀錄重算出來都一樣。
 */
export function expeditionBattle(
  exp: BattleSource & { ultTurns?: readonly number[] },
): BattleResult {
  return resolveBattle(battleInputOf(exp), exp.ultTurns ? { ultTurns: exp.ultTurns } : {});
}

/** 選隊伍畫面的「勝率約 N%」：用目前的攻防與陣型、自動放招模擬很多場 */
export function stageWinChance(
  state: Pick<GameState, 'dogs' | 'formation'> & { equipped?: GameState['equipped'] },
  stageId: string,
  dogIds: readonly string[],
): number {
  if (dogIds.length < TEAM_MIN || dogIds.length > stageTeamMax(stageId)) return 0;
  return winChance(battleInputOf({ stageId, team: battleTeamOf(state, dogIds), seed: 0 }));
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
    const rng = createRng(mixSeed(exp.seed, i + 1, LEVEL_SEED_SALT));
    const r = addExp(before, d.role, amount, rng, d.rarity);
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

export interface RunOptions extends TimeOptions {
  seed?: number;
  auto?: boolean;
}

/** 開戰前的檢查：通過回傳 null，不行回傳原因 */
function runError(
  state: GameState,
  stageId: string,
  dogIds: readonly string[],
  now: number,
  opts: TimeOptions,
): RunError | null {
  if (!findStage(stageId)) return 'stage-not-found';
  if (!isStageUnlocked(state, stageId)) return 'stage-locked';
  if (dogIds.length < TEAM_MIN || dogIds.length > stageTeamMax(stageId)) return 'wrong-team-size';
  if (new Set(dogIds).size !== dogIds.length) return 'duplicate-dog';
  if (!dogIds.every((id) => DOGS.some((d) => d.id === id))) return 'dog-not-found';
  if (!dogIds.every((id) => state.owned.includes(id))) return 'dog-not-owned';
  const busy = busyDogIds(state);
  if (dogIds.some((id) => busy.has(id))) return 'dog-busy';
  const block = runBlock(state, stageId, now, opts);
  return block.ok ? null : block.reason;
}

/** 扣體力與次數，把這一仗的隊伍（攻防、站位）與種子定下來 */
function openBattle(
  state: GameState,
  stageId: string,
  dogIds: readonly string[],
  now: number,
  opts: RunOptions,
): { paid: GameState; ticket: PendingBattle } {
  return {
    paid: spendRun(state, stageId, now, opts),
    ticket: {
      stageId,
      dogIds: [...dogIds],
      team: battleTeamOf(state, dogIds),
      seed: (opts.seed ?? mixSeed(now, state.nextExpeditionNo)) >>> 0,
      at: now,
    },
  };
}

/** 掉落亂數的種子：和升級一樣由這一仗的種子算出，同一仗怎麼算都掉一樣的東西 */
const DROP_SEED_SALT = 0xd409;

/** 這一仗掉的裝備（T014）：打贏才會掉，機率與比重見 src/logic/equipment.ts；沒掉回傳 null */
export function expeditionDrop(
  exp: Pick<ExpeditionRecord, 'stageId' | 'seed'>,
  win: boolean,
): string | null {
  const stage = findStage(exp.stageId);
  if (!win || !stage) return null;
  const chapter = findRegionOfStage(exp.stageId)?.chapter ?? 1;
  const rng = createRng(mixSeed(exp.seed, DROP_SEED_SALT));
  return rollDrop(chapter, !!stage.boss, rng)?.id ?? null;
}

/**
 * 結算一仗：算勝負、加資源與經驗（經驗滿了自動升級）、寫一筆紀錄。
 * 打贏才記為通過該關（解鎖下一關）；打輸只拿部分獎勵與一半經驗。
 * 第一次打贏有 firstClearDog 的關卡，那隻狗會加入（紀錄的 newDogId）。
 * ultTurns 是玩家手動放招的時機；沒有就用自動放招。
 */
function settleBattle(
  state: GameState,
  ticket: PendingBattle,
  opts: { ultTurns?: readonly number[]; auto?: boolean } = {},
): { state: GameState; record: ExpeditionRecord } {
  const stage = findStage(ticket.stageId);
  const exp = {
    stageId: ticket.stageId,
    dogIds: [...ticket.dogIds],
    team: ticket.team,
    seed: ticket.seed,
    ...(opts.ultTurns ? { ultTurns: [...opts.ultTurns] } : {}),
  };
  const { win } = expeditionBattle(exp);
  const reward = expeditionReward(exp, win);
  const growth = expeditionGrowth(state, exp, win);
  const dropGearId = expeditionDrop(exp, win);
  // 第一次打贏有送狗的關卡：狗狗加入（已經擁有就不再送）
  const firstClear = win && !state.cleared.includes(exp.stageId);
  const gift = firstClear ? findDog(stage?.firstClearDog ?? '') : undefined;
  const newDog = gift && !state.owned.includes(gift.id) ? gift : undefined;
  // 送的狗已經先從召募抽到了：改送碎片，可以拿去升星
  const giftShards =
    gift && !newDog ? { dogId: gift.id, amount: GIFT_DUPLICATE_SHARDS } : undefined;
  const record: ExpeditionRecord = {
    id: `exp-${state.nextExpeditionNo}`,
    ...exp,
    at: ticket.at,
    reward,
    win,
    gains: growth.gains,
    ...(opts.auto ? { auto: true } : {}),
    ...(dropGearId ? { dropGearId } : {}),
    ...(newDog ? { newDogId: newDog.id } : {}),
    ...(giftShards ? { giftShards } : {}),
  };
  const next: GameState = {
    ...state,
    pending: null,
    // 受傷外觀：出戰的狗休息一下，打輸的全部掛彩（不影響數值）
    wounds: markWounds(state, exp.dogIds, win, ticket.at),
    gear: dropGearId ? addGear(state, dropGearId).gear : state.gear,
    resources: {
      food: state.resources.food + reward.food,
      bones: state.resources.bones + reward.bones,
    },
    dogs: newDog ? { ...growth.dogs, [newDog.id]: initialProgress(newDog) } : growth.dogs,
    owned: newDog ? [...state.owned, newDog.id] : state.owned,
    shards: giftShards
      ? {
          ...state.shards,
          [giftShards.dogId]: (state.shards[giftShards.dogId] ?? 0) + giftShards.amount,
        }
      : state.shards,
    nextExpeditionNo: state.nextExpeditionNo + 1,
    cleared:
      !win || state.cleared.includes(exp.stageId) ? state.cleared : [...state.cleared, exp.stageId],
    history: [...state.history, record].slice(-HISTORY_MAX),
  };
  // 新夥伴有專屬裝備的話一起送（T014）
  return { record, state: newDog ? grantExclusives(next) : next };
}

/**
 * 出征（T019）：沒有等待時間，按下去就用自動放招打完（略過戰鬥畫面、自動出征用這個）。
 * 檢查：關卡存在且已解鎖、1 隻到這一關的上陣上限、不重複、狗存在且擁有、沒在寄宿、今天還有次數、體力夠。
 * seed 為這一仗的亂數種子；沒給就由時間與出征編號算出。
 */
export function runExpedition(
  state: GameState,
  stageId: string,
  dogIds: readonly string[],
  now: number,
  opts: RunOptions = {},
): RunResult {
  const error = runError(state, stageId, dogIds, now, opts);
  if (error) return { ok: false, error };
  const { paid, ticket } = openBattle(state, stageId, dogIds, now, opts);
  return { ok: true, ...settleBattle(paid, ticket, { auto: opts.auto }) };
}

/**
 * 開戰（T023，要進戰鬥畫面一步一步打的時候用）：檢查和 runExpedition 一樣，
 * 通過就扣體力與次數，把這一仗記在 state.pending，等戰鬥畫面打完再用 completeExpedition 結算。
 * 上一仗還沒結算（pending 還在）就先用自動放招把它算完。
 */
export function beginExpedition(
  state: GameState,
  stageId: string,
  dogIds: readonly string[],
  now: number,
  opts: RunOptions = {},
): { ok: true; state: GameState } | { ok: false; error: RunError } {
  const base = settlePending(state);
  const error = runError(base, stageId, dogIds, now, opts);
  if (error) return { ok: false, error };
  const { paid, ticket } = openBattle(base, stageId, dogIds, now, opts);
  return { ok: true, state: { ...paid, pending: ticket } };
}

/**
 * 把開戰中的那一仗結算掉。ultTurns 是玩家在戰鬥畫面實際放招的時機
 * （我方在整場第幾次出手時放了大絕招）；沒給就用自動放招。沒有開戰中的仗回傳 null。
 */
export function completeExpedition(
  state: GameState,
  ultTurns?: readonly number[],
): { state: GameState; record: ExpeditionRecord } | null {
  if (!state.pending) return null;
  return settleBattle(state, state.pending, { ultTurns });
}

/** 有開戰到一半就關掉的仗：用自動放招直接算完（開遊戲讀檔時呼叫）；沒有就原樣回傳 */
export function settlePending(state: GameState): GameState {
  return completeExpedition(state)?.state ?? state;
}

/**
 * 結算面板上額外的訊息：有沒有通過關卡、新夥伴、改送的碎片、新的主頁背景。
 * before 是開戰前的狀態，after 是結算後的狀態。
 */
export function resultNotes(
  before: Pick<GameState, 'cleared' | 'redeemedCodes'>,
  after: Pick<GameState, 'cleared' | 'redeemedCodes'>,
  record: ExpeditionRecord,
): string[] {
  const notes: string[] = [];
  if (!record.win) {
    notes.push('只帶回三成物資，關卡還沒通過');
    notes.push('狗狗們掛彩了，休息一下就好（不影響能力）');
  } else if (!before.cleared.includes(record.stageId)) notes.push('通過關卡！下一關已開放');
  const drop = findGear(record.dropGearId ?? '');
  if (drop) notes.push(dropNote(drop));
  const gift = record.newDogId ? findDog(record.newDogId) : undefined;
  if (gift) {
    notes.push(`新夥伴「${gift.name}」加入！（${gift.breed}・${battleRoleOf(gift.role) ?? ''}）`);
    const own = exclusiveGearOf(gift.id);
    if (own) notes.push(`附贈專屬裝備「${own.name}」`);
  }
  if (record.giftShards) {
    const name = findDog(record.giftShards.dogId)?.name ?? '';
    notes.push(`已經有「${name}」了，改送碎片 ×${record.giftShards.amount}`);
  }
  const had = unlockedBackgrounds(before);
  for (const b of unlockedBackgrounds(after)) {
    if (!had.includes(b))
      notes.push(`獲得主頁背景「${BACKGROUNDS.find((x) => x.id === b)?.name}」`);
  }
  return notes;
}
