import { describe, expect, it } from 'vitest';
import { findDog } from '../data/dogs';
import { createInitialState, type GameState } from '../state/gameState';
import { addExp, dogStats } from './leveling';
import {
  DRILL_COST_STEP,
  DRILL_MAX,
  checkDrill,
  drill,
  drillCost,
  drillTotalCost,
  type DrillStat,
} from './training';

const withFood = (food: number): GameState => {
  const s = createInitialState();
  return { ...s, resources: { ...s.resources, food } };
};

const drillTimes = (s: GameState, id: string, stat: DrillStat, n: number): GameState => {
  for (let i = 0; i < n; i++) s = drill(s, id, stat).state;
  return s;
};

describe('drillCost', () => {
  it('第 n 次花 10 × n 糧草，練滿後是 0', () => {
    expect(DRILL_COST_STEP).toBe(10);
    for (let done = 0; done < DRILL_MAX; done++) expect(drillCost(done)).toBe(10 * (done + 1));
    expect(drillCost(DRILL_MAX)).toBe(0);
    expect(drillCost(DRILL_MAX + 3)).toBe(0);
  });

  it('一項屬性練滿共 550', () => {
    expect(drillTotalCost()).toBe(550);
  });
});

describe('drill', () => {
  it('特訓一次：屬性 +1、扣糧草、次數 +1，戰力跟著變', () => {
    const s0 = withFood(100);
    const dog = findDog('abai')!;
    const before = dogStats(s0, dog);
    const { state: s1, check } = drill(s0, 'abai', 'attack');
    expect(check).toMatchObject({ ok: true, count: 0, cost: 10 });
    const after = dogStats(s1, dog);
    expect(after.attack).toBe(before.attack + 1);
    expect(after.defense).toBe(before.defense);
    expect(after.power).toBe(before.power + 1);
    expect(after.drillAttack).toBe(1);
    expect(after.drillDefense).toBe(0);
    expect(s1.resources.food).toBe(90);
    expect(s1.resources.bones).toBe(s0.resources.bones);
    // 不給經驗、不加等級
    expect(after.level).toBe(before.level);
    expect(after.exp).toBe(before.exp);
    // 原本的狀態沒被改到
    expect(s0.resources.food).toBe(100);
    expect(dogStats(s0, dog).attack).toBe(before.attack);
  });

  it('攻擊與防禦的次數、花費分開算', () => {
    let s = withFood(1000);
    s = drillTimes(s, 'abai', 'attack', 3);
    expect(s.resources.food).toBe(1000 - 10 - 20 - 30);
    expect(checkDrill(s, 'abai', 'attack')).toMatchObject({ count: 3, cost: 40 });
    expect(checkDrill(s, 'abai', 'defense')).toMatchObject({ count: 0, cost: 10 });
    s = drill(s, 'abai', 'defense').state;
    const st = dogStats(s, findDog('abai')!);
    expect([st.drillAttack, st.drillDefense]).toEqual([3, 1]);
    // 別隻狗不受影響
    expect(checkDrill(s, 'daer', 'attack')).toMatchObject({ count: 0, cost: 10 });
  });

  it('最多 10 次，滿了就不能再練、不扣糧草', () => {
    const s0 = withFood(5000);
    const base = dogStats(s0, findDog('daer')!);
    const s = drillTimes(s0, 'daer', 'defense', DRILL_MAX);
    expect(s.resources.food).toBe(5000 - 550);
    expect(dogStats(s, findDog('daer')!).defense).toBe(base.defense + 10);
    const again = drill(s, 'daer', 'defense');
    expect(again.check).toMatchObject({ ok: false, reason: 'maxed', count: 10, cost: 0 });
    expect(again.state).toBe(s);
  });

  it('糧草不夠不能練，狀態不變，並算出還差多少', () => {
    const s = drillTimes(withFood(35), 'abai', 'attack', 2);
    expect(s.resources.food).toBe(5);
    const r = drill(s, 'abai', 'attack');
    expect(r.check).toMatchObject({ ok: false, reason: 'food', cost: 30, short: 25 });
    expect(r.state).toBe(s);
  });

  it('糧草剛好夠可以練', () => {
    const r = drill(withFood(10), 'abai', 'attack');
    expect(r.check.ok).toBe(true);
    expect(r.state.resources.food).toBe(0);
  });

  it('沒擁有或不存在的狗不能練', () => {
    const s = withFood(1000);
    const notOwned = { ...s, owned: s.owned.filter((id) => id !== 'abai') };
    expect(drill(notOwned, 'abai', 'attack').check).toMatchObject({
      ok: false,
      reason: 'not-owned',
    });
    expect(drill(s, 'nobody', 'attack').check).toMatchObject({ ok: false, reason: 'unknown-dog' });
    expect(drill(s, 'nobody', 'attack').state).toBe(s);
  });

  it('沒有特訓欄位的舊資料當成 0 次', () => {
    const s = withFood(100);
    expect(s.dogs.abai.drillAttack).toBeUndefined();
    expect(checkDrill(s, 'abai', 'attack')).toMatchObject({ ok: true, count: 0, cost: 10 });
    expect(dogStats(s, findDog('abai')!)).toMatchObject({ drillAttack: 0, drillDefense: 0 });
  });

  it('特訓後升級，特訓加成還在', () => {
    const dog = findDog('abai')!;
    let s = drillTimes(withFood(1000), 'abai', 'attack', 2);
    const before = dogStats(s, dog);
    const r = addExp(s.dogs.abai, dog.role, 1000, () => 0.5);
    s = { ...s, dogs: { ...s.dogs, abai: r.progress } };
    const after = dogStats(s, dog);
    expect(after.level).toBeGreaterThan(before.level);
    expect(after.drillAttack).toBe(2);
    expect(after.attack).toBe(dog.baseAttack + after.growthAttack + 2);
  });

  it('存成 JSON 再讀回來，特訓次數與屬性都一樣', () => {
    const s = drillTimes(withFood(1000), 'abai', 'defense', 4);
    const back = JSON.parse(JSON.stringify(s)) as GameState;
    expect(dogStats(back, findDog('abai')!)).toEqual(dogStats(s, findDog('abai')!));
  });
});
