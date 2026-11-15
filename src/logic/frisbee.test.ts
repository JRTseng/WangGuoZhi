import { describe, expect, it } from 'vitest';
import { REGIONS } from '../data/regions';
import { createInitialState, type GameState } from '../state/gameState';
import { createRng } from './battle';
import {
  FRISBEE_COUNT,
  FRISBEE_DOG_SPEED,
  FRISBEE_EDGE,
  FRISBEE_EXP_BASE,
  FRISBEE_EXP_PER_CATCH,
  FRISBEE_MAX_STEP,
  FRISBEE_MIN_STEP,
  FRISBEE_REACH,
  finishFrisbee,
  frisbeeCaught,
  frisbeeComment,
  frisbeeDefaultDog,
  frisbeeDuration,
  frisbeePlan,
  frisbeePos,
  frisbeeReady,
  frisbeeReward,
  moveDog,
  sanitizeFrisbee,
} from './frisbee';
import { levelCapOf, stageExp } from './leveling';
import { deserialize, serialize } from './save';

const NOW = Date.UTC(2026, 10, 15, 4, 0, 0); // 台北 12:00
const O = { tzOffsetMin: -480 };
const DAY = 24 * 3_600_000;
const fresh = (): GameState => createInitialState(NOW);

describe('接飛盤：怎麼丟', () => {
  it('同一個種子丟法一樣，換種子就不同', () => {
    expect(frisbeePlan(42)).toEqual(frisbeePlan(42));
    expect(frisbeePlan(42)).not.toEqual(frisbeePlan(43));
    expect(frisbeePlan(42)).toHaveLength(FRISBEE_COUNT);
  });

  it('落點都在場地裡，每一個都跑得到、也不會站著就接到', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const plan = frisbeePlan(seed);
      let dog = 0.5;
      let t = 0;
      for (const th of plan) {
        expect(th.landX).toBeGreaterThanOrEqual(FRISBEE_EDGE - 1e-9);
        expect(th.landX).toBeLessThanOrEqual(1 - FRISBEE_EDGE + 1e-9);
        const step = Math.abs(th.landX - dog);
        expect(step).toBeGreaterThanOrEqual(FRISBEE_MIN_STEP - 1e-9);
        expect(step).toBeLessThanOrEqual(FRISBEE_MAX_STEP + 1e-9);
        // 丟出來才開始跑，落地前到得了
        expect((step / FRISBEE_DOG_SPEED) * 1000).toBeLessThan(th.flight);
        // 一次只有一個飛盤在空中
        expect(th.at).toBeGreaterThanOrEqual(t);
        t = th.at + th.flight;
        dog = th.landX;
      }
      expect(frisbeeDuration(plan)).toBe(t);
    }
  });

  it('越後面飛得越快', () => {
    const plan = frisbeePlan(7);
    expect(plan[0].flight).toBeGreaterThan(plan[plan.length - 1].flight);
  });

  it('飛盤從場外飛進來，先往上再落到落點', () => {
    const th = frisbeePlan(7)[0];
    expect(frisbeePos(th, th.at - 1)).toBeNull();
    const start = frisbeePos(th, th.at)!;
    expect(th.from === 0 ? start.x < 0 : start.x > 1).toBe(true);
    const mid = frisbeePos(th, th.at + th.flight / 2)!;
    expect(mid.y).toBeGreaterThan(start.y);
    const end = frisbeePos(th, th.at + th.flight + 500)!;
    expect(end).toEqual({ x: th.landX, y: 0, p: 1 });
  });
});

describe('接飛盤：狗狗跑位與接到沒', () => {
  it('往目標跑，不會衝過頭，也不會跑出場地', () => {
    expect(moveDog(0.5, 0.9, 100)).toBeCloseTo(0.5 + FRISBEE_DOG_SPEED * 0.1);
    expect(moveDog(0.5, 0.1, 100)).toBeCloseTo(0.5 - FRISBEE_DOG_SPEED * 0.1);
    expect(moveDog(0.5, 0.52, 1000)).toBe(0.52);
    expect(moveDog(0.9, 5, 5000)).toBe(1);
    expect(moveDog(0.5, 0.9, 0)).toBe(0.5);
  });

  it('落地時離落點夠近才算接到', () => {
    const th = { landX: 0.4 };
    expect(frisbeeCaught(th, 0.4)).toBe(true);
    expect(frisbeeCaught(th, 0.4 + FRISBEE_REACH)).toBe(true);
    expect(frisbeeCaught(th, 0.4 - FRISBEE_REACH - 0.01)).toBe(false);
  });

  it('照著落點跑的話每一個都接得到', () => {
    const plan = frisbeePlan(99);
    let dog = 0.5;
    let caught = 0;
    for (const th of plan) {
      // 每 50 毫秒更新一次位置
      for (let t = 0; t < th.flight; t += 50) dog = moveDog(dog, th.landX, 50);
      if (frisbeeCaught(th, dog)) caught++;
    }
    expect(caught).toBe(FRISBEE_COUNT);
  });
});

