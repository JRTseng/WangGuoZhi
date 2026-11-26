import { wt } from '../data/worldText';
import { ALL_GEARS } from '../data/equipment';
import { REGIONS } from '../data/regions';
import type { Resources } from '../data/resources';
import type {
  DailyCounter,
  GameState,
  QuestState,
  WeeklyCounter,
  WeeklyQuestState,
} from '../state/gameState';
import { formatAmount } from './format';
import { starOf } from './leveling';
import { currentChapterIndex } from './progress';
import { towerOpen } from './tower';

/**
 * 任務（T011）。全部是純函式。
 *
 * 四種任務：
 * - 主線：跟著章節走，每章兩個（打到第 3 關、打倒頭目），進度直接看通關紀錄。
 * - 每日：出征、打贏、特訓、召募，加一個「完成 3 個每日任務」；每天 05:00 清空（跟著體力的換日）。
 * - 每週（T045）：目標比較大、獎勵比較多，每週一 05:00 清空（跟著登天塔的換週）。
 * - 成就：累計出征、勝場、狗狗數量、召募、升星、特訓、裝備、等級，各有好幾段，領完一段換下一段。
 *
 * 主線與成就的進度都是從別的欄位算出來的，所以舊存檔一打開就會照已有的進度顯示、可以直接領。
 */

export type QuestTab = 'main' | 'daily' | 'weekly' | 'feat';

export const QUEST_TABS: readonly QuestTab[] = ['main', 'daily', 'weekly', 'feat'];

export const QUEST_TAB_LABEL: Readonly<Record<QuestTab, string>> = {
  main: '主線',
  daily: '每日',
  weekly: '每週',
  feat: '成就',
};

/** 還沒完成的任務可以按「前往」去的畫面 */
export type QuestGo =
  'CampaignScene' | 'TrainingScene' | 'RecruitScene' | 'TowerScene' | 'HomeScene';

/** 畫面上的一列任務 */
export interface QuestView {
  id: string;
  tab: QuestTab;
  title: string;
  progress: number;
  target: number;
  /** 條件達成了（不管領了沒） */
  done: boolean;
  claimed: boolean;
  reward: Resources;
  go?: QuestGo;
}

type QuestFields = Pick<
  GameState,
  'cleared' | 'owned' | 'dogs' | 'gear' | 'gacha' | 'nextExpeditionNo' | 'quests'
> &
  // 每週的「登天塔爬到第幾層」直接看塔的進度；沒給（舊的呼叫端、測試）就當這週還沒爬
  Partial<Pick<GameState, 'tower'>>;

// ---- 主線 ----

/** 每章的中途任務看第幾關（從 1 算） */
export const MAIN_MID_STAGE = 3;

interface MainDef {
  id: string;
  title: string;
  /** 要通過的關卡；進度顯示這一章打到第幾關 */
  stageIds: string[];
  reward: Resources;
}

/** 主線任務：每章「打到第 3 關」與「打倒頭目」，獎勵和那一關的過關獎勵一樣多（等於首次通過多拿一份） */
export const MAIN_QUESTS: readonly MainDef[] = REGIONS.flatMap((r) => {
  const mid = r.stages[MAIN_MID_STAGE - 1];
  const last = r.stages[r.stages.length - 1];
  const ids = r.stages.map((s) => s.id);
  return [
    {
      id: `main-${r.id}-mid`,
      title: `第 ${r.chapter} 章：通過「${mid.name}」`,
      stageIds: ids.slice(0, MAIN_MID_STAGE),
      reward: { ...mid.reward },
    },
    {
      id: `main-${r.id}-boss`,
      // 頭目的名字會跟著陣營換（T031），所以用到的時候才組
      get title() {
        return `第 ${r.chapter} 章：打倒${last.boss ? `頭目「${last.boss.name}」` : `「${last.name}」`}`;
      },
      stageIds: ids,
      reward: { ...last.reward },
    },
  ];
});

/** 主線分頁一次最多列幾個（還沒領的照順序排） */
export const MAIN_VISIBLE = 10;

// ---- 每日 ----

interface DailyDef {
  id: string;
  title: string;
  counter: DailyCounter;
  target: number;
  /** 糧草獎勵是「每章」的量：打到第幾章就乘幾倍，後面的章節才不會沒感覺 */
  foodPerChapter: number;
  bones: number;
  go: QuestGo;
}

