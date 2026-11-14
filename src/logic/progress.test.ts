import { describe, expect, it } from 'vitest';
import { BACKGROUNDS } from '../data/backgrounds';
import { REGIONS } from '../data/regions';
import { STORIES } from '../data/stories';
import { createInitialState, type GameState } from '../state/gameState';
import {
  currentChapterIndex,
  isChapterUnlocked,
  isStageUnlocked,
  isStoryUnlocked,
  markStorySeen,
  newStoriesAfter,
  nextBackground,
  stageNodeState,
  unlockedBackgrounds,
} from './progress';

const withCleared = (...ids: string[]): GameState => ({ ...createInitialState(), cleared: ids });
const ch1 = REGIONS[0].stages.map((s) => s.id);

describe('章節與關卡解鎖', () => {
  it('一開始只有第 1 章第 1 關', () => {
    const s = createInitialState();
    expect(REGIONS.map((_, i) => isChapterUnlocked(s, i))).toEqual([
      true,
      ...Array.from({ length: REGIONS.length - 1 }, () => false),
    ]);
    expect(ch1.map((id) => stageNodeState(s, id))).toEqual([
      'open',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
    expect(isStageUnlocked(s, 'zhulindu-1')).toBe(false);
    expect(isStageUnlocked(s, 'nope')).toBe(false);
  });
  it('打過前一關才開下一關', () => {
    const s = withCleared('luoyepo-1', 'luoyepo-2');
    expect(ch1.map((id) => stageNodeState(s, id))).toEqual([
      'cleared',
      'cleared',
      'open',
      'locked',
      'locked',
    ]);
  });
  it('打倒章末 Boss 才開下一章', () => {
    const s = withCleared(...ch1);
    expect(isChapterUnlocked(s, 1)).toBe(true);
    expect(isChapterUnlocked(s, 2)).toBe(false);
    expect(isStageUnlocked(s, 'zhulindu-1')).toBe(true);
    expect(currentChapterIndex(s)).toBe(1);
    expect(currentChapterIndex(createInitialState())).toBe(0);
  });
});

describe('劇情', () => {
  it('序章一開始就能看，其餘要過關', () => {
    const s = createInitialState();
    expect(STORIES.filter((x) => isStoryUnlocked(s, x)).map((x) => x.id)).toEqual(['prologue']);
  });
  it('第一次過關會跳出新劇情，看過就不再跳', () => {
    let s = withCleared('luoyepo-1');
    expect(newStoriesAfter(s, 'luoyepo-1').map((x) => x.id)).toEqual(['ch1-first']);
    s = markStorySeen(s, 'ch1-first');
    expect(newStoriesAfter(s, 'luoyepo-1')).toEqual([]);
    expect(markStorySeen(s, 'ch1-first')).toBe(s);
    expect(newStoriesAfter(s, 'luoyepo-2')).toEqual([]);
  });
});

describe('主頁背景', () => {
  it('一開始只有落葉坡；過關與優惠碼解鎖更多', () => {
    expect(unlockedBackgrounds(createInitialState())).toEqual(['slope']);
    const s = { ...withCleared('luoyepo-5'), redeemedCodes: ['WANGWANG'] };
    expect(unlockedBackgrounds(s)).toEqual(['slope', 'bamboo', 'lantern']);
  });
  it('換背景會循環已取得的背景', () => {
    let s: GameState = { ...withCleared('luoyepo-5') };
    expect(nextBackground(createInitialState()).backgroundId).toBe('slope');
    s = nextBackground(s);
    expect(s.backgroundId).toBe('bamboo');
    s = nextBackground(s);
    expect(s.backgroundId).toBe('slope');
  });
});

describe('主頁背景擴充到每一章（T016）', () => {
  it('每一章的場景都是一張背景：第一章一開始就有，其餘打倒前一章的 Boss 拿到', () => {
    REGIONS.forEach((region, i) => {
      const bg = BACKGROUNDS.find((b) => b.id === region.theme);
      expect(bg, region.name).toBeDefined();
      if (i === 0) {
        expect(bg!.unlock.kind).toBe('start');
        return;
      }
      const prev = REGIONS[i - 1].stages;
      expect(bg!.unlock, region.name).toEqual({
        kind: 'stage',
        stageId: prev[prev.length - 1].id,
      });
    });
  });

  it('打倒最後一章的 Boss 送主城；加上活動的燈會一共 12 張，沒有重複', () => {
    const last = REGIONS[REGIONS.length - 1].stages;
    expect(BACKGROUNDS.find((b) => b.id === 'city')?.unlock).toEqual({
      kind: 'stage',
      stageId: last[last.length - 1].id,
    });
    expect(BACKGROUNDS.length).toBe(REGIONS.length + 2);
    expect(new Set(BACKGROUNDS.map((b) => b.id)).size).toBe(BACKGROUNDS.length);
  });

  it('全部通關加上活動碼就拿到全部，而且能一張一張輪流換', () => {
    const cleared = REGIONS.flatMap((r) => r.stages.map((s) => s.id));
    let s = { ...createInitialState(), cleared, redeemedCodes: ['WANGWANG'] };
    expect(unlockedBackgrounds(s).length).toBe(12);
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      seen.add(s.backgroundId);
      s = nextBackground(s);
    }
    expect(seen.size).toBe(12);
    expect(s.backgroundId).toBe('slope');
  });
});
