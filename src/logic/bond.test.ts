import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { REGIONS } from '../data/regions';
import { createInitialState } from '../state/gameState';
import {
  BOND,
  BOND_GIFT,
  BOND_MAX_LEVEL,
  BOND_NEED,
  battleBond,
  bondLevel,
  bondReward,
  bondText,
  bondUpNote,
  bondUpText,
  bondView,
  canPet,
  FAVE_MULT,
  favoriteSnack,
  faveText,
  giftGain,
  knowsFavorite,
  gainBond,
  GIFT_PER_DAY,
  giftBlock,
  giftBlockText,
  giftLine,
  giftSnack,
  giftsLeft,
  petDog,
  petLine,
  sanitizeBond,
} from './bond';
import { runExpedition } from './expedition';
import { sanitizeState } from './save';

const NOW = Date.UTC(2026, 10, 24, 4, 0, 0); // 台北中午
const DAY = 24 * 60 * 60 * 1000;
const fresh = () => createInitialState(NOW);

describe('好感度（T042）', () => {
  it('門檻一級比一級高，最高 10 級', () => {
    expect(BOND_MAX_LEVEL).toBe(10);
    expect(BOND_NEED[0]).toBe(0);
    for (let i = 1; i < BOND_NEED.length; i += 1) {
      expect(BOND_NEED[i]).toBeGreaterThan(BOND_NEED[i - 1]);
    }
    expect(bondLevel(0)).toBe(0);
    expect(bondLevel(9)).toBe(0);
    expect(bondLevel(10)).toBe(1);
    expect(bondLevel(659)).toBe(9);
    expect(bondLevel(660)).toBe(10);
    expect(bondLevel(99999)).toBe(10);
  });

  it('每一級都有禮物，碎片是那個角色自己的', () => {
    for (let lv = 1; lv <= BOND_MAX_LEVEL; lv += 1) {
      expect(bondReward('daer', lv).length, `第 ${lv} 級`).toBeGreaterThan(0);
    }
    expect(bondReward('daer', 0)).toEqual([]);
    expect(bondReward('daer', 11)).toEqual([]);
    expect(bondReward('daer', 3)).toEqual([{ kind: 'shards', id: 'daer', amount: 2 }]);
  });

  it('摸摸：每個角色一天一次，摸到升級禮物直接入袋', () => {
    const s0 = fresh();
    const id = s0.owned[0];
    expect(canPet(s0, id, NOW)).toBe(true);
    const r1 = petDog(s0, id, NOW);
    expect(r1.gained).toBe(BOND.pet);
    expect(r1.ups).toEqual([{ dogId: id, level: 1, gifts: [{ kind: 'food', amount: 100 }] }]);
    expect(r1.state.resources.food).toBe(s0.resources.food + 100);
    expect(bondView(r1.state, id)).toMatchObject({ level: 1, points: 10, into: 0, need: 20 });
    // 今天再摸不會再加
    expect(canPet(r1.state, id, NOW + 1000)).toBe(false);
    const r2 = petDog(r1.state, id, NOW + 1000);
    expect(r2.gained).toBe(0);
    expect(r2.state).toBe(r1.state);
    // 別的角色今天還可以摸
    const other = s0.owned[1];
    expect(petDog(r1.state, other, NOW).gained).toBe(BOND.pet);
    // 隔天又可以
    const r3 = petDog(r1.state, id, NOW + DAY);
    expect(r3.gained).toBe(BOND.pet);
    expect(r3.state.bond.petted).toEqual([id]);
    expect(bondView(r3.state, id).points).toBe(20);
  });

  it('沒擁有的角色不能摸、也不會加好感度', () => {
    const s0 = fresh();
    const stranger = DOGS.find((d) => !s0.owned.includes(d.id))!.id;
    expect(canPet(s0, stranger, NOW)).toBe(false);
    expect(petDog(s0, stranger, NOW).state).toBe(s0);
    expect(gainBond(s0, [stranger, 'nobody'], 50).state.bond.points).toEqual({});
  });

  it('一次跨好幾級，每一級的禮物都送；滿級後不再累積', () => {
    const s0 = fresh();
    const id = s0.owned[0];
    const r = gainBond(s0, [id], 60);
    expect(r.ups.map((u) => u.level)).toEqual([1, 2, 3]);
    expect(r.state.resources.food).toBe(s0.resources.food + 100);
    expect(r.state.resources.bones).toBe(s0.resources.bones + 10);
    expect(r.state.shards[id] ?? 0).toBe((s0.shards[id] ?? 0) + 2);
    expect(bondUpText(r.ups)).toContain('♥3');
    expect(bondUpText(r.ups)).toContain('碎片 ×2');
    expect(bondUpNote(r.ups)).toBe(`好感度升級：${DOGS.find((d) => d.id === id)!.name} ♥3`);
    const two = gainBond(s0, s0.owned.slice(0, 2), 10).ups;
    expect(bondUpNote(two)).toMatch(/ ♥1 等 2 隻$/);
    expect(bondUpText([])).toBe('');
    expect(bondUpNote([])).toBe('');

    const full = gainBond(s0, [id], 99999);
    expect(full.ups).toHaveLength(BOND_MAX_LEVEL);
    const v = bondView(full.state, id);
    expect(v).toMatchObject({ level: 10, points: 660, max: true, need: 0, next: [] });
    expect(bondText(v)).toContain('滿');
    expect(canPet(full.state, id, NOW)).toBe(false);
    expect(gainBond(full.state, [id], 10).state).toBe(full.state);
  });

  it('資料視窗的那一行寫得出等級、進度與下一級的禮物', () => {
    const s = gainBond(fresh(), ['daer'], 45).state;
    expect(bondText(bondView(s, 'daer'))).toBe('♥2（15／30）下一級送 大耳碎片 ×2');
  });

  it('一起出征：打贏每隻 +3、打輸 +1，同一隻不重複算', () => {
    const s0 = fresh();
    const [a, b] = s0.owned;
    const win = battleBond(s0, [a, b, a], true).state;
    expect(win.bond.points).toEqual({ [a]: BOND.win, [b]: BOND.win });
    const lose = battleBond(s0, [a], false).state;
    expect(lose.bond.points).toEqual({ [a]: BOND.lose });
  });

  it('真的打一仗：上陣的角色好感度增加，升級會記在出征紀錄上', () => {
    let s = fresh();
    const team = s.owned.slice(0, 3);
    // 差一點就升級
    s = gainBond(s, team, 9).state;
    const r = runExpedition(s, REGIONS[0].stages[0].id, team, NOW, { seed: 7 });
    if (!r.ok) throw new Error(r.error);
    for (const id of team) {
      expect(r.state.bond.points[id]).toBe(9 + (r.record.win ? BOND.win : BOND.lose));
    }
    expect(r.record.bondUps?.map((u) => u.dogId).sort()).toEqual([...team].sort());
    expect(r.record.bondUps?.every((u) => u.level === 1)).toBe(true);
  });

  it('被摸的時候說的話：三個階段不一樣，喜歡的東西會出現在裡面', () => {
    const low = new Set([0, 1, 2, 3, 4].map((i) => petLine(0, i, '烤地瓜')));
    const high = new Set([0, 1, 2, 3, 4].map((i) => petLine(9, i, '烤地瓜')));
    expect(low.size).toBe(4);
    expect(high.size).toBe(5);
    expect([...low].some((l) => high.has(l))).toBe(false);
    expect([...low].some((l) => l.includes('烤地瓜'))).toBe(false);
    expect([...high].some((l) => l.includes('烤地瓜'))).toBe(true);
    expect(petLine(5, -3)).toBeTruthy();
    // 泡泡放得下
    for (const lv of [0, 5, 9]) {
      for (let i = 0; i < 6; i += 1) {
        expect(petLine(lv, i, '一二三四五六七八九十一二三四五六七八').length).toBeLessThanOrEqual(
          30,
        );
      }
    }
  });

  it('讀檔：舊存檔沒有好感度就從 0 開始；壞掉的值會被整理掉', () => {
    expect(sanitizeBond(undefined)).toEqual({
      points: {},
      day: '',
      petted: [],
      gifted: {},
      faves: [],
    });
    expect(
      sanitizeBond({
        points: { daer: 45.7, nobody: 10, abai: -3, heixuan: 'x', changxu: 99999 },
        day: 20261124,
        petted: ['daer', 'daer', 'nobody', 5],
      }),
    ).toEqual({
      points: { daer: 45, changxu: 660 },
      day: '',
      petted: ['daer'],
      gifted: {},
      faves: [],
    });

    const s = petDog(fresh(), 'daer', NOW).state;
    const loaded = sanitizeState(JSON.parse(JSON.stringify(s)), NOW);
    expect(loaded.bond).toEqual(s.bond);
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete old.bond;
    expect(sanitizeState(old, NOW).bond).toEqual({
      points: {},
      day: '',
      petted: [],
      gifted: {},
      faves: [],
    });
  });

  describe('送零食（T044）', () => {
    const withSnacks = () => ({ ...fresh(), snacks: { small: 5, mid: 1, big: 0 } });

    it('送一個扣一個零食，照零食種類加好感度，升級的禮物直接入袋', () => {
      const s0 = withSnacks();
      const id = s0.owned[0];
      expect(giftsLeft(s0, id, NOW)).toBe(GIFT_PER_DAY);
      const r1 = giftSnack(s0, id, 'small', NOW);
      expect(r1.block).toBeNull();
      expect(r1.gained).toBe(BOND_GIFT.small);
      expect(r1.state.snacks.small).toBe(4);
      expect(r1.state.bond.points[id]).toBe(5);
      expect(r1.ups).toEqual([]);
      expect(giftsLeft(r1.state, id, NOW)).toBe(GIFT_PER_DAY - 1);
      // 香烤肉排 +12：5 → 17，升到 1 級送糧草 100
      const r2 = giftSnack(r1.state, id, 'mid', NOW);
      expect(r2.gained).toBe(BOND_GIFT.mid);
      expect(r2.state.snacks.mid).toBe(0);
      expect(r2.ups).toHaveLength(1);
      expect(r2.state.resources.food).toBe(s0.resources.food + 100);
    });

    it('每個角色一天最多收三次，換日以後又可以送；不影響今天有沒有摸過', () => {
      let st = withSnacks();
      const [a, b] = st.owned;
      st = petDog(st, a, NOW).state;
      for (let i = 0; i < GIFT_PER_DAY; i += 1) st = giftSnack(st, a, 'small', NOW).state;
      expect(giftBlock(st, a, 'small', NOW)).toBe('daily');
      const blocked = giftSnack(st, a, 'small', NOW);
      expect(blocked.gained).toBe(0);
      expect(blocked.state).toBe(st);
      // 別的角色不受影響
      expect(giftBlock(st, b, 'small', NOW)).toBeNull();
      // 今天摸過的紀錄還在
      expect(canPet(st, a, NOW)).toBe(false);
      // 隔天：送的次數與摸摸都重新算
      expect(giftsLeft(st, a, NOW + DAY)).toBe(GIFT_PER_DAY);
      const next = giftSnack(st, a, 'small', NOW + DAY);
      expect(next.block).toBeNull();
      expect(next.state.bond.gifted).toEqual({ [a]: 1 });
      expect(next.state.bond.petted).toEqual([]);
      expect(canPet(next.state, a, NOW + DAY)).toBe(true);
    });

    it('沒有零食、沒擁有、滿級、認不得的都不能送，而且什麼都不扣', () => {
      const s0 = withSnacks();
      const id = s0.owned[0];
      const other = DOGS.find((d) => !s0.owned.includes(d.id))!.id;
      expect(giftBlock(s0, id, 'big', NOW)).toBe('none-left');
      expect(giftBlock(s0, other, 'small', NOW)).toBe('not-owned');
      expect(giftBlock(s0, id, 'cake', NOW)).toBe('unknown');
      expect(giftBlock(s0, 'nobody', 'small', NOW)).toBe('unknown');
      const full = { ...s0, bond: { ...s0.bond, points: { [id]: BOND_NEED[BOND_MAX_LEVEL] } } };
      expect(giftBlock(full, id, 'small', NOW)).toBe('maxed');
      expect(giftSnack(full, id, 'small', NOW).state).toBe(full);
      for (const b of ['maxed', 'daily', 'none-left', 'unknown'] as const) {
        expect(giftBlockText(b).length).toBeGreaterThan(0);
      }
    });

    it('快滿級時多的好感度不會超過上限，gained 是實際加到的', () => {
      const s0 = { ...withSnacks(), snacks: { big: 1 } };
      const id = s0.owned[0];
      const near = {
        ...s0,
        bond: { ...s0.bond, points: { [id]: BOND_NEED[BOND_MAX_LEVEL] - 4 } },
      };
      const r = giftSnack(near, id, 'big', NOW);
      expect(r.gained).toBe(4);
      expect(r.state.bond.points[id]).toBe(BOND_NEED[BOND_MAX_LEVEL]);
      expect(r.ups.at(-1)?.level).toBe(BOND_MAX_LEVEL);
    });

    describe('愛吃的零食（T046）', () => {
      const SNACK_IDS = ['small', 'mid', 'big'] as const;
      const stocked = () => ({ ...fresh(), snacks: { small: 9, mid: 9, big: 9 } });

      it('每個角色愛吃的固定不變，三種零食都有不少角色愛吃', () => {
        const count: Record<string, number> = { small: 0, mid: 0, big: 0 };
        for (const d of DOGS) {
          const f = favoriteSnack(d.id);
          expect(SNACK_IDS).toContain(f);
          expect(favoriteSnack(d.id)).toBe(f);
          count[f] += 1;
        }
        for (const id of SNACK_IDS) expect(count[id]).toBeGreaterThanOrEqual(DOGS.length / 5);
      });

      it('送對了好感度加倍，並且記下來；送別的照原本的加', () => {
        const s0 = stocked();
        const id = s0.owned[0];
        const fave = favoriteSnack(id);
        const other = SNACK_IDS.find((x) => x !== fave)!;
        expect(giftGain(id, fave)).toBe(BOND_GIFT[fave] * FAVE_MULT);
        expect(giftGain(id, other)).toBe(BOND_GIFT[other]);
        expect(knowsFavorite(s0, id)).toBe(false);
        expect(bondView(s0, id).fave).toBeNull();

        const r1 = giftSnack(s0, id, other, NOW);
        expect(r1).toMatchObject({ gained: BOND_GIFT[other], fave: false, found: false });
        expect(knowsFavorite(r1.state, id)).toBe(false);

        const r2 = giftSnack(r1.state, id, fave, NOW);
        expect(r2).toMatchObject({ gained: BOND_GIFT[fave] * FAVE_MULT, fave: true, found: true });
        expect(r2.state.snacks[fave]).toBe(8);
        expect(r2.state.bond.faves).toEqual([id]);
        expect(bondView(r2.state, id).fave).toBe(fave);

        // 再送一次：還是加倍，但不是新發現，也不會重複記
        const r3 = giftSnack(r2.state, id, fave, NOW);
        expect(r3).toMatchObject({ fave: true, found: false });
        expect(r3.state.bond.faves).toEqual([id]);
      });

      it('知道愛吃什麼不會換日就忘記；送不出去的時候不會偷偷記下來', () => {
        const s0 = stocked();
        const id = s0.owned[0];
        const fave = favoriteSnack(id);
        const known = giftSnack(s0, id, fave, NOW).state;
        const next = petDog(known, id, NOW + DAY).state;
        expect(next.bond.gifted).toEqual({});
        expect(knowsFavorite(next, id)).toBe(true);
        const none = { ...s0, snacks: {} };
        const blocked = giftSnack(none, id, fave, NOW);
        expect(blocked).toMatchObject({ block: 'none-left', fave: false, found: false });
        expect(knowsFavorite(blocked.state, id)).toBe(false);
      });

      it('台詞與資料視窗的文字', () => {
        for (let i = 0; i < 6; i += 1) {
          const line = giftLine(0, i, '香烤肉排', true);
          expect(line).toContain('香烤肉排');
          expect(line.length).toBeLessThanOrEqual(30);
          expect(giftLine(0, i, '香烤肉排')).not.toBe(line);
        }
        expect(faveText(null)).toContain('？？？');
        expect(faveText('big')).toContain('大骨頭');
      });

      it('讀檔：舊存檔沒有 faves 是空的；認不得、重複的會被整理掉', () => {
        const s0 = stocked();
        const id = s0.owned[0];
        const old = { ...s0, bond: { points: {}, day: '', petted: [] } } as unknown as typeof s0;
        expect(knowsFavorite(old, id)).toBe(false);
        expect(giftSnack(old, id, favoriteSnack(id), NOW).state.bond.faves).toEqual([id]);
        expect(sanitizeBond({ faves: [id, id, 'nobody', 3] }).faves).toEqual([id]);
        expect(sanitizeBond({ faves: 'x' }).faves).toEqual([]);
        const saved = giftSnack(s0, id, favoriteSnack(id), NOW).state;
        expect(sanitizeState(JSON.parse(JSON.stringify(saved)), NOW).bond).toEqual(saved.bond);
      });
    });

    it('舊存檔沒有 gifted 也能送；壞掉的 gifted 會被整理掉', () => {
      const s0 = withSnacks();
      const id = s0.owned[0];
      const old = { ...s0, bond: { points: {}, day: '', petted: [] } } as unknown as typeof s0;
      expect(giftSnack(old, id, 'small', NOW).state.bond.gifted).toEqual({ [id]: 1 });
      expect(
        sanitizeBond({ points: {}, day: 'x', petted: [], gifted: { [id]: 99, nobody: 2, a: -1 } })
          .gifted,
      ).toEqual({ [id]: GIFT_PER_DAY });
    });

    it('收到零食會說話，好感度越高越熱情', () => {
      expect(giftLine(0, 0, '小肉乾').length).toBeGreaterThan(0);
      expect(giftLine(5, 0, '小肉乾')).toContain('小肉乾');
      expect(giftLine(9, -1, '大骨頭').length).toBeGreaterThan(0);
    });
  });
});
