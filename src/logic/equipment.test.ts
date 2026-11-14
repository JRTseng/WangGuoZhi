import { describe, expect, it } from 'vitest';
import { findDog } from '../data/dogs';
import {
  ALL_GEARS,
  EXCLUSIVE_BONUS,
  EXCLUSIVE_GEARS,
  GEARS,
  GEAR_BONUS,
  GEAR_SLOTS,
  exclusiveGearOf,
  findGear,
} from '../data/equipment';
import { DOGS } from '../data/dogs';
import { createInitialState, type GameState } from '../state/gameState';
import {
  DROP_RATE,
  addGear,
  dropNote,
  dropWeights,
  equip,
  equipBest,
  gearBonus,
  gearPct,
  grantExclusives,
  gearBonusLabel,
  gearOf,
  ownedGears,
  rollDrop,
  sanitizeGear,
  spareCount,
  totalGear,
  unequip,
  wearersOf,
} from './equipment';
import { expeditionDrop, runExpedition } from './expedition';
import { dogStats } from './leveling';
import { deserialize, serialize } from './save';
import { pull } from './gacha';

const base = (): GameState => createInitialState(0);
const withGear = (ids: Record<string, number>): GameState => ({ ...base(), gear: ids });
const stats = (s: GameState, id: string) => dogStats(s, findDog(id)!);
/** 依序回傳給定的數字的假亂數 */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[Math.min(i++, xs.length - 1)];
};

describe('裝備資料', () => {
  it('每個部位至少 4 件，id 不重複，加成合計照稀有度', () => {
    expect(new Set(GEARS.map((g) => g.id)).size).toBe(GEARS.length);
    for (const slot of GEAR_SLOTS) {
      expect(GEARS.filter((g) => g.slot === slot).length).toBeGreaterThanOrEqual(4);
    }
    for (const g of GEARS) {
      expect(g.attack + g.defense, g.name).toBe(GEAR_BONUS[g.rarity]);
      expect(g.attack).toBeGreaterThanOrEqual(0);
      expect(g.defense).toBeGreaterThanOrEqual(0);
      expect(g.name.length).toBeLessThanOrEqual(8);
    }
  });
  it('名字不重複，每個稀有度每個部位都有', () => {
    expect(new Set(GEARS.map((g) => g.name)).size).toBe(GEARS.length);
    for (const slot of GEAR_SLOTS) {
      for (const r of ['N', 'R', 'SR', 'SSR'] as const) {
        expect(
          GEARS.some((g) => g.slot === slot && g.rarity === r),
          `${slot} ${r}`,
        ).toBe(true);
      }
    }
  });
});

