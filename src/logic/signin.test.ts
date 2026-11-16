import { describe, expect, it } from 'vitest';
import { REGIONS } from '../data/regions';
import { createInitialState, type GameState } from '../state/gameState';
import { deserialize, serialize } from './save';
import {
  SIGNIN_DAYS,
  SIGNIN_SSR_SHARDS,
  SIGNIN_TABLE,
  claimSignin,
  markSigninShown,
  sanitizeSignin,
  setSigninPick,
  signinPickPool,
  signinPopup,
  signinPopupFromSearch,
  signinReady,
  signinReward,
  signinRewardText,
  signinStreak,
  signinView,
} from './signin';
import { DOGS } from '../data/dogs';

const NOW = Date.UTC(2026, 10, 16, 4, 0, 0); // 台北 11-16 12:00
const O = { tzOffsetMin: -480 };
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const fresh = (): GameState => createInitialState(NOW);
/** 隨便一隻 SSR 狗（從資料表拿，不寫死） */
const SSR_DOG = signinPickPool()[0];
const EMPTY = { day: '', count: 0, streak: 0, pick: '', shown: '' };
/** 先選好第 7 天要哪隻狗的新遊戲 */
const picked = (): GameState => setSigninPick(fresh(), SSR_DOG.id);

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
      expect(r.food + r.bones + (r.snack?.amount ?? 0) + (r.shards?.amount ?? 0)).toBeGreaterThan(
        0,
      );
      expect(signinRewardText(r)).not.toBe('');
    }
  });

  it('第 7 天送自選 SSR 碎片 15 個', () => {
    expect(SIGNIN_SSR_SHARDS).toBe(15);
    const blank = signinReward(6, 1);
    expect(blank).toEqual({ food: 0, bones: 0, shards: { dogId: '', amount: 15 } });
    expect(signinRewardText(blank)).toBe('SSR 碎片 ×15');
    const chosen = signinReward(6, 3, SSR_DOG.id);
    expect(chosen.shards).toEqual({ dogId: SSR_DOG.id, amount: 15 });
    expect(signinRewardText(chosen)).toBe(`${SSR_DOG.name}碎片 ×15`);
  });

  it('可以選的狗就是資料表裡所有的 SSR；不是 SSR 的選不了', () => {
    const pool = signinPickPool();
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.map((d) => d.id)).toEqual(DOGS.filter((d) => d.rarity === 'SSR').map((d) => d.id));
    const other = DOGS.find((d) => d.rarity !== 'SSR')!;
    expect(setSigninPick(fresh(), other.id).signin.pick).toBe('');
    expect(setSigninPick(fresh(), 'nobody').signin.pick).toBe('');
    expect(signinReward(6, 1, other.id).shards?.dogId).toBe('');
    expect(picked().signin.pick).toBe(SSR_DOG.id);
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
    expect(signinReward(8, 1).shards).toBeUndefined();
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
    expect(r.state.signin).toEqual({
      day: '2026-11-16',
      count: 1,
      streak: 1,
      pick: '',
      shown: '',
    });
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

  it('連簽七天全部領到，第 7 天拿到選的那隻 SSR 碎片，第 8 天從第 1 天再來', () => {
    const start = picked();
    const s = signDays(start, 7);
    expect(s.resources.food).toBe(start.resources.food + 300 + 500);
    expect(s.resources.bones).toBe(start.resources.bones + 20 + 30);
    expect(s.snacks.small).toBe(3 + 5);
    expect(s.shards[SSR_DOG.id]).toBe((start.shards[SSR_DOG.id] ?? 0) + 15);
    expect(s.signin).toMatchObject({ count: 7, streak: 7 });
    const r = claimSignin(s, NOW + 7 * DAY, O);
    expect(r.day).toBe(1);
    expect(r.reward).toEqual({ food: 300, bones: 0 });
    expect(r.state.signin).toMatchObject({ count: 8, streak: 1 });
  });

  it('第 7 天還沒選狗：領不了，要先選；選了就領得到', () => {
    const s = signDays(fresh(), 6);
    const r = claimSignin(s, NOW + 6 * DAY, O);
    expect(r).toMatchObject({ reward: null, day: 7, needPick: true });
    expect(r.state).toBe(s);
    const ok = claimSignin(setSigninPick(s, SSR_DOG.id), NOW + 6 * DAY, O);
    expect(ok.reward?.shards).toEqual({ dogId: SSR_DOG.id, amount: 15 });
    expect(ok.state.shards[SSR_DOG.id]).toBe(15);
  });

  it('要連續簽：漏了一天就斷掉，回來從第 1 天重新開始', () => {
    const s = signDays(fresh(), 2);
    // 第 3 天沒來，第 4 天才來
    expect(signinStreak(s, NOW + 2 * DAY, O)).toBe(2);
    expect(signinStreak(s, NOW + 3 * DAY, O)).toBe(0);
    const r = claimSignin(s, NOW + 3 * DAY, O);
    expect(r.day).toBe(1);
    expect(r.reward).toEqual({ food: 300, bones: 0 });
    expect(r.state.signin).toMatchObject({ count: 3, streak: 1 });
    const v = signinView(s, NOW + 10 * DAY, O);
    expect(v).toMatchObject({ ready: true, index: 0, broken: true, total: 2 });
    expect(v.cells[0].status).toBe('today');
    expect(v.cells[1].status).toBe('later');
  });

  it('沒斷的時候不會說斷掉：新遊戲、隔天接著簽、領完一輪後隔很久才來', () => {
    expect(signinView(fresh(), NOW, O).broken).toBe(false);
    expect(signinView(signDays(fresh(), 2), NOW + 2 * DAY, O).broken).toBe(false);
    const done = signDays(picked(), 7);
    const v = signinView(done, NOW + 20 * DAY, O);
    expect(v).toMatchObject({ ready: true, index: 0, broken: false });
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
    const s = signDays(picked(), 7);
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

describe('七日簽到：每天第一次進主頁自動跳出', () => {
  it('今天還沒簽就跳；跳過一次今天就不再跳，隔天又會跳', () => {
    const s = fresh();
    expect(signinPopup(s, NOW, O)).toBe(true);
    const shown = markSigninShown(s, NOW, O);
    expect(shown.signin.shown).toBe('2026-11-16');
    expect(signinPopup(shown, NOW + HOUR, O)).toBe(false);
    expect(markSigninShown(shown, NOW + HOUR, O)).toBe(shown);
    expect(signinPopup(shown, NOW + DAY, O)).toBe(true);
  });

  it('今天簽過了就不跳', () => {
    const s = claimSignin(fresh(), NOW, O).state;
    expect(signinPopup(s, NOW + HOUR, O)).toBe(false);
  });

  it('網址 ?signin=0 可以關掉', () => {
    expect(signinPopupFromSearch('')).toBe(true);
    expect(signinPopupFromSearch('?fast=1')).toBe(true);
    expect(signinPopupFromSearch('?fast=1&signin=0')).toBe(false);
    expect(signinPopupFromSearch('?signin=1')).toBe(true);
  });
});

describe('七日簽到：存檔', () => {
  it('存檔讀檔後還在', () => {
    const s = markSigninShown(signDays(picked(), 4), NOW + 3 * DAY, O);
    const back = deserialize(serialize(s, NOW), NOW);
    expect(back.status).toBe('ok');
    expect(back.state.signin).toEqual(s.signin);
  });

  it('舊存檔沒有這個欄位：從頭開始', () => {
    const file = JSON.parse(serialize(fresh(), NOW));
    delete file.state.signin;
    const back = deserialize(JSON.stringify(file), NOW);
    expect(back.status).toBe('ok');
    expect(back.state.signin).toEqual(EMPTY);
  });

  it('改成連續簽之前的存檔沒有連續格數：照累計天數換算', () => {
    expect(sanitizeSignin({ day: '2026-11-16', count: 3 })).toMatchObject({ count: 3, streak: 3 });
    expect(sanitizeSignin({ day: '2026-11-16', count: 7 })).toMatchObject({ count: 7, streak: 7 });
    expect(sanitizeSignin({ day: '2026-11-16', count: 9 })).toMatchObject({ count: 9, streak: 2 });
  });

  it('怪資料會被整理掉', () => {
    expect(sanitizeSignin(null)).toEqual(EMPTY);
    expect(sanitizeSignin({ day: 'abc', count: -3, streak: 5 })).toEqual(EMPTY);
    expect(sanitizeSignin({ day: '2026-11-16', count: 2.7 })).toEqual({
      ...EMPTY,
      day: '2026-11-16',
      count: 2,
      streak: 2,
    });
    expect(sanitizeSignin({ day: '2026-11-16', count: 'x', streak: 99 })).toEqual({
      ...EMPTY,
      day: '2026-11-16',
      count: 1,
      streak: 1,
    });
    // 選的狗不是 SSR、跳出日期亂寫：清掉
    const other = DOGS.find((d) => d.rarity !== 'SSR')!;
    expect(
      sanitizeSignin({ day: '2026-11-16', count: 3, streak: 3, pick: other.id, shown: 7 }),
    ).toMatchObject({ pick: '', shown: '' });
    expect(sanitizeSignin({ day: '2026-11-16', count: 3, streak: 3, pick: SSR_DOG.id }).pick).toBe(
      SSR_DOG.id,
    );
  });
});
