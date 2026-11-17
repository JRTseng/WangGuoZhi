import { findDog } from '../data/dogs';
import { findGear, type GearData } from '../data/equipment';
import type { GameState } from '../state/gameState';
import {
  GEAR_STAR_MAX,
  gearAtStar,
  gearStarOf,
  ownedCount,
  ownedGears,
  wearersOf,
} from './equipment';

/**
 * 裝備升星（T036，Jimmy 2026-11-17：「後續再做裝備也可以升級星等」）。
 * 星等記在「裝備種類」上（GameState.gearStars）：同款的每一件一起變強，誰穿都算。
 * 每升一星攻防合計多原本的 20%、至少 +1（公式在 src/logic/equipment.ts 的 gearAtStar），最多 5 星。
 * 要花的東西看裝備怎麼來的：
 * - 關卡掉的一般裝備：吃掉多的同款（沒人穿、而且至少留一件）
 * - 專屬裝備（每隻只有一件）：花那隻角色的碎片
 * - 爬塔的飾品（每種只有一件）：花骨頭幣
 * 全部是純函式，回傳新的狀態。數字都是暫定。
 */

/** 升到第 1～5 星各要幾件多的同款（一般裝備） */
export const GEAR_STAR_COPIES: readonly number[] = [1, 1, 2, 2, 3];
/** 升到第 1～5 星各要幾個碎片（專屬裝備，花那隻角色的碎片） */
export const GEAR_STAR_SHARDS: readonly number[] = [5, 10, 15, 20, 25];
/** 升到第 1～5 星各要多少骨頭幣（爬塔飾品） */
export const GEAR_STAR_BONES: readonly number[] = [50, 100, 150, 200, 250];

export type GearStarCostKind = 'copies' | 'shards' | 'bones';
export interface GearStarCost {
  kind: GearStarCostKind;
  amount: number;
}

/** 這件裝備要花哪一種東西升星 */
export function gearStarCostKind(g: Pick<GearData, 'exclusive' | 'tower'>): GearStarCostKind {
  return g.exclusive ? 'shards' : g.tower ? 'bones' : 'copies';
}

/** 從 star 星升到下一星要花什麼；滿星回傳 null */
export function gearStarCost(
  g: Pick<GearData, 'exclusive' | 'tower'>,
  star: number,
): GearStarCost | null {
  const s = Math.max(0, Math.floor(star));
  if (s >= GEAR_STAR_MAX) return null;
  const kind = gearStarCostKind(g);
  const table =
    kind === 'shards' ? GEAR_STAR_SHARDS : kind === 'bones' ? GEAR_STAR_BONES : GEAR_STAR_COPIES;
  return { kind, amount: table[s] };
}

type StarState = Pick<
  GameState,
  'gear' | 'equipped' | 'gearStars' | 'shards' | 'resources' | 'owned'
>;

/** 一般裝備：可以拿去升星的同款有幾件（沒人穿的，而且至少留一件） */
export function spareCopies(state: Pick<GameState, 'gear' | 'equipped'>, gearId: string): number {
  return Math.max(0, ownedCount(state, gearId) - Math.max(1, wearersOf(state, gearId).length));
}

export type GearStarBlock = 'unknown-gear' | 'not-owned' | 'maxed' | 'short';

export interface GearStarCheck {
  ok: boolean;
  reason?: GearStarBlock;
  /** 目前幾星 */
  star: number;
  /** 升下一星要花什麼；滿星或不認得是 null */
  cost: GearStarCost | null;
  /** 手上有多少可以花的（同款多的件數／碎片／骨頭幣） */
  have: number;
  /** 還差多少；夠就是 0 */
  short: number;
}

/** 現在能不能升星 */
export function checkGearStarUp(state: StarState, gearId: string): GearStarCheck {
  const g = findGear(gearId);
  if (!g) return { ok: false, reason: 'unknown-gear', star: 0, cost: null, have: 0, short: 0 };
  const star = gearStarOf(state, gearId);
  const cost = gearStarCost(g, star);
  const kind = gearStarCostKind(g);
  const have =
    kind === 'shards'
      ? Math.max(0, Math.floor(state.shards[g.exclusive ?? ''] ?? 0))
      : kind === 'bones'
        ? Math.max(0, Math.floor(state.resources.bones))
        : spareCopies(state, gearId);
  const short = cost ? Math.max(0, cost.amount - have) : 0;
  const base = { star, cost, have, short };
  if (ownedCount(state, gearId) <= 0) return { ok: false, reason: 'not-owned', ...base };
  if (!cost) return { ok: false, reason: 'maxed', ...base };
  if (short > 0) return { ok: false, reason: 'short', ...base };
  return { ok: true, ...base };
}