describe('穿、脫、換', () => {
  it('穿上後攻防與戰力照加成變化，脫下恢復', () => {
    const s0 = withGear({ 'boxing-quanquan': 1, 'sweater-wufeng': 1 });
    const before = stats(s0, 'daer');
    const r1 = equip(s0, 'daer', 'boxing-quanquan');
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = equip(r1.state, 'daer', 'sweater-wufeng');
    if (!r2.ok) throw new Error('穿不上');
    const after = stats(r2.state, 'daer');
    expect(after.attack).toBe(before.attack + 4);
    expect(after.defense).toBe(before.defense + 4);
    expect(after.power).toBe(before.power + 8);
    expect(after).toMatchObject({ gearAttack: 4, gearDefense: 4 });
    expect(gearBonus(r2.state, 'daer')).toEqual({ attack: 4, defense: 4 });
    expect(gearOf(r2.state, 'daer').map((g) => g.id)).toEqual([
      'sweater-wufeng',
      'boxing-quanquan',
    ]);
    const off = unequip(unequip(r2.state, 'daer', 'gloves'), 'daer', 'clothes');
    expect(stats(off, 'daer')).toEqual(before);
    expect(off.equipped).toEqual({});
    // 本來就沒穿：原樣回傳
    expect(unequip(off, 'daer', 'head')).toBe(off);
  });

  it('同一個部位只能穿一件，換上新的舊的回倉庫', () => {
    const s0 = withGear({ 'mitt-taojiaoqing': 1, 'boxing-quanquan': 1 });
    const a = equip(s0, 'daer', 'mitt-taojiaoqing');
    if (!a.ok) throw new Error();
    const b = equip(a.state, 'daer', 'boxing-quanquan');
    if (!b.ok) throw new Error();
    expect(b.state.equipped.daer).toEqual({ gloves: 'boxing-quanquan' });
    expect(spareCount(b.state, 'mitt-taojiaoqing')).toBe(1);
    expect(spareCount(b.state, 'boxing-quanquan')).toBe(0);
  });

  it('同一件不能同時穿在兩隻狗身上：只有一件時從原本那隻身上換過來', () => {
    const s0 = withGear({ 'boxing-quanquan': 1 });
    const a = equip(s0, 'daer', 'boxing-quanquan');
    if (!a.ok) throw new Error();
    const b = equip(a.state, 'heixuan', 'boxing-quanquan');
    if (!b.ok) throw new Error();
    expect(b.from).toBe('daer');
    expect(wearersOf(b.state, 'boxing-quanquan')).toEqual(['heixuan']);
    expect(b.state.equipped.daer).toBeUndefined();
    expect(stats(b.state, 'daer').gearAttack).toBe(0);
    expect(stats(b.state, 'heixuan').gearAttack).toBe(4);
  });

  it('有兩件就可以兩隻各穿一件', () => {
    const s0 = withGear({ 'boxing-quanquan': 2 });
    const a = equip(s0, 'daer', 'boxing-quanquan');
    if (!a.ok) throw new Error();
    const b = equip(a.state, 'heixuan', 'boxing-quanquan');
    if (!b.ok) throw new Error();
    expect(b.from).toBeUndefined();
    expect(wearersOf(b.state, 'boxing-quanquan')).toEqual(['daer', 'heixuan']);
    expect(spareCount(b.state, 'boxing-quanquan')).toBe(0);
  });

  it('兩隻狗互換：各自把對方那件換過來', () => {
    const s0 = withGear({ 'boxing-quanquan': 1, 'mitt-taojiaoqing': 1 });
    let s = s0;
    for (const [dog, gear] of [
      ['daer', 'boxing-quanquan'],
      ['heixuan', 'mitt-taojiaoqing'],
      ['daer', 'mitt-taojiaoqing'],
      ['heixuan', 'boxing-quanquan'],
    ] as const) {
      const r = equip(s, dog, gear);
      if (!r.ok) throw new Error();
      s = r.state;
    }
    expect(s.equipped).toEqual({
      daer: { gloves: 'mitt-taojiaoqing' },
      heixuan: { gloves: 'boxing-quanquan' },
    });
    expect(stats(s, 'daer').gearAttack).toBe(2);
    expect(stats(s, 'heixuan').gearAttack).toBe(4);
  });

  it('不行的情況：沒有這件、不認得、狗不是自己的', () => {
    const s0 = withGear({ 'boxing-quanquan': 1 });
    expect(equip(s0, 'daer', 'sweater-wufeng')).toEqual({ ok: false, error: 'no-gear' });
    expect(equip(s0, 'daer', 'nope')).toEqual({ ok: false, error: 'gear-not-found' });
    expect(equip(s0, 'tieya', 'boxing-quanquan')).toEqual({ ok: false, error: 'dog-not-owned' });
    // 已經穿著同一件：不變
    const a = equip(s0, 'daer', 'boxing-quanquan');
    if (!a.ok) throw new Error();
    const again = equip(a.state, 'daer', 'boxing-quanquan');
    expect(again.ok && again.state).toBe(a.state);
  });

  it('一鍵穿上：每個部位挑沒人穿的裡面最好的，不搶別的狗的', () => {
    const s0 = withGear({
      'mitt-taojiaoqing': 1,
      'boxing-quanquan': 1,
      'boxing-zhetian': 1,
      'sneaker-xiexieni': 1,
      'crown-yiguandaodi': 1,
    });
    const a = equip(s0, 'heixuan', 'boxing-zhetian');
    if (!a.ok) throw new Error();
    const s = equipBest(a.state, 'daer');
    expect(s.equipped.daer).toEqual({
      gloves: 'boxing-quanquan',
      shoes: 'sneaker-xiexieni',
      head: 'crown-yiguandaodi',
    });
    expect(s.equipped.heixuan).toEqual({ gloves: 'boxing-zhetian' });
    // 已經是最好的：不變
    expect(equipBest(s, 'daer')).toBe(s);
  });

  it('倉庫清單：照部位、稀有度高的在前，可以只看一個部位', () => {
    const s = withGear({ 'mitt-taojiaoqing': 2, 'boxing-zhetian': 1, 'sweater-wufeng': 1 });
    expect(ownedGears(s).map((g) => g.id)).toEqual([
      'sweater-wufeng',
      'boxing-zhetian',
      'mitt-taojiaoqing',
    ]);
    expect(ownedGears(s, 'gloves').map((g) => g.id)).toEqual([
      'boxing-zhetian',
      'mitt-taojiaoqing',
    ]);
    expect(ownedGears(s, 'head')).toEqual([]);
    expect(totalGear(s)).toBe(4);
    expect(addGear(s, 'nope')).toBe(s);
    expect(totalGear(addGear(s, 'sweater-wufeng'))).toBe(5);
  });

  it('顯示用的字', () => {
    expect(gearBonusLabel(findGear('boxing-quanquan')!)).toBe('攻 +4');
    expect(gearBonusLabel(findGear('shorts-kuku')!)).toBe('攻 +1 防 +3');
    expect(dropNote(findGear('sweater-wufeng')!)).toBe('獲得裝備「毛衣無縫」（R・衣服）');
  });
});

