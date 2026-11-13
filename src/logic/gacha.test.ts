import { describe, expect, it } from 'vitest';
import { DOGS, STARTER_DOG_IDS, findDog } from '../data/dogs';
import { createInitialState } from '../state/gameState';
import { createRng } from './battle';
import {
  GACHA_MAX_PULLS,
  GACHA_RATES,
  PITY_SSR,
  RARITIES,
  SHARDS_PER_DUPLICATE,
  bestRarity,
  collection,
  featuredDogs,
  gachaPool,
  pickDog,
  pull,
  pullsToPity,
  rollRarity,
} from './gacha';
import { calcPower } from './power';

const NOW = 1_800_000_000_000;
const fresh = () => createInitialState(NOW);
const rankOf = (id: string) => RARITIES.indexOf(findDog(id)!.rarity!);

describe('狗狗資料（T007）', () => {
  it('每隻狗都有稀有度與體型，id 不重複', () => {
    expect(new Set(DOGS.map((d) => d.id)).size).toBe(DOGS.length);
    expect(new Set(DOGS.map((d) => d.name)).size).toBe(DOGS.length);
    for (const d of DOGS) {
      expect(d.rarity, d.name).toBeDefined();
      expect(d.size, d.name).toBeDefined();
    }
  });

  it('共 19 隻：T007 新增 10 隻，小中大體型與四種稀有度都有', () => {
    expect(DOGS).toHaveLength(19);
    for (const size of ['小型', '中型', '大型']) {
      expect(DOGS.filter((d) => d.size === size).length, size).toBeGreaterThanOrEqual(3);
    }
    for (const r of RARITIES) {
      expect(DOGS.filter((d) => d.rarity === r).length, r).toBeGreaterThanOrEqual(2);
    }
  });

  it('稀有度越高基礎戰力越高（1 級時每一階都比低一階的最高還高；補血狗另計）', () => {
    const powers = (r: string) =>
      DOGS.filter((d) => d.rarity === r && !d.rewardOnly).map((d) =>
        calcPower(d.baseAttack, d.baseDefense),
      );
    for (let i = 1; i < RARITIES.length; i++) {
      expect(Math.min(...powers(RARITIES[i])), RARITIES[i]).toBeGreaterThan(
        Math.max(...powers(RARITIES[i - 1])),
      );
    }
  });
});

describe('召募池', () => {
  it('機率加起來 100', () => {
    expect(RARITIES.reduce((s, r) => s + GACHA_RATES[r], 0)).toBe(100);
  });

  it('關卡送的補血狗一開始就在池子裡（重複可以換碎片）', () => {
    expect(gachaPool().map((d) => d.id)).toContain('nuantong');
    expect(gachaPool()).toHaveLength(DOGS.length);
  });

  it('看板主打最稀有的幾隻', () => {
    expect(featuredDogs(2).map((d) => d.rarity)).toEqual(['SSR', 'SSR']);
    expect(featuredDogs(3)).toHaveLength(3);
  });
});

describe('rollRarity', () => {
  it('依機率切：亂數越小越稀有', () => {
    const at = (x: number) => rollRarity(() => x, { sinceSSR: 0 });
    expect(at(0)).toBe('SSR');
    expect(at(0.029)).toBe('SSR');
    expect(at(0.03)).toBe('SR');
    expect(at(0.149)).toBe('SR');
    expect(at(0.15)).toBe('R');
    expect(at(0.449)).toBe('R');
    expect(at(0.45)).toBe('N');
    expect(at(0.999999)).toBe('N');
    expect(at(1)).toBe('N');
  });

  it('大量抽的比例接近設定值', () => {
    const rng = createRng(7);
    const count = { N: 0, R: 0, SR: 0, SSR: 0 };
    const total = 20_000;
    for (let i = 0; i < total; i++) count[rollRarity(rng, { sinceSSR: 0 })]++;
    for (const r of RARITIES) {
      expect(Math.abs((count[r] / total) * 100 - GACHA_RATES[r]), r).toBeLessThan(1.5);
    }
  });

  it('十連保底：至少 SR；SSR 保底：第 50 抽一定是 SSR', () => {
    expect(rollRarity(() => 0.9, { sinceSSR: 0, atLeastSR: true })).toBe('SR');
    expect(rollRarity(() => 0.01, { sinceSSR: 0, atLeastSR: true })).toBe('SSR');
    expect(rollRarity(() => 0.9, { sinceSSR: PITY_SSR - 2 })).toBe('N');
    expect(rollRarity(() => 0.9, { sinceSSR: PITY_SSR - 1 })).toBe('SSR');
  });
});

describe('pickDog', () => {
  it('從指定稀有度裡平均抽；那一階沒有狗就往低一階找', () => {
    const pool = gachaPool();
    const seen = new Set<string>();
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) seen.add(pickDog(pool, 'SSR', rng)!.id);
    expect([...seen].sort()).toEqual(['nuantong', 'xiongyue', 'xueling']);
    const noSSR = pool.filter((d) => d.rarity !== 'SSR');
    expect(pickDog(noSSR, 'SSR', () => 0)!.rarity).toBe('SR');
    expect(pickDog([], 'N', () => 0)).toBeUndefined();
  });
});

