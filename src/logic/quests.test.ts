import { describe, expect, it } from 'vitest';
import { REGIONS } from '../data/regions';
import { createInitialState, type GameState } from '../state/gameState';
import { runExpedition } from './expedition';
import {
  DAILY_BONUS,
  FEATS,
  MAIN_QUESTS,
  MAIN_VISIBLE,
  QUEST_TABS,
  WEEKLY_BONUS,
  WEEKLY_QUESTS,
  claimAll,
  claimQuest,
  claimableCount,
  countQuest,
  featId,
  featReward,
  mainProgress,
  questList,
  rewardText,
  sanitizeQuests,
} from './quests';
import { deserialize, serialize } from './save';
import { settle } from './stamina';

const NOW = Date.UTC(2026, 10, 15, 4, 0, 0);
const O = { tzOffsetMin: -480 };
const fresh = (): GameState => settle(createInitialState(NOW), NOW, O);
const find = (st: GameState, id: string) =>
  QUEST_TABS.flatMap((t) => questList(st, t)).find((q) => q.id === id)!;

describe('主線任務', () => {
  it('每章兩個：打到第 3 關、打倒頭目，照章節順序排', () => {
    expect(MAIN_QUESTS).toHaveLength(REGIONS.length * 2);
    expect(MAIN_QUESTS[0].id).toBe('main-luoyepo-mid');
    expect(MAIN_QUESTS[1].title).toContain('雷吼');
    expect(MAIN_QUESTS[1].reward).toEqual(REGIONS[0].stages[4].reward);
  });

  it('進度跟著通關紀錄走，完成才能領，領了加資源並換下一個', () => {
    let st = fresh();
    const rows = questList(st, 'main');
    expect(rows).toHaveLength(MAIN_VISIBLE);
    expect(rows[0]).toMatchObject({ progress: 0, target: 3, done: false, go: 'CampaignScene' });
    expect(claimQuest(st, 'main-luoyepo-mid').reward).toBeNull();

    st = { ...st, cleared: ['luoyepo-1', 'luoyepo-2', 'luoyepo-3'] };
    expect(find(st, 'main-luoyepo-mid')).toMatchObject({ progress: 3, done: true });
    expect(find(st, 'main-luoyepo-boss')).toMatchObject({ progress: 3, target: 5, done: false });
    expect(claimableCount(st, 'main')).toBe(1);

    const r = claimQuest(st, 'main-luoyepo-mid');
    expect(r.reward).toEqual({ food: 560, bones: 25 });
    expect(r.state.resources.food).toBe(st.resources.food + 560);
    expect(r.state.resources.bones).toBe(st.resources.bones + 25);
    expect(questList(r.state, 'main')[0].id).toBe('main-luoyepo-boss');
    expect(mainProgress(r.state)).toEqual({ claimed: 1, total: 20 });
    // 領過不能再領
    expect(claimQuest(r.state, 'main-luoyepo-mid').state).toBe(r.state);
  });

  it('全部領完後主線分頁是空的', () => {
    const st = {
      ...fresh(),
      cleared: REGIONS.flatMap((r) => r.stages.map((s) => s.id)),
    };
    const r = claimAll(st, 'main');
    expect(r.count).toBe(20);
    expect(questList(r.state, 'main')).toEqual([]);
    expect(claimableCount(r.state, 'main')).toBe(0);
  });
});