describe('掉落', () => {
  it('三成機率掉一件；沒抽中就沒有', () => {
    expect(DROP_RATE).toBe(0.3);
    expect(rollDrop(1, false, seq(0.3))).toBeNull();
    expect(rollDrop(1, false, seq(0.99))).toBeNull();
    expect(rollDrop(1, false, seq(0.29, 0, 0))?.rarity).toBe('N');
  });

  it('照比重抽稀有度：第 1 章一般關不會出 SSR，Boss 關與後面的章節會', () => {
    expect(dropWeights(1, false)).toEqual({ N: 70, R: 25, SR: 5, SSR: 0 });
    expect(dropWeights(1, true)).toEqual({ N: 70, R: 25, SR: 10, SSR: 2 });
    expect(dropWeights(10, false)).toEqual({ N: 20, R: 43, SR: 32, SSR: 8 });
    expect(rollDrop(1, false, seq(0, 0.999, 0))?.rarity).toBe('SR');
    expect(rollDrop(1, true, seq(0, 0.999, 0))?.rarity).toBe('SSR');
    expect(rollDrop(1, false, seq(0, 0.7, 0))?.rarity).toBe('R');
  });

  it('大量抽：掉落率約三成，稀有度分布接近比重', () => {
    let seed = 12345;
    const rng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const n = 20000;
    const got: Record<string, number> = { N: 0, R: 0, SR: 0, SSR: 0 };
    let drops = 0;
    for (let i = 0; i < n; i++) {
      const g = rollDrop(5, false, rng);
      if (g) {
        drops++;
        got[g.rarity]++;
      }
    }
    expect(drops / n).toBeGreaterThan(0.28);
    expect(drops / n).toBeLessThan(0.32);
    const w = dropWeights(5, false);
    const sum = w.N + w.R + w.SR + w.SSR;
    for (const r of ['N', 'R', 'SR', 'SSR'] as const) {
      expect(Math.abs(got[r] / drops - w[r] / sum), r).toBeLessThan(0.03);
    }
  });

  it('出征：打輸不掉；同一個種子掉的東西一樣，掉的會進倉庫與紀錄', () => {
    expect(expeditionDrop({ stageId: 'luoyepo-1', seed: 1 }, false)).toBeNull();
    const team = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
    let hit = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const r = runExpedition(base(), 'luoyepo-1', team, 1000, { seed });
      if (!r.ok) throw new Error(r.error);
      const want = expeditionDrop({ stageId: 'luoyepo-1', seed }, r.record.win);
      expect(r.record.dropGearId ?? null).toBe(want);
      if (want) {
        hit++;
        expect(r.state.gear).toEqual({ [want]: 1 });
      } else {
        expect(r.state.gear).toEqual({});
      }
    }
    expect(hit).toBeGreaterThan(5);
    expect(hit).toBeLessThan(35);
  });
});

