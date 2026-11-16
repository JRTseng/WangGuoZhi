import { describe, expect, it } from 'vitest';
import { REGIONS } from '../data/regions';
import { createInitialState, type GameState } from '../state/gameState';
import { deserialize, serialize } from './save';
import {
  SIGNIN_DAYS,
  SIGNIN_TABLE,
  claimSignin,
  sanitizeSignin,
  signinReady,
  signinReward,
  signinRewardText,
  signinView,
} from './signin';

const NOW = Date.UTC(2026, 10, 16, 4, 0, 0); // 台北 11-16 12:00
const O = { tzOffsetMin: -480 };
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const fresh = (): GameState => createInitialState(NOW);

/** 連續簽 n 天（每天中午） */
function signDays(state: GameState, n: number, from = NOW): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = claimSignin(s, from + i * DAY, O).state;
  return s;
}

describe('七日簽到：獎勵表', () => {
  it('一輪七天，每天都有東西，第 7 天最多', () => {
    expect(SIGNIN_TABLE).toHaveLength(SIGNIN_DAYS);
    for (let i = 0; i < SIGNIN_DAYS; i++) {
      const r = signinReward(i, 1);
      expect(r.food + r.bones + (r.snack?.amount ?? 0)).toBeGreaterThan(0);
      expect(signinRewardText(r)).not.toBe('');
    }
    const last = signinReward(6, 1);
    expect(last).toEqual({ food: 1000, bones: 100, snack: { id: 'small', amount: 5 } });
    expect(signinRewardText(last)).toBe('糧草 1,000・骨頭幣 100・小肉乾 ×5');
  });

  it('糧草照章節加倍，零食照章節換種類，骨頭幣不變', () => {
    expect(signinReward(0, 1).food).toBe(300);
    expect(signinReward(0, 4).food).toBe(1200);
    expect(signinReward(1, 1).bones).toBe(signinReward(1, 10).bones);
    expect(signinReward(2, 1).snack).toEqual({ id: 'small', amount: 3 });
    expect(signinReward(2, 5).snack).toEqual({ id: 'mid', amount: 3 });
    expect(signinReward(2, 9).snack).toEqual({ id: 'big', amount: 3 });
  });

  it('格子編號超過 7 會繞回來', () => {
    expect(signinReward(7, 1)).toEqual(signinReward(0, 1));
    expect(signinReward(13, 2)).toEqual(signinReward(6, 2));
  });
});

describe('七日簽到：領取', () => {
  it('新遊戲今天就能簽，領第 1 天的糧草', () => {
    const s = fresh();
    expect(signinReady(s, NOW, O)).toBe(true);
    const r = claimSignin(s, NOW, O);
    expect(r.day).toBe(1);
    expect(r.reward).toEqual({ food: 300, bones: 0 });
    expect(r.state.resources.food).toBe(s.resources.food + 300);
    expect(r.state.resources.bones).toBe(s.resources.bones);
    expect(r.state.signin).toEqual({ day: '2026-11-16', count: 1 });
  });

  it('一天只能領一次，05:00 換日後才能再領', () => {
    const s = claimSignin(fresh(), NOW, O).state;
    expect(signinReady(s, NOW + HOUR, O)).toBe(false);
    const again = claimSignin(s, NOW + HOUR, O);
    expect(again.reward).toBeNull();
    expect(again.state).toBe(s);
    // 隔天 04:59 還是同一個遊戲日，05:00 才換日
    expect(signinReady(s, NOW + 16 * HOUR + 59 * 60_000, O)).toBe(false);
    expect(signinReady(s, NOW + 17 * HOUR, O)).toBe(true);
    expect(claimSignin(s, NOW + 17 * HOUR, O).reward).toEqual({ food: 0, bones: 20 });
  });

  it('第 3 天領到的零食進倉庫', () => {
    const s = signDays(fresh(), 3);
    expect(s.snacks.small).toBe(3);
    expect(s.signin.count).toBe(3);
  });

  it('連簽七天全部領到，第 8 天從第 1 天再來', () => {
    const start = fresh();
    const s = signDays(start, 7);
    expect(s.resources.food).toBe(start.resources.food + 300 + 500 + 1000);
    expect(s.resources.bones).toBe(start.resources.bones + 20 + 30 + 100);
    expect(s.snacks.small).toBe(3 + 5 + 5);
    const r = claimSignin(s, NOW + 7 * DAY, O);
    expect(r.day).toBe(1);
    expect(r.reward).toEqual({ food: 300, bones: 0 });
    expect(r.state.signin.count).toBe(8);
  });

  it('漏簽不會歸零：隔了好幾天回來接著領下一格', () => {
    const s = signDays(fresh(), 2);
    const r = claimSignin(s, NOW + 10 * DAY, O);
    expect(r.day).toBe(3);
    expect(r.reward?.snack).toEqual({ id: 'small', amount: 3 });
  });

  it('手機時間被調回過去不給領', () => {
    const s = claimSignin(fresh(), NOW, O).state;
    expect(signinReady(s, NOW - 3 * DAY, O)).toBe(false);
    expect(claimSignin(s, NOW - 3 * DAY, O).reward).toBeNull();
  });

  it('打到後面的章節，糧草跟著變多', () => {
    const s: GameState = { ...fresh(), cleared: REGIONS[0].stages.map((x) => x.id) };
    expect(claimSignin(s, NOW, O).reward).toEqual({ food: 600, bones: 0 });
  });
});

