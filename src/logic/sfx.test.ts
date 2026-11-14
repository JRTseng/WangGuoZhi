import { describe, expect, it } from 'vitest';
import { SFX, SFX_MIN_GAP_MS, sfxAllowed, sfxSeconds, type SfxId } from './sfx';

const IDS = Object.keys(SFX) as SfxId[];

describe('音效配方', () => {
  it('每個音效都有內容，頻率、長度、音量都在合理範圍', () => {
    expect(IDS.length).toBeGreaterThanOrEqual(12);
    for (const id of IDS) {
      expect(SFX[id].length, id).toBeGreaterThan(0);
      for (const t of SFX[id]) {
        expect(t.from, id).toBeGreaterThanOrEqual(40);
        expect(t.from, id).toBeLessThanOrEqual(8000);
        if (t.to !== undefined) expect(t.to, id).toBeGreaterThanOrEqual(40);
        expect(t.at, id).toBeGreaterThanOrEqual(0);
        expect(t.dur, id).toBeGreaterThan(0);
        expect(t.gain, id).toBeGreaterThan(0);
        expect(t.gain, id).toBeLessThanOrEqual(1);
      }
    }
  });

  it('點按要很短，勝利與落敗的樂句不超過一秒半', () => {
    expect(sfxSeconds('tap')).toBeLessThanOrEqual(0.08);
    expect(sfxSeconds('hit')).toBeLessThan(0.2);
    for (const id of IDS) expect(sfxSeconds(id), id).toBeLessThanOrEqual(1.5);
    expect(sfxSeconds('win')).toBeCloseTo(1.0);
  });
});

describe('sfxAllowed', () => {
  it('第一次一定可以播', () => {
    expect(sfxAllowed(undefined, 0)).toBe(true);
  });

  it('同一個音效太密就不播', () => {
    expect(sfxAllowed(1000, 1000 + SFX_MIN_GAP_MS - 1)).toBe(false);
    expect(sfxAllowed(1000, 1000 + SFX_MIN_GAP_MS)).toBe(true);
  });
});
