import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../state/gameState';
import { findDog } from '../data/dogs';
import {
  GIFT_DUPLICATE_SHARDS,
  HISTORY_MAX,
  busyDogIds,
  expeditionBattle,
  expeditionReward,
  idleDogIds,
  runExpedition,
  stageTeamMax,
} from './expedition';
import { initialProgress } from './leveling';
import { STAMINA_COST, STAMINA_MAX, runsLeft } from './stamina';
import { dogPower } from './team';

const T0 = 1_800_000_000_000; // 固定的「現在」
const TZ = { tzOffsetMin: -480 }; // 台北時間
const TEAM = ['daer', 'heixuan', 'changxu'];
const ALL = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];
/** 第 1 章 Boss 關最多上 4 隻 */
const BOSS_TEAM = ALL.slice(0, 4);

const fresh = () => createInitialState(T0);

function run(
  state: GameState = fresh(),
  stageId = 'luoyepo-1',
  team = TEAM,
  now = T0,
  seed?: number,
) {
  const r = runExpedition(state, stageId, team, now, { ...TZ, seed });
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('runExpedition', () => {
  it('按下去就打完：扣體力與次數、加資源、記為通過、寫一筆紀錄', () => {
    const s = fresh();
    const { state, record } = run(s);
    expect(state.stamina.value).toBe(STAMINA_MAX - STAMINA_COST);
    expect(runsLeft(state, 'luoyepo-1', T0, TZ)).toBe(2);
    expect(state.resources).toEqual({ food: 1200 + 120, bones: 50 + 5 });
    expect(state.cleared).toEqual(['luoyepo-1']);
    expect(state.nextExpeditionNo).toBe(2);
    expect(state.history).toEqual([record]);
    expect(record).toMatchObject({
      id: 'exp-1',
      stageId: 'luoyepo-1',
      dogIds: TEAM,
      at: T0,
      reward: { food: 120, bones: 5 },
      win: true,
    });
    expect(record.auto).toBeUndefined();
  });

  it('不改動原本的狀態', () => {
    const before = fresh();
    const snapshot = JSON.stringify(before);
    run(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('戰鬥種子可指定，沒指定就由時間與編號算出', () => {
    const s = fresh();
    expect(run(s, 'luoyepo-1', TEAM, T0, 777).record.seed).toBe(777);
    expect(run(s).record.seed).toBe(run(s).record.seed);
    expect(run(s, 'luoyepo-1', TEAM, T0 + 1).record.seed).not.toBe(run(s).record.seed);
  });

  it('沒有狗會出征中，打完馬上可以再打；下一關也開放了', () => {
    const a = run();
    expect([...busyDogIds(a.state)]).toEqual([]);
    expect(idleDogIds(a.state)).toEqual(ALL);
    const b = run(a.state, 'luoyepo-2');
    expect(b.record.id).toBe('exp-2');
    expect(b.state.stamina.value).toBe(STAMINA_MAX - STAMINA_COST * 2);
  });

  it('隊伍可帶 1 隻到這一關的上陣上限（T018：跟著敵人數量）；不重複、要存在', () => {
    const s = fresh();
    const tz = TZ;
    // 第 1 關五隻小卒，可以上 5 隻
    expect(stageTeamMax('luoyepo-1')).toBe(5);
    for (let n = 1; n <= 5; n++) {
      expect(run(s, 'luoyepo-1', ALL.slice(0, n)).record.dogIds).toEqual(ALL.slice(0, n));
    }
    // 第 2 關三隻敵人，最多 3 隻
    expect(stageTeamMax('luoyepo-2')).toBe(3);
    const second = { ...s, cleared: ['luoyepo-1'] };
    expect(run(second, 'luoyepo-2', ALL.slice(0, 3)).record.dogIds).toEqual(ALL.slice(0, 3));
    expect(runExpedition(second, 'luoyepo-2', ALL.slice(0, 4), T0, tz)).toEqual({
      ok: false,
      error: 'wrong-team-size',
    });
    // Boss 關：頭目算兩隻，加兩隻小兵可以上 4 隻
    expect(stageTeamMax('luoyepo-5')).toBe(4);
    expect(stageTeamMax('zhulindu-5')).toBe(5);
    expect(stageTeamMax('xuelingguan-3')).toBe(2);
    expect(stageTeamMax('nope')).toBe(5);
    expect(runExpedition(s, 'luoyepo-1', [], T0, tz)).toEqual({
      ok: false,
      error: 'wrong-team-size',
    });
    const six = { ...s, owned: [...s.owned, 'tieya'] };
    expect(runExpedition(six, 'luoyepo-1', [...ALL, 'tieya'], T0, tz)).toEqual({
      ok: false,
      error: 'wrong-team-size',
    });
    expect(runExpedition(s, 'luoyepo-1', ['daer', 'daer', 'abai'], T0, tz)).toEqual({
      ok: false,
      error: 'duplicate-dog',
    });
    expect(runExpedition(s, 'luoyepo-1', ['daer', 'ghost', 'abai'], T0, tz)).toEqual({
      ok: false,
      error: 'dog-not-found',
    });
    expect(runExpedition(s, 'nope', TEAM, T0, tz)).toEqual({ ok: false, error: 'stage-not-found' });
  });

  it('沒擁有的狗不能出征，未解鎖的關卡不能去', () => {
    const s = fresh();
    expect(runExpedition(s, 'luoyepo-1', ['daer', 'tieya', 'abai'], T0, TZ)).toEqual({
      ok: false,
      error: 'dog-not-owned',
    });
    expect(runExpedition(s, 'luoyepo-2', TEAM, T0, TZ)).toEqual({
      ok: false,
      error: 'stage-locked',
    });
  });

  it('同一關一天 3 次，用完就不能打，狀態不變', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) s = run(s).state;
    expect(runsLeft(s, 'luoyepo-1', T0, TZ)).toBe(0);
    expect(runExpedition(s, 'luoyepo-1', TEAM, T0, TZ)).toEqual({ ok: false, error: 'no-runs' });
    // 別關不受影響
    expect(run(s, 'luoyepo-2').state.stamina.value).toBe(20);
  });

  it('體力不夠不能打', () => {
    const s = { ...fresh(), stamina: { value: 19, updatedAt: T0 } };
    expect(runExpedition(s, 'luoyepo-1', TEAM, T0, TZ)).toEqual({ ok: false, error: 'no-stamina' });
    // 過 5 分鐘回 1 點就夠了
    expect(runExpedition(s, 'luoyepo-1', TEAM, T0 + 5 * 60_000, TZ).ok).toBe(true);
  });

  it('打輸：只拿 30% 獎勵、不算通過、一樣扣體力與次數、紀錄記敗', () => {
    // 阿白一隻（戰力 70）打建議戰力 150 的關卡，一定輸
    const { state, record } = run(fresh(), 'luoyepo-1', ['abai']);
    expect(record).toMatchObject({ win: false, reward: { food: 36, bones: 1 } });
    expect(state.resources).toEqual({ food: 1200 + 36, bones: 50 + 1 });
    expect(state.cleared).toEqual([]);
    expect(state.stamina.value).toBe(80);
    expect(runsLeft(state, 'luoyepo-1', T0, TZ)).toBe(2);
    // 沒通過，下一關還是鎖著
    expect(runExpedition(state, 'luoyepo-2', TEAM, T0, TZ)).toEqual({
      ok: false,
      error: 'stage-locked',
    });
  });

  it('結果不可重抽：同一個種子算幾次都一樣，用紀錄（存檔還原後）也能重播出同一場', () => {
    // 兩邊實力接近（勝負要看運氣）的關卡，換很多種子都要穩定
    const base = { ...fresh(), cleared: ['luoyepo-1', 'luoyepo-2'] };
    const outcomes = new Set<boolean>();
    for (let seed = 1; seed <= 40; seed++) {
      const a = run(base, 'luoyepo-3', TEAM, T0, seed);
      const b = run(base, 'luoyepo-3', TEAM, T0, seed);
      expect(b.record).toEqual(a.record);
      const battle = expeditionBattle(a.record);
      expect(a.record.win).toBe(battle.win);
      expect(a.record.reward).toEqual(expeditionReward(a.record, battle.win));
      const restored = JSON.parse(JSON.stringify(a.state)) as GameState;
      expect(expeditionBattle(restored.history[0])).toEqual(battle);
      expect(a.state.cleared.includes('luoyepo-3')).toBe(battle.win);
      outcomes.add(battle.win);
    }
    expect(outcomes.size).toBe(2);
  });

  it('紀錄記下隊伍當下的攻防等級（含升級成長），不是升級後的', () => {
    const { record } = run();
    expect(record.team.map((d) => d.id)).toEqual(TEAM);
    // 大耳 3 級、稀有度 R（每級多 1 點）：攻 42+8、防 48+8
    expect(record.team[0]).toMatchObject({ attack: 50, defense: 56, level: 3 });
  });

  it('隊伍每隻狗都拿到經驗，滿了自動升級，沒出征的不變', () => {
    const s = fresh();
    const { state, record } = run(s);
    expect(record.gains.map((g) => g.dogId)).toEqual(TEAM);
    // 第 1 關每隻 90 經驗：3 級的大耳（需要 104）還沒升；2 級的黑旋、長鬚（需要 57）升到 3 級
    for (const g of record.gains) expect(g.exp).toBe(90);
    expect(record.gains[0]).toMatchObject({ fromLevel: 3, toLevel: 3 });
    expect(record.gains[1]).toMatchObject({ fromLevel: 2, toLevel: 3 });
    expect(state.dogs.daer.exp).toBe(90);
    expect(state.dogs.heixuan).toMatchObject({ level: 3, exp: 33 });
    expect(state.dogs.abai).toEqual(s.dogs.abai);
    expect(state.dogs.xiaosuan).toEqual(s.dogs.xiaosuan);
    // 原本的狀態沒被改動
    expect(s.dogs.daer.exp).toBe(0);
  });

  it('升級結果寫進狀態與紀錄：1 級的狗打贏第 1 關連升到 3 級，多的經驗保留', () => {
    const { state, record } = run(fresh(), 'luoyepo-1', ['daer', 'heixuan', 'abai'], T0, 5);
    const g = record.gains.find((x) => x.dogId === 'abai')!;
    expect(g).toMatchObject({ exp: 90, fromLevel: 1, toLevel: 3 });
    const p = state.dogs.abai;
    // 90 - 20（1→2）- 57（2→3）= 13
    expect(p).toMatchObject({ level: 3, exp: 13, rolls: 2 });
    expect(p.growthAttack).toBe(g.attack.fixed + g.attack.bonus);
    expect(p.growthDefense).toBe(g.defense.fixed + g.defense.bonus);
    expect(g.attack.fixed + g.defense.fixed).toBe(10);
    expect(dogPower(state, 'abai')).toBe(70 + p.growthAttack + p.growthDefense);
  });

  it('打輸拿一半經驗', () => {
    const { record } = run(fresh(), 'luoyepo-1', ['abai']);
    expect(record.win).toBe(false);
    expect(record.gains[0].exp).toBe(45);
  });

  it(`紀錄只留最近 ${HISTORY_MAX} 筆`, () => {
    let s: GameState = { ...fresh(), stamina: { value: 100_000, updatedAt: T0 } };
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      // 每次換一天，不受每日次數限制
      s = run(s, 'luoyepo-1', TEAM, T0 + i * 86_400_000).state;
    }
    expect(s.history).toHaveLength(HISTORY_MAX);
    expect(s.history[HISTORY_MAX - 1].id).toBe(`exp-${HISTORY_MAX + 5}`);
  });
});

describe('第 1 章通關送補血狗（T017）', () => {
  const BOSS = 'luoyepo-5';
  const GIFT = 'nuantong';
  /** 前 4 關已通過；strong 時把狗練強，打 Boss 一定贏 */
  const beforeBoss = (strong = true): GameState => {
    const s = fresh();
    const dogs = Object.fromEntries(
      Object.entries(s.dogs).map(([id, p]) => [
        id,
        strong ? { ...p, growthAttack: p.growthAttack + 200 } : p,
      ]),
    );
    return { ...s, dogs, cleared: ['luoyepo-1', 'luoyepo-2', 'luoyepo-3', 'luoyepo-4'] };
  };

  it('第一次打贏 Boss：補血狗加入，有養成進度，紀錄記下來', () => {
    const s = beforeBoss();
    expect(s.owned).not.toContain(GIFT);
    const { state, record } = run(s, BOSS, BOSS_TEAM);
    expect(record.win).toBe(true);
    expect(record.newDogId).toBe(GIFT);
    expect(state.owned).toEqual([...s.owned, GIFT]);
    expect(state.dogs[GIFT].level).toBe(5);
    expect(idleDogIds(state)).toContain(GIFT);
    // 馬上可以帶牠出征，戰鬥裡會標成補血狗
    const next = run(state, 'luoyepo-1', ['daer', GIFT], T0 + 1);
    expect(next.record.team.find((d) => d.id === GIFT)?.heal).toBe(true);
    expect(next.record.team.find((d) => d.id === 'daer')?.heal).toBeUndefined();
  });

  it('再打贏一次不會重複送', () => {
    const first = run(beforeBoss(), BOSS, BOSS_TEAM).state;
    const again = run(first, BOSS, BOSS_TEAM, T0 + 1);
    expect(again.record.win).toBe(true);
    expect(again.record.newDogId).toBeUndefined();
    expect(again.state.owned.filter((id) => id === GIFT)).toHaveLength(1);
    expect(again.state.dogs[GIFT]).toEqual(first.dogs[GIFT]);
  });

  it('送的狗已經先從召募抽到：不重複加入，改送碎片（只有第一次通關）', () => {
    const s0 = beforeBoss();
    const s = {
      ...s0,
      owned: [...s0.owned, GIFT],
      dogs: { ...s0.dogs, [GIFT]: initialProgress(findDog(GIFT)!) },
      shards: { [GIFT]: 3 },
    };
    const first = run(s, BOSS, BOSS_TEAM);
    expect(first.record.win).toBe(true);
    expect(first.record.newDogId).toBeUndefined();
    expect(first.record.giftShards).toEqual({ dogId: GIFT, amount: GIFT_DUPLICATE_SHARDS });
    expect(first.state.owned.filter((id) => id === GIFT)).toHaveLength(1);
    expect(first.state.shards[GIFT]).toBe(3 + GIFT_DUPLICATE_SHARDS);
    const again = run(first.state, BOSS, BOSS_TEAM, T0 + 1);
    expect(again.record.giftShards).toBeUndefined();
    expect(again.state.shards[GIFT]).toBe(3 + GIFT_DUPLICATE_SHARDS);
  });

  it('打輸不送；其他關卡打贏也不送', () => {
    const lost = run(beforeBoss(false), BOSS, ['abai']);
    expect(lost.record.win).toBe(false);
    expect(lost.record.newDogId).toBeUndefined();
    expect(lost.state.owned).not.toContain(GIFT);
    const other = run(fresh());
    expect(other.record.newDogId).toBeUndefined();
    expect(other.state.owned).not.toContain(GIFT);
  });
});
