import type { Faction } from '../data/dogs';
import type { Resources } from '../data/resources';
import type { GameState, WarState } from '../state/gameState';
import { createRng } from './battle';
import { playerFaction } from './faction';
import { nextResetAt, type TimeOptions } from './stamina';
import { daysToReset, weekKey } from './tower';

/**
 * 陣營積分戰（T030，Jimmy 2026-11-17：「陣營比較先用每週積分戰概念就可以」「單純先以單機為主」）。
 * 全部單機、全部是純函式：
 *
 * - 每週一當地 05:00 開新的一週（和登天塔同一個時間）。出征、爬塔會幫自己的陣營賺積分。
 * - 兩個陣營的總分由遊戲模擬：每週用週次當種子算出兩邊這週會拿到多少分，隨時間慢慢長；
 *   兩邊最後的差距不超過 WAR_GAP，玩家自己的積分直接加在自己陣營上，所以認真打可以把戰局扳過來。
 * - 個人積分到了門檻可以領獎（一鍵全領）。
 * - 換週時結算上週：有參加（積分大於 0）就能領陣營獎勵，贏的那邊比較多。
 * - 週中換陣營：這週的個人積分歸零（不能兩邊賺）。
 *
 * 數字都是暫定。
 */

/** 每種行動幫陣營賺幾分 */
export const WAR_POINTS = { win: 10, lose: 2, tower: 15 } as const;
/** 模擬的陣營一週大約拿到多少分 */
export const WAR_BASE = 50_000;
/** 兩個陣營（不含玩家）一週結束時最多差多少分 */
export const WAR_GAP = 600;

export interface WarMilestone {
  points: number;
  reward: Resources;
}

/** 個人積分獎勵 */
export const WAR_MILESTONES: readonly WarMilestone[] = [
  { points: 50, reward: { food: 500, bones: 10 } },
  { points: 150, reward: { food: 1000, bones: 20 } },
  { points: 300, reward: { food: 2000, bones: 30 } },
  { points: 600, reward: { food: 3000, bones: 50 } },
  { points: 1000, reward: { food: 5000, bones: 80 } },
];

/** 每週結算的陣營獎勵 */
export const WAR_RESULT_REWARD: Readonly<Record<'win' | 'lose', Resources>> = {
  win: { food: 3000, bones: 100 },
  lose: { food: 1000, bones: 30 },
};

export const EMPTY_WAR: WarState = { week: '', faction: '', points: 0, claimed: [], result: null };

type HasWar = Pick<GameState, 'war' | 'faction'>;

/** 把換週與換陣營結算到 now */
export function warAt(state: HasWar, now: number, o?: TimeOptions): WarState {
  const w = state.war;
  const week = weekKey(now, o);
  const mine = playerFaction(state);
  if (w.week < week) {
    // 換週：上週有積分就留下一筆等著領的結果（之前沒領的就過期了）
    const result =
      w.week && w.points > 0 && w.faction
        ? { week: w.week, faction: w.faction, points: w.points }
        : w.result;
    return { week, faction: mine, points: 0, claimed: [], result };
  }
  if (w.faction !== mine) return { ...w, faction: mine, points: 0, claimed: [] };
  return w;
}

/** 幫自己的陣營加積分 */
export function addWarPoints<S extends HasWar>(
  state: S,
  points: number,
  now: number,
  o?: TimeOptions,
): S {
  const w = warAt(state, now, o);
  if (points <= 0 && w === state.war) return state;
  return { ...state, war: { ...w, points: w.points + Math.max(0, Math.floor(points)) } };
}

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** 這一週兩個陣營（不含玩家）最後會拿到幾分：用週次當種子，每週固定 */
export function warFinals(week: string): Record<Faction, number> {
  const rng = createRng(hash(week));
  const dog = Math.round(WAR_BASE + rng() * 2000);
  const cat = dog + Math.round((rng() * 2 - 1) * WAR_GAP);
  return { dog, cat };
}

/** 這一週過了多少（0～1） */
export function weekProgress(now: number, o?: TimeOptions): number {
  const daysDone = 7 - daysToReset(now, o);
  const dayPart = 1 - Math.min(1, Math.max(0, (nextResetAt(now, o) - now) / 86_400_000));
  return Math.min(1, Math.max(0, (daysDone + dayPart) / 7));
}