export const DAILY_QUESTS: readonly DailyDef[] = [
  {
    id: 'daily-battle',
    title: '出征 3 次',
    counter: 'battle',
    target: 3,
    foodPerChapter: 300,
    bones: 0,
    go: 'CampaignScene',
  },
  {
    id: 'daily-win',
    title: '打贏 2 場',
    counter: 'win',
    target: 2,
    foodPerChapter: 300,
    bones: 0,
    go: 'CampaignScene',
  },
  {
    id: 'daily-drill',
    title: '專項特訓 3 次',
    counter: 'drill',
    target: 3,
    foodPerChapter: 200,
    bones: 0,
    go: 'TrainingScene',
  },
  {
    id: 'daily-pull',
    title: '召募 1 次',
    counter: 'pull',
    target: 1,
    foodPerChapter: 0,
    bones: 10,
    go: 'RecruitScene',
  },
];

/** 「完成幾個每日任務」的加碼任務：不用全部做完，特訓練滿的人也拿得到 */
export const DAILY_BONUS = { id: 'daily-all', target: 3, bones: 30 } as const;

// ---- 每週（T045） ----

interface WeeklyDef {
  id: string;
  title: string;
  /** 數哪一種事；'tower' 不用數，直接看這週登天塔爬到第幾層 */
  counter: WeeklyCounter | 'tower';
  target: number;
  /** 糧草獎勵是「每章」的量，和每日任務一樣打到第幾章就乘幾倍 */
  foodPerChapter: number;
  bones: number;
  go?: QuestGo;
}

export const WEEKLY_QUESTS: readonly WeeklyDef[] = [
  {
    id: 'weekly-battle',
    title: '這週出征 30 次',
    counter: 'battle',
    target: 30,
    foodPerChapter: 1000,
    bones: 20,
    go: 'CampaignScene',
  },
  {
    id: 'weekly-win',
    title: '這週打贏 20 場',
    counter: 'win',
    target: 20,
    foodPerChapter: 1000,
    bones: 20,
    go: 'CampaignScene',
  },
  {
    id: 'weekly-drill',
    title: '這週專項特訓 15 次',
    counter: 'drill',
    target: 15,
    foodPerChapter: 800,
    bones: 10,
    go: 'TrainingScene',
  },
  {
    id: 'weekly-pull',
    title: '這週召募 10 次',
    counter: 'pull',
    target: 10,
    foodPerChapter: 0,
    bones: 30,
    go: 'RecruitScene',
  },
  {
    id: 'weekly-pet',
    title: '這週摸摸角色 10 次',
    counter: 'pet',
    target: 10,
    foodPerChapter: 0,
    bones: 20,
    go: 'HomeScene',
  },
  {
    id: 'weekly-days',
    title: '這週有 5 天完成每日任務',
    counter: 'days',
    target: 5,
    foodPerChapter: 0,
    bones: 50,
  },
  {
    id: 'weekly-tower',
    title: '這週登天塔爬到第 10 層',
    counter: 'tower',
    target: 10,
    foodPerChapter: 0,
    bones: 40,
    go: 'TowerScene',
  },
];

/** 「完成幾個每週任務」的加碼任務：不用全部做完 */
export const WEEKLY_BONUS = { id: 'weekly-all', target: 5, bones: 100 } as const;

/** 這一週的每週任務紀錄；存檔還沒有這個欄位（舊的測試資料）就當空的 */
const weeklyOf = (s: Pick<GameState, 'quests'>): WeeklyQuestState =>
  s.quests.weekly ?? { week: '', counts: {}, claimed: [] };

// ---- 成就 ----

interface FeatDef {
  key: string;
  /** 標題，{n} 換成這一段的目標 */
  title: string;
  tiers: readonly number[];
  value: (s: QuestFields) => number;
}

const sumDogs = (s: QuestFields, f: (p: GameState['dogs'][string]) => number): number =>
  s.owned.reduce((n, id) => n + (s.dogs[id] ? f(s.dogs[id]) : 0), 0);

