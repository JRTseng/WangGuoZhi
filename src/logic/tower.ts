import { towerGearOf } from '../data/equipment';
import { REGIONS } from '../data/regions';
import type { Resources } from '../data/resources';
import { TOWER_FLOORS, towerFloorOf, towerReward } from '../data/tower';
import type { GameState, TowerState } from '../state/gameState';
import { dayKey, type TimeOptions } from './stamina';

/**
 * 登天塔的規則（Jimmy 2026-11-17）。全部是純函式。
 *
 * - 100 層，一次打一層，打贏才能往上；不花體力、沒有次數限制、不限制帶誰。
 * - 每週一當地 05:00 整座塔重置，從第 1 層重新爬，每一層的獎勵可以再拿一次。
 * - 重置後可以「一鍵通關」到上週爬到的那一層，並一次領完那些層的獎勵。
 * - 第 20、40、60、80、100 層第一次通關送一件爬塔限定裝備（只送一次）。
 * - 打輸沒有獎勵也沒有經驗（不花體力，不然可以一直輸著練）。
 */

/** 打過這一關才開放爬塔：第 3 章的頭目 */
export const TOWER_UNLOCK_STAGE = REGIONS[2].stages[REGIONS[2].stages.length - 1].id;

export const EMPTY_TOWER: TowerState = { week: '', floor: 0, last: 0, best: 0, gear: [] };

type HasTower = Pick<GameState, 'tower'>;

/** 這個時間屬於哪一週：那一週星期一的遊戲日（當地 05:00 換日），例：'2026-11-16' */
export function weekKey(now: number, o?: TimeOptions): string {
  const day = new Date(`${dayKey(now, o)}T00:00:00Z`);
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - sinceMonday * 86_400_000).toISOString().slice(0, 10);
}

/** 下一次重置還有幾天（1～7） */
export function daysToReset(now: number, o?: TimeOptions): number {
  const day = new Date(`${dayKey(now, o)}T00:00:00Z`);
  return 7 - ((day.getUTCDay() + 6) % 7);
}

/**
 * 把每週重置結算到 now：換週了就從第 1 層重來，上週爬到的層數記在 last（一鍵通關用）。
 * 上週一層都沒爬就留著更早那次的 last。手機時間被調回過去不重置。
 */
export function towerAt(state: HasTower, now: number, o?: TimeOptions): TowerState {
  const t = state.tower;
  const week = weekKey(now, o);
  if (t.week >= week) return t;
  return { ...t, week, floor: 0, last: t.floor > 0 ? t.floor : t.last };
}

export function towerOpen(state: Pick<GameState, 'cleared'>): boolean {
  return state.cleared.includes(TOWER_UNLOCK_STAGE);
}

/** 現在該打第幾層；爬到頂了回傳 0 */
export function towerNextFloor(state: HasTower, now: number, o?: TimeOptions): number {
  const f = towerAt(state, now, o).floor;
  return f >= TOWER_FLOORS ? 0 : f + 1;
}

/** 這一層現在能不能打：塔開了，而且就是下一層 */
export function towerCanFight(
  state: HasTower & Pick<GameState, 'cleared'>,
  stageId: string,
  now: number,
  o?: TimeOptions,
): boolean {
  const n = towerFloorOf(stageId);
  return n > 0 && towerOpen(state) && n === towerNextFloor(state, now, o);
}

/** 打贏第 floor 層：記進度，第一次到有限定裝備的那一層就送（回傳送了哪一件） */
export function towerWin<S extends HasTower & Pick<GameState, 'gear'>>(
  state: S,
  floor: number,
  now: number,
  o?: TimeOptions,
): { state: S; gearId?: string } {
  const t = towerAt(state, now, o);
  const gift = towerGearOf(floor);
  const give = gift && !t.gear.includes(floor) ? gift : undefined;
  return {
    state: {
      ...state,
      tower: {
        ...t,
        floor: Math.max(t.floor, floor),
        best: Math.max(t.best, floor),
        gear: give ? [...t.gear, floor] : t.gear,
      },
      gear: give ? { ...state.gear, [give.id]: (state.gear[give.id] ?? 0) + 1 } : state.gear,
    },
    ...(give ? { gearId: give.id } : {}),
  };
}

export interface SweepPlan {
  /** 從第幾層掃到第幾層 */
  from: number;
  to: number;
  reward: Resources;
}

/** 一鍵通關能掃哪些層、一共拿多少；這週已經爬到上週的高度（或上週沒爬）就是 null */
export function sweepPlan(state: HasTower, now: number, o?: TimeOptions): SweepPlan | null {
  const t = towerAt(state, now, o);
  if (t.last <= t.floor) return null;
  const reward: Resources = { food: 0, bones: 0 };
  for (let f = t.floor + 1; f <= t.last; f++) {
    const r = towerReward(f);
    reward.food += r.food;
    reward.bones += r.bones;
  }
  return { from: t.floor + 1, to: t.last, reward };
}

/** 一鍵通關到上週的進度，並領完那些層的獎勵；沒有可以掃的就原樣回傳 */
export function towerSweep<S extends HasTower & Pick<GameState, 'resources'>>(
  state: S,
  now: number,
  o?: TimeOptions,
): { state: S; plan: SweepPlan | null } {
  const plan = sweepPlan(state, now, o);
  if (!plan) return { state, plan };
  return {
    plan,
    state: {
      ...state,
      tower: { ...towerAt(state, now, o), floor: plan.to },
      resources: {
        food: state.resources.food + plan.reward.food,
        bones: state.resources.bones + plan.reward.bones,
      },
    },
  };
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const clamp = (v: unknown): number => (isInt(v) ? Math.min(TOWER_FLOORS, Math.max(0, v)) : 0);

/** 讀檔時的檢查：壞掉的欄位回到預設 */
export function sanitizeTower(raw: unknown): TowerState {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY_TOWER };
  const r = raw as Record<string, unknown>;
  const floor = clamp(r.floor);
  const gear = Array.isArray(r.gear)
    ? [...new Set(r.gear.filter((f): f is number => isInt(f) && !!towerGearOf(f)))]
    : [];
  return {
    week: typeof r.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.week) ? r.week : '',
    floor,
    last: clamp(r.last),
    best: Math.max(floor, clamp(r.best)),
    gear,
  };
}
