import { describe, expect, it } from 'vitest';
import { BACKGROUNDS } from '../data/backgrounds';
import { DOGS, STARTER_IDS, factionOf } from '../data/dogs';
import { ALL_GEARS, EXCLUSIVE_GEARS, GEARS, TOWER_GEARS } from '../data/equipment';
import { createInitialState } from '../state/gameState';
import {
  CODEX_BACKGROUND_TIERS,
  CODEX_GEAR_TIERS,
  CODEX_PAGES,
  CODEX_TIERS,
  codexBackgroundEntries,
  codexGearEntries,
  codexPageCount,
  codexTiers,
  gearSource,
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

describe('圖鑑：裝備頁（T043）', () => {
  const gearOf = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]));

  it('列出全部的裝備，稀有度高的在前面，不重複', () => {
    const list = codexGearEntries(createInitialState(0));
    expect(list).toHaveLength(ALL_GEARS.length);
    expect(new Set(list.map((e) => e.gear.id)).size).toBe(ALL_GEARS.length);
    const order = ['SSR', 'SR', 'R', 'N'];
    const ranks = list.map((e) => order.indexOf(e.gear.rarity));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('有幾件、幾星都看得到；數量是 0 就算還沒有', () => {
    const id = GEARS[0].id;
    const st = {
      ...createInitialState(0),
      gear: { [id]: 3, [GEARS[1].id]: 0 },
      gearStars: { [id]: 2 },
    };
    const list = codexGearEntries(st);
    expect(list.find((e) => e.gear.id === id)).toMatchObject({ owned: true, count: 3, star: 2 });
    expect(list.find((e) => e.gear.id === GEARS[1].id)).toMatchObject({ owned: false, count: 0 });
    expect(codexPageCount(st, 'gear')).toEqual({ owned: 1, total: ALL_GEARS.length });
  });

  it('怎麼拿：一般、專屬、爬塔飾品各有說法', () => {
    expect(gearSource(GEARS[0])).toContain('關卡');
    const ex = EXCLUSIVE_GEARS[0];
    const owner = DOGS.find((d) => d.id === ex.exclusive)!;
    expect(gearSource(ex)).toContain(owner.name);
    expect(gearSource(TOWER_GEARS[0])).toContain(`第 ${TOWER_GEARS[0].tower} 層`);
  });

  it('收集到 20 種可以領前兩段，領過不能再領，不影響角色那兩頁', () => {
    const st = { ...createInitialState(0), gear: gearOf(ALL_GEARS.slice(0, 20).map((g) => g.id)) };
    expect(codexClaimable(st, 'gear')).toBe(2);
    expect(codexClaimable(st, 'dog')).toBe(0);
    expect(codexClaimable(st)).toBe(2);
    const r = claimCodex(st, 'gear');
    expect(r.count).toBe(2);
    expect(r.reward).toEqual({ food: 0, bones: 150 });
    expect(r.state.codex.claimed).toEqual([codexId('gear', 10), codexId('gear', 20)]);
    expect(codexClaimable(r.state)).toBe(0);
  });
});

describe('圖鑑：背景頁（T043）', () => {
  it('新遊戲只有一開始那一張，主頁用的就是它', () => {
    const st = createInitialState(0);
    const list = codexBackgroundEntries(st);
    expect(list).toHaveLength(BACKGROUNDS.length);
    expect(list.filter((e) => e.owned).map((e) => e.background.id)).toEqual(['slope']);
    expect(list.filter((e) => e.current).map((e) => e.background.id)).toEqual(['slope']);
    expect(codexPageCount(st, 'background')).toEqual({ owned: 1, total: BACKGROUNDS.length });
    expect(codexClaimable(st, 'background')).toBe(0);
  });

  it('打倒兩章頭目有三張，可以領第一段；再兌換活動碼多一張', () => {
    const st = { ...createInitialState(0), cleared: ['luoyepo-5', 'zhulindu-5'] };
    expect(codexPageCount(st, 'background').owned).toBe(3);
    expect(codexClaimable(st, 'background')).toBe(1);
    const r = claimCodex(st, 'background');
    expect(r.reward.bones).toBe(CODEX_BACKGROUND_TIERS[0].bones);
    expect(r.state.codex.claimed).toEqual([codexId('background', 3)]);
    const more = { ...r.state, redeemedCodes: ['WANGWANG'] };
    expect(codexPageCount(more, 'background').owned).toBe(4);
    expect(codexBackgroundEntries(more).find((e) => e.background.id === 'lantern')!.owned).toBe(
      true,
    );
  });
});

describe('圖鑑：每一頁的收集獎勵（T043）', () => {
  it('每一頁的門檻都由小到大、獎勵越來越多，最後一段就是全部收集', () => {
    const st = createInitialState(0);
    for (const p of CODEX_PAGES) {
      const tiers = codexTiers(p);
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].target).toBeGreaterThan(tiers[i - 1].target);
        expect(tiers[i].bones).toBeGreaterThan(tiers[i - 1].bones);
      }
      expect(tiers[tiers.length - 1].target).toBe(codexPageCount(st, p).total);
    }
    expect(CODEX_GEAR_TIERS).toHaveLength(5);
  });

  it('讀檔認得裝備與背景的獎勵', () => {
    expect(sanitizeCodex({ claimed: ['gear-10', 'background-3', 'gear-11', 'bg-3'] })).toEqual({
      claimed: ['gear-10', 'background-3'],
    });
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
