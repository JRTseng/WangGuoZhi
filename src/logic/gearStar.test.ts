import { describe, expect, it } from 'vitest';
import { ALL_GEARS, findGear } from '../data/equipment';
import { createInitialState, type GameState } from '../state/gameState';
import {
  GEAR_STAR_MAX,
  equip,
  equipBest,
  gearAtStar,
  gearBonus,
  gearPct,
  gearStarOf,
  sanitizeGearStars,
} from './equipment';
import {
  GEAR_STAR_BONES,
  GEAR_STAR_COPIES,
  GEAR_STAR_SHARDS,
  checkGearStarUp,
  gearStarCost,
  gearStarCostLabel,
  gearStarPreview,
  gearStarReadyCount,
  gearStarText,
  gearStarUp,
  gearStarUpAll,
  spareCopies,
} from './gearStar';
import { dogStats } from './leveling';
import { findDog } from '../data/dogs';
import { deserialize, serialize } from './save';

const base = (patch: Partial<GameState> = {}): GameState => ({
  ...createInitialState(0),
  ...patch,
});
const BOXING = 'boxing-quanquan'; // R 手套 攻 +4
const MITT = 'mitt-taojiaoqing'; // N 手套 攻 +2

describe('裝備星等的加成', () => {
  it('每一星多原本合計的 20%、至少 +1；0 星和原本一樣；星數越高不會變弱', () => {
    const g = findGear(BOXING)!;
    expect(gearAtStar(g, 0)).toEqual({ attack: g.attack, defense: g.defense });
    expect([1, 2, 3, 4, 5].map((s) => gearAtStar(g, s).attack)).toEqual([5, 6, 7, 8, 9]);
    for (const x of ALL_GEARS) {
      const total = x.attack + x.defense;
      const top = gearAtStar(x, GEAR_STAR_MAX);
      expect(top.attack + top.defense).toBe(total + Math.max(GEAR_STAR_MAX, total));
      // 原本沒有的那一項不會憑空多出來
      if (x.attack === 0) expect(top.attack).toBe(0);
      if (x.defense === 0) expect(top.defense).toBe(0);
      for (let s = 1; s <= GEAR_STAR_MAX; s++) {
        const a = gearAtStar(x, s - 1);
        const b = gearAtStar(x, s);
        expect(b.attack).toBeGreaterThanOrEqual(a.attack);
        expect(b.defense).toBeGreaterThanOrEqual(a.defense);
        // 每升一星合計一定有多
        expect(b.attack + b.defense).toBeGreaterThan(a.attack + a.defense);
      }
    }
  });

  it('同樣星數時稀有度高的還是比較好', () => {
    const of = (id: string, s: number) => {
      const at = gearAtStar(findGear(id)!, s);
      return at.attack + at.defense;
    };
    for (let s = 0; s <= GEAR_STAR_MAX; s++) expect(of(BOXING, s)).toBeGreaterThan(of(MITT, s));
  });

  it('專屬裝備的比例加成每星多 1%，沒有比例加成的不會多出來', () => {
    const ssr = ALL_GEARS.find((g) => g.pct)!;
    expect(gearAtStar(ssr, 5).pct).toBeCloseTo(ssr.pct! + 0.05);
    expect(gearAtStar(findGear(BOXING)!, 5).pct).toBeUndefined();
  });

  it('星數超出範圍或亂填都夾回 0～5', () => {
    expect(gearStarOf({ gearStars: { [BOXING]: 99 } }, BOXING)).toBe(5);
    expect(gearStarOf({ gearStars: { [BOXING]: -3 } }, BOXING)).toBe(0);
    expect(gearStarOf({ gearStars: { [BOXING]: NaN } }, BOXING)).toBe(0);
    expect(gearStarOf({}, BOXING)).toBe(0);
  });

  it('穿著的狗攻防與戰力跟著星數變，沒穿的不變', () => {
    let s = base({ gear: { [BOXING]: 1 } });
    const r = equip(s, 'daer', BOXING);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.state;
    const dog = findDog('daer')!;
    const before = dogStats(s, dog);
    expect(gearBonus(s, 'daer')).toEqual({ attack: 4, defense: 0 });
    const up = { ...s, gearStars: { [BOXING]: 5 } };
    expect(gearBonus(up, 'daer')).toEqual({ attack: 9, defense: 0 });
    const after = dogStats(up, dog);
    expect(after.attack).toBe(before.attack + 5);
    expect(after.power).toBe(before.power + 5);
    expect(dogStats(up, findDog('heixuan')!)).toEqual(dogStats(s, findDog('heixuan')!));
  });

  it('專屬裝備升星後比例加成也算進去', () => {
    const ex = ALL_GEARS.find((g) => g.pct && g.exclusive)!;
    let s = base({ owned: [...createInitialState(0).owned, ex.exclusive!], gear: { [ex.id]: 1 } });
    const r = equip(s, ex.exclusive!, ex.id);
    if (!r.ok) throw new Error('equip failed');
    s = r.state;
    expect(gearPct(s, ex.exclusive!)).toBeCloseTo(ex.pct!);
    expect(gearPct({ ...s, gearStars: { [ex.id]: 3 } }, ex.exclusive!)).toBeCloseTo(ex.pct! + 0.03);
  });

  it('一鍵穿上會把星等算進去：升過星的 N 比沒升的 R 好就穿 N', () => {
    // 套交情手套 N 攻 +2，2 星 +4，和沒升星的拳拳到肉球 R 攻 +4 一樣好：一樣好就挑稀有度高的；3 星才換
    const s = base({ gear: { [BOXING]: 1, [MITT]: 1 } });
    expect(equipBest(s, 'daer').equipped.daer?.gloves).toBe(BOXING);
    expect(gearAtStar(findGear(MITT)!, 2).attack).toBe(gearAtStar(findGear(BOXING)!, 0).attack);
    expect(equipBest({ ...s, gearStars: { [MITT]: 3 } }, 'daer').equipped.daer?.gloves).toBe(MITT);
  });
});