describe('pull', () => {
  it('單抽：抽到沒有的狗就加入，1 級 1 星，累計次數 +1', () => {
    const s0 = fresh();
    // 第一個亂數決定稀有度（SSR），第二個決定哪一隻（第一隻）
    const seq = [0, 0];
    const r = pull(s0, 1, () => seq.shift() ?? 0);
    expect(r.items).toEqual([{ dogId: 'xiongyue', rarity: 'SSR', isNew: true, shards: 0 }]);
    expect(r.state.owned).toEqual([...s0.owned, 'xiongyue']);
    expect(r.state.dogs.xiongyue).toMatchObject({ level: 1, exp: 0 });
    expect(r.state.shards).toEqual({});
    expect(r.state.gacha).toEqual({ pulls: 1, sinceSSR: 0 });
    // 原本的狀態不變
    expect(s0.owned).toHaveLength(5);
    expect(s0.gacha).toEqual({ pulls: 0, sinceSSR: 0 });
  });

  it('抽到已經有的狗換成碎片，等級與隊伍不動', () => {
    const s0 = fresh();
    // 0.2 → R；R 有 7 隻，0.2 落在第 2 隻：黑旋（開局就有）
    const r = pull(s0, 1, () => 0.2);
    expect(gachaPool().filter((d) => d.rarity === 'R')[1].id).toBe('heixuan');
    expect(r.items).toEqual([
      { dogId: 'heixuan', rarity: 'R', isNew: false, shards: SHARDS_PER_DUPLICATE },
    ]);
    expect(r.state.owned).toEqual(s0.owned);
    expect(r.state.dogs).toEqual(s0.dogs);
    expect(r.state.shards).toEqual({ heixuan: 10 });
    expect(r.state.gacha).toEqual({ pulls: 1, sinceSSR: 1 });
    expect(pull(r.state, 1, () => 0.2).state.shards).toEqual({ heixuan: 20 });
  });

  it('十連：剛好 10 隻，同一次裡第二次抽到同一隻算重複', () => {
    const r = pull(fresh(), 10, () => 0.999);
    expect(r.items).toHaveLength(10);
    const ids = r.items.map((i) => i.dogId);
    for (let i = 0; i < ids.length; i++) {
      const dupe = STARTER_DOG_IDS.includes(ids[i]) || ids.indexOf(ids[i]) < i;
      expect(r.items[i].isNew).toBe(!dupe);
    }
    expect(r.state.gacha.pulls).toBe(10);
  });

  it('十連保底：前 9 隻都沒有 SR 以上，第 10 隻一定是 SR 以上；單抽沒有這個保底', () => {
    const r = pull(fresh(), 10, () => 0.999);
    expect(r.items.slice(0, 9).every((i) => i.rarity === 'N')).toBe(true);
    expect(r.items[9].rarity).toBe('SR');
    expect(pull(fresh(), 1, () => 0.999).items[0].rarity).toBe('N');
    for (let seed = 1; seed <= 300; seed++) {
      const items = pull(fresh(), 10, createRng(seed)).items;
      expect(items.some((i) => rankOf(i.dogId) >= 2)).toBe(true);
    }
  });

  it('SSR 保底：連續 49 抽沒出，第 50 抽一定是 SSR，之後重新計數', () => {
    let s = fresh();
    const never = () => 0.999;
    for (let i = 0; i < PITY_SSR - 1; i++) s = pull(s, 1, never).state;
    expect(s.gacha).toEqual({ pulls: PITY_SSR - 1, sinceSSR: PITY_SSR - 1 });
    expect(pullsToPity(s.gacha)).toBe(1);
    const r = pull(s, 1, never);
    expect(r.items[0].rarity).toBe('SSR');
    expect(r.state.gacha).toEqual({ pulls: PITY_SSR, sinceSSR: 0 });
    expect(pullsToPity(r.state.gacha)).toBe(PITY_SSR);
  });

  it('保底計數跨十連累積：任何連續 50 抽裡一定有 SSR', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = createRng(seed);
      let s = fresh();
      let gap = 0;
      for (let n = 0; n < 30; n++) {
        const r = pull(s, 10, rng);
        s = r.state;
        for (const it of r.items) {
          gap = it.rarity === 'SSR' ? 0 : gap + 1;
          expect(gap).toBeLessThan(PITY_SSR);
        }
      }
    }
  });

  it('次數夾在 1～10', () => {
    expect(pull(fresh(), 0, createRng(1)).items).toHaveLength(1);
    expect(pull(fresh(), 3.9, createRng(1)).items).toHaveLength(3);
    expect(pull(fresh(), 99, createRng(1)).items).toHaveLength(GACHA_MAX_PULLS);
    expect(pull(fresh(), Number.NaN, createRng(1)).items).toHaveLength(1);
  });

  it('同一個亂數種子結果一樣；抽很多次可以收集到全部召募得到的狗', () => {
    const a = pull(fresh(), 10, createRng(42));
    const b = pull(fresh(), 10, createRng(42));
    expect(a).toEqual(b);
    let s = fresh();
    const rng = createRng(5);
    for (let i = 0; i < 100; i++) s = pull(s, 10, rng).state;
    expect(collection(s.owned)).toEqual({ owned: DOGS.length, total: DOGS.length });
    // 關卡送的補血狗也抽得到，拿到的是牠原本的等級
    expect(s.owned).toContain('nuantong');
    expect(s.dogs.nuantong.level).toBe(5);
    // 狀態可以直接存檔
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('拿到補血狗之後抽得到牠的碎片', () => {
    const s0 = { ...fresh(), owned: [...STARTER_DOG_IDS, 'nuantong'] };
    let s = s0;
    const rng = createRng(9);
    for (let i = 0; i < 60; i++) s = pull(s, 10, rng).state;
    expect(s.shards.nuantong ?? 0).toBeGreaterThan(0);
  });

  it('bestRarity', () => {
    expect(bestRarity([])).toBeNull();
    expect(bestRarity(pull(fresh(), 10, () => 0.999).items)).toBe('SR');
  });
});