describe('存檔', () => {
  it('裝備與穿著存得回來', () => {
    const a = equip(
      withGear({ 'boxing-quanquan': 2, 'sweater-wufeng': 1 }),
      'daer',
      'boxing-quanquan',
    );
    if (!a.ok) throw new Error();
    const back = deserialize(serialize(a.state, 5), 5).state;
    expect(back.gear).toEqual(a.state.gear);
    expect(back.equipped).toEqual(a.state.equipped);
    expect(stats(back, 'daer').gearAttack).toBe(4);
  });

  it('舊存檔沒有裝備欄位：補成空的', () => {
    const file = JSON.parse(serialize(base(), 5));
    delete file.state.gear;
    delete file.state.equipped;
    const back = deserialize(JSON.stringify(file), 5);
    expect(back.status).toBe('ok');
    expect(back.state.gear).toEqual({});
    expect(back.state.equipped).toEqual({});
  });

  it('怪資料：不認得的丟掉，穿著的不能比擁有的多，部位不對的丟掉', () => {
    const r = sanitizeGear(
      { 'boxing-quanquan': 1, nope: 3, 'sweater-wufeng': -1, 'crown-yiguandaodi': 2.9 },
      {
        daer: { gloves: 'boxing-quanquan', head: 'boxing-quanquan', clothes: 'sweater-wufeng' },
        heixuan: { gloves: 'boxing-quanquan', head: 'crown-yiguandaodi' },
        stranger: { head: 'crown-yiguandaodi' },
        abai: 'x',
      },
      (id) => id !== 'stranger',
    );
    expect(r.gear).toEqual({ 'boxing-quanquan': 1, 'crown-yiguandaodi': 2 });
    expect(r.equipped).toEqual({
      daer: { gloves: 'boxing-quanquan' },
      heixuan: { head: 'crown-yiguandaodi' },
    });
    expect(sanitizeGear(null, [], () => true)).toEqual({ gear: {}, equipped: {} });
  });
});