describe('升星要花的東西', () => {
  it('一般裝備吃同款、專屬花碎片、爬塔飾品花骨頭幣；滿星沒有花費', () => {
    const normal = findGear(BOXING)!;
    const ex = ALL_GEARS.find((g) => g.exclusive)!;
    const tw = ALL_GEARS.find((g) => g.tower)!;
    for (let s = 0; s < GEAR_STAR_MAX; s++) {
      expect(gearStarCost(normal, s)).toEqual({ kind: 'copies', amount: GEAR_STAR_COPIES[s] });
      expect(gearStarCost(ex, s)).toEqual({ kind: 'shards', amount: GEAR_STAR_SHARDS[s] });
      expect(gearStarCost(tw, s)).toEqual({ kind: 'bones', amount: GEAR_STAR_BONES[s] });
    }
    expect(gearStarCost(normal, GEAR_STAR_MAX)).toBeNull();
    for (const t of [GEAR_STAR_COPIES, GEAR_STAR_SHARDS, GEAR_STAR_BONES]) {
      expect(t).toHaveLength(GEAR_STAR_MAX);
    }
  });

  it('可以拿去升星的同款：沒人穿的，而且至少留一件', () => {
    let s = base({ gear: { [BOXING]: 3 } });
    expect(spareCopies(s, BOXING)).toBe(2);
    const a = equip(s, 'daer', BOXING);
    if (!a.ok) throw new Error();
    s = a.state;
    expect(spareCopies(s, BOXING)).toBe(2);
    const b = equip(s, 'heixuan', BOXING);
    if (!b.ok) throw new Error();
    s = b.state;
    expect(spareCopies(s, BOXING)).toBe(1);
    expect(spareCopies(base({ gear: { [BOXING]: 1 } }), BOXING)).toBe(0);
    expect(spareCopies(base(), BOXING)).toBe(0);
  });
});

describe('升星', () => {
  it('同款夠就升一星並吃掉同款；不夠、沒有、不認得、滿星都不動', () => {
    const s = base({ gear: { [BOXING]: 2 } });
    expect(checkGearStarUp(s, BOXING)).toMatchObject({ ok: true, star: 0, have: 1, short: 0 });
    const r = gearStarUp(s, BOXING);
    expect(r.state.gearStars[BOXING]).toBe(1);
    expect(r.state.gear[BOXING]).toBe(1);
    // 原本的狀態沒被改到
    expect(s.gearStars[BOXING]).toBeUndefined();
    expect(s.gear[BOXING]).toBe(2);

    const again = gearStarUp(r.state, BOXING);
    expect(again.state).toBe(r.state);
    expect(again.check).toMatchObject({ ok: false, reason: 'short', star: 1, have: 0, short: 1 });

    expect(gearStarUp(base(), BOXING).check.reason).toBe('not-owned');
    expect(gearStarUp(base(), 'no-such-gear').check.reason).toBe('unknown-gear');
    const full = base({ gear: { [BOXING]: 9 }, gearStars: { [BOXING]: 5 } });
    const m = gearStarUp(full, BOXING);
    expect(m.state).toBe(full);
    expect(m.check).toMatchObject({ ok: false, reason: 'maxed', short: 0 });
  });

  it('穿在身上的那幾件不會被吃掉', () => {
    let s = base({ gear: { [BOXING]: 2 } });
    for (const id of ['daer', 'heixuan']) {
      const r = equip(s, id, BOXING);
      if (!r.ok) throw new Error();
      s = r.state;
    }
    const r = gearStarUp(s, BOXING);
    expect(r.check).toMatchObject({ ok: false, reason: 'short', have: 0 });
    expect(r.state).toBe(s);
  });

  it('專屬裝備花那隻角色的碎片', () => {
    const ex = ALL_GEARS.find((g) => g.exclusive)!;
    const dogId = ex.exclusive!;
    const s = base({ gear: { [ex.id]: 1 }, shards: { [dogId]: 7 } });
    const r = gearStarUp(s, ex.id);
    expect(r.check.ok).toBe(true);
    expect(r.state.gearStars[ex.id]).toBe(1);
    expect(r.state.shards[dogId]).toBe(2);
    expect(r.state.gear[ex.id]).toBe(1);
    expect(gearStarUp(r.state, ex.id).check).toMatchObject({
      ok: false,
      reason: 'short',
      have: 2,
      short: 8,
    });
  });

  it('爬塔飾品花骨頭幣', () => {
    const tw = ALL_GEARS.find((g) => g.tower)!;
    const init = createInitialState(0);
    const s = base({ gear: { [tw.id]: 1 }, resources: { ...init.resources, bones: 120 } });
    const r = gearStarUp(s, tw.id);
    expect(r.state.gearStars[tw.id]).toBe(1);
    expect(r.state.resources.bones).toBe(70);
    expect(r.state.resources.food).toBe(init.resources.food);
    expect(gearStarUp(r.state, tw.id).check).toMatchObject({ ok: false, short: 30 });
  });

  it('五星總共要吃 9 件同款', () => {
    let s = base({ gear: { [BOXING]: 10 } });
    for (let i = 0; i < 5; i++) s = gearStarUp(s, BOXING).state;
    expect(s.gearStars[BOXING]).toBe(5);
    expect(s.gear[BOXING]).toBe(1);
  });
});

