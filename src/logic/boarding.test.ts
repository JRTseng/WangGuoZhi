import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../state/gameState';
import { autoTeamOf } from './auto';
import {
  BOARDING_RATE,
  board,
  boardingExpPerHour,
  boardingExpPerRun,
  boardingPeriodMs,
  boardingSlotCount,
  boardingStage,
  checkBoard,
  msUntilNextBoardingExp,
  settleBoarding,
  unboard,
} from './boarding';
import { busyDogIds, idleDogIds, runExpedition } from './expedition';
import { MAX_LEVEL, dogStatsById, expNeeded } from './leveling';
import { deserialize, sanitizeState, serialize } from './save';
import { FAST_STAMINA_REGEN_MS, settle } from './stamina';
import { autoFillTeam, toggleTeamMember } from './team';

const NOW = Date.UTC(2026, 10, 13, 4, 0, 0);
const O = { tzOffsetMin: -480 };
const PERIOD = boardingPeriodMs();
const HOUR = 3_600_000;

/** 新遊戲：隊伍是大耳、黑旋、長鬚，板凳是小算、阿白（都 1 級） */
const fresh = (): GameState => settle(createInitialState(NOW), NOW, O);

const boarded = (s: GameState, ...ids: string[]): GameState => {
  for (const id of ids) {
    const r = board(s, id, NOW);
    if (r.block) throw new Error(`放不進去：${id} ${r.block}`);
    s = r.state;
  }
  return s;
};

describe('寄宿位與速度', () => {
  it('一開始 2 個位子，打贏第 1 章 Boss 後 3 個', () => {
    const s = fresh();
    expect(boardingSlotCount(s)).toBe(2);
    expect(boardingSlotCount({ cleared: ['luoyepo-1', 'luoyepo-4'] })).toBe(2);
    expect(boardingSlotCount({ cleared: ['luoyepo-5'] })).toBe(3);
  });

  it('速度是已通關關卡裡最高經驗的三成；還沒通關用第 1 關', () => {
    expect(BOARDING_RATE).toBe(0.3);
    expect(boardingStage({ cleared: [] }).id).toBe('luoyepo-1');
    expect(boardingExpPerRun({ cleared: [] })).toBe(27);
    expect(boardingExpPerRun({ cleared: ['luoyepo-1'] })).toBe(27);
    // 第 1 章 Boss 難度 4：一場 180 經驗
    expect(boardingExpPerRun({ cleared: ['luoyepo-1', 'luoyepo-5'] })).toBe(54);
  });

  it('一個週期是回滿一場出征體力的時間：正式 100 分鐘，測試模式快 60 倍', () => {
    expect(PERIOD).toBe(100 * 60_000);
    expect(boardingPeriodMs({ regenMs: FAST_STAMINA_REGEN_MS })).toBe(100_000);
    expect(boardingExpPerHour({ cleared: [] })).toBe(16);
    expect(boardingExpPerHour({ cleared: ['luoyepo-5'] })).toBe(32);
  });
});

describe('board / checkBoard', () => {
  it('板凳上的狗可以放，位子記下開始時間', () => {
    const s0 = fresh();
    expect(checkBoard(s0, 'xiaosuan')).toBeNull();
    const r = board(s0, 'xiaosuan', NOW);
    expect(r.block).toBeNull();
    expect(r.state.boarding).toEqual([
      { dogId: 'xiaosuan', since: NOW, at: NOW, carry: 0, exp: 0, levels: 0 },
    ]);
    expect(s0.boarding).toEqual([]);
  });

  it('隊伍裡、已在寄宿、沒擁有、不認得、已滿級、沒空位都不能放，狀態不變', () => {
    const s0 = fresh();
    expect(board(s0, 'daer', NOW)).toEqual({ state: s0, block: 'in-team' });
    expect(checkBoard(s0, 'nuantong')).toBe('not-owned');
    expect(checkBoard(s0, 'nobody')).toBe('unknown-dog');
    const one = boarded(s0, 'xiaosuan');
    expect(board(one, 'xiaosuan', NOW)).toEqual({ state: one, block: 'boarding' });
    const maxed = {
      ...s0,
      dogs: { ...s0.dogs, abai: { ...s0.dogs.abai, level: MAX_LEVEL, exp: 0 } },
    };
    expect(checkBoard(maxed, 'abai')).toBe('max-level');
    // 兩個位子放滿後，第三隻放不進去；通過第 1 章 Boss 後就可以
    const noTeam = { ...s0, team: ['daer'] };
    const two = boarded(noTeam, 'xiaosuan', 'abai');
    expect(checkBoard(two, 'heixuan')).toBe('full');
    expect(checkBoard({ ...two, cleared: ['luoyepo-5'] }, 'heixuan')).toBeNull();
  });
});

