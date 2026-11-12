import { advanceAuto } from '../logic/auto';
import { regenMsFromSearch, settle, type TimeOptions } from '../logic/stamina';
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

/** 體力與每日重置用的時間設定（測試模式 ?fast=1 體力恢復比較快） */
export function timeOptions(): TimeOptions {
  return { regenMs: regenMsFromSearch(window.location.search) };
}

/**
 * 把跟時間有關的狀態結算到現在：體力恢復、每日重置、自動出征補算。
 * 畫面定時呼叫，進入要用體力的畫面前也呼叫一次。
 */
export function tick(now: number = Date.now()): GameState {
  const o = timeOptions();
  const next = settle(advanceAuto(current, now, o), now, o);
  if (next !== current) current = next;
  return current;
}
