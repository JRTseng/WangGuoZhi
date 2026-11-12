import { advanceAuto } from '../logic/auto';
import { SAVE_BACKUP_KEY, SAVE_KEY, deserialize, serialize, type LoadStatus } from '../logic/save';
import { regenMsFromSearch, settle, type TimeOptions } from '../logic/stamina';
import { createInitialState, type GameState } from './gameState';

/**
 * 記憶體中的唯一遊戲狀態，開遊戲時從 localStorage 讀回來，每次變更就存回去（T006）。
 * 畫面只讀取，變更一律先經 src/logic/ 的純函式算出新狀態，再用 setState 放回來。
 *
 * localStorage 不能用時（例如無痕模式擋掉、空間滿了）遊戲照常跑，只是這次的進度留不住。
 */

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function load(): { state: GameState; status: LoadStatus } {
  const raw = readStorage(SAVE_KEY);
  const r = deserialize(raw, Date.now());
  // 壞檔先搬到備份的位置再重置，需要時還救得回來
  if (r.status === 'reset' && raw !== null) writeStorage(SAVE_BACKUP_KEY, raw);
  return r;
}

const loaded = load();
let current: GameState = loaded.state;
let loadStatus: LoadStatus = loaded.status;
let lastSaveOk = true;

function save(): void {
  lastSaveOk = writeStorage(SAVE_KEY, serialize(current, Date.now()));
}

// 新遊戲或剛重置：馬上存一份，之後重開就是「讀檔」
if (loadStatus !== 'ok') save();

export function getState(): GameState {
  return current;
}

export function setState(next: GameState): void {
  if (next === current) return;
  current = next;
  save();
}

/** 這次開遊戲是新遊戲、讀檔成功，還是存檔壞掉被重置 */
export function saveStatus(): { load: LoadStatus; saveOk: boolean } {
  return { load: loadStatus, saveOk: lastSaveOk };
}

/** 「存檔壞了已重置」的提示只需要講一次；講完呼叫這個 */
export function acknowledgeLoad(): void {
  if (loadStatus === 'reset') loadStatus = 'new';
}

/** 清除存檔，回到新遊戲（設定面板的「重新開始」） */
export function resetSave(): void {
  current = createInitialState();
  loadStatus = 'new';
  save();
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
  if (next === current) return current;
  // 體力滿的時候，每次結算只會把「上次結算時間」往前推；這種變化不用寫進存檔，
  // 免得主頁每 0.25 秒就存一次。讀檔時時間本來就會重新結算。
  const keys = Object.keys(next) as (keyof GameState)[];
  const onlyClock =
    next.stamina.value === current.stamina.value &&
    keys.every((k) => k === 'stamina' || next[k] === current[k]);
  current = next;
  if (!onlyClock) save();
  return current;
}
