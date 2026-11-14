import { findDog } from '../data/dogs';
import { ROW_MAX, defaultRowOf, type BattleRole, type RowIndex } from './battle';

/**
 * 陣型（T023）：每隻狗站前排、中排或後排（0／1／2），一排最多 ROW_MAX 隻。
 * 存檔只記「每隻狗想站哪一排」（GameState.formation，以狗狗 id 為鍵）；
 * 沒記的照定位的預設（守護、突擊前排，補給中排，謀略、幸運、補血後排）。
 * 實際上場時再用 arrangeRows 把超過一排上限的擠到最近的空位。
 *
 * 九宮格（2026-11-14 Jimmy：站位要清楚的 3×3）：每一排再分上、中、下三格（lane 0／1／2），
 * 一格只站一隻。存檔同一個欄位：0～2 是舊的「只記排」，3～11 是「排 × 3 + 格 + 3」。
 * 格子目前只影響畫面上站哪裡，不影響勝負（攻擊範圍只看排）。
 */

export type LaneIndex = 0 | 1 | 2;
export interface Cell {
  row: RowIndex;
  lane: LaneIndex;
}
export const LANES: readonly LaneIndex[] = [0, 1, 2];
/** 格子的名字（畫面上由上到下） */
export const LANE_NAMES: readonly string[] = ['上', '中', '下'];

const CELL_BASE = 3;

/** 存檔值 → 想站哪一排；不合法回 undefined */
export function savedRowOf(v: unknown): RowIndex | undefined {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= CELL_BASE + 9)
    return undefined;
  return (v < CELL_BASE ? v : Math.floor((v - CELL_BASE) / 3)) as RowIndex;
}

/** 存檔值 → 想站那一排的哪一格；舊的只記排的值沒有格，回 undefined */
export function savedLaneOf(v: unknown): LaneIndex | undefined {
  if (savedRowOf(v) === undefined || (v as number) < CELL_BASE) return undefined;
  return (((v as number) - CELL_BASE) % 3) as LaneIndex;
}

/** 一格的存檔值 */
export function cellValue(row: RowIndex, lane: LaneIndex): number {
  return CELL_BASE + row * 3 + lane;
}

/** 存檔值合不合法（讀檔檢查用） */
export function isFormationValue(v: unknown): v is number {
  return savedRowOf(v) !== undefined;
}

export const ROWS: readonly RowIndex[] = [0, 1, 2];

interface FormationState {
  formation: Record<string, number>;
}

const isRow = (v: unknown): v is RowIndex => v === 0 || v === 1 || v === 2;

const DOG_ROLES: readonly BattleRole[] = ['突擊', '守護', '謀略', '幸運', '補給', '補血'];

/** 從資料檔的定位字串（例如「前排／突擊」）取出戰鬥用的定位 */
export function battleRoleOf(role: string): BattleRole | undefined {
  return DOG_ROLES.find((k) => role.includes(k));
}

/** 這隻狗照定位預設站哪一排 */
export function defaultRowOfDog(dogId: string): RowIndex {
  const d = findDog(dogId);
  return defaultRowOf(d ? battleRoleOf(d.role) : undefined);
}

/** 這一排滿了的話，依序改試哪幾排（先試近的） */
const FALLBACK: Record<RowIndex, readonly RowIndex[]> = {
  0: [0, 1, 2],
  1: [1, 2, 0],
  2: [2, 1, 0],
};

/**
 * 把一支隊伍排進三排：每隻先站牠想站的那一排（saved 有記就用，沒有就照定位），
 * 那一排滿了就擠到最近還有空位的一排。隊伍順序前面的先選。回傳和 dogIds 一一對應的排。
 */
export function arrangeRows(
  dogIds: readonly string[],
  saved: Readonly<Record<string, number>> = {},
): RowIndex[] {
  const count = [0, 0, 0];
  return dogIds.map((id) => {
    const want = savedRowOf(saved[id]) ?? defaultRowOfDog(id);
    const row = FALLBACK[want].find((r) => count[r] < ROW_MAX) ?? want;
    count[row]++;
    return row;
  });
}

/** 這支隊伍現在的陣型（和 dogIds 一一對應） */
export function teamRows(state: FormationState, dogIds: readonly string[]): RowIndex[] {
  return arrangeRows(dogIds, state.formation);
}

/** 一排有 n 隻、都沒指定格子時怎麼站：一隻站中間，兩隻站上下，三隻站滿 */
const LANE_PATTERN: readonly (readonly LaneIndex[])[] = [[], [1], [0, 2], [0, 1, 2]];

