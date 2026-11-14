import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../state/gameState';
import {
  advanceAuto,
  autoTeamFor,
  autoTeamOf,
  clearAutoSummary,
  pickAutoStage,
  setAuto,
} from './auto';
import { dogPower } from './team';
import { runExpedition } from './expedition';
import { runsLeft, spendRun } from './stamina';

const TZ = { tzOffsetMin: -480 };
const tpe = (iso: string) => Date.parse(`${iso}+08:00`);
const T0 = tpe('2026-11-12T12:00:00');
const MIN = 60_000;

const fresh = (cleared: string[] = []): GameState => ({ ...createInitialState(T0), cleared });
const on = (s: GameState, now = T0) => setAuto(s, true, now);

describe('自動出征：開關', () => {
  it('預設關；關著的時候什麼都不做', () => {
    const s = fresh(['luoyepo-1']);
    expect(s.auto).toEqual({ enabled: false, lastAt: T0, summary: null });
    expect(advanceAuto(s, T0 + 600 * MIN, TZ)).toBe(s);
  });
  it('打開時從現在開始算；重複設定不變', () => {
    const s = setAuto(fresh(), true, T0 + 5);
    expect(s.auto).toMatchObject({ enabled: true, lastAt: T0 + 5 });
    expect(setAuto(s, true, T0 + 99)).toBe(s);
    expect(setAuto(s, false, T0 + 99).auto.enabled).toBe(false);
  });
  it('用組隊編排裡擁有的狗', () => {
    expect(autoTeamOf(fresh())).toEqual(['daer', 'heixuan', 'changxu']);
    expect(autoTeamOf({ ...fresh(), team: ['tieya', 'abai'] })).toEqual(['abai']);
  });
  it('隊伍超過那一關的上陣上限：派戰力最高的幾隻，順序不變（T018）', () => {
    const five = { ...fresh(), team: ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'] };
    // 第 1 關最多 3 隻
    const three = autoTeamFor(five, 'luoyepo-1');
    expect(three).toHaveLength(3);
    expect(three).toEqual(five.team.filter((id) => three.includes(id)));
    const weakest = [...five.team].sort((a, b) => dogPower(five, a) - dogPower(five, b));
    expect(three).not.toContain(weakest[0]);
    expect(three).not.toContain(weakest[1]);
    // 可以上 5 隻的關卡就全上
    expect(autoTeamFor(five, 'zhulindu-5')).toEqual(five.team);
    // 帶五隻也能自動打第 1 關，不會卡住
    const done = advanceAuto(on({ ...five, cleared: ['luoyepo-1'] }), T0 + 1, TZ);
    expect(done.history.at(-1)?.dogIds).toEqual(three);
  });
});

describe('自動出征：選關', () => {
  it('只打已通過的關卡；沒通過任何關卡就沒有', () => {
    expect(pickAutoStage(fresh(), T0, TZ)).toBeUndefined();
    expect(pickAutoStage(fresh(['luoyepo-1']), T0, TZ)?.id).toBe('luoyepo-1');
  });
  it('選經驗最高的；一樣高選後面的；今天次數用完就換下一個', () => {
    // 第 3、4 關難度一樣（經驗一樣），選後面的第 4 關
    let s = fresh(['luoyepo-1', 'luoyepo-2', 'luoyepo-3', 'luoyepo-4']);
    expect(pickAutoStage(s, T0, TZ)?.id).toBe('luoyepo-4');
    for (let i = 0; i < 3; i++) s = spendRun(s, 'luoyepo-4', T0, TZ);
    expect(pickAutoStage(s, T0, TZ)?.id).toBe('luoyepo-3');
  });
});

describe('advanceAuto', () => {
  it('體力夠就一直打：100 體力打 5 場，同關最多 3 場，結果累積成摘要', () => {
    const s = advanceAuto(on(fresh(['luoyepo-1', 'luoyepo-2'])), T0, TZ);
    expect(s.stamina.value).toBe(0);
    expect(s.auto.summary).toMatchObject({
      runs: 5,
      wins: 5,
      stages: { 'luoyepo-2': 3, 'luoyepo-1': 2 },
      reward: { food: 260 * 3 + 120 * 2, bones: 12 * 3 + 5 * 2 },
    });
    expect(s.resources.food).toBe(1200 + 260 * 3 + 120 * 2);
    expect(s.history).toHaveLength(5);
    expect(s.history.every((r) => r.auto)).toBe(true);
    // 每隻狗的經驗：第 2 關 120 × 3 + 第 1 關 90 × 2
    expect(s.auto.summary!.dogs.daer.exp).toBe(540);
    expect(s.auto.summary!.dogs.daer.levels).toBe(s.dogs.daer.level - 3);
    // 再呼叫一次不會多打
    expect(advanceAuto(s, T0, TZ).auto.summary!.runs).toBe(5);
  });

  it('沒通過任何關卡、或隊伍是空的：不打，體力照常', () => {
    const a = advanceAuto(on(fresh()), T0 + 60 * MIN, TZ);
    expect(a.auto.summary).toBeNull();
    expect(a.stamina.value).toBe(100);
    const b = advanceAuto(on({ ...fresh(['luoyepo-1']), team: [] }), T0 + 60 * MIN, TZ);
    expect(b.auto.summary).toBeNull();
  });

  it('離開一段時間再回來：依這段時間恢復的體力補算，和一直開著結果一樣', () => {
    const cleared = ['luoyepo-1', 'luoyepo-2', 'luoyepo-3', 'luoyepo-4', 'luoyepo-5'];
    const start = on(fresh(cleared));
    // 一直開著：每分鐘呼叫一次，共 10 小時
    let live = start;
    for (let m = 0; m <= 600; m++) live = advanceAuto(live, T0 + m * MIN, TZ);
    // 離開 10 小時後才呼叫一次
    const away = advanceAuto(start, T0 + 600 * MIN, TZ);
    expect(away.auto.summary).toEqual(live.auto.summary);
    expect(away.stamina).toEqual(live.stamina);
    expect(away.resources).toEqual(live.resources);
    // 100 體力 5 場 + 10 小時恢復 120 點 6 場
    expect(away.auto.summary!.runs).toBe(11);
    expect(away.auto.lastAt).toBe(T0 + 600 * MIN);
  });

  it('次數都用完就停，體力回到上限；隔天 05:00 重置後繼續打', () => {
    const start = on(fresh(['luoyepo-1']));
    const night = advanceAuto(start, tpe('2026-11-13T04:59:00'), TZ);
    expect(night.auto.summary!.runs).toBe(3);
    expect(night.stamina.value).toBe(100);
    const morning = advanceAuto(night, tpe('2026-11-13T05:00:00'), TZ);
    expect(morning.auto.summary!.runs).toBe(6);
    expect(runsLeft(morning, 'luoyepo-1', tpe('2026-11-13T05:00:00'), TZ)).toBe(0);
    // 一次跳過好幾天也只會照每天的次數打
    const week = advanceAuto(start, tpe('2026-11-15T12:00:00'), TZ);
    expect(week.auto.summary!.runs).toBe(3 * 4);
  });

  it('中間手動打過一場：不會重複恢復體力', () => {
    const start = on(fresh(['luoyepo-1']));
    const drained = advanceAuto(start, T0, TZ); // 打 3 場，剩 40
    expect(drained.stamina.value).toBe(40);
    // 50 分鐘後沒經過 advanceAuto 就手動打第 2 關：體力 40 + 10 - 20
    const t1 = T0 + 50 * MIN;
    const manual = runExpedition(drained, 'luoyepo-2', ['daer', 'heixuan', 'changxu'], t1, TZ);
    if (!manual.ok) throw new Error(manual.error);
    expect(manual.state.stamina.value).toBe(30);
    const after = advanceAuto(manual.state, t1, TZ);
    // 第 2 關通過了，自動出征用剩下的 30 體力打 1 場
    expect(after.auto.summary!.runs).toBe(4);
    expect(after.stamina.value).toBe(10);
  });

  it('打輸也照算：拿三成獎勵，摘要記敗', () => {
    const s = advanceAuto(on({ ...fresh(['luoyepo-1']), team: ['abai'] }), T0, TZ);
    expect(s.auto.summary).toMatchObject({ runs: 3, wins: 0, reward: { food: 108, bones: 3 } });
  });

  it('看過摘要後清掉', () => {
    const s = advanceAuto(on(fresh(['luoyepo-1'])), T0, TZ);
    const c = clearAutoSummary(s);
    expect(c.auto.summary).toBeNull();
    expect(clearAutoSummary(c)).toBe(c);
  });
});
