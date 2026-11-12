import { DOGS, findDog } from '../data/dogs';
import type { GameState } from '../state/gameState';
import { autoTeam, type DogContext } from './dogFilter';
import { TEAM_SIZE, busyDogIds } from './expedition';
import { dogStats } from './leveling';

/**
 * 組隊編排：最多 5 隻、只能放擁有、沒在寄宿的狗。
 * 隊伍已滿時再加會沒反應（和出征選角一致，Jimmy 2026-11-12 確認）。
 */
export function toggleTeamMember(state: GameState, dogId: string): GameState {
  if (state.team.includes(dogId)) {
    return { ...state, team: state.team.filter((id) => id !== dogId) };
  }
  if (!state.owned.includes(dogId) || state.team.length >= TEAM_SIZE) return state;
  // 寄宿中的狗要先接回來才能上陣（T021）
  if (busyDogIds(state).has(dogId)) return state;
  return { ...state, team: [...state.team, dogId] };
}

/** 選狗、排序用的資料：誰擁有、誰在寄宿、目前的等級與戰力 */
export function dogContext(state: GameState): DogContext {
  return {
    owned: state.owned,
    busy: busyDogIds(state),
    stats: (d) => dogStats(state, d),
  };
}

/** 一鍵自動編隊：換成可出征（擁有且沒在寄宿）裡戰力最高的 5 隻；沒有可出征的就不動 */
export function autoFillTeam(state: GameState): GameState {
  const team = autoTeam(DOGS, dogContext(state));
  if (team.length === 0 || team.join() === state.team.join()) return state;
  return { ...state, team };
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