export interface WarScores {
  dog: number;
  cat: number;
  /** 領先的陣營；同分算玩家這邊 */
  leader: Faction;
}

function scoresOf(week: string, progress: number, faction: Faction, points: number): WarScores {
  const f = warFinals(week);
  const s = { dog: Math.round(f.dog * progress), cat: Math.round(f.cat * progress) };
  s[faction] += points;
  const other: Faction = faction === 'dog' ? 'cat' : 'dog';
  return { ...s, leader: s[faction] >= s[other] ? faction : other };
}

/** 現在兩邊的分數（玩家的積分已經加在自己陣營上） */
export function warScores(state: HasWar, now: number, o?: TimeOptions): WarScores {
  const w = warAt(state, now, o);
  return scoresOf(w.week, weekProgress(now, o), playerFaction(state), w.points);
}

/** 上週的結果（沒有等著領的就 null） */
export function warResult(
  state: HasWar,
  now: number,
  o?: TimeOptions,
): {
  week: string;
  faction: Faction;
  points: number;
  scores: WarScores;
  win: boolean;
  reward: Resources;
} | null {
  const r = warAt(state, now, o).result;
  if (!r) return null;
  const scores = scoresOf(r.week, 1, r.faction, r.points);
  const win = scores.leader === r.faction;
  return { ...r, scores, win, reward: WAR_RESULT_REWARD[win ? 'win' : 'lose'] };
}

/** 現在可以領的個人積分獎勵（WAR_MILESTONES 的索引） */
export function warClaimable(state: HasWar, now: number, o?: TimeOptions): number[] {
  const w = warAt(state, now, o);
  return WAR_MILESTONES.map((_, i) => i).filter(
    (i) => w.points >= WAR_MILESTONES[i].points && !w.claimed.includes(i),
  );
}

/** 主頁要不要亮紅點：有積分獎勵或上週結果可以領 */
export function warReady(state: HasWar, now: number, o?: TimeOptions): boolean {
  return warClaimable(state, now, o).length > 0 || warAt(state, now, o).result !== null;
}

const plus = (a: Resources, b: Resources): Resources => ({
  food: a.food + b.food,
  bones: a.bones + b.bones,
});

/** 一次領完達標的個人積分獎勵 */
export function claimWarMilestones<S extends HasWar & Pick<GameState, 'resources'>>(
  state: S,
  now: number,
  o?: TimeOptions,
): { state: S; reward: Resources | null } {
  const list = warClaimable(state, now, o);
  if (list.length === 0) return { state, reward: null };
  const reward = list.reduce((sum, i) => plus(sum, WAR_MILESTONES[i].reward), {
    food: 0,
    bones: 0,
  });
  const w = warAt(state, now, o);
  return {
    reward,
    state: {
      ...state,
      war: { ...w, claimed: [...w.claimed, ...list] },
      resources: plus(state.resources, reward),
    },
  };
}

/** 領上週的陣營獎勵 */
export function claimWarResult<S extends HasWar & Pick<GameState, 'resources'>>(
  state: S,
  now: number,
  o?: TimeOptions,
): { state: S; reward: Resources | null } {
  const r = warResult(state, now, o);
  if (!r) return { state, reward: null };
  return {
    reward: r.reward,
    state: {
      ...state,
      war: { ...warAt(state, now, o), result: null },
      resources: plus(state.resources, r.reward),
    },
  };
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isFaction = (v: unknown): v is Faction => v === 'dog' || v === 'cat';
const isWeek = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** 讀檔時的檢查：壞掉的欄位回到預設 */
export function sanitizeWar(raw: unknown): WarState {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY_WAR };
  const r = raw as Record<string, unknown>;
  const res = r.result as Record<string, unknown> | null | undefined;
  const result =
    res && isWeek(res.week) && isFaction(res.faction) && isInt(res.points) && res.points > 0
      ? { week: res.week, faction: res.faction, points: res.points }
      : null;
  return {
    week: isWeek(r.week) ? r.week : '',
    faction: isFaction(r.faction) ? r.faction : '',
    points: isInt(r.points) ? r.points : 0,
    claimed: Array.isArray(r.claimed)
      ? [...new Set(r.claimed.filter((i): i is number => isInt(i) && i < WAR_MILESTONES.length))]
      : [],
    result,
  };
}
