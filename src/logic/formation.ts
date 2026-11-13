import { findDog } from '../data/dogs';
import { ROW_MAX, defaultRowOf, type BattleRole, type RowIndex } from './battle';

/**
 * 陣型（T023）：每隻狗站前排、中排或後排（0／1／2），一排最多 ROW_MAX 隻。
 * 存檔只記「每隻狗想站哪一排」（GameState.formation，以狗狗 id 為鍵）；
 * 沒記的照定位的預設（守護、突擊前排，補給中排，謀略、幸運、補血後排）。
 * 實際上場時再用 arrangeRows 把超過一排上限的擠到最近的空位。
 * 之後想升級成九宮格（每排再分左中右），格子可以由隊伍順序推出來，不用重做。
 */

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
    const want = isRow(saved[id]) ? (saved[id] as RowIndex) : defaultRowOfDog(id);
    const row = FALLBACK[want].find((r) => count[r] < ROW_MAX) ?? want;
    count[row]++;
    return row;
  });
}

/** 這支隊伍現在的陣型（和 dogIds 一一對應） */
export function teamRows(state: FormationState, dogIds: readonly string[]): RowIndex[] {
  return arrangeRows(dogIds, state.formation);
}

/**
 * 把隊伍裡的一隻狗換到另一排。那一排已經滿了、狗不在隊伍裡、或本來就在那一排，就原樣回傳。
 * 成功時把整支隊伍目前的站位都記下來，之後不會因為別隻移動而被擠走。
 */
export function setDogRow<T extends FormationState>(
  state: T,
  dogIds: readonly string[],
  dogId: string,
  row: RowIndex,
): T {
  const at = dogIds.indexOf(dogId);
  if (at < 0 || !isRow(row)) return state;
  const rows = teamRows(state, dogIds);
  if (rows[at] === row) return state;
  if (rows.filter((r, i) => i !== at && r === row).length >= ROW_MAX) return state;
  const formation = { ...state.formation };
  dogIds.forEach((id, i) => (formation[id] = i === at ? row : rows[i]));
  return { ...state, formation };
}

/** 這幾隻狗照定位重新排好（清掉牠們記下來的站位）；本來就沒記就原樣回傳 */
export function resetFormation<T extends FormationState>(state: T, dogIds: readonly string[]): T {
  if (!dogIds.some((id) => id in state.formation)) return state;
  const formation = { ...state.formation };
  for (const id of dogIds) delete formation[id];
  return { ...state, formation };
}
