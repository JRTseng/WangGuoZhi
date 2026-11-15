import { REGIONS, type StageData } from '../data/regions';
import type { GameState } from '../state/gameState';
import { TEAM_MIN, busyDogIds, stageTeamMax } from './expedition';
import { isStageUnlocked } from './progress';
import { runBlock, type TimeOptions } from './stamina';
import { dogPower } from './team';

/**
 * 結算畫面的「下一關」按鈕：打贏後用同一隊直接挑戰下一關，不用回地圖再選一次。
 * 全部是純函式，畫面只負責照結果畫按鈕與開戰。
 */

export interface NextStagePlan {
  stage: StageData;
  /** 下一關在第幾章（REGIONS 的索引），打完回地圖時停在那一章 */
  chapter: number;
  /** 帶去下一關的隊伍 */
  team: string[];
  /** 下一關能上陣的比較少，有幾隻這次先留下來 */
  benched: number;
  /** 下一關能上陣的比較多，自動補了幾隻 */
  added: number;
}

/** 照章節順序的下一關（章末 Boss 的下一關是下一章第一關）；最後一關沒有下一關 */
export function nextStageOf(stageId: string): { stage: StageData; chapter: number } | undefined {
  const all = REGIONS.flatMap((r, chapter) => r.stages.map((stage) => ({ stage, chapter })));
  const i = all.findIndex((x) => x.stage.id === stageId);
  return i >= 0 ? all[i + 1] : undefined;
}

/**
 * 剛打完 stageId、隊伍是 team：能不能直接挑戰下一關，帶誰去。不能回傳 null（按鈕就不出現）。
 * - 下一關要存在而且已經解鎖（所以打輸、或這關是最後一關都不會有）。
 * - 隊伍照原本那一隊；下一關能上陣的比較少，就留戰力最高的幾隻（順序不變）。
 *   下一關能上陣的比較多就自動補滿：先補編隊裡的隊員，再補其他戰力高的狗（寄宿中的不算）。
 * - 體力或今日次數不夠（限制有開的時候）也不出現。
 */
export function nextStagePlan(
  state: GameState,
  stageId: string,
  team: readonly string[],
  now: number,
  o?: TimeOptions,
): NextStagePlan | null {
  const next = nextStageOf(stageId);
  if (!next || !isStageUnlocked(state, next.stage.id)) return null;
  const busy = busyDogIds(state);
  const able = team.filter((id) => state.owned.includes(id) && !busy.has(id));
  const max = stageTeamMax(next.stage.id);
  const keep = new Set(
    [...able].sort((a, b) => dogPower(state, b) - dogPower(state, a)).slice(0, max),
  );
  const going = able.filter((id) => keep.has(id));
  // 下一關能上陣的比較多（Jimmy 2026-11-15）：自動補滿。
  // 先補編隊裡原本的隊員（前幾關人數少被留下來的），再補其他戰力高的狗。
  const before = going.length;
  if (going.length < max) {
    const free = (id: string) => state.owned.includes(id) && !busy.has(id) && !going.includes(id);
    const others = state.owned
      .filter((id) => !state.team.includes(id))
      .sort((a, b) => dogPower(state, b) - dogPower(state, a));
    for (const id of [...state.team, ...others]) {
      if (going.length >= max) break;
      if (free(id)) going.push(id);
    }
  }
  if (going.length < TEAM_MIN) return null;
  if (!runBlock(state, next.stage.id, now, o).ok) return null;
  return {
    ...next,
    team: going,
    benched: able.length - before,
    added: going.length - before,
  };
}

/** 勾了「自動」：結算出來後等多久自己打下一關（留時間看獎勵，也來得及取消） */
export const AUTO_NEXT_DELAY_MS = 3000;

/** 倒數還剩幾秒（無條件進位，最少 0） */
export function autoNextSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** 結算面板最下面那行提示；seconds 有給代表正在倒數自動下一關 */
export function nextHint(seconds?: number): string {
  return seconds === undefined
    ? '點其他地方回地圖'
    : `${seconds} 秒後自動打下一關・取消「自動」就停`;
}