export const FEATS: readonly FeatDef[] = [
  {
    key: 'runs',
    title: '累計出征 {n} 次',
    tiers: [10, 50, 150, 400, 1000],
    value: (s) => s.nextExpeditionNo - 1,
  },
  {
    key: 'wins',
    title: '累計打贏 {n} 場',
    tiers: [10, 50, 150, 400, 1000],
    value: (s) => s.quests.wins,
  },
  {
    key: 'dogs',
    title: '擁有 {n} 隻狗狗',
    tiers: [8, 12, 16, 20, 25, 30],
    value: (s) => s.owned.length,
  },
  {
    key: 'pulls',
    title: '累計召募 {n} 次',
    tiers: [10, 50, 100, 300],
    value: (s) => s.gacha.pulls,
  },
  {
    key: 'stars',
    title: '狗狗升星合計 {n} 次',
    tiers: [1, 5, 15, 30],
    value: (s) => sumDogs(s, (p) => starOf(p) - 1),
  },
  {
    key: 'drills',
    title: '專項特訓合計 {n} 次',
    tiers: [10, 50, 150, 300],
    value: (s) => sumDogs(s, (p) => (p.drillAttack ?? 0) + (p.drillDefense ?? 0)),
  },
  {
    key: 'gear',
    title: '收集 {n} 種裝備',
    tiers: [5, 10, 20, 30],
    value: (s) => ALL_GEARS.filter((g) => (s.gear[g.id] ?? 0) > 0).length,
  },
  {
    key: 'level',
    title: '有狗狗升到 {n} 級',
    tiers: [10, 20, 40, 60, 80, 100],
    value: (s) => Math.max(0, ...s.owned.map((id) => s.dogs[id]?.level ?? 0)),
  },
];

/** 成就第 tier 段（從 0 算）的獎勵：越後面越多 */
export function featReward(tier: number): Resources {
  return { food: 500 * (tier + 1), bones: 20 * (tier + 1) };
}

export const featId = (key: string, tier: number): string => `feat-${key}-${tier + 1}`;

/** 會記在 quests.claimed 裡的 id（主線＋成就每一段） */
export const LASTING_QUEST_IDS: ReadonlySet<string> = new Set([
  ...MAIN_QUESTS.map((q) => q.id),
  ...FEATS.flatMap((f) => f.tiers.map((_, i) => featId(f.key, i))),
]);

/** 會記在 quests.daily.claimed 裡的 id */
export const DAILY_QUEST_IDS: ReadonlySet<string> = new Set([
  ...DAILY_QUESTS.map((q) => q.id),
  DAILY_BONUS.id,
]);

/** 會記在 quests.weekly.claimed 裡的 id */
export const WEEKLY_QUEST_IDS: ReadonlySet<string> = new Set([
  ...WEEKLY_QUESTS.map((q) => q.id),
  WEEKLY_BONUS.id,
]);

// ---- 列表 ----

function mainViews(s: QuestFields): QuestView[] {
  return MAIN_QUESTS.filter((q) => !s.quests.claimed.includes(q.id))
    .slice(0, MAIN_VISIBLE)
    .map((q) => {
      const progress = q.stageIds.filter((id) => s.cleared.includes(id)).length;
      const done = progress >= q.stageIds.length;
      return {
        id: q.id,
        tab: 'main',
        title: q.title,
        progress,
        target: q.stageIds.length,
        done,
        claimed: false,
        reward: q.reward,
        ...(done ? {} : { go: 'CampaignScene' as const }),
      };
    });
}

function dailyViews(s: QuestFields): QuestView[] {
  const chapter = REGIONS[currentChapterIndex(s)]?.chapter ?? 1;
  const d = s.quests.daily;
  const rows: QuestView[] = DAILY_QUESTS.map((q) => {
    const progress = Math.min(q.target, d.counts[q.counter] ?? 0);
    const done = progress >= q.target;
    return {
      id: q.id,
      tab: 'daily',
      title: q.title,
      progress,
      target: q.target,
      done,
      claimed: d.claimed.includes(q.id),
      reward: { food: q.foodPerChapter * chapter, bones: q.bones },
      ...(done ? {} : { go: q.go }),
    };
  });
  const finished = Math.min(DAILY_BONUS.target, rows.filter((r) => r.done).length);
  rows.push({
    id: DAILY_BONUS.id,
    tab: 'daily',
    title: `完成 ${DAILY_BONUS.target} 個每日任務`,
    progress: finished,
    target: DAILY_BONUS.target,
    done: finished >= DAILY_BONUS.target,
    claimed: d.claimed.includes(DAILY_BONUS.id),
    reward: { food: 0, bones: DAILY_BONUS.bones },
  });
  return rows;
}