describe('每日任務', () => {
  it('出征與打贏在結算時自動記；累計勝場一起加', () => {
    const st = fresh();
    const run = runExpedition(st, 'luoyepo-1', ['daer', 'heixuan', 'changxu'], NOW, {
      ...O,
      seed: 7,
    });
    if (!run.ok) throw new Error(run.error);
    const win = run.record.win ? 1 : 0;
    expect(run.state.quests.daily.counts.battle).toBe(1);
    expect(run.state.quests.daily.counts.win ?? 0).toBe(win);
    expect(run.state.quests.wins).toBe(win);
  });

  it('次數到了可以領；糧草獎勵跟著打到第幾章變多', () => {
    let st = countQuest(fresh(), 'battle', 2);
    expect(find(st, 'daily-battle')).toMatchObject({ progress: 2, target: 3, done: false });
    st = countQuest(st, 'battle', 5);
    expect(find(st, 'daily-battle')).toMatchObject({ progress: 3, done: true, claimed: false });
    expect(find(st, 'daily-battle').reward).toEqual({ food: 300, bones: 0 });
    const later = { ...st, cleared: REGIONS[0].stages.map((s) => s.id) };
    expect(find(later, 'daily-battle').reward).toEqual({ food: 600, bones: 0 });

    const r = claimQuest(st, 'daily-battle');
    expect(r.reward).toEqual({ food: 300, bones: 0 });
    expect(find(r.state, 'daily-battle').claimed).toBe(true);
    expect(claimQuest(r.state, 'daily-battle').reward).toBeNull();
  });

  it('完成 3 個每日任務有加碼獎勵，不用四個全做', () => {
    let st = countQuest(countQuest(fresh(), 'battle', 3), 'win', 2);
    expect(find(st, DAILY_BONUS.id)).toMatchObject({ progress: 2, done: false });
    st = countQuest(st, 'pull', 10);
    expect(find(st, DAILY_BONUS.id)).toMatchObject({ progress: 3, done: true });
    const r = claimAll(st, 'daily');
    expect(r.count).toBe(4);
    expect(r.reward).toEqual({ food: 600, bones: 40 });
    expect(claimableCount(r.state, 'daily')).toBe(0);
  });

  it('換日（05:00）清空次數與領取紀錄，主線與累計勝場留著', () => {
    let st = countQuest(countQuest(fresh(), 'battle', 3), 'win', 2);
    st = claimQuest(st, 'daily-battle').state;
    st = { ...st, quests: { ...st.quests, claimed: ['main-luoyepo-mid'] } };
    // 同一天再結算不會動
    expect(settle(st, NOW + 60_000, O).quests).toBe(st.quests);
    const next = settle(st, NOW + 24 * 3600_000, O);
    expect(next.quests.daily).toEqual({ counts: {}, claimed: [] });
    expect(next.quests.claimed).toEqual(['main-luoyepo-mid']);
    expect(next.quests.wins).toBe(2);
  });
});

describe('成就', () => {
  it('每種一列，顯示第一段還沒領的；領完換下一段', () => {
    let st = fresh();
    const rows = questList(st, 'feat');
    expect(rows).toHaveLength(FEATS.length);
    expect(find(st, 'feat-dogs-1')).toMatchObject({ progress: 5, target: 8, done: false });

    st = { ...st, gacha: { pulls: 60, sinceSSR: 0 } };
    expect(find(st, 'feat-pulls-1')).toMatchObject({ progress: 10, target: 10, done: true });
    // 第二段還沒輪到，不能跳著領
    expect(claimQuest(st, 'feat-pulls-2').reward).toBeNull();
    const r = claimQuest(st, 'feat-pulls-1');
    expect(r.reward).toEqual(featReward(0));
    expect(find(r.state, 'feat-pulls-2')).toMatchObject({ progress: 50, target: 50, done: true });
  });

  it('全部領取會把接連達成的幾段一次領完', () => {
    const st = { ...fresh(), gacha: { pulls: 60, sinceSSR: 0 } };
    const r = claimAll(st);
    expect(r.count).toBe(2);
    expect(r.reward).toEqual({ food: 1500, bones: 60 });
    expect(r.state.quests.claimed).toEqual([featId('pulls', 0), featId('pulls', 1)]);
    expect(questList(r.state, 'feat').find((q) => q.id === 'feat-pulls-3')).toMatchObject({
      progress: 60,
      target: 100,
      done: false,
    });
  });

  it('各種累計都從現有的進度算：出征次數、升星、特訓、等級', () => {
    const base = fresh();
    const st: GameState = {
      ...base,
      nextExpeditionNo: 13,
      dogs: {
        ...base.dogs,
        daer: { ...base.dogs.daer, level: 22, star: 3, drillAttack: 6, drillDefense: 5 },
      },
      gear: { 'not-a-gear': 3 },
    };
    expect(find(st, 'feat-runs-1')).toMatchObject({ progress: 10, done: true });
    expect(find(st, 'feat-stars-1')).toMatchObject({ done: true });
    expect(find(st, 'feat-drills-1')).toMatchObject({ progress: 10, done: true });
    expect(find(st, 'feat-level-1')).toMatchObject({ progress: 10, done: true });
    expect(find(st, 'feat-gear-1')).toMatchObject({ progress: 0, done: false });
  });

  it('一種成就全部領完後停在最後一段、顯示已領取', () => {
    const f = FEATS.find((x) => x.key === 'pulls')!;
    const st = {
      ...fresh(),
      gacha: { pulls: 999, sinceSSR: 0 },
    };
    const r = claimAll(st, 'feat');
    expect(r.count).toBe(f.tiers.length);
    const row = questList(r.state, 'feat').find((q) => q.id.startsWith('feat-pulls'))!;
    expect(row).toMatchObject({ id: featId('pulls', f.tiers.length - 1), claimed: true });
    expect(claimableCount(r.state)).toBe(0);
  });
});

