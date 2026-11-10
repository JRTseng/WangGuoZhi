import { createInitialState, type GameState } from './gameState';

/**
 * 記憶體中的唯一遊戲狀態（T006 會改成從 localStorage 讀寫）。
 * 畫面只讀取，變更一律先經 src/logic/ 的純函式算出新狀態，再用 setState 放回來。
 */
let current: GameState = createInitialState();

export function getState(): GameState {
  return current;
}

export function setState(next: GameState): void {
  current = next;
}
