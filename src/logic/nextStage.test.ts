import { afterEach, describe, expect, it } from 'vitest';
import { REGIONS } from '../data/regions';
import { createInitialState, type GameState } from '../state/gameState';
import { beginExpedition, runExpedition, stageTeamMax } from './expedition';
import { autoNextSeconds, nextHint, nextStageOf, nextStagePlan } from './nextStage';
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

  it('下一關能上陣的比較多：自動補滿，先補編隊裡的隊員', () => {
    const s = cleared('luoyepo-1');
    const max = stageTeamMax('luoyepo-2');
    expect(s.team).toEqual(['daer', 'heixuan', 'changxu']);
    const plan = nextStagePlan(s, 'luoyepo-1', ['daer'], T0, TZ)!;
    expect(plan.team).toEqual(['daer', 'heixuan', 'changxu'].slice(0, max));
    expect(plan.benched).toBe(0);
    expect(plan.added).toBe(max - 1);
    expect(beginExpedition(s, plan.stage.id, plan.team, T0, TZ).ok).toBe(true);
  });

  it('編隊的人不夠補：再補其他戰力高的狗；寄宿中的不補', () => {
    // 打完只能上 3 隻的第 2 關，接著第 3 關可以上比較多
    const max = stageTeamMax('luoyepo-3');
    expect(max).toBeGreaterThan(3);
    const base = cleared('luoyepo-1', 'luoyepo-2');
    const s = { ...base, team: ['daer'] };
    const plan = nextStagePlan(s, 'luoyepo-2', ['daer'], T0, TZ)!;
    expect(plan.team).toHaveLength(Math.min(max, ALL.length));
    expect(plan.team[0]).toBe('daer');
    const rest = ALL.filter((id) => id !== 'daer').sort((a, b) => dogPower(s, b) - dogPower(s, a));
    expect(plan.team.slice(1)).toEqual(rest.slice(0, plan.team.length - 1));

    const busy = rest[0];
    const boarded = {
      ...s,
      boarding: [{ dogId: busy, since: T0, at: T0, carry: 0, exp: 0, levels: 0 }],
    };
    expect(nextStagePlan(boarded, 'luoyepo-2', ['daer'], T0, TZ)!.team).not.toContain(busy);
  });

  it('人數剛好：原班人馬去，不多補', () => {
    const s = cleared('luoyepo-1');
    const max = stageTeamMax('luoyepo-2');
    const team = ALL.slice(0, max);
    const plan = nextStagePlan(s, 'luoyepo-1', team, T0, TZ)!;
    expect(plan.team).toEqual(team);
    expect(plan).toMatchObject({ benched: 0, added: 0 });
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

describe('自動下一關的倒數', () => {
  it('剩下的秒數無條件進位，時間到是 0', () => {
    expect(autoNextSeconds(3000, 0)).toBe(3);
    expect(autoNextSeconds(3000, 1)).toBe(3);
    expect(autoNextSeconds(3000, 1000)).toBe(2);
    expect(autoNextSeconds(3000, 2999)).toBe(1);
    expect(autoNextSeconds(3000, 3000)).toBe(0);
    expect(autoNextSeconds(3000, 9999)).toBe(0);
  });

  it('提示文字帶秒數', () => {
    expect(nextHint()).toBe('點其他地方回地圖');
    expect(nextHint(3)).toContain('3 秒後自動打下一關');
  });
});
