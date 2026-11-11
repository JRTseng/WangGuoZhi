import { findDog } from '../data/dogs';
import type { GameState } from '../state/gameState';
import { TEAM_SIZE } from './expedition';
import { calcPower } from './power';

/**
 * 組隊編排：最多 5 隻、只能放擁有的狗。
 * 隊伍已滿時再加會沒反應（和出征選角一致，見 BACKLOG 待決定）。
 */
export function toggleTeamMember(state: GameState, dogId: string): GameState {
  if (state.team.includes(dogId)) {
    return { ...state, team: state.team.filter((id) => id !== dogId) };
  }
  if (!state.owned.includes(dogId) || state.team.length >= TEAM_SIZE) return state;
  return { ...state, team: [...state.team, dogId] };
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
