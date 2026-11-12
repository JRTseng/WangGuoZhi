import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../state/gameState';
import {
  DAILY_STAGE_RUNS,
  FAST_STAMINA_REGEN_MS,
  RUN_PACK,
  STAMINA_COST,
  STAMINA_MAX,
  STAMINA_PACK,
  STAMINA_REGEN_MS,
  buyRun,
  buyStamina,
  dayKey,
  msUntilNextPoint,
  msUntilStamina,
  nextResetAt,
  regenMsFromSearch,
  runBlock,
  runBuysLeft,
  runsLeft,
  runsTotal,
  settle,
  spendRun,
  staminaAt,
  staminaBuysLeft,
} from './stamina';

const TZ = { tzOffsetMin: -480 }; // 台北時間（UTC+8）
/** 台北時間的某個時刻 */
const tpe = (iso: string) => Date.parse(`${iso}+08:00`);
const T0 = tpe('2026-11-12T12:00:00');
const MIN = 60_000;

const fresh = (now = T0) => createInitialState(now);
const withStamina = (value: number, at = T0): GameState => ({
  ...fresh(at),
  stamina: { value, updatedAt: at },
});

describe('規格數字', () => {
  it('上限 100、一次 20、5 分鐘 1 點、同關每天 3 次', () => {
    expect([STAMINA_MAX, STAMINA_COST, STAMINA_REGEN_MS, DAILY_STAGE_RUNS]).toEqual([
      100,
      20,
      5 * MIN,
      3,
    ]);
    expect(fresh().stamina.value).toBe(100);
  });
  it('測試模式恢復比較快', () => {
    expect(regenMsFromSearch('')).toBe(STAMINA_REGEN_MS);
    expect(regenMsFromSearch('?fast=1')).toBe(FAST_STAMINA_REGEN_MS);
    expect(regenMsFromSearch('?fast=true&battle=slow')).toBe(FAST_STAMINA_REGEN_MS);
    expect(regenMsFromSearch('?fast=0')).toBe(STAMINA_REGEN_MS);
  });
});

describe('體力恢復', () => {
  it('每 5 分鐘 1 點，不足 5 分鐘的零頭留到下次', () => {
    const s = withStamina(40);
    expect(staminaAt(s, T0 + 5 * MIN - 1, TZ)).toBe(40);
    expect(staminaAt(s, T0 + 5 * MIN, TZ)).toBe(41);
    expect(staminaAt(s, T0 + 52 * MIN, TZ)).toBe(50);
    // 分兩次結算和一次結算一樣
    const a = settle(settle(s, T0 + 7 * MIN, TZ), T0 + 10 * MIN, TZ);
    expect(a.stamina).toEqual({ value: 42, updatedAt: T0 + 10 * MIN });
  });

  it('離線很久：最多回到上限', () => {
    const s = settle(withStamina(0), T0 + 30 * 24 * 60 * MIN, TZ);
    expect(s.stamina.value).toBe(100);
  });

  it('滿了就不累積：之後扣掉才從那一刻開始恢復', () => {
    const later = T0 + 60 * MIN;
    const s = spendRun(fresh(), 'luoyepo-1', later, TZ);
    expect(s.stamina).toEqual({ value: 80, updatedAt: later });
    expect(staminaAt(s, later + 4 * MIN, TZ)).toBe(80);
    expect(staminaAt(s, later + 5 * MIN, TZ)).toBe(81);
  });

  it('系統時間被調回過去：不恢復也不倒扣，從現在重新起算', () => {
    const s = settle(withStamina(40), T0 - 60 * MIN, TZ);
    expect(s.stamina).toEqual({ value: 40, updatedAt: T0 - 60 * MIN });
  });

  it('沒有變化時回傳原本的物件；不改動原狀態', () => {
    const s = settle(withStamina(40), T0, TZ);
    expect(settle(s, T0 + MIN, TZ)).toBe(s);
    const snapshot = JSON.stringify(s);
    settle(s, T0 + 60 * MIN, TZ);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('還要等多久', () => {
    const s = withStamina(17);
    expect(msUntilStamina(s, 20, T0, TZ)).toBe(15 * MIN);
    expect(msUntilStamina(s, 20, T0 + 7 * MIN, TZ)).toBe(8 * MIN);
    expect(msUntilStamina(s, 10, T0, TZ)).toBe(0);
    expect(msUntilNextPoint(s, T0 + MIN, TZ)).toBe(4 * MIN);
    expect(msUntilNextPoint(fresh(), T0, TZ)).toBe(0);
    expect(msUntilStamina(s, 20, T0, { ...TZ, regenMs: 1000 })).toBe(3000);
  });
});

describe('每日重置', () => {
  it('以當地 05:00 換日', () => {
    expect(dayKey(tpe('2026-11-12T04:59:59'), TZ)).toBe('2026-11-11');
    expect(dayKey(tpe('2026-11-12T05:00:00'), TZ)).toBe('2026-11-12');
    expect(dayKey(tpe('2026-11-12T23:59:59'), TZ)).toBe('2026-11-12');
    // 同一個時刻在別的時區是不同的遊戲日
    expect(dayKey(tpe('2026-11-12T05:00:00'), { tzOffsetMin: 0 })).toBe('2026-11-11');
  });

  it('下一次重置時間', () => {
    expect(nextResetAt(tpe('2026-11-12T12:00:00'), TZ)).toBe(tpe('2026-11-13T05:00:00'));
    expect(nextResetAt(tpe('2026-11-12T04:00:00'), TZ)).toBe(tpe('2026-11-12T05:00:00'));
    expect(nextResetAt(tpe('2026-11-12T05:00:00'), TZ)).toBe(tpe('2026-11-13T05:00:00'));
  });

  it('換日後次數與購買上限都重來', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) s = spendRun(s, 'luoyepo-1', T0, TZ);
    const b = buyStamina(s, T0, TZ);
    if (!b.ok) throw new Error(b.error);
    s = b.state;
    expect(runsLeft(s, 'luoyepo-1', T0, TZ)).toBe(0);
    expect(staminaBuysLeft(s, T0, TZ)).toBe(2);
    const tomorrow = tpe('2026-11-13T05:00:00');
    expect(runsLeft(s, 'luoyepo-1', tomorrow - 1, TZ)).toBe(0);
    expect(runsLeft(s, 'luoyepo-1', tomorrow, TZ)).toBe(3);
    expect(staminaBuysLeft(s, tomorrow, TZ)).toBe(3);
  });
});