/**
 * 把一支隊伍排進九宮格：排照 arrangeRows；同一排裡，有記格子的先站牠記的那一格
 * （被隊伍順序前面的佔走就讓），其餘照 LANE_PATTERN 補進空格。回傳和 dogIds 一一對應的格子。
 */
export function arrangeCells(
  dogIds: readonly string[],
  saved: Readonly<Record<string, number>> = {},
): Cell[] {
  const rows = arrangeRows(dogIds, saved);
  const lanes: (LaneIndex | undefined)[] = dogIds.map(() => undefined);
  for (const row of ROWS) {
    const members = dogIds.map((_, i) => i).filter((i) => rows[i] === row);
    const taken = new Set<LaneIndex>();
    for (const i of members) {
      const v = saved[dogIds[i]];
      const lane = savedRowOf(v) === row ? savedLaneOf(v) : undefined;
      if (lane !== undefined && !taken.has(lane)) {
        lanes[i] = lane;
        taken.add(lane);
      }
    }
    const order = [...(LANE_PATTERN[Math.min(members.length, ROW_MAX)] ?? []), ...LANES];
    for (const i of members) {
      if (lanes[i] !== undefined) continue;
      const lane = order.find((l) => !taken.has(l)) ?? 1;
      lanes[i] = lane;
      taken.add(lane);
    }
  }
  return dogIds.map((_, i) => ({ row: rows[i], lane: lanes[i] ?? 1 }));
}

/** 這支隊伍現在每隻站哪一格（和 dogIds 一一對應） */
export function teamCells(state: FormationState, dogIds: readonly string[]): Cell[] {
  return arrangeCells(dogIds, state.formation);
}

/**
 * 把整支隊伍現在站的格子都記下來。隊伍要加人、少人之前先呼叫，
 * 其他隊友才不會因為那一排的隻數變了而自己換格子。
 */
export function freezeCells<T extends FormationState>(state: T, dogIds: readonly string[]): T {
  const cells = teamCells(state, dogIds);
  if (dogIds.every((id, i) => state.formation[id] === cellValue(cells[i].row, cells[i].lane))) {
    return state;
  }
  const formation = { ...state.formation };
  dogIds.forEach((id, i) => (formation[id] = cellValue(cells[i].row, cells[i].lane)));
  return { ...state, formation };
}

/**
 * 把隊伍裡的一隻狗移到九宮格的某一格。那一格有別的隊友就兩隻對調。
 * 狗不在隊伍裡、或本來就在那一格，就原樣回傳。
 * 成功時把整支隊伍目前的站位都記下來，之後不會因為別隻移動而被擠走。
 */
export function setDogCell<T extends FormationState>(
  state: T,
  dogIds: readonly string[],
  dogId: string,
  row: RowIndex,
  lane: LaneIndex,
): T {
  const at = dogIds.indexOf(dogId);
  if (at < 0 || !isRow(row) || !isRow(lane)) return state;
  const cells = teamCells(state, dogIds);
  const from = cells[at];
  if (from.row === row && from.lane === lane) return state;
  const other = cells.findIndex((c, i) => i !== at && c.row === row && c.lane === lane);
  const formation = { ...state.formation };
  dogIds.forEach((id, i) => {
    const c = i === at ? { row, lane } : i === other ? from : cells[i];
    formation[id] = cellValue(c.row, c.lane);
  });
  return { ...state, formation };
}

/**
 * 把隊伍裡的一隻狗換到另一排（站那一排的第一個空格）。
 * 那一排已經滿了、狗不在隊伍裡、或本來就在那一排，就原樣回傳。
 */
export function setDogRow<T extends FormationState>(
  state: T,
  dogIds: readonly string[],
  dogId: string,
  row: RowIndex,
): T {
  const at = dogIds.indexOf(dogId);
  if (at < 0 || !isRow(row)) return state;
  const cells = teamCells(state, dogIds);
  if (cells[at].row === row) return state;
  const used = cells.filter((c) => c.row === row).map((c) => c.lane);
  if (used.length >= ROW_MAX) return state;
  const lane = ([1, 0, 2] as const).find((l) => !used.includes(l));
  return lane === undefined ? state : setDogCell(state, dogIds, dogId, row, lane);
}

/** 這幾隻狗照定位重新排好（清掉牠們記下來的站位）；本來就沒記就原樣回傳 */
export function resetFormation<T extends FormationState>(state: T, dogIds: readonly string[]): T {
  if (!dogIds.some((id) => id in state.formation)) return state;
  const formation = { ...state.formation };
  for (const id of dogIds) delete formation[id];
  return { ...state, formation };
}