describe('每週任務（T045）', () => {
  // NOW 是台北 2026-11-15（星期日）中午，這一週的星期一是 11-09
  const DAY = 24 * 3600_000;
  const TOWER_DONE = REGIONS.slice(0, 3).flatMap((r) => r.stages.map((x) => x.id));

  it('結算後記著這一週是哪一週', () => {
    expect(fresh().quests.weekly).toEqual({ week: '2026-11-09', counts: {}, claimed: [] });
  });

  it('出征、打贏、特訓、召募同時記在每日與每週；摸摸只記在每週', () => {
    let st = countQuest(countQuest(fresh(), 'battle', 3), 'win', 2);
    st = countQuest(countQuest(st, 'drill'), 'pull', 10);
    st = countQuest(st, 'pet', 4);
    expect(st.quests.weekly.counts).toEqual({ battle: 3, win: 2, drill: 1, pull: 10, pet: 4 });
    expect(st.quests.daily.counts).toEqual({ battle: 3, win: 2, drill: 1, pull: 10 });
    expect(find(st, 'weekly-battle')).toMatchObject({ progress: 3, target: 30, done: false });
    expect(find(st, 'weekly-pull')).toMatchObject({ progress: 10, done: true });
    expect(find(st, 'weekly-pet')).toMatchObject({ progress: 4, target: 10, go: 'HomeScene' });
  });

  it('換日不清每週的次數，換週（星期一 05:00）才清', () => {
    let st = countQuest(fresh(), 'battle', 30);
    st = claimQuest(st, 'weekly-battle').state;
    expect(st.quests.weekly.claimed).toEqual(['weekly-battle']);
    // 星期日 → 星期一 04:00 還是同一週（NOW 是台北中午，往後 16 小時）
    const sameWeek = settle(st, NOW + 16 * 3600_000, O);
    expect(sameWeek.quests.weekly).toBe(st.quests.weekly);
    const nextWeek = settle(st, NOW + 18 * 3600_000, O);
    expect(nextWeek.quests.weekly).toEqual({ week: '2026-11-16', counts: {}, claimed: [] });
    // 手機時間調回上一週：不重置
    expect(settle(nextWeek, NOW - 7 * DAY, O).quests.weekly).toBe(nextWeek.quests.weekly);
  });

  it('領每日的加碼任務算「完成每日任務」一天', () => {
    // 從星期五開始，隔天星期六還在同一週
    const FRI = NOW - 2 * DAY;
    let st = settle(createInitialState(FRI), FRI, O);
    st = countQuest(countQuest(countQuest(st, 'battle', 3), 'win', 2), 'pull');
    expect(find(st, 'weekly-days')).toMatchObject({ progress: 0, target: 5 });
    expect(find(st, 'weekly-days').go).toBeUndefined();
    st = claimQuest(st, 'daily-battle').state;
    expect(st.quests.weekly.counts.days).toBeUndefined();
    st = claimQuest(st, DAILY_BONUS.id).state;
    expect(st.quests.weekly.counts.days).toBe(1);
    // 隔天再做完一次
    st = settle(st, FRI + DAY, O);
    st = countQuest(countQuest(countQuest(st, 'battle', 3), 'win', 2), 'pull');
    st = claimAll(st, 'daily').state;
    expect(find(st, 'weekly-days')).toMatchObject({ progress: 2 });
  });

  it('登天塔還沒開放不列那一個；開放後看這週爬到第幾層', () => {
    const base = fresh();
    expect(questList(base, 'weekly').map((q) => q.id)).not.toContain('weekly-tower');
    expect(questList(base, 'weekly')).toHaveLength(WEEKLY_QUESTS.length);
    const open = { ...base, cleared: TOWER_DONE };
    expect(questList(open, 'weekly')).toHaveLength(WEEKLY_QUESTS.length + 1);
    expect(find(open, 'weekly-tower')).toMatchObject({ progress: 0, target: 10, go: 'TowerScene' });
    const climbed = { ...open, tower: { ...open.tower, week: '2026-11-09', floor: 12 } };
    expect(find(climbed, 'weekly-tower')).toMatchObject({ progress: 10, done: true });
    // 塔的進度是上週的：這週還沒爬，不算
    const stale = { ...open, tower: { ...open.tower, week: '2026-11-02', floor: 40 } };
    expect(find(stale, 'weekly-tower')).toMatchObject({ progress: 0, done: false });
  });

  it('糧草獎勵跟著章節變多；完成 5 個有加碼獎勵', () => {
    let st: GameState = { ...fresh(), cleared: REGIONS[0].stages.map((x) => x.id) };
    expect(find(st, 'weekly-battle').reward).toEqual({ food: 2000, bones: 20 });
    for (const c of ['battle', 'win', 'drill', 'pull'] as const) st = countQuest(st, c, 30);
    expect(find(st, WEEKLY_BONUS.id)).toMatchObject({ progress: 4, target: 5, done: false });
    st = countQuest(st, 'pet', 10);
    expect(find(st, WEEKLY_BONUS.id)).toMatchObject({ progress: 5, done: true });
    const before = st.resources;
    const r = claimAll(st, 'weekly');
    expect(r.count).toBe(6);
    expect(r.reward.bones).toBe(20 + 20 + 10 + 30 + 20 + WEEKLY_BONUS.bones);
    expect(r.state.resources.bones).toBe(before.bones + r.reward.bones);
    expect(claimableCount(r.state, 'weekly')).toBe(0);
    // 領過的不能再領
    expect(claimQuest(r.state, 'weekly-battle').reward).toBeNull();
  });

  it('每週任務存得進去、讀得回來', () => {
    let st = countQuest(countQuest(fresh(), 'pet', 10), 'battle', 5);
    st = claimQuest(st, 'weekly-pet').state;
    const back = deserialize(serialize(st, NOW), NOW).state;
    expect(back.quests.weekly).toEqual(st.quests.weekly);
  });
});

