import { DOGS, findDog } from '../data/dogs';
import type { GameState } from '../state/gameState';
import { autoTeam } from './dogFilter';
import { TEAM_SIZE, busyDogIds } from './expedition';
import { calcPower } from './power';

/**
 * 組隊編排：最多 5 隻、只能放擁有的狗。
 * 隊伍已滿時再加會沒反應（和出征選角一致，Jimmy 2026-11-12 確認）。
 */
export function toggleTeamMember(state: GameState, dogId: string): GameState {
  if (state.team.includes(dogId)) {
    return { ...state, team: state.team.filter((id) => id !== dogId) };
  }
  if (!state.owned.includes(dogId) || state.team.length >= TEAM_SIZE) return state;
  return { ...state, team: [...state.team, dogId] };
}

/** 一鍵自動編隊：換成可出征（擁有且沒在出征）裡戰力最高的 5 隻；沒有可出征的就不動 */
export function autoFillTeam(state: GameState): GameState {
  const team = autoTeam(DOGS, { owned: state.owned, busy: busyDogIds(state) });
  if (team.length === 0 || team.join() === state.team.join()) return state;
  return { ...state, team };
}

/** 設定主頁角色（必須擁有） */
export function setLobbyDog(state: GameState, dogId: string): GameState {
  if (!state.owned.includes(dogId) || state.lobbyDogId === dogId) return state;
  return { ...state, lobbyDogId: dogId };
}

export function dogPower(dogId: string): number {
  const d = findDog(dogId);
  return d ? calcPower(d.baseAttack, d.baseDefense, d.level) : 0;
}

export function teamPower(dogIds: readonly string[]): number {
  return dogIds.reduce((sum, id) => sum + dogPower(id), 0);
}
