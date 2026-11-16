import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { TOWER_GEARS, findGear } from '../data/equipment';
import { findRegionOfStage, findStage } from '../data/regions';
import {
  TOWER_FLOORS,
  isGuardFloor,
  towerFloorOf,
  towerPerDog,
  towerReward,
  towerStage,
  towerStageId,
} from '../data/tower';
import { createInitialState, type GameState } from '../state/gameState';
import { winChance } from './battle';
import { battleDogOf, battleInputOf, battleTeamOf, runExpedition } from './expedition';
import { nextStagePlan } from './nextStage';
import { deserialize, serialize } from './save';
import {
  TOWER_UNLOCK_STAGE,
  daysToReset,
  sanitizeTower,
  sweepPlan,
  towerAt,
  towerCanFight,
  towerNextFloor,
  towerOpen,
  towerSweep,
  towerWin,
  weekKey,
} from './tower';

const DAY = 86_400_000;
const TZ = { tzOffsetMin: -480 }; // 台北時間
/** 2027-01-15（五）台北 16:00 */
const T0 = 1_800_000_000_000;
const TEAM = ['liuxing', 'xiongyue', 'xueling', 'nuantong', 'songling'];

/** 塔已經開放、五隻很強的狗 */
function strong(): GameState {
  const s = createInitialState(T0);
  const dogs = { ...s.dogs };
  for (const id of TEAM) {
    dogs[id] = {
      level: 100,
      exp: 0,
      growthAttack: 1500,
      growthDefense: 1500,
      bonusAttack: 0,
      bonusDefense: 0,
      rolls: 0,
      star: 5,
    };
  }
  return { ...s, owned: [...s.owned, ...TEAM], dogs, cleared: [TOWER_UNLOCK_STAGE] };
}

describe('塔的資料', () => {
  it('100 層，每層一位頭目加小弟，越上面越強、獎勵越多', () => {
    for (let f = 1; f <= TOWER_FLOORS; f++) {
      const s = towerStage(f)!;
      expect(findStage(towerStageId(f))).toBe(s);
      expect(s.enemies.filter((e) => e.role === '頭目')).toHaveLength(1);
      expect(s.enemies.length).toBeGreaterThanOrEqual(3);
      expect(s.boss?.breed).toBeTruthy();
      expect(findRegionOfStage(s.id)).toBeTruthy();
      if (f > 1) {
        expect(towerPerDog(f)).toBeGreaterThan(towerPerDog(f - 1));
        if (!isGuardFloor(f - 1)) {
          expect(towerReward(f).food).toBeGreaterThan(towerReward(f - 1).food);
        }
      }
    }
    expect(towerStage(0)).toBeUndefined();
    expect(towerStage(101)).toBeUndefined();
    expect(towerFloorOf('tower-37')).toBe(37);
    expect(towerFloorOf('tower-101')).toBe(0);
    expect(towerFloorOf('luoyepo-1')).toBe(0);
    expect(towerStage(10)!.boss!.name).toBe('塔主雷吼');
    expect(towerReward(10).food).toBe(towerReward(9).food * 3 + 60);
  });

  it('每一層都有解：戰力照建議值的隊伍勝率不會太低', () => {
    for (const f of [1, 10, 25, 50, 75, 100]) {
      const stage = towerStage(f)!;
      const per = Math.round(towerPerDog(f) / 2);
      const s = createInitialState(T0);
      const ids = TEAM.slice(0, stage.teamMax);
      const dogs = { ...s.dogs };
      for (const id of ids) {
        const d = DOGS.find((x) => x.id === id)!;
        dogs[id] = {
          level: 1,
          exp: 0,
          growthAttack: Math.max(0, per - d.baseAttack),
          growthDefense: Math.max(0, per - d.baseDefense),
          bonusAttack: 0,
          bonusDefense: 0,
          rolls: 0,
        };
      }
      const team = battleTeamOf({ dogs, formation: {} }, ids);
      const chance = winChance(battleInputOf({ stageId: stage.id, team, seed: 0 }));
      expect(chance, `第 ${f} 層`).toBeGreaterThan(0.3);
    }
  });

  it('爬塔限定裝備：五件、五個部位各一件、都有特殊功能，穿上就進戰鬥', () => {
    expect(TOWER_GEARS.map((g) => g.tower)).toEqual([20, 40, 60, 80, 100]);
    expect(new Set(TOWER_GEARS.map((g) => g.slot)).size).toBe(5);
    for (const g of TOWER_GEARS) {
      expect(g.perks).toBeTruthy();
      expect(findGear(g.id)).toBe(g);
      expect(g.attack + g.defense).toBe(12);
    }
    const s = strong();
    const worn = { ...s, equipped: { liuxing: { head: 'tw-20' } } };
    const before = battleDogOf(s, 'liuxing')!.perks?.startEn ?? 0;
    expect(battleDogOf(worn, 'liuxing')!.perks!.startEn).toBe(before + 30);
  });
});

