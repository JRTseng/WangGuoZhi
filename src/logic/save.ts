import { BACKGROUNDS } from '../data/backgrounds';
import { DOGS, findDog } from '../data/dogs';
import { findStage, type ThemeId } from '../data/regions';
import type { Resources } from '../data/resources';
import { findStory } from '../data/stories';
import {
  createInitialState,
  type AutoSummary,
  type BoardingSlot,
  type DogProgress,
  type ExpeditionRecord,
  type GameState,
  type PendingBattle,
  type Quality,
  type Settings,
} from '../state/gameState';
import { boardingSlotCount } from './boarding';
import { HISTORY_MAX, TEAM_SIZE, battleTeamOf } from './expedition';
import { isFormationValue } from './formation';
import { PITY_SSR } from './gacha';
import { MAX_LEVEL, STAR_MAX, expNeeded, initialProgress, levelCapForStar } from './leveling';
import { cleanSkillLine } from './skillShow';
import { DRILL_MAX } from './training';
import { isTrainingSort } from './trainingSort';

/**
 * 存檔與讀檔（T006）。全部是純函式：這裡只負責「狀態 ↔ 字串」，
 * 真正讀寫 localStorage 在 src/state/store.ts。
 *
 * 讀檔的原則：
 * - 整份讀不懂（不是 JSON、不是物件、沒有 state）→ 當成壞檔，回到新遊戲。
 * - 讀得懂但某個欄位怪怪的或缺了 → 只把那個欄位補成預設值，其他進度留著。
 *   所以之後的任務加新欄位，舊存檔不用特別處理就能讀。
 * - 欄位改名或改結構時，把 SAVE_VERSION 加 1，並在 MIGRATIONS 加一步轉換。
 */

/** 存檔格式版本 */
export const SAVE_VERSION = 1;
/** localStorage 的鍵 */
export const SAVE_KEY = 'wgz-save';
/** 壞檔在重置前會先搬到這裡，需要時還救得回來 */
export const SAVE_BACKUP_KEY = 'wgz-save-broken';

export interface SaveFile {
  version: number;
  /** 存檔時間（毫秒時間戳） */
  savedAt: number;
  state: GameState;
}

/** new：沒有存檔，新遊戲；ok：讀檔成功；reset：存檔壞了，已重置成新遊戲 */
export type LoadStatus = 'new' | 'ok' | 'reset';

export interface LoadResult {
  state: GameState;
  status: LoadStatus;
}

export function serialize(state: GameState, now: number): string {
  const file: SaveFile = { version: SAVE_VERSION, savedAt: now, state };
  return JSON.stringify(file);
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 整數並限制在範圍內；不是數字就用預設值 */
function int(v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return isNum(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;
}

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** 不重複的字串陣列，只留通過 keep 的 */
function stringList(v: unknown, keep: (s: string) => boolean): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const s of v) {
    if (typeof s === 'string' && keep(s) && !out.includes(s)) out.push(s);
  }
  return out;
}