function weeklyViews(s: QuestFields): QuestView[] {
  const chapter = REGIONS[currentChapterIndex(s)]?.chapter ?? 1;
  const w = weeklyOf(s);
  // 登天塔還沒開放（第三章頭目之後）就先不列那一個
  const defs = WEEKLY_QUESTS.filter((q) => q.counter !== 'tower' || towerOpen(s));
  const rows: QuestView[] = defs.map((q) => {
    const value =
      q.counter === 'tower'
        ? s.tower && s.tower.week === w.week
          ? s.tower.floor
          : 0
        : (w.counts[q.counter] ?? 0);
    const progress = Math.min(q.target, value);
    const done = progress >= q.target;
    return {
      id: q.id,
      tab: 'weekly',
      title: wt(q.title),
      progress,
      target: q.target,
      done,
      claimed: w.claimed.includes(q.id),
      reward: { food: q.foodPerChapter * chapter, bones: q.bones },
      ...(done || !q.go ? {} : { go: q.go }),
    };
  });
  const finished = Math.min(WEEKLY_BONUS.target, rows.filter((r) => r.done).length);
  rows.push({
    id: WEEKLY_BONUS.id,
    tab: 'weekly',
    title: `完成 ${WEEKLY_BONUS.target} 個每週任務`,
    progress: finished,
    target: WEEKLY_BONUS.target,
    done: finished >= WEEKLY_BONUS.target,
    claimed: w.claimed.includes(WEEKLY_BONUS.id),
    reward: { food: 0, bones: WEEKLY_BONUS.bones },
  });
  return rows;
}

function featViews(s: QuestFields): QuestView[] {
  return FEATS.map((f) => {
    const value = f.value(s);
    // 顯示第一段還沒領的；全部領完就停在最後一段
    let tier = f.tiers.findIndex((_, i) => !s.quests.claimed.includes(featId(f.key, i)));
    const allClaimed = tier < 0;
    if (allClaimed) tier = f.tiers.length - 1;
    const target = f.tiers[tier];
    return {
      id: featId(f.key, tier),
      tab: 'feat',
      title: wt(f.title).replace('{n}', String(target)),
      progress: Math.min(target, value),
      target,
      done: value >= target,
      claimed: allClaimed,
      reward: featReward(tier),
    };
  });
}

/** 某個分頁現在要列出來的任務 */
export function questList(state: QuestFields, tab: QuestTab): QuestView[] {
  if (tab === 'main') return mainViews(state);
  if (tab === 'daily') return dailyViews(state);
  return tab === 'weekly' ? weeklyViews(state) : featViews(state);
}

const canClaim = (q: QuestView): boolean => q.done && !q.claimed;

/** 某個分頁有幾個可以領的獎勵（沒給分頁就是全部） */
export function claimableCount(state: QuestFields, tab?: QuestTab): number {
  return (tab ? [tab] : QUEST_TABS).reduce(
    (n, t) => n + questList(state, t).filter(canClaim).length,
    0,
  );
}

/** 主線總共幾個、領了幾個（分頁標題用） */
export function mainProgress(state: Pick<GameState, 'quests'>): { claimed: number; total: number } {
  return {
    claimed: MAIN_QUESTS.filter((q) => state.quests.claimed.includes(q.id)).length,
    total: MAIN_QUESTS.length,
  };
}

// ---- 領獎與計數 ----

type ClaimFields = QuestFields & Pick<GameState, 'resources'>;

/** 領一個任務的獎勵。還沒完成、領過了、或不是現在列出來的任務，就原封不動回傳、reward 為 null */
export function claimQuest<S extends ClaimFields>(
  state: S,
  id: string,
): { state: S; reward: Resources | null } {
  const q = QUEST_TABS.flatMap((t) => questList(state, t)).find((x) => x.id === id);
  if (!q || !canClaim(q)) return { state, reward: null };
  let quests: QuestState;
  if (q.tab === 'daily') {
    quests = {
      ...state.quests,
      daily: { ...state.quests.daily, claimed: [...state.quests.daily.claimed, id] },
    };
  } else if (q.tab === 'weekly') {
    const w = weeklyOf(state);
    quests = { ...state.quests, weekly: { ...w, claimed: [...w.claimed, id] } };
  } else {
    quests = { ...state.quests, claimed: [...state.quests.claimed, id] };
  }
  // 領了每日的加碼任務＝今天的每日任務做完了，每週的「幾天做完每日任務」加一天
  const counted = id === DAILY_BONUS.id ? countQuest({ ...state, quests }, 'days') : null;
  if (counted) quests = counted.quests;
  return {
    state: {
      ...state,
      quests,
      resources: {
        food: state.resources.food + q.reward.food,
        bones: state.resources.bones + q.reward.bones,
      },
    },
    reward: q.reward,
  };
}