describe('每週重置', () => {
  it('一週從星期一 05:00 開始', () => {
    expect(weekKey(T0, TZ)).toBe('2027-01-11');
    expect(daysToReset(T0, TZ)).toBe(3);
    // 星期一 04:59 還是上一週，05:00 換週
    const monday5 = Date.UTC(2027, 0, 17, 21, 0);
    expect(weekKey(monday5 - 60_000, TZ)).toBe('2027-01-11');
    expect(weekKey(monday5, TZ)).toBe('2027-01-18');
    expect(daysToReset(monday5, TZ)).toBe(7);
  });

  it('換週從第 1 層重來，上週的層數留著給一鍵通關；時間調回去不重置', () => {
    const s = { tower: { week: '2027-01-11', floor: 23, last: 5, best: 30, gear: [20] } };
    expect(towerAt(s, T0, TZ)).toBe(s.tower);
    expect(towerAt(s, T0 + 7 * DAY, TZ)).toEqual({
      week: '2027-01-18',
      floor: 0,
      last: 23,
      best: 30,
      gear: [20],
    });
    expect(towerAt(s, T0 - 30 * DAY, TZ)).toBe(s.tower);
    // 上週一層都沒爬：留著更早那次
    const idle = { tower: { ...s.tower, floor: 0 } };
    expect(towerAt(idle, T0 + 7 * DAY, TZ).last).toBe(5);
  });

  it('一鍵通關到上週的進度，一次領完那些層的獎勵', () => {
    const s = {
      ...strong(),
      tower: { week: '2027-01-04', floor: 12, last: 0, best: 12, gear: [] },
    };
    const plan = sweepPlan(s, T0, TZ)!;
    expect(plan).toMatchObject({ from: 1, to: 12 });
    let food = 0;
    for (let f = 1; f <= 12; f++) food += towerReward(f).food;
    expect(plan.reward.food).toBe(food);
    const r = towerSweep(s, T0, TZ);
    expect(r.state.tower).toMatchObject({ week: '2027-01-11', floor: 12, last: 12 });
    expect(r.state.resources.food).toBe(s.resources.food + food);
    expect(towerNextFloor(r.state, T0, TZ)).toBe(13);
    // 掃過了就沒有了
    expect(sweepPlan(r.state, T0, TZ)).toBeNull();
    expect(towerSweep(r.state, T0, TZ).state).toBe(r.state);
  });
});

describe('打塔', () => {
  it('打過第 3 章頭目才開放；只能打下一層', () => {
    const s = strong();
    expect(towerOpen(createInitialState(T0))).toBe(false);
    expect(towerOpen(s)).toBe(true);
    expect(towerCanFight(s, 'tower-1', T0, TZ)).toBe(true);
    expect(towerCanFight(s, 'tower-2', T0, TZ)).toBe(false);
    expect(runExpedition(createInitialState(T0), 'tower-1', ['daer'], T0, TZ)).toEqual({
      ok: false,
      error: 'stage-locked',
    });
    expect(runExpedition(s, 'tower-2', TEAM, T0, TZ)).toEqual({ ok: false, error: 'stage-locked' });
  });

  it('打贏：往上一層、拿獎勵、不花體力、不記進主線的通過關卡', () => {
    const s = strong();
    const r = runExpedition(s, 'tower-1', TEAM.slice(0, 4), T0, { ...TZ, enforce: true });
    if (!r.ok) throw new Error(r.error);
    expect(r.record.win).toBe(true);
    expect(r.state.tower.floor).toBe(1);
    expect(r.state.tower.best).toBe(1);
    expect(r.state.cleared).toEqual(s.cleared);
    expect(r.state.stamina.value).toBe(s.stamina.value);
    expect(r.state.resources.food).toBeGreaterThanOrEqual(s.resources.food + towerReward(1).food);
    // 同一層不能再打，下一層可以，「下一關」會帶去第 2 層
    expect(towerCanFight(r.state, 'tower-1', T0, TZ)).toBe(false);
    const plan = nextStagePlan(r.state, 'tower-1', TEAM.slice(0, 4), T0, TZ)!;
    expect(plan.stage.id).toBe('tower-2');
    expect(plan.chapter).toBe(-1);
  });

  it('打輸：沒有獎勵、沒有經驗、層數不動', () => {
    const s = {
      ...strong(),
      tower: { week: '2027-01-11', floor: 99, last: 0, best: 99, gear: [] },
    };
    const weak = { ...s, owned: [...s.owned], team: ['daer'] };
    const r = runExpedition(weak, 'tower-100', ['daer'], T0, TZ);
    if (!r.ok) throw new Error(r.error);
    expect(r.record.win).toBe(false);
    expect(r.record.reward).toEqual({ food: 0, bones: 0 });
    expect(r.record.gains.every((g) => g.exp === 0)).toBe(true);
    expect(r.state.tower.floor).toBe(99);
  });

  it('限定裝備只送一次：下週再過同一層不會再送', () => {
    const s = {
      ...strong(),
      tower: { week: '2027-01-11', floor: 19, last: 0, best: 19, gear: [] },
    };
    const a = towerWin(s, 20, T0, TZ);
    expect(a.gearId).toBe('tw-20');
    expect(a.state.gear['tw-20']).toBe(1);
    expect(a.state.tower.gear).toEqual([20]);
    const nextWeek = { ...a.state, tower: { ...towerAt(a.state, T0 + 7 * DAY, TZ), floor: 19 } };
    const b = towerWin(nextWeek, 20, T0 + 7 * DAY, TZ);
    expect(b.gearId).toBeUndefined();
    expect(b.state.gear['tw-20']).toBe(1);
  });
});

describe('存檔', () => {
  it('塔的進度存得回來；壞掉的欄位回到預設', () => {
    const s = {
      ...strong(),
      tower: { week: '2027-01-11', floor: 7, last: 3, best: 9, gear: [20] },
    };
    expect(deserialize(serialize(s, T0), T0).state.tower).toEqual(s.tower);
    expect(sanitizeTower(undefined)).toEqual({ week: '', floor: 0, last: 0, best: 0, gear: [] });
    expect(
      sanitizeTower({ week: 'x', floor: 999, last: -3, best: 'a', gear: [20, 20, 7, 'x'] }),
    ).toEqual({ week: '', floor: 100, last: 0, best: 100, gear: [20] });
    // 舊存檔沒有這個欄位
    const old = JSON.parse(serialize(s, T0));
    delete old.state.tower;
    expect(deserialize(JSON.stringify(old), T0).state.tower.floor).toBe(0);
  });
});