describe('專屬裝備', () => {
  const own = (ids: string[]): GameState => {
    const s = base();
    return grantExclusives({ ...s, owned: [...s.owned, ...ids] });
  };

  it('SR、SSR 的狗每隻一件，其他的沒有；id、名字不和一般裝備重複', () => {
    for (const d of DOGS) {
      const g = exclusiveGearOf(d.id);
      if (d.rarity === 'SR' || d.rarity === 'SSR') {
        expect(g, d.name).toBeTruthy();
        expect(g!.rarity).toBe(d.rarity);
        expect(g!.attack + g!.defense).toBe(EXCLUSIVE_BONUS[d.rarity]);
        expect(g!.pct ?? 0).toBe(d.rarity === 'SSR' ? 0.05 : 0);
        expect(g!.name.length).toBeLessThanOrEqual(8);
      } else expect(g).toBeUndefined();
    }
    expect(EXCLUSIVE_GEARS).toHaveLength(12);
    expect(new Set(ALL_GEARS.map((g) => g.id)).size).toBe(ALL_GEARS.length);
    expect(new Set(ALL_GEARS.map((g) => g.name)).size).toBe(ALL_GEARS.length);
    // 比同稀有度的一般裝備強
    expect(EXCLUSIVE_BONUS.SR).toBeGreaterThan(GEAR_BONUS.SR);
    expect(EXCLUSIVE_BONUS.SSR).toBeGreaterThan(GEAR_BONUS.SSR);
  });

  it('擁有那隻狗就送一件，不會重複送；沒有的狗不送', () => {
    const s = own(['xiongyue', 'tieya']);
    expect(s.gear).toEqual({ 'ex-xiongyue': 1, 'ex-tieya': 1 });
    expect(grantExclusives(s)).toBe(s);
    expect(grantExclusives(base())).toEqual(base());
  });

  it('只有那隻狗能穿；一鍵穿上不會拿別隻狗的專屬', () => {
    const s = own(['xiongyue']);
    expect(equip(s, 'daer', 'ex-xiongyue')).toEqual({ ok: false, error: 'exclusive' });
    expect(equipBest(s, 'daer')).toBe(s);
    const best = equipBest(addGear(s, 'trousers-chikunailao'), 'xiongyue');
    // 專屬（+16、攻防 +5%）比一般的 SSR 褲子（+12）好
    expect(best.equipped.xiongyue).toEqual({ pants: 'ex-xiongyue' });
  });

  it('SSR 專屬：固定加成之外，攻防各再多 5%（以沒算裝備的攻防為準）', () => {
    const s = own(['xiongyue']);
    const before = stats(s, 'xiongyue');
    const r = equip(s, 'xiongyue', 'ex-xiongyue');
    if (!r.ok) throw new Error();
    expect(gearPct(r.state, 'xiongyue')).toBe(0.05);
    const after = stats(r.state, 'xiongyue');
    expect(after.gearAttack).toBe(4 + Math.round(before.attack * 0.05));
    expect(after.gearDefense).toBe(12 + Math.round(before.defense * 0.05));
    expect(after.attack).toBe(before.attack + after.gearAttack);
    expect(after.power).toBe(before.power + after.gearAttack + after.gearDefense);
  });

  it('SR 專屬只有固定加成', () => {
    const s = own(['tieya']);
    const r = equip(s, 'tieya', 'ex-tieya');
    if (!r.ok) throw new Error();
    expect(stats(r.state, 'tieya')).toMatchObject({ gearAttack: 0, gearDefense: 10 });
    expect(gearBonusLabel(findGear('ex-tieya')!)).toBe('防 +10');
    expect(gearBonusLabel(findGear('ex-xiongyue')!)).toBe('攻 +4 防 +12 攻防 +5%');
  });

  it('關卡不會掉專屬裝備', () => {
    let seed = 7;
    const rng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 3000; i++) {
      const g = rollDrop(10, true, rng);
      if (g) expect(g.exclusive).toBeUndefined();
    }
    expect(GEARS.every((g) => !g.exclusive)).toBe(true);
  });

  it('召募抽到新的 SR、SSR 後補發；讀舊存檔時也會補發', () => {
    let seed = 99;
    const rng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    let s = base();
    for (let i = 0; i < 20; i++) s = grantExclusives(pull(s, 10, rng).state);
    const rare = DOGS.filter(
      (d) => s.owned.includes(d.id) && (d.rarity === 'SR' || d.rarity === 'SSR'),
    );
    expect(rare.length).toBeGreaterThan(3);
    for (const d of rare) expect(s.gear[exclusiveGearOf(d.id)!.id]).toBe(1);
    // 舊存檔：有狗但沒有裝備欄位
    const file = JSON.parse(serialize(s, 5));
    delete file.state.gear;
    const back = deserialize(JSON.stringify(file), 5).state;
    for (const d of rare) expect(back.gear[exclusiveGearOf(d.id)!.id]).toBe(1);
    // 存檔裡把專屬裝備穿在別隻狗身上：讀檔時脫掉
    const bad = JSON.parse(serialize(s, 5));
    bad.state.equipped = {
      daer: { [exclusiveGearOf(rare[0].id)!.slot]: exclusiveGearOf(rare[0].id)!.id },
    };
    expect(deserialize(JSON.stringify(bad), 5).state.equipped).toEqual({});
  });
});
