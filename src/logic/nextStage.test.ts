import { afterEach, describe, expect, it } from 'vitest';
import { REGIONS } from '../data/regions';
import { createInitialState, type GameState } from '../state/gameState';
import { beginExpedition, runExpedition, stageTeamMax } from './expedition';
import { nextStageOf, nextStagePlan } from './nextStage';
import { STAMINA_COST, STAMINA_MAX, limits, limitsFromSearch, runBlock, runsLeft } from './stamina';
import { dogPower } from './team';

const T0 = 1_800_000_000_000;
const TZ = { tzOffsetMin: -480 };
const ALL = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
const fresh = (): GameState => createInitialState(T0);
const cleared = (...ids: string[]): GameState => ({ ...fresh(), cleared: ids });

afterEach(() => {
  limits.stamina = true;
  limits.dailyRuns = true;
});

describe('nextStageOf', () => {
  it('同一章往下一關，章末接下一章第一關，最後一關沒有下一關', () => {
    expect(nextStageOf('luoyepo-1')?.stage.id).toBe('luoyepo-2');
    const boss = REGIONS[0].stages[REGIONS[0].stages.length - 1];
    expect(nextStageOf(boss.id)).toMatchObject({ stage: REGIONS[1].stages[0], chapter: 1 });
    const last = REGIONS[REGIONS.length - 1].stages;
    expect(nextStageOf(last[last.length - 1].id)).toBeUndefined();
    expect(nextStageOf('沒有這一關')).toBeUndefined();
  });
});

describe('nextStagePlan', () => {
  it('這一關還沒通過（打輸）就沒有下一關可按', () => {
    expect(nextStagePlan(fresh(), 'luoyepo-1', ALL, T0, TZ)).toBeNull();
  });

  it('下一關能上陣的比較少：留戰力最高的幾隻，順序不變', () => {
    const s = cleared('luoyepo-1');
    const max = stageTeamMax('luoyepo-2');
    expect(max).toBeLessThan(ALL.length);
    const plan = nextStagePlan(s, 'luoyepo-1', ALL, T0, TZ)!;
    expect(plan.stage.id).toBe('luoyepo-2');
    expect(plan.chapter).toBe(0);
    expect(plan.team).toHaveLength(max);
    expect(plan.benched).toBe(ALL.length - max);
    const weakestKept = Math.min(...plan.team.map((id) => dogPower(s, id)));
    for (const id of ALL.filter((x) => !plan.team.includes(x))) {
      expect(dogPower(s, id)).toBeLessThanOrEqual(weakestKept);
    }
    expect(plan.team).toEqual(ALL.filter((id) => plan.team.includes(id)));
    // 照這個計畫真的開得了戰
    expect(beginExpedition(s, plan.stage.id, plan.team, T0, TZ).ok).toBe(true);
  });

  it('隊伍比下一關的上限少：原班人馬去，不自動補狗', () => {
    const plan = nextStagePlan(cleared('luoyepo-1'), 'luoyepo-1', ['daer'], T0, TZ)!;
    expect(plan.team).toEqual(['daer']);
    expect(plan.benched).toBe(0);
  });

  it('限制有開的時候，體力不夠就沒有下一關可按', () => {
    const s = { ...cleared('luoyepo-1'), stamina: { value: STAMINA_COST - 1, updatedAt: T0 } };
    expect(nextStagePlan(s, 'luoyepo-1', ALL, T0, TZ)).toBeNull();
    limits.stamina = false;
    expect(nextStagePlan(s, 'luoyepo-1', ALL, T0, TZ)).not.toBeNull();
  });
});

describe('體力與每日次數先放開（limits 關掉）', () => {
  it('預設兩個都關；網址加 ?limits=1 打開', () => {
    expect(limitsFromSearch('')).toEqual({ stamina: false, dailyRuns: false });
    expect(limitsFromSearch('?fast=1&limits=1')).toEqual({ stamina: true, dailyRuns: true });
  });

  it('手動出征不扣體力、不算次數，同一關可以一直打', () => {
    limits.stamina = false;
    limits.dailyRuns = false;
    let s = fresh();
    for (let i = 0; i < 8; i++) {
      const r = runExpedition(s, 'luoyepo-1', ALL, T0, { ...TZ, seed: i });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.stamina.value).toBe(STAMINA_MAX);
    expect(s.daily.runs).toEqual({});
    expect(runsLeft(s, 'luoyepo-1', T0, TZ)).toBe(Infinity);
    expect(runBlock({ ...s, stamina: { value: 0, updatedAt: T0 } }, 'luoyepo-1', T0, TZ).ok).toBe(
      true,
    );
  });

  it('自動出征（enforce）照舊扣體力、算次數', () => {
    limits.stamina = false;
    limits.dailyRuns = false;
    const o = { ...TZ, enforce: true };
    const r = runExpedition(fresh(), 'luoyepo-1', ALL, T0, o);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.stamina.value).toBe(STAMINA_MAX - STAMINA_COST);
    expect(runsLeft(r.state, 'luoyepo-1', T0, o)).toBe(2);
    expect(
      runBlock({ ...r.state, stamina: { value: 0, updatedAt: T0 } }, 'luoyepo-1', T0, o),
    ).toMatchObject({
      ok: false,
      reason: 'no-stamina',
    });
  });

  it('只關體力、次數照算（兩個開關各管各的）', () => {
    limits.stamina = false;
    const r = runExpedition(fresh(), 'luoyepo-1', ALL, T0, TZ);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.stamina.value).toBe(STAMINA_MAX);
    expect(runsLeft(r.state, 'luoyepo-1', T0, TZ)).toBe(2);
  });
});