describe('能不能出征', () => {
  it('可以打', () => {
    expect(runBlock(fresh(), 'luoyepo-1', T0, TZ)).toEqual({ ok: true });
  });
  it('體力不足：顯示還要等多久', () => {
    expect(runBlock(withStamina(18), 'luoyepo-1', T0, TZ)).toEqual({
      ok: false,
      reason: 'no-stamina',
      waitMs: 10 * MIN,
    });
  });
  it('次數用完：等到明天 05:00；次數每關分開算', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) s = spendRun(s, 'luoyepo-1', T0, TZ);
    expect(runBlock(s, 'luoyepo-1', T0, TZ)).toEqual({
      ok: false,
      reason: 'no-runs',
      waitMs: 17 * 60 * MIN,
    });
    expect(runBlock(s, 'luoyepo-2', T0, TZ)).toEqual({ ok: true });
  });
});

describe('骨頭幣購買', () => {
  it('買體力：固定價格、可以超過上限、每天有上限', () => {
    let s: GameState = { ...withStamina(90), resources: { food: 0, bones: 1000 } };
    for (let i = 0; i < STAMINA_PACK.dailyLimit; i++) {
      const r = buyStamina(s, T0, TZ);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.stamina.value).toBe(90 + STAMINA_PACK.amount * STAMINA_PACK.dailyLimit);
    expect(s.resources.bones).toBe(1000 - STAMINA_PACK.price * STAMINA_PACK.dailyLimit);
    expect(buyStamina(s, T0, TZ)).toEqual({ ok: false, error: 'daily-limit' });
    // 超過上限的部分留著，但不再恢復
    expect(staminaAt(s, T0 + 60 * MIN, TZ)).toBe(s.stamina.value);
  });

  it('骨頭幣不夠不能買，狀態不變', () => {
    const s: GameState = { ...fresh(), resources: { food: 0, bones: STAMINA_PACK.price - 1 } };
    expect(buyStamina(s, T0, TZ)).toEqual({ ok: false, error: 'not-enough-bones' });
    const poor: GameState = { ...fresh(), resources: { food: 0, bones: RUN_PACK.price - 1 } };
    expect(buyRun(poor, 'luoyepo-1', T0, TZ)).toEqual({ ok: false, error: 'not-enough-bones' });
  });

  it('加購次數：只加在那一關，每天合計有上限', () => {
    let s: GameState = { ...fresh(), resources: { food: 0, bones: 1000 } };
    for (let i = 0; i < 3; i++) s = spendRun(s, 'luoyepo-1', T0, TZ);
    const r = buyRun(s, 'luoyepo-1', T0, TZ);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
    expect(runsLeft(s, 'luoyepo-1', T0, TZ)).toBe(1);
    expect(runsTotal(s, 'luoyepo-1', T0, TZ)).toBe(4);
    expect(runsLeft(s, 'luoyepo-2', T0, TZ)).toBe(3);
    expect(s.resources.bones).toBe(1000 - RUN_PACK.price);
    expect(runBuysLeft(s, T0, TZ)).toBe(RUN_PACK.dailyLimit - 1);
    for (let i = 1; i < RUN_PACK.dailyLimit; i++) {
      const x = buyRun(s, 'luoyepo-2', T0, TZ);
      if (!x.ok) throw new Error(x.error);
      s = x.state;
    }
    expect(buyRun(s, 'luoyepo-1', T0, TZ)).toEqual({ ok: false, error: 'daily-limit' });
  });
});
