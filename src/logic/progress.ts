import { BACKGROUNDS } from '../data/backgrounds';
import { REGIONS, type RegionData, type ThemeId } from '../data/regions';
import { STORIES, type StoryData } from '../data/stories';
import type { GameState } from '../state/gameState';

/**
 * 關卡進度：哪些章節／關卡開放、哪些劇情與背景已解鎖。全部是純函式。
 * 規則：
 * - 第 1 章一開始開放；之後的章節要打過上一章 Boss（最後一關）。
 * - 章內第 1 關跟著章節開放；其餘關卡要打過前一關。
 */

type Progress = Pick<GameState, 'cleared'>;

export type NodeState = 'locked' | 'open' | 'cleared';

export function isChapterUnlocked(state: Progress, regionIndex: number): boolean {
  if (regionIndex <= 0) return regionIndex === 0;
  const prev = REGIONS[regionIndex - 1];
  if (!prev) return false;
  return state.cleared.includes(prev.stages[prev.stages.length - 1].id);
}

export function isStageUnlocked(state: Progress, stageId: string): boolean {
  const ri = REGIONS.findIndex((r) => r.stages.some((s) => s.id === stageId));
  if (ri < 0 || !isChapterUnlocked(state, ri)) return false;
  const stages = REGIONS[ri].stages;
  const si = stages.findIndex((s) => s.id === stageId);
  return si === 0 || state.cleared.includes(stages[si - 1].id);
}

export function stageNodeState(state: Progress, stageId: string): NodeState {
  if (state.cleared.includes(stageId)) return 'cleared';
  return isStageUnlocked(state, stageId) ? 'open' : 'locked';
}

/** 目前最該去的章節（第一個還沒打完的已開放章節），用來決定地圖預設顯示哪章 */
export function currentChapterIndex(state: Progress): number {
  let idx = 0;
  REGIONS.forEach((_, i) => {
    if (isChapterUnlocked(state, i)) idx = i;
  });
  return idx;
}

export function chapterCleared(state: Progress, region: RegionData): boolean {
  return region.stages.every((s) => state.cleared.includes(s.id));
}

/** 已解鎖（可在劇情回顧觀看）的劇情 */
export function isStoryUnlocked(state: Progress, story: StoryData): boolean {
  return story.unlockAfter === null || state.cleared.includes(story.unlockAfter);
}

/** 打過這一關後，第一次解鎖、還沒看過的劇情（收成後自動播放） */
export function newStoriesAfter(
  state: Pick<GameState, 'cleared' | 'seenStories'>,
  stageId: string,
): StoryData[] {
  return STORIES.filter(
    (s) =>
      s.unlockAfter === stageId &&
      state.cleared.includes(stageId) &&
      !state.seenStories.includes(s.id),
  );
}

export function markStorySeen(state: GameState, storyId: string): GameState {
  if (state.seenStories.includes(storyId)) return state;
  return { ...state, seenStories: [...state.seenStories, storyId] };
}

/** 已取得的主頁背景 */
export function unlockedBackgrounds(
  state: Pick<GameState, 'cleared' | 'redeemedCodes'>,
): ThemeId[] {
  return BACKGROUNDS.filter((b) => {
    switch (b.unlock.kind) {
      case 'start':
        return true;
      case 'stage':
        return state.cleared.includes(b.unlock.stageId);
      case 'code':
        return state.redeemedCodes.includes(b.unlock.code);
    }
  }).map((b) => b.id);
}

/** 換到下一個已取得的背景（循環） */
export function nextBackground(state: GameState): GameState {
  const list = unlockedBackgrounds(state);
  const i = list.indexOf(state.backgroundId);
  const next = list[(i + 1) % list.length];
  return next === state.backgroundId ? state : { ...state, backgroundId: next };
}