/** 以關卡 id 為鍵的次數表 */
function countMap(v: unknown, keep: (key: string) => boolean): Record<string, number> {
  if (!isObj(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) {
    if (keep(k) && isNum(n) && n > 0) out[k] = Math.floor(n);
  }
  return out;
}

function resources(v: unknown, fallback: Resources): Resources {
  if (!isObj(v)) return { ...fallback };
  return { food: int(v.food, fallback.food), bones: int(v.bones, fallback.bones) };
}

function dogProgress(v: unknown, fallback: DogProgress): DogProgress {
  if (!isObj(v)) return fallback;
  const level = int(v.level, fallback.level, 1, MAX_LEVEL);
  // 星數是後來才加的欄位（T007），沒有就是 1 星；等級上限看星數
  const star = int(v.star, 1, 1, STAR_MAX);
  const need = expNeeded(level, levelCapForStar(star));
  const p: DogProgress = {
    level,
    exp: int(v.exp, 0, 0, Math.max(0, need - 1)),
    growthAttack: int(v.growthAttack, 0),
    growthDefense: int(v.growthDefense, 0),
    bonusAttack: int(v.bonusAttack, 0),
    bonusDefense: int(v.bonusDefense, 0),
    rolls: int(v.rolls, 0),
  };
  // 特訓次數是後來才加的欄位（T020），沒練過的狗可以沒有
  if (isNum(v.drillAttack)) p.drillAttack = int(v.drillAttack, 0, 0, DRILL_MAX);
  if (isNum(v.drillDefense)) p.drillDefense = int(v.drillDefense, 0, 0, DRILL_MAX);
  if (star > 1) p.star = star;
  return p;
}

const isStage = (id: string): boolean => !!findStage(id);
const isDog = (id: string): boolean => !!findDog(id);

/** 出征紀錄只是用來重播與顯示，有一點不對就整筆丟掉，不影響進度 */
function historyRecord(v: unknown): ExpeditionRecord | null {
  if (!isObj(v)) return null;
  if (typeof v.id !== 'string' || typeof v.stageId !== 'string' || !isStage(v.stageId)) return null;
  if (!Array.isArray(v.dogIds) || !v.dogIds.every((d) => typeof d === 'string' && isDog(d))) {
    return null;
  }
  if (!isNum(v.at) || !isNum(v.seed) || typeof v.win !== 'boolean') return null;
  if (!isObj(v.reward) || !isNum(v.reward.food) || !isNum(v.reward.bones)) return null;
  const teamOk =
    Array.isArray(v.team) &&
    v.team.every(
      (t) =>
        isObj(t) &&
        typeof t.id === 'string' &&
        typeof t.name === 'string' &&
        isNum(t.attack) &&
        isNum(t.defense) &&
        isNum(t.level),
    );
  const statOk = (s: unknown): boolean => isObj(s) && isNum(s.fixed) && isNum(s.bonus);
  const gainsOk =
    Array.isArray(v.gains) &&
    v.gains.every(
      (g) =>
        isObj(g) &&
        typeof g.dogId === 'string' &&
        isNum(g.exp) &&
        isNum(g.fromLevel) &&
        isNum(g.toLevel) &&
        statOk(g.attack) &&
        statOk(g.defense),
    );
  if (!teamOk || !gainsOk) return null;
  if (v.newDogId !== undefined && (typeof v.newDogId !== 'string' || !isDog(v.newDogId))) {
    return null;
  }
  if (v.giftShards !== undefined) {
    const g = v.giftShards;
    if (!isObj(g) || typeof g.dogId !== 'string' || !isDog(g.dogId) || !isNum(g.amount)) {
      return null;
    }
  }
  // 放招時機（T023）：手動放招的紀錄才有，要是一串不是負數的整數
  if (v.ultTurns !== undefined) {
    if (!Array.isArray(v.ultTurns) || !v.ultTurns.every((n) => isNum(n) && n >= 0)) return null;
  }
  return v as unknown as ExpeditionRecord;
}

function autoSummary(v: unknown): AutoSummary | null {
  if (!isObj(v) || !isNum(v.runs) || v.runs <= 0) return null;
  const dogs: AutoSummary['dogs'] = {};
  if (isObj(v.dogs)) {
    for (const [id, d] of Object.entries(v.dogs)) {
      if (isDog(id) && isObj(d)) dogs[id] = { exp: int(d.exp, 0), levels: int(d.levels, 0) };
    }
  }
  const runs = int(v.runs, 0);
  return {
    runs,
    wins: int(v.wins, 0, 0, runs),
    reward: resources(v.reward, { food: 0, bones: 0 }),
    stages: countMap(v.stages, isStage),
    dogs,
  };
}

function settings(v: unknown, fallback: Settings): Settings {
  if (!isObj(v)) return { ...fallback };
  const quality: Quality =
    v.quality === 'low' || v.quality === 'medium' || v.quality === 'high'
      ? v.quality
      : fallback.quality;
  const speed = v.battleSpeed;
  return {
    voice: bool(v.voice, fallback.voice),
    music: bool(v.music, fallback.music),
    push: bool(v.push, fallback.push),
    quality,
    skipBattle: bool(v.skipBattle, fallback.skipBattle),
    battleSpeed:
      speed === 1 || speed === 2 || speed === 3 || speed === 4 ? speed : fallback.battleSpeed,
    autoUlt: bool(v.autoUlt, fallback.autoUlt),
    trainingSort: isTrainingSort(v.trainingSort) ? v.trainingSort : fallback.trainingSort,
  };
}

/**
 * 把讀進來的資料整理成一份一定合法的 GameState：
 * 缺的、型別不對的、超出範圍的欄位都補成新遊戲的預設值，認不得的狗狗與關卡 id 丟掉。
 */
export function sanitizeState(raw: unknown, now: number): GameState {
  const base = createInitialState(now);
  if (!isObj(raw)) return base;

  let owned = stringList(raw.owned, isDog);
  if (owned.length === 0) owned = base.owned;

  const rawDogs = isObj(raw.dogs) ? raw.dogs : {};
  const dogs: Record<string, DogProgress> = {};
  for (const d of DOGS) {
    // 擁有的狗一定要有進度；還沒擁有但已有進度的（之後可能用得到）也留著
    if (owned.includes(d.id) || isObj(rawDogs[d.id])) {
      dogs[d.id] = dogProgress(rawDogs[d.id], initialProgress(d));
    }
  }

  const isOwned = (id: string): boolean => owned.includes(id);
  const team = Array.isArray(raw.team)
    ? stringList(raw.team, isOwned).slice(0, TEAM_SIZE)
    : base.team.filter(isOwned);

  const lobbyDogId =
    typeof raw.lobbyDogId === 'string' && isOwned(raw.lobbyDogId) ? raw.lobbyDogId : owned[0];
  const backgroundId: ThemeId =
    BACKGROUNDS.find((b) => b.id === raw.backgroundId)?.id ?? base.backgroundId;

  const history = Array.isArray(raw.history)
    ? raw.history
        .map(historyRecord)
        .filter((r): r is ExpeditionRecord => r !== null)
        .slice(-HISTORY_MAX)
    : [];

  const stamina = isObj(raw.stamina)
    ? {
        value: int(raw.stamina.value, base.stamina.value),
        // 存檔時間比現在還晚（系統時間被調過）：從現在重新起算
        updatedAt: Math.min(now, int(raw.stamina.updatedAt, now)),
      }
    : base.stamina;

  const daily = isObj(raw.daily)
    ? {
        day: typeof raw.daily.day === 'string' ? raw.daily.day : '',
        runs: countMap(raw.daily.runs, isStage),
        extraRuns: countMap(raw.daily.extraRuns, isStage),
        staminaBuys: int(raw.daily.staminaBuys, 0),
        runBuys: int(raw.daily.runBuys, 0),
      }
    : base.daily;

  const auto = isObj(raw.auto)
    ? {
        enabled: bool(raw.auto.enabled, false),
        lastAt: Math.min(now, int(raw.auto.lastAt, now)),
        summary: autoSummary(raw.auto.summary),
      }
    : base.auto;

  const cleared = stringList(raw.cleared, isStage);

  // 寄宿位（T021）：只留擁有、不在隊伍裡、不重複的狗，超過位子數的丟掉；時間不能比現在晚
  const boarding: BoardingSlot[] = [];
  if (Array.isArray(raw.boarding)) {
    for (const v of raw.boarding) {
      if (boarding.length >= boardingSlotCount({ cleared })) break;
      if (!isObj(v) || typeof v.dogId !== 'string') continue;
      const id = v.dogId;
      if (!isOwned(id) || team.includes(id) || boarding.some((b) => b.dogId === id)) continue;
      const at = Math.min(now, int(v.at, now));
      boarding.push({
        dogId: id,
        since: Math.min(at, int(v.since, at)),
        at,
        carry: int(v.carry, 0),
        exp: int(v.exp, 0),
        levels: int(v.levels, 0),
      });
    }
  }

  // 召募紀錄（T007）：保底計數不能超過保底門檻
  const gacha = isObj(raw.gacha)
    ? {
        pulls: int(raw.gacha.pulls, 0),
        sinceSSR: int(raw.gacha.sinceSSR, 0, 0, PITY_SSR - 1),
      }
    : base.gacha;

  // 玩家填的台詞（T017）：只留認得的狗，內容重新整理一次（去控制字元、限制字數），空的丟掉
  const skillLines: Record<string, string> = {};
  if (isObj(raw.skillLines)) {
    for (const [id, v] of Object.entries(raw.skillLines)) {
      if (!isDog(id) || typeof v !== 'string') continue;
      const line = cleanSkillLine(v);
      if (line) skillLines[id] = line;
    }
  }

  // 陣型（T023）：只留認得的狗；0～2 是只記排，3～11 是九宮格的格子；沒記的上場時照定位排
  const formation: Record<string, number> = {};
  if (isObj(raw.formation)) {
    for (const [id, v] of Object.entries(raw.formation)) {
      if (isDog(id) && isFormationValue(v)) formation[id] = v;
    }
  }

  // 開戰到一半的仗（T023）：關卡與隊伍要認得，隊伍的攻防與站位用現在的資料重新排
  let pending: PendingBattle | null = null;
  if (isObj(raw.pending) && typeof raw.pending.stageId === 'string') {
    const p = raw.pending;
    const ids = stringList(p.dogIds, isOwned);
    if (
      isStage(p.stageId as string) &&
      ids.length >= 1 &&
      ids.length <= TEAM_SIZE &&
      isNum(p.seed)
    ) {
      pending = {
        stageId: p.stageId as string,
        dogIds: ids,
        team: battleTeamOf({ dogs, formation }, ids),
        seed: Math.floor(p.seed) >>> 0,
        at: Math.min(now, int(p.at, now)),
      };
    }
  }

  return {
    resources: resources(raw.resources, base.resources),
    history,
    nextExpeditionNo: Math.max(int(raw.nextExpeditionNo, 1, 1), history.length + 1),
    owned,
    dogs,
    team,
    lobbyDogId,
    backgroundId,
    cleared,
    seenStories: stringList(raw.seenStories, (id) => !!findStory(id)),
    redeemedCodes: stringList(raw.redeemedCodes, () => true),
    settings: settings(raw.settings, base.settings),
    stamina,
    daily,
    auto,
    boarding,
    // 碎片（T007）：只留認得的狗、正整數
    shards: countMap(raw.shards, isDog),
    gacha,
    skillLines,
    formation,
    pending,
  };
}

/**
 * 舊版存檔升級到新版的步驟：MIGRATIONS[n] 把第 n 版的 state 轉成第 n + 1 版。
 * 目前只有第 1 版，所以是空的。只加欄位不用寫（sanitizeState 會補預設值）。
 */
const MIGRATIONS: Record<number, (state: Obj) => Obj> = {};

/**
 * 把 localStorage 讀到的字串變回遊戲狀態。
 * raw 為 null 表示沒有存檔。不會丟出例外：讀不懂就回到新遊戲並標成 reset。
 */
export function deserialize(raw: string | null, now: number): LoadResult {
  if (raw === null) return { state: createInitialState(now), status: 'new' };
  let file: unknown;
  try {
    file = JSON.parse(raw);
  } catch {
    return { state: createInitialState(now), status: 'reset' };
  }
  if (!isObj(file) || !isObj(file.state) || !isNum(file.version) || file.version < 1) {
    return { state: createInitialState(now), status: 'reset' };
  }
  let state = file.state;
  try {
    for (let v = Math.floor(file.version); v < SAVE_VERSION; v++) {
      const step = MIGRATIONS[v];
      if (step) state = step(state);
    }
    return { state: sanitizeState(state, now), status: 'ok' };
  } catch {
    return { state: createInitialState(now), status: 'reset' };
  }
}