describe('接飛盤：獎勵', () => {
  const base = stageExp(REGIONS[0].stages[0]);

  it('參加就有經驗，接越多越多；全部接到再送一個零食', () => {
    const st = fresh();
    expect(frisbeeReward(st, 0)).toEqual({ exp: Math.round(base * FRISBEE_EXP_BASE), snack: null });
    expect(frisbeeReward(st, 5).exp).toBe(
      Math.round(base * (FRISBEE_EXP_BASE + FRISBEE_EXP_PER_CATCH * 5)),
    );
    expect(frisbeeReward(st, FRISBEE_COUNT).snack).toEqual({ id: 'small', amount: 1 });
    // 超過的不多算
    expect(frisbeeReward(st, 99)).toEqual(frisbeeReward(st, FRISBEE_COUNT));
  });

  it('打到越後面的關卡，經驗跟零食越好', () => {
    const late = { cleared: REGIONS.slice(0, 4).flatMap((r) => r.stages.map((s) => s.id)) };
    expect(frisbeeReward(late, 3).exp).toBeGreaterThan(frisbeeReward(fresh(), 3).exp);
    expect(frisbeeReward(late, FRISBEE_COUNT).snack).toEqual({ id: 'mid', amount: 1 });
  });

  it('每天第一次玩才有獎勵，05:00 換日後又可以拿', () => {
    const st = fresh();
    expect(frisbeeReady(st, NOW, O)).toBe(true);
    const a = finishFrisbee(st, 'daer', 5, NOW, createRng(1), O);
    expect(a.result).toMatchObject({ catches: 5, rewarded: true, newBest: true, snack: null });
    expect(a.result.gain).toMatchObject({ dogId: 'daer', exp: frisbeeReward(st, 5).exp });
    expect(a.state.frisbee).toEqual({ day: '2026-11-15', best: 5 });
    expect(a.state.dogs.daer).not.toEqual(st.dogs.daer);
    expect(frisbeeReady(a.state, NOW, O)).toBe(false);

    // 同一天再玩：沒有獎勵，只更新最佳紀錄
    const b = finishFrisbee(a.state, 'daer', FRISBEE_COUNT, NOW + 60_000, createRng(1), O);
    expect(b.result).toMatchObject({ rewarded: false, newBest: true, gain: null, snack: null });
    expect(b.state.dogs).toBe(a.state.dogs);
    expect(b.state.snacks).toEqual({});
    expect(b.state.frisbee).toEqual({ day: '2026-11-15', best: FRISBEE_COUNT });
    const c = finishFrisbee(b.state, 'daer', 2, NOW + 120_000, createRng(1), O);
    expect(c.state).toBe(b.state);
    expect(c.result.newBest).toBe(false);

    // 台北隔天 04:59 還是同一天，05:00 才換日
    const at0459 = Date.UTC(2026, 10, 15, 20, 59, 0);
    expect(frisbeeReady(b.state, at0459, O)).toBe(false);
    expect(frisbeeReady(b.state, at0459 + 60_000, O)).toBe(true);
    const d = finishFrisbee(b.state, 'heixuan', FRISBEE_COUNT, NOW + DAY, createRng(1), O);
    expect(d.result).toMatchObject({ rewarded: true, newBest: false });
    expect(d.result.snack).toEqual({ id: 'small', amount: 1 });
    expect(d.state.snacks).toEqual({ small: 1 });
    expect(d.state.frisbee).toEqual({ day: '2026-11-16', best: FRISBEE_COUNT });
  });

  it('經驗夠就升級；沒有的狗不給獎勵、也不算今天玩過', () => {
    const st = fresh();
    const up = finishFrisbee(st, 'daer', FRISBEE_COUNT, NOW, createRng(3), O);
    expect(up.result.gain!.toLevel).toBeGreaterThan(up.result.gain!.fromLevel);
    const no = finishFrisbee(st, 'nuantong', 4, NOW, createRng(3), O);
    expect(no.result.rewarded).toBe(false);
    expect(frisbeeReady(no.state, NOW, O)).toBe(true);
  });

  it('預設上場的是主頁那隻；牠滿級就換一隻還能長大的', () => {
    const st = fresh();
    expect(frisbeeDefaultDog(st)).toBe('daer');
    expect(frisbeeDefaultDog({ ...st, lobbyDogId: 'abai' })).toBe('abai');
    const cap = levelCapOf(st.dogs.daer);
    const maxed = { ...st, dogs: { ...st.dogs, daer: { ...st.dogs.daer, level: cap, exp: 0 } } };
    expect(frisbeeDefaultDog(maxed)).not.toBe('daer');
    expect(maxed.owned).toContain(frisbeeDefaultDog(maxed));
  });

  it('評語', () => {
    expect(frisbeeComment(FRISBEE_COUNT)).toContain('全部接到');
    expect(frisbeeComment(0)).toContain('一個都沒接到');
    expect(frisbeeComment(5)).not.toBe(frisbeeComment(1));
  });
});

describe('接飛盤：存檔', () => {
  it('存檔讀檔後還在；舊存檔沒有這個欄位就補預設值', () => {
    const st = finishFrisbee(fresh(), 'daer', 6, NOW, createRng(1), O).state;
    const back = deserialize(serialize(st, NOW), NOW);
    expect(back.status).toBe('ok');
    expect(back.state.frisbee).toEqual(st.frisbee);

    const file = JSON.parse(serialize(fresh(), NOW));
    delete file.state.frisbee;
    const old = deserialize(JSON.stringify(file), NOW);
    expect(old.status).toBe('ok');
    expect(old.state.frisbee).toEqual({ day: '', best: 0 });
  });

  it('亂掉的內容會修好', () => {
    expect(sanitizeFrisbee(null)).toEqual({ day: '', best: 0 });
    expect(sanitizeFrisbee({ day: 5, best: 'x' })).toEqual({ day: '', best: 0 });
    expect(sanitizeFrisbee({ day: 'tomorrow', best: 99.7 })).toEqual({
      day: '',
      best: FRISBEE_COUNT,
    });
    expect(sanitizeFrisbee({ day: '2026-11-15', best: 3 })).toEqual({ day: '2026-11-15', best: 3 });
  });
});
