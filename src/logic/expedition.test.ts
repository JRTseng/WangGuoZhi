import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../state/gameState';
import {
  busyDogIds,
  collectExpedition,
  expeditionBattle,
  expeditionReward,
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

  it('戰鬥種子在出發時就定下來：可指定，沒指定就由時間與編號算出', () => {
    const s = createInitialState();
    const a = startExpedition(s, 'luoyepo-1', TEAM, T0, MINUTE_MS, 777);
    expect(a.ok && a.state.expeditions[0].seed).toBe(777);
    const b = started(s);
    const c = started(s);
    expect(b.expeditions[0].seed).toBe(c.expeditions[0].seed);
    expect(started(s, T0 + 1).expeditions[0].seed).not.toBe(b.expeditions[0].seed);
  });

  it('不改動原本的狀態', () => {
    const before = createInitialState();
    const snapshot = JSON.stringify(before);
    started(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('測試模式：分鐘換成秒', () => {
    const s = { ...createInitialState(), cleared: ['luoyepo-1', 'luoyepo-2'] };
    const r = startExpedition(s, 'luoyepo-3', TEAM, T0, FAST_MINUTE_MS);
    expect(r.ok && r.state.expeditions[0].endsAt).toBe(T0 + 20 * 1000);
  });

  it('已出征的狗不可再被選', () => {
    const s = started();
    expect([...busyDogIds(s)].sort()).toEqual([...TEAM].sort());
    expect(idleDogIds(s)).toEqual(['xiaosuan', 'abai']);
    const r = startExpedition(s, 'luoyepo-1', ['daer', 'xiaosuan', 'abai'], T0);
    expect(r).toEqual({ ok: false, error: 'dog-busy' });
  });

  it('隊伍可帶 1 到 5 隻，0 隻或超過 5 隻不行；不重複、要存在', () => {
    const s = createInitialState();
    const all = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
    for (let n = 1; n <= 5; n++) {
      const r = startExpedition(s, 'luoyepo-1', all.slice(0, n), T0);
      expect(r.ok && r.state.expeditions[0].dogIds).toEqual(all.slice(0, n));
    }
    expect(startExpedition(s, 'luoyepo-1', [], T0)).toEqual({
      ok: false,
      error: 'wrong-team-size',
    });
    const six = { ...s, owned: [...s.owned, 'tieya'] };
    expect(startExpedition(six, 'luoyepo-1', [...all, 'tieya'], T0)).toEqual({
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

  it('沒擁有的狗不能出征，未解鎖的關卡不能去', () => {
    const s = createInitialState();
    expect(startExpedition(s, 'luoyepo-1', ['daer', 'tieya', 'abai'], T0)).toEqual({
      ok: false,
      error: 'dog-not-owned',
    });
    expect(startExpedition(s, 'luoyepo-2', TEAM, T0)).toEqual({
      ok: false,
      error: 'stage-locked',
    });
    expect(idleDogIds(s)).toEqual(['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai']);
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

  it('收成：加資源、釋放狗狗、記一筆歷史、記為通過', () => {
    const s = started();
    const now = T0 + 5 * MINUTE_MS + 30_000;
    const r = collectExpedition(s, 'exp-1', now);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.resources).toEqual({ food: 1200 + 120, bones: 50 + 5 });
    expect(r.state.expeditions).toHaveLength(0);
    expect(idleDogIds(r.state)).toHaveLength(5);
    expect(r.state.cleared).toEqual(['luoyepo-1']);
    expect(r.state.history).toEqual([
      {
        id: 'exp-1',
        stageId: 'luoyepo-1',
        dogIds: TEAM,
        startedAt: T0,
        endsAt: T0 + 5 * MINUTE_MS,
        collectedAt: now,
        reward: { food: 120, bones: 5 },
        win: true,
        seed: s.expeditions[0].seed,
      },
    ]);
  });

  it('收成後狗狗可以再出征，下一關也開放了', () => {
    const s = started();
    const r = collectExpedition(s, 'exp-1', T0 + 5 * MINUTE_MS);
    if (!r.ok) throw new Error(r.error);
    const again = startExpedition(r.state, 'luoyepo-2', TEAM, T0 + 5 * MINUTE_MS);
    expect(again.ok && again.state.expeditions[0].id).toBe('exp-2');
  });

  it('打輸：只拿 30% 獎勵、不算通過、狗狗一樣回家、歷史記敗', () => {
    // 阿白一隻（戰力 70）打建議戰力 150 的關卡，一定輸
    const r0 = startExpedition(createInitialState(), 'luoyepo-1', ['abai'], T0);
    if (!r0.ok) throw new Error(r0.error);
    expect(expeditionBattle(r0.state.expeditions[0]).win).toBe(false);
    const r = collectExpedition(r0.state, 'exp-1', T0 + 5 * MINUTE_MS);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.resources).toEqual({ food: 1200 + 36, bones: 50 + 1 });
    expect(r.state.cleared).toEqual([]);
    expect(idleDogIds(r.state)).toHaveLength(5);
    expect(r.state.history[0]).toMatchObject({ win: false, reward: { food: 36, bones: 1 } });
    // 沒通過，下一關還是鎖著
    expect(startExpedition(r.state, 'luoyepo-2', TEAM, T0)).toEqual({
      ok: false,
      error: 'stage-locked',
    });
  });

  it('結果不可重抽：同一筆出征不管算幾次、存檔還原後再算，勝負與紀錄都一樣', () => {
    // 兩邊實力接近（勝負要看運氣）的關卡，換很多種子都要穩定
    const base = { ...createInitialState(), cleared: ['luoyepo-1', 'luoyepo-2'] };
    const outcomes = new Set<boolean>();
    for (let seed = 1; seed <= 40; seed++) {
      const r = startExpedition(base, 'luoyepo-3', TEAM, T0, MINUTE_MS, seed);
      if (!r.ok) throw new Error(r.error);
      const exp = r.state.expeditions[0];
      const battle = expeditionBattle(exp);
      expect(expeditionBattle(exp)).toEqual(battle);
      const restored = JSON.parse(JSON.stringify(r.state)) as GameState;
      const done = collectExpedition(restored, exp.id, exp.endsAt);
      if (!done.ok) throw new Error(done.error);
      const rec = done.state.history[0];
      expect(rec.win).toBe(battle.win);
      expect(rec.reward).toEqual(expeditionReward(exp, battle.win));
      // 收成後用歷史紀錄也能重播出同一場
      expect(expeditionBattle(rec)).toEqual(battle);
      expect(done.state.cleared.includes('luoyepo-3')).toBe(battle.win);
      outcomes.add(battle.win);
    }
    expect(outcomes.size).toBe(2);
  });

  it('狀態可 JSON 序列化後還原（給 T006 存檔）', () => {
    const s = started();
    const restored = JSON.parse(JSON.stringify(s)) as GameState;
    expect(restored).toEqual(s);
    expect(collectExpedition(restored, 'exp-1', T0 + 5 * MINUTE_MS).ok).toBe(true);
  });
});