describe('存檔', () => {
  it('任務欄位存得進去、讀得回來', () => {
    let st = countQuest(countQuest(fresh(), 'battle', 3), 'win', 2);
    st = claimQuest(st, 'daily-battle').state;
    st = claimQuest({ ...st, gacha: { pulls: 10, sinceSSR: 0 } }, 'feat-pulls-1').state;
    const back = deserialize(serialize(st, NOW), NOW).state;
    expect(back.quests).toEqual(st.quests);
  });

  it('舊存檔沒有任務欄位：補預設值，累計勝場用通關數起算', () => {
    const st = { ...fresh(), cleared: ['luoyepo-1', 'luoyepo-2'] };
    const file = JSON.parse(serialize(st, NOW));
    delete file.state.quests;
    const back = deserialize(JSON.stringify(file), NOW);
    expect(back.status).toBe('ok');
    expect(back.state.quests).toEqual({
      claimed: [],
      wins: 2,
      daily: { counts: {}, claimed: [] },
      weekly: { week: '', counts: {}, claimed: [] },
    });
  });

  it('怪怪的內容整理掉：認不得的 id、負數、重複', () => {
    expect(
      sanitizeQuests(
        {
          claimed: ['main-luoyepo-mid', 'main-luoyepo-mid', 'nope', 5, 'daily-battle'],
          wins: -3,
          daily: {
            counts: { battle: 2.7, win: -1, fly: 9 },
            claimed: ['daily-win', 'feat-runs-1'],
          },
          weekly: {
            week: 'last week',
            counts: { battle: 12.9, pet: 4, days: -2, tower: 9, fly: 1 },
            claimed: ['weekly-pet', 'weekly-pet', 'daily-win', 7],
          },
        },
        4,
      ),
    ).toEqual({
      claimed: ['main-luoyepo-mid'],
      wins: 4,
      daily: { counts: { battle: 2 }, claimed: ['daily-win'] },
      weekly: { week: '', counts: { battle: 12, pet: 4 }, claimed: ['weekly-pet'] },
    });
    expect(
      sanitizeQuests({ weekly: { week: '2026-11-09', counts: { days: 3 }, claimed: [] } }, 0)
        .weekly,
    ).toEqual({ week: '2026-11-09', counts: { days: 3 }, claimed: [] });
    expect(sanitizeQuests('x', 0)).toEqual({
      claimed: [],
      wins: 0,
      daily: { counts: {}, claimed: [] },
      weekly: { week: '', counts: {}, claimed: [] },
    });
  });
});

describe('獎勵文字', () => {
  it('只寫有的資源，加千分位', () => {
    expect(rewardText({ food: 1500, bones: 60 })).toBe('糧草 1,500・骨頭幣 60');
    expect(rewardText({ food: 0, bones: 30 })).toBe('骨頭幣 30');
  });
});