/**
 * 一鍵領取：把現在能領的全部領掉。成就領完一段、下一段也已經達成的話會接著領，
 * 所以回傳的 count 可能比按下去前看到的多。
 */
export function claimAll<S extends ClaimFields>(
  state: S,
  tab?: QuestTab,
): { state: S; reward: Resources; count: number } {
  const reward: Resources = { food: 0, bones: 0 };
  let count = 0;
  let cur = state;
  for (;;) {
    const next = (tab ? [tab] : QUEST_TABS).flatMap((t) => questList(cur, t)).find(canClaim);
    if (!next) break;
    const r = claimQuest(cur, next.id);
    if (!r.reward) break;
    cur = r.state;
    reward.food += r.reward.food;
    reward.bones += r.reward.bones;
    count++;
  }
  return { state: cur, reward, count };
}

const DAILY_COUNTERS: readonly DailyCounter[] = ['battle', 'win', 'drill', 'pull'];
const WEEKLY_COUNTERS: readonly WeeklyCounter[] = [...DAILY_COUNTERS, 'pet', 'days'];

/**
 * 記一次任務會數的事：出征、打贏、特訓、召募同時記在每日與每週，
 * 摸摸角色（pet）與「每日任務做完的天數」（days）只記在每週。打贏同時加累計勝場。n 是 0 就不動
 */
export function countQuest<S extends Pick<GameState, 'quests'>>(
  state: S,
  counter: WeeklyCounter,
  n = 1,
): S {
  if (!(n > 0)) return state;
  const q = state.quests;
  const w = weeklyOf(state);
  const isDaily = (DAILY_COUNTERS as readonly string[]).includes(counter);
  return {
    ...state,
    quests: {
      ...q,
      wins: q.wins + (counter === 'win' ? n : 0),
      daily: isDaily
        ? {
            ...q.daily,
            counts: {
              ...q.daily.counts,
              [counter]: (q.daily.counts[counter as DailyCounter] ?? 0) + n,
            },
          }
        : q.daily,
      weekly: { ...w, counts: { ...w.counts, [counter]: (w.counts[counter] ?? 0) + n } },
    },
  };
}

/** 獎勵的文字，例：「糧草 300・骨頭幣 10」 */
export function rewardText(r: Resources): string {
  const parts: string[] = [];
  if (r.food > 0) parts.push(`糧草 ${formatAmount(r.food)}`);
  if (r.bones > 0) parts.push(`骨頭幣 ${formatAmount(r.bones)}`);
  return parts.join('・');
}

// ---- 存檔 ----

/**
 * 讀檔時整理任務欄位：認不得的 id 丟掉。
 * 舊存檔沒有這個欄位：累計勝場先用「通過了幾關」起算（每一關至少贏過一場）。
 */
export function sanitizeQuests(raw: unknown, clearedCount: number): QuestState {
  const obj = (v: unknown): Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const ids = (v: unknown, known: ReadonlySet<string>): string[] =>
    Array.isArray(v)
      ? [...new Set(v.filter((x): x is string => typeof x === 'string' && known.has(x)))]
      : [];
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
  const r = obj(raw);
  const d = obj(r.daily);
  const rawCounts = obj(d.counts);
  const counts: QuestState['daily']['counts'] = {};
  for (const c of DAILY_COUNTERS) {
    const n = num(rawCounts[c]);
    if (n) counts[c] = n;
  }
  // 每週任務（T045）：舊存檔沒有這個欄位，從空的開始
  const w = obj(r.weekly);
  const rawWeekly = obj(w.counts);
  const weeklyCounts: WeeklyQuestState['counts'] = {};
  for (const c of WEEKLY_COUNTERS) {
    const n = num(rawWeekly[c]);
    if (n) weeklyCounts[c] = n;
  }
  const week = typeof w.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.week) ? w.week : '';
  return {
    claimed: ids(r.claimed, LASTING_QUEST_IDS),
    wins: num(r.wins) ?? clearedCount,
    daily: { counts, claimed: ids(d.claimed, DAILY_QUEST_IDS) },
    weekly: { week, counts: weeklyCounts, claimed: ids(w.claimed, WEEKLY_QUEST_IDS) },
  };
}