describe('七日簽到：畫面上的七格', () => {
  it('新遊戲：第 1 格是今天，其他還沒到', () => {
    const v = signinView(fresh(), NOW, O);
    expect(v).toMatchObject({ ready: true, index: 0, total: 0 });
    expect(v.cells.map((c) => c.status)).toEqual([
      'today',
      'later',
      'later',
      'later',
      'later',
      'later',
      'later',
    ]);
    expect(v.cells.map((c) => c.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('今天領過：那一格打勾，沒有「今天」', () => {
    const s = signDays(fresh(), 3);
    const v = signinView(s, NOW + 2 * DAY, O);
    expect(v).toMatchObject({ ready: false, index: 2, total: 3 });
    expect(v.cells.map((c) => c.status)).toEqual([
      'claimed',
      'claimed',
      'claimed',
      'later',
      'later',
      'later',
      'later',
    ]);
    // 隔天輪到第 4 格
    const next = signinView(s, NOW + 3 * DAY, O);
    expect(next).toMatchObject({ ready: true, index: 3 });
    expect(next.cells[3].status).toBe('today');
  });

  it('第 7 天領完當天七格全勾，隔天換新的一輪', () => {
    const s = signDays(fresh(), 7);
    const v = signinView(s, NOW + 6 * DAY, O);
    expect(v.ready).toBe(false);
    expect(v.cells.every((c) => c.status === 'claimed')).toBe(true);
    const next = signinView(s, NOW + 7 * DAY, O);
    expect(next.cells.map((c) => c.status)).toEqual([
      'today',
      'later',
      'later',
      'later',
      'later',
      'later',
      'later',
    ]);
  });
});

describe('七日簽到：存檔', () => {
  it('存檔讀檔後還在', () => {
    const s = signDays(fresh(), 4);
    const back = deserialize(serialize(s, NOW), NOW);
    expect(back.status).toBe('ok');
    expect(back.state.signin).toEqual(s.signin);
  });

  it('舊存檔沒有這個欄位：從頭開始', () => {
    const file = JSON.parse(serialize(fresh(), NOW));
    delete file.state.signin;
    const back = deserialize(JSON.stringify(file), NOW);
    expect(back.status).toBe('ok');
    expect(back.state.signin).toEqual({ day: '', count: 0 });
  });

  it('怪資料會被整理掉', () => {
    expect(sanitizeSignin(null)).toEqual({ day: '', count: 0 });
    expect(sanitizeSignin({ day: 'abc', count: -3 })).toEqual({ day: '', count: 0 });
    expect(sanitizeSignin({ day: '2026-11-16', count: 2.7 })).toEqual({
      day: '2026-11-16',
      count: 2,
    });
    expect(sanitizeSignin({ day: '2026-11-16', count: 'x' })).toEqual({
      day: '2026-11-16',
      count: 1,
    });
  });
});