describe('settleBoarding', () => {
  it('過一個週期拿到 27 經驗（第 1 關的三成），滿了自動升級', () => {
    const s0 = boarded(fresh(), 'xiaosuan');
    const s1 = settleBoarding(s0, NOW + PERIOD);
    // 1 級升 2 級要 20，剩 7
    expect(s1.dogs.xiaosuan).toMatchObject({ level: 2, exp: 7 });
    expect(s1.boarding[0]).toMatchObject({ exp: 27, levels: 1, at: NOW + PERIOD, carry: 0 });
    const before = dogStatsById(s0, 'xiaosuan')!;
    const after = dogStatsById(s1, 'xiaosuan')!;
    expect(after.attack).toBeGreaterThan(before.attack);
    expect(after.defense).toBeGreaterThan(before.defense);
    // 沒寄宿的狗不受影響
    expect(s1.dogs.abai).toBe(s0.dogs.abai);
    expect(s1.dogs.daer).toBe(s0.dogs.daer);
  });

  it('還沒湊滿 1 點經驗時回傳同一個物件（不用存檔）', () => {
    const s0 = boarded(fresh(), 'xiaosuan');
    const perExp = PERIOD / 27;
    expect(settleBoarding(s0, NOW + Math.floor(perExp) - 1)).toBe(s0);
    expect(settleBoarding(s0, NOW + Math.ceil(perExp)).boarding[0].exp).toBe(1);
    expect(settleBoarding(fresh(), NOW + PERIOD * 10)).toEqual(fresh());
  });

  it('每 0.25 秒算一次、亂跳著算、一次算完，結果完全一樣', () => {
    const fast = { regenMs: FAST_STAMINA_REGEN_MS };
    const s0 = boarded(fresh(), 'xiaosuan', 'abai');
    const end = NOW + 40 * 60_000; // 測試模式 40 分鐘 = 24 個週期
    const once = settleBoarding(s0, end, fast);
    let step = s0;
    for (let t = NOW; t <= end; t += 250) step = settleBoarding(step, t, fast);
    step = settleBoarding(step, end, fast);
    let jump = s0;
    for (const m of [0.7, 3, 3.01, 11, 29.5, 40]) {
      jump = settleBoarding(jump, NOW + m * 60_000, fast);
    }
    expect(once.boarding[0].exp).toBe(27 * 24);
    expect(once.dogs.xiaosuan.level).toBeGreaterThan(5);
    expect(step.dogs).toEqual(once.dogs);
    expect(jump.dogs).toEqual(once.dogs);
    expect(step.boarding.map((b) => [b.exp, b.levels])).toEqual(
      once.boarding.map((b) => [b.exp, b.levels]),
    );
    // 兩隻都從 1 級開始、拿一樣多經驗，升的級數一樣
    expect(once.boarding[0].levels).toBe(once.boarding[1].levels);
  });

  it('離線很久回來一次補算（24 小時）', () => {
    const s0 = boarded(fresh(), 'abai');
    const s1 = settleBoarding(s0, NOW + 24 * HOUR);
    // 24 小時 = 14.4 個週期 × 27
    expect(s1.boarding[0].exp).toBe(Math.floor(14.4 * 27));
    let need = 0;
    for (let lv = 1; lv < s1.dogs.abai.level; lv++) need += expNeeded(lv);
    expect(need + s1.dogs.abai.exp).toBe(s1.boarding[0].exp);
  });

  it('通關更難的關卡後變快', () => {
    const s0 = boarded({ ...fresh(), cleared: ['luoyepo-1', 'luoyepo-5'] }, 'xiaosuan');
    expect(settleBoarding(s0, NOW + PERIOD).boarding[0].exp).toBe(54);
  });

  it('系統時間被調回過去：不倒扣也不多拿，從現在重新起算', () => {
    const s0 = boarded(fresh(), 'xiaosuan');
    const s1 = settleBoarding(s0, NOW - HOUR);
    expect(s1.dogs).toBe(s0.dogs);
    expect(s1.boarding[0]).toMatchObject({ at: NOW - HOUR, exp: 0 });
    expect(settleBoarding(s1, NOW - HOUR + PERIOD).boarding[0].exp).toBe(27);
  });

  it('寄宿到滿級就不再拿經驗', () => {
    const s0 = fresh();
    const near = {
      ...s0,
      dogs: { ...s0.dogs, abai: { ...s0.dogs.abai, level: MAX_LEVEL - 1, exp: 0 } },
    };
    const s1 = settleBoarding(boarded(near, 'abai'), NOW + PERIOD * 100_000);
    expect(s1.dogs.abai).toMatchObject({ level: MAX_LEVEL, exp: 0 });
    expect(settleBoarding(s1, NOW + PERIOD * 200_000)).toBe(s1);
    expect(msUntilNextBoardingExp(s1, s1.boarding[0], NOW)).toBe(0);
  });

  it('下一點經驗的倒數', () => {
    const s0 = boarded(fresh(), 'xiaosuan');
    const wait = msUntilNextBoardingExp(s0, s0.boarding[0], NOW);
    expect(wait).toBe(Math.ceil(PERIOD / 27));
    expect(settleBoarding(s0, NOW + wait).boarding[0].exp).toBe(1);
    expect(settleBoarding(s0, NOW + wait - 1)).toBe(s0);
  });
});

