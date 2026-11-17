import { findDog } from '../data/dogs';
import type { GameState } from '../state/gameState';
import { initialProgress } from './leveling';

/**
 * 網址參數（試看用，T035）：?try=角色 id 直接拿到那隻角色、放到主頁、排進隊伍第一位。
 * 用來最快看到某一隻角色在各個畫面的樣子。已經有的不會重複給；不認得的 id 不動。
 */
export function tryDogFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get('try');
  return id && findDog(id) ? id : null;
}

export function grantTryDog(state: GameState, id: string): GameState {
  const dog = findDog(id);
  if (!dog) return state;
  const owned = state.owned.includes(id) ? state.owned : [...state.owned, id];
  const dogs = state.dogs[id] ? state.dogs : { ...state.dogs, [id]: initialProgress(dog) };
  let team = state.team;
  let formation = state.formation;
  if (!team.includes(id)) {
    // 隊伍人數不變：頂掉第一位（空隊伍就只放牠），站位沿用被頂掉的那一格
    const out = team[0];
    team = [id, ...team.slice(1)];
    formation = { ...formation };
    if (out !== undefined && formation[out] !== undefined) {
      formation[id] = formation[out];
      delete formation[out];
    }
  }
  if (owned === state.owned && team === state.team && state.lobbyDogId === id) return state;
  return { ...state, owned, dogs, team, formation, lobbyDogId: id };
}
