import { describe, expect, it } from 'vitest';
import { DOGS, STARTER_IDS, factionOf } from '../data/dogs';
import { createInitialState } from '../state/gameState';
import {
  CODEX_TIERS,
  claimCodex,
  codexClaimable,
  codexCount,
  codexEntries,
  codexId,
  codexMilestones,
  codexRarityCounts,
  sanitizeCodex,
} from './codex';

const dogIds = DOGS.filter((d) => factionOf(d) === 'dog').map((d) => d.id);
const catIds = DOGS.filter((d) => factionOf(d) === 'cat').map((d) => d.id);
const withOwned = (owned: string[]) => ({ ...createInitialState(0), owned });

describe('圖鑑：列出角色', () => {
  it('每個陣營 50 隻，只列自己陣營的，稀有度高的在前面', () => {
    const st = createInitialState(0);
    for (const f of ['dog', 'cat'] as const) {
      const list = codexEntries(st, f);
      expect(list).toHaveLength(50);
      expect(list.every((e) => factionOf(e.dog) === f)).toBe(true);
      const order = ['SSR', 'SR', 'R', 'N'];
      const ranks = list.map((e) => order.indexOf(e.dog.rarity ?? 'N'));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      expect(new Set(list.map((e) => e.dog.id)).size).toBe(50);
    }
  });

  it('新遊戲：汪國有一開始的五隻，喵國一隻都沒有', () => {
    const st = createInitialState(0);
    expect(codexCount(st, 'dog')).toEqual({ owned: 5, total: 50 });
    expect(codexCount(st, 'cat')).toEqual({ owned: 0, total: 50 });
    const owned = codexEntries(st, 'dog')
      .filter((e) => e.owned)
      .map((e) => e.dog.id);
    expect(owned.sort()).toEqual([...STARTER_IDS.dog].sort());
  });

  it('各稀有度的數量加起來等於全部', () => {
    const st = withOwned(dogIds.slice(0, 20));
    const c = codexRarityCounts(st, 'dog');
    expect(c.SSR.total + c.SR.total + c.R.total + c.N.total).toBe(50);
    expect(c.SSR.owned + c.SR.owned + c.R.owned + c.N.owned).toBe(20);
  });
});

describe('圖鑑：收集獎勵', () => {
  it('門檻由小到大、獎勵越來越多，最後一段就是全部收集', () => {
    for (let i = 1; i < CODEX_TIERS.length; i++) {
      expect(CODEX_TIERS[i].target).toBeGreaterThan(CODEX_TIERS[i - 1].target);
      expect(CODEX_TIERS[i].bones).toBeGreaterThan(CODEX_TIERS[i - 1].bones);
    }
    expect(CODEX_TIERS[CODEX_TIERS.length - 1].target).toBe(50);
  });

  it('新遊戲沒有獎勵可以領，領了也沒事', () => {
    const st = createInitialState(0);
    expect(codexClaimable(st)).toBe(0);
    const r = claimCodex(st, 'dog');
    expect(r.count).toBe(0);
    expect(r.state).toBe(st);
  });

  it('收集到 20 隻：前兩段可以領，一次領完、不能重複領', () => {
    const st = withOwned(dogIds.slice(0, 20));
    expect(codexMilestones(st, 'dog').map((m) => m.done)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(codexClaimable(st, 'dog')).toBe(2);
    const r = claimCodex(st, 'dog');
    expect(r.count).toBe(2);
    expect(r.reward).toEqual({ food: 0, bones: 150 });
    expect(r.state.resources.bones).toBe(st.resources.bones + 150);
    expect(r.state.resources.food).toBe(st.resources.food);
    expect(r.state.codex.claimed).toEqual([codexId('dog', 10), codexId('dog', 20)]);
    expect(codexClaimable(r.state)).toBe(0);
    expect(claimCodex(r.state, 'dog').count).toBe(0);
    // 原本的狀態沒被改到
    expect(st.codex.claimed).toEqual([]);
  });

  it('兩個陣營各算各的，主頁紅點是兩邊加起來', () => {
    const st = withOwned([...dogIds.slice(0, 10), ...catIds.slice(0, 30)]);
    expect(codexClaimable(st, 'dog')).toBe(1);
    expect(codexClaimable(st, 'cat')).toBe(3);
    expect(codexClaimable(st)).toBe(4);
    const r = claimCodex(st, 'cat');
    expect(r.reward.bones).toBe(300);
    expect(codexClaimable(r.state)).toBe(1);
    expect(codexClaimable(r.state, 'dog')).toBe(1);
  });

  it('全部收集可以把五段領完', () => {
    const r = claimCodex(withOwned(dogIds), 'dog');
    expect(r.count).toBe(5);
    expect(r.reward.bones).toBe(CODEX_TIERS.reduce((n, t) => n + t.bones, 0));
  });
});

describe('圖鑑：讀檔', () => {
  it('舊存檔沒有這個欄位、或內容亂掉，都當成還沒領', () => {
    expect(sanitizeCodex(undefined)).toEqual({ claimed: [] });
    expect(sanitizeCodex(null)).toEqual({ claimed: [] });
    expect(sanitizeCodex({ claimed: 'dog-10' })).toEqual({ claimed: [] });
  });

  it('認不得的 id 丟掉、重複的只留一個', () => {
    expect(
      sanitizeCodex({ claimed: ['dog-10', 'dog-10', 'bird-10', 'cat-15', 7, 'cat-50'] }),
    ).toEqual({
      claimed: ['dog-10', 'cat-50'],
    });
  });
});