describe('unboard', () => {
  it('接回來先結算到現在，位子空出來，經驗留在狗身上', () => {
    const s0 = boarded(fresh(), 'xiaosuan', 'abai');
    const s1 = unboard(s0, 'xiaosuan', NOW + PERIOD);
    expect(s1.boarding.map((b) => b.dogId)).toEqual(['abai']);
    expect(s1.dogs.xiaosuan).toMatchObject({ level: 2, exp: 7 });
    // 另一隻也一起結算了
    expect(s1.boarding[0].exp).toBe(27);
    expect(checkBoard(s1, 'xiaosuan')).toBeNull();
  });

  it('不在寄宿的狗接回沒有效果', () => {
    const s0 = boarded(fresh(), 'xiaosuan');
    expect(unboard(s0, 'daer', NOW)).toBe(s0);
  });
});

describe('寄宿中的狗不能上陣', () => {
  it('不能出征、不算可出征、不能加入隊伍、不會被自動編隊選到', () => {
    const s = boarded(fresh(), 'xiaosuan');
    expect([...busyDogIds(s)]).toEqual(['xiaosuan']);
    expect(idleDogIds(s)).not.toContain('xiaosuan');
    expect(runExpedition(s, 'luoyepo-1', ['daer', 'xiaosuan'], NOW, O)).toEqual({
      ok: false,
      error: 'dog-busy',
    });
    expect(runExpedition(s, 'luoyepo-1', ['daer', 'abai'], NOW, O).ok).toBe(true);
    expect(toggleTeamMember(s, 'xiaosuan')).toBe(s);
    expect(autoFillTeam(s).team).not.toContain('xiaosuan');
    expect(autoFillTeam(s).team).toHaveLength(4);
    // 接回來就可以
    const back = unboard(s, 'xiaosuan', NOW);
    expect(toggleTeamMember(back, 'xiaosuan').team).toContain('xiaosuan');
  });

  it('自動出征的隊伍不含寄宿中的狗（壞資料也擋得住）', () => {
    const s = fresh();
    const odd = {
      ...s,
      boarding: [{ dogId: 'daer', since: NOW, at: NOW, carry: 0, exp: 0, levels: 0 }],
    };
    expect(autoTeamOf(odd)).toEqual(['heixuan', 'changxu']);
  });
});

describe('存檔', () => {
  it('寄宿狀態存了再讀一樣，讀檔後離線的時間照算', () => {
    const s0 = settleBoarding(boarded(fresh(), 'xiaosuan'), NOW + PERIOD / 2);
    const r = deserialize(serialize(s0, NOW + PERIOD / 2), NOW + PERIOD / 2);
    expect(r.status).toBe('ok');
    expect(r.state.boarding).toEqual(s0.boarding);
    expect(settleBoarding(r.state, NOW + PERIOD).boarding[0].exp).toBe(27);
  });

  it('舊存檔沒有這個欄位：當成沒有狗在寄宿', () => {
    const { boarding: _drop, ...old } = fresh();
    void _drop;
    expect(sanitizeState(old, NOW).boarding).toEqual([]);
  });

  it('壞資料：不認得、沒擁有、重複、還在隊伍裡、超過位子數的丟掉；時間比現在晚的拉回來', () => {
    const slot = (dogId: string) => ({ dogId, since: NOW, at: NOW, carry: 0, exp: 0, levels: 0 });
    const s = { ...fresh(), team: ['daer'] };
    const raw = {
      ...s,
      boarding: [
        slot('nobody'),
        slot('nuantong'),
        slot('daer'),
        'x',
        { ...slot('xiaosuan'), since: NOW + 99, at: NOW + 99, carry: -5, exp: 'a' },
        slot('xiaosuan'),
        slot('abai'),
        slot('heixuan'),
      ],
    };
    expect(sanitizeState(raw, NOW).boarding).toEqual([slot('xiaosuan'), slot('abai')]);
    expect(sanitizeState({ ...raw, cleared: ['luoyepo-5'] }, NOW).boarding).toHaveLength(3);
    expect(sanitizeState({ ...s, boarding: 'oops' }, NOW).boarding).toEqual([]);
  });
});
