import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../state/gameState';
import {
  busyDogIds,
  collectExpedition,
  idleDogIds,
  isComplete,
  progress,
  remainingMs,
  startExpedition,
} from './expedition';
import { FAST_MINUTE_MS, MINUTE_MS } from './timeScale';

const T0 = 1_800_000_000_000; // 固定的「現在」
const TEAM = ['daer', 'heixuan', 'changxu'];

function started(state: GameState = createInitialState(), now = T0): GameState {
  const r = startExpedition(state, 'luoyepo-1', TEAM, now);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('startExpedition', () => {
  it('建立出征：記錄開始、結束時間、隊伍、關卡', () => {
    const s = started();
    expect(s.expeditions).toHaveLength(1);
    const e = s.expeditions[0];
    expect(e).toMatchObject({ stageId: 'luoyepo-1', dogIds: TEAM, startedAt: T0 });
    expect(e.endsAt).toBe(T0 + 5 * MINUTE_MS);
    expect(s.nextExpeditionNo).toBe(2);
  });

  it('不改動原本的狀態', () => {
    const before = createInitialState();
    const snapshot = JSON.stringify(before);
    started(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('測試模式：分鐘換成秒', () => {
    const r = startExpedition(createInitialState(), 'luoyepo-3', TEAM, T0, FAST_MINUTE_MS);
    expect(r.ok && r.state.expeditions[0].endsAt).toBe(T0 + 20 * 1000);
  });

  it('已出征的狗不可再被選', () => {
    const s = started();
    expect([...busyDogIds(s)].sort()).toEqual([...TEAM].sort());
    expect(idleDogIds(s)).toEqual(['xiaosuan', 'abai']);
    const r = startExpedition(s, 'luoyepo-2', ['daer', 'xiaosuan', 'abai'], T0);
    expect(r).toEqual({ ok: false, error: 'dog-busy' });
  });

  it('隊伍必須剛好 3 隻且不重複、存在', () => {
    const s = createInitialState();
    expect(startExpedition(s, 'luoyepo-1', ['daer', 'abai'], T0)).toEqual({
      ok: false,
      error: 'wrong-team-size',
    });
    expect(startExpedition(s, 'luoyepo-1', ['daer', 'daer', 'abai'], T0)).toEqual({
      ok: false,
      error: 'duplicate-dog',
    });
    expect(startExpedition(s, 'luoyepo-1', ['daer', 'ghost', 'abai'], T0)).toEqual({
      ok: false,
      error: 'dog-not-found',
    });
    expect(startExpedition(s, 'nope', TEAM, T0)).toEqual({
      ok: false,
      error: 'stage-not-found',
    });
  });
});

describe('計時', () => {
  const exp = started().expeditions[0];
  const total = 5 * MINUTE_MS;

  it('剛開始：剩餘 = 總耗時，未完成', () => {
    expect(remainingMs(exp, T0)).toBe(total);
    expect(isComplete(exp, T0)).toBe(false);
    expect(progress(exp, T0)).toBe(0);
  });

  it('過一半', () => {
    expect(remainingMs(exp, T0 + total / 2)).toBe(total / 2);
    expect(progress(exp, T0 + total / 2)).toBeCloseTo(0.5);
  });

  it('時間剛好到：完成', () => {
    expect(remainingMs(exp, T0 + total - 1)).toBe(1);
    expect(isComplete(exp, T0 + total - 1)).toBe(false);
    expect(remainingMs(exp, T0 + total)).toBe(0);
    expect(isComplete(exp, T0 + total)).toBe(true);
  });

  it('離線很久再回來：以時間戳計算，直接完成', () => {
    const later = T0 + 8 * 3_600_000;
    expect(remainingMs(exp, later)).toBe(0);
    expect(isComplete(exp, later)).toBe(true);
    expect(progress(exp, later)).toBe(1);
  });

  it('系統時間被調快：立即可收成，但只能收成一次', () => {
    const jumped = T0 + 365 * 24 * 3_600_000;
    expect(isComplete(exp, jumped)).toBe(true);
    const s = started();
    const r1 = collectExpedition(s, exp.id, jumped);
    expect(r1.ok).toBe(true);
    const r2 = collectExpedition(r1.ok ? r1.state : s, exp.id, jumped);
    expect(r2).toEqual({ ok: false, error: 'expedition-not-found' });
  });

  it('系統時間被調慢到開始之前：剩餘不會超過總耗時', () => {
    const before = T0 - 3_600_000;
    expect(remainingMs(exp, before)).toBe(total);
    expect(isComplete(exp, before)).toBe(false);
    expect(progress(exp, before)).toBe(0);
  });
});

describe('collectExpedition', () => {
  it('時間未到不能收成，狀態不變', () => {
    const s = started();
    const r = collectExpedition(s, 'exp-1', T0 + 1000);
    expect(r).toEqual({ ok: false, error: 'not-ready' });
  });

  it('收成：加資源、釋放狗狗、記一筆歷史', () => {
    const s = started();
    const now = T0 + 5 * MINUTE_MS + 30_000;
    const r = collectExpedition(s, 'exp-1', now);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.resources).toEqual({ food: 1200 + 120, bones: 50 + 5 });
    expect(r.state.expeditions).toHaveLength(0);
    expect(idleDogIds(r.state)).toHaveLength(5);
    expect(r.state.history).toEqual([
      {
        id: 'exp-1',
        stageId: 'luoyepo-1',
        dogIds: TEAM,
        startedAt: T0,
        endsAt: T0 + 5 * MINUTE_MS,
        collectedAt: now,
        reward: { food: 120, bones: 5 },
      },
    ]);
  });

  it('收成後狗狗可以再出征', () => {
    const s = started();
    const r = collectExpedition(s, 'exp-1', T0 + 5 * MINUTE_MS);
    if (!r.ok) throw new Error(r.error);
    const again = startExpedition(r.state, 'luoyepo-2', TEAM, T0 + 5 * MINUTE_MS);
    expect(again.ok && again.state.expeditions[0].id).toBe('exp-2');
  });

  it('狀態可 JSON 序列化後還原（給 T006 存檔）', () => {
    const s = started();
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    expect(restored).toEqual(s);
    expect(collectExpedition(restored, 'exp-1', T0 + 5 * MINUTE_MS).ok).toBe(true);
  });
});
