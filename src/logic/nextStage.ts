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
 *   下一關能上陣的比較多也不會自動補狗，想多帶就回地圖重選。
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
  if (going.length < TEAM_MIN) return null;
  if (!runBlock(state, next.stage.id, now, o).ok) return null;
  return { ...next, team: going, benched: able.length - going.length };
}