/** 升一星：扣掉要花的東西、星數 +1。不能升時狀態原封不動回傳 */
export function gearStarUp<S extends StarState>(
  state: S,
  gearId: string,
): { state: S; check: GearStarCheck } {
  const check = checkGearStarUp(state, gearId);
  const g = findGear(gearId);
  if (!check.ok || !g || !check.cost) return { state, check };
  const { kind, amount } = check.cost;
  let next: S = { ...state, gearStars: { ...state.gearStars, [gearId]: check.star + 1 } };
  if (kind === 'copies') {
    next = { ...next, gear: { ...next.gear, [gearId]: ownedCount(state, gearId) - amount } };
  } else if (kind === 'shards' && g.exclusive) {
    next = { ...next, shards: { ...next.shards, [g.exclusive]: check.have - amount } };
  } else {
    next = { ...next, resources: { ...next.resources, bones: state.resources.bones - amount } };
  }
  return { state: next, check };
}

/** 這種裝備能不能列進「全部升星」：只算吃同款的一般裝備（碎片與骨頭幣還有別的用途，不自動花） */
function inBulk(g: GearData): boolean {
  return gearStarCostKind(g) === 'copies';
}

/** 現在有幾種一般裝備的同款夠升星（「全部升星」按鈕上的數字） */
export function gearStarReadyCount(state: StarState): number {
  return ownedGears(state).filter((g) => inBulk(g) && checkGearStarUp(state, g.id).ok).length;
}

export interface GearStarUpAllResult<S> {
  state: S;
  ups: { gearId: string; from: number; to: number }[];
}

/**
 * 一鍵全部升星：每種一般裝備，多的同款夠就一直升，升到不夠或滿星為止。
 * 只吃多的同款，不花碎片與骨頭幣（專屬裝備與飾品要自己點）。沒有能升的狀態原封不動回傳。
 */
export function gearStarUpAll<S extends StarState>(state: S): GearStarUpAllResult<S> {
  let s = state;
  const ups: GearStarUpAllResult<S>['ups'] = [];
  for (const g of ownedGears(state)) {
    if (!inBulk(g)) continue;
    const from = gearStarOf(s, g.id);
    let to = from;
    for (let i = 0; i < GEAR_STAR_MAX; i++) {
      const r = gearStarUp(s, g.id);
      if (!r.check.ok) break;
      s = r.state;
      to = r.check.star + 1;
    }
    if (to > from) ups.push({ gearId: g.id, from, to });
  }
  return { state: s, ups };
}

// ---- 顯示用 ----

/** 「★★☆☆☆」；0 星是五顆空的 */
export function gearStarText(star: number): string {
  const s = Math.min(GEAR_STAR_MAX, Math.max(0, Math.floor(star)));
  return '★'.repeat(s) + '☆'.repeat(GEAR_STAR_MAX - s);
}

/** 要花什麼的一句話：「同款 ×2」「鐵牙碎片 ×10」「骨頭幣 ×100」 */
export function gearStarCostLabel(
  g: Pick<GearData, 'exclusive' | 'tower'>,
  cost: GearStarCost,
): string {
  if (cost.kind === 'copies') return `多的同款 ×${cost.amount}`;
  if (cost.kind === 'shards')
    return `${findDog(g.exclusive ?? '')?.name ?? ''}碎片 ×${cost.amount}`;
  return `骨頭幣 ×${cost.amount}`;
}

/** 升一星前後的加成，給畫面寫「攻 +4 → 攻 +5」 */
export function gearStarPreview(
  g: Pick<GearData, 'attack' | 'defense' | 'pct'>,
  star: number,
): { now: ReturnType<typeof gearAtStar>; next: ReturnType<typeof gearAtStar> | null } {
  return {
    now: gearAtStar(g, star),
    next: star >= GEAR_STAR_MAX ? null : gearAtStar(g, star + 1),
  };
}