describe('全部升星', () => {
  it('每種一般裝備升到不夠為止，只吃多的同款，不花碎片與骨頭幣', () => {
    const ex = ALL_GEARS.find((g) => g.exclusive)!;
    const tw = ALL_GEARS.find((g) => g.tower)!;
    const init = createInitialState(0);
    const s = base({
      gear: { [BOXING]: 4, [MITT]: 2, 'sweater-wufeng': 1, [ex.id]: 1, [tw.id]: 1 },
      shards: { [ex.exclusive!]: 99 },
      resources: { ...init.resources, bones: 9999 },
    });
    expect(gearStarReadyCount(s)).toBe(2);
    const r = gearStarUpAll(s);
    // 4 件：1 + 1 → 2 星，剩 2 件，第 3 星要 2 件但只多 1 件
    expect(r.ups).toEqual(
      expect.arrayContaining([
        { gearId: BOXING, from: 0, to: 2 },
        { gearId: MITT, from: 0, to: 1 },
      ]),
    );
    expect(r.ups).toHaveLength(2);
    expect(r.state.gear).toMatchObject({ [BOXING]: 2, [MITT]: 1, 'sweater-wufeng': 1 });
    expect(r.state.shards).toEqual(s.shards);
    expect(r.state.resources).toEqual(s.resources);
    expect(r.state.gearStars[ex.id]).toBeUndefined();
    expect(gearStarReadyCount(r.state)).toBe(0);
    const none = gearStarUpAll(r.state);
    expect(none.state).toBe(r.state);
    expect(none.ups).toEqual([]);
  });
});

describe('顯示與存檔', () => {
  it('星星與花費的字', () => {
    expect(gearStarText(0)).toBe('☆☆☆☆☆');
    expect(gearStarText(3)).toBe('★★★☆☆');
    expect(gearStarText(9)).toBe('★★★★★');
    const ex = findGear('ex-tieya')!;
    expect(gearStarCostLabel(findGear(BOXING)!, { kind: 'copies', amount: 2 })).toBe('多的同款 ×2');
    expect(gearStarCostLabel(ex, { kind: 'shards', amount: 10 })).toBe('鐵牙碎片 ×10');
    expect(gearStarCostLabel(ex, { kind: 'bones', amount: 50 })).toBe('骨頭幣 ×50');
    const p = gearStarPreview(findGear(BOXING)!, 0);
    expect(p.now.attack).toBe(4);
    expect(p.next?.attack).toBe(5);
    expect(gearStarPreview(findGear(BOXING)!, 5).next).toBeNull();
  });

  it('讀檔：只留認得的裝備、星數夾在 1～5', () => {
    expect(
      sanitizeGearStars({ [BOXING]: 3, [MITT]: 99, 'no-such': 2, 'sweater-wufeng': 0, x: 'a' }),
    ).toEqual({ [BOXING]: 3, [MITT]: 5 });
    expect(sanitizeGearStars(null)).toEqual({});
    expect(sanitizeGearStars([1, 2])).toEqual({});
  });

  it('星等會存檔；舊存檔沒有這個欄位就是空的', () => {
    const s = base({ gear: { [BOXING]: 1 }, gearStars: { [BOXING]: 2 } });
    const back = deserialize(serialize(s, 0), 0);
    expect(back.status).toBe('ok');
    expect(back.state.gearStars).toEqual({ [BOXING]: 2 });
    const file = JSON.parse(serialize(s, 0));
    delete file.state.gearStars;
    expect(deserialize(JSON.stringify(file), 0).state.gearStars).toEqual({});
  });
});
