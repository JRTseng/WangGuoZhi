import { describe, expect, it } from 'vitest';
import { BIOS, BIO_LIMITS, bioOf } from './bios';
import { DOGS } from './dogs';

describe('角色小故事（T041）', () => {
  it('100 個角色每一個都有小故事，沒有多出來的 id', () => {
    const ids = DOGS.map((d) => d.id);
    expect(ids).toHaveLength(100);
    expect(Object.keys(BIOS).sort()).toEqual([...ids].sort());
  });

  it('每一段都有字，而且不超過字數上限（太長會超出視窗）', () => {
    for (const d of DOGS) {
      const b = bioOf(d.id)!;
      for (const key of ['story', 'likes', 'fears'] as const) {
        expect(b[key].trim(), `${d.name} ${key}`).toBe(b[key]);
        expect(b[key].length, `${d.name} ${key}`).toBeGreaterThan(0);
        expect(b[key].length, `${d.name} ${key}：${b[key]}`).toBeLessThanOrEqual(BIO_LIMITS[key]);
      }
      expect(b.story.length, `${d.name} 故事太短`).toBeGreaterThanOrEqual(30);
    }
  });

  it('小故事沒有重複的', () => {
    const stories = Object.values(BIOS).map((b) => b.story);
    expect(new Set(stories).size).toBe(stories.length);
  });

  it('認不得的 id 回傳 null', () => {
    expect(bioOf('nobody')).toBeNull();
  });
});
