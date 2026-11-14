import { DOGS, findDog } from '../data/dogs';
import type { GameState } from '../state/gameState';
import { autoTeam, type DogContext } from './dogFilter';
import { TEAM_SIZE, busyDogIds } from './expedition';
import type { RowIndex } from './battle';
import {
  cellValue,
  freezeCells,
  resetFormation,
  setDogCell,
  teamCells,
  type LaneIndex,
} from './formation';
import { dogStats } from './leveling';

/**
 * 組隊編排：最多 5 隻、只能放擁有、沒在寄宿的狗。
 * 隊伍已滿時再加會沒反應（和出征選角一致，Jimmy 2026-11-12 確認）。
 */
export function toggleTeamMember(state: GameState, dogId: string): GameState {
  if (state.team.includes(dogId)) {
    // 其他隊友留在原本的格子上（九宮格）
    return { ...freezeCells(state, state.team), team: state.team.filter((id) => id !== dogId) };
  }
  if (!state.owned.includes(dogId) || state.team.length >= TEAM_SIZE) return state;
  // 寄宿中的狗要先接回來才能上陣（T021）
  if (busyDogIds(state).has(dogId)) return state;
  return { ...freezeCells(state, state.team), team: [...state.team, dogId] };
}

export interface PlaceResult {
  state: GameState;
  /** 放完之後的隊伍 */
  team: string[];
  /** 沒放成的原因（給玩家看的），成功為 null */
  error: string | null;
}

/**
 * 把一隻狗放到陣型九宮格的某一格（2026-11-14 拖曳站位）。team 是目前正在排的隊伍
 * （組隊編排是 state.team，出征選狗是畫面上選的那幾隻）。
 * - 已經在隊伍裡：換到那一格，那一格有隊友就對調。
 * - 還沒上陣：那一格有隊友就換牠下來；是空格就加入隊伍（隊伍滿了不行）。
 * 只能放擁有、沒在寄宿的狗。其他隊友的站位會一起記下來，不會被擠走。
 */
export function placeDog(
  state: GameState,
  team: readonly string[],
  dogId: string,
  row: RowIndex,
  lane: LaneIndex,
  /** 最多幾隻（出征選狗時是那一關的上陣上限） */
  max: number = TEAM_SIZE,
): PlaceResult {
  const fail = (error: string): PlaceResult => ({ state, team: [...team], error });
  if (team.includes(dogId)) {
    return { state: setDogCell(state, team, dogId, row, lane), team: [...team], error: null };
  }
  if (!state.owned.includes(dogId)) return fail('還沒擁有這隻狗');
  if (busyDogIds(state).has(dogId)) return fail('寄宿中的狗要先接回來');
  const cells = teamCells(state, team);
  const at = cells.findIndex((c) => c.row === row && c.lane === lane);
  if (at < 0 && team.length >= max) {
    return fail(`隊伍滿了（最多 ${max} 隻），拖到隊友身上換人`);
  }
  const formation = { ...state.formation };
  team.forEach((id, i) => {
    if (i !== at) formation[id] = cellValue(cells[i].row, cells[i].lane);
  });
  formation[dogId] = cellValue(row, lane);
  return {
    state: { ...state, formation },
    team: at >= 0 ? team.map((id, i) => (i === at ? dogId : id)) : [...team, dogId],
    error: null,
  };
}

/** 選狗、排序用的資料：誰擁有、誰在寄宿、目前的等級與戰力 */
export function dogContext(state: GameState): DogContext {
  return {
    owned: state.owned,
    busy: busyDogIds(state),
    stats: (d) => dogStats(state, d),
  };
}

/** 一鍵自動編隊：換成可出征（擁有且沒在寄宿）裡戰力最高的 5 隻，站位照定位排好；沒有可出征的就不動 */
export function autoFillTeam(state: GameState): GameState {
  const team = autoTeam(DOGS, dogContext(state));
  if (team.length === 0) return state;
  // 陣型也照定位重新排好（T023）：守護、突擊前排，補給中排，謀略、幸運、補血後排
  const base = resetFormation(state, team);
  return team.join() === state.team.join() ? base : { ...base, team };
}

/** 設定主頁角色（必須擁有） */
export function setLobbyDog(state: GameState, dogId: string): GameState {
  if (!state.owned.includes(dogId) || state.lobbyDogId === dogId) return state;
  return { ...state, lobbyDogId: dogId };
}

/** 一隻狗目前的戰力（含升級成長） */
export function dogPower(state: Pick<GameState, 'dogs'>, dogId: string): number {
  const d = findDog(dogId);
  return d ? dogStats(state, d).power : 0;
}

export function teamPower(state: Pick<GameState, 'dogs'>, dogIds: readonly string[]): number {
  return dogIds.reduce((sum, id) => sum + dogPower(state, id), 0);
}
