import { DOGS, type DogData } from '../data/dogs';
import { REGIONS } from '../data/regions';
import type { Resources } from '../data/resources';
import type { GameState, SigninState } from '../state/gameState';
import { currentChapterIndex } from './progress';
import { rewardText } from './quests';
import { addSnacks, snackDrop, snackLabel, type SnackId } from './snacks';
import { dayKey, type TimeOptions } from './stamina';

/**
 * 七日簽到（T026）：主頁「獎勵」進來，每天領一次，連續簽七天一輪（一週），領完第 7 天從第 1 天再來。
 * 全部是純函式。
 *
 * - 換日跟體力、每日任務一樣是當地 05:00。
 * - 要連續簽（Jimmy 2026-11-17）：中間有一天沒來，這一輪就斷掉，下次來從第 1 天重新開始。
 * - 第 7 天送 SSR 碎片，哪一隻 SSR 由玩家自己選（`signin.pick`），可以先選好、領之前都能換。
 * - 每天第一次進主頁會自動跳出簽到畫面（`signinPopup`）。
 * - 糧草照打到第幾章加倍、零食照章節給（和過關掉的同一種），後面的章節才不會沒感覺。
 */

/** 一輪幾天 */
export const SIGNIN_DAYS = 7;

interface SigninDef {
  /** 糧草是「每章」的量：打到第幾章就乘幾倍 */
  foodPerChapter: number;
  bones: number;
  /** 經驗零食幾個（哪一種看章節） */
  snacks: number;
  /** 自選 SSR 狗的碎片幾個 */
  ssrShards?: number;
}

/** 第 7 天送幾個自選 SSR 碎片 */
export const SIGNIN_SSR_SHARDS = 15;

/** 第 1～7 天的獎勵；第 7 天是大獎 */
export const SIGNIN_TABLE: readonly SigninDef[] = [
  { foodPerChapter: 300, bones: 0, snacks: 0 },
  { foodPerChapter: 0, bones: 20, snacks: 0 },
  { foodPerChapter: 0, bones: 0, snacks: 3 },
  { foodPerChapter: 500, bones: 0, snacks: 0 },
  { foodPerChapter: 0, bones: 30, snacks: 0 },
  { foodPerChapter: 0, bones: 0, snacks: 5 },
  { foodPerChapter: 0, bones: 0, snacks: 0, ssrShards: SIGNIN_SSR_SHARDS },
];

/** 一天的獎勵：糧草、骨頭幣，有的天再加經驗零食 */
export interface SigninReward extends Resources {
  snack?: { id: SnackId; amount: number };
  /** 自選 SSR 碎片；dogId 是空字串表示還沒選 */
  shards?: { dogId: string; amount: number };
}

/** 第 7 天可以選哪些狗：所有 SSR，從狗的資料表現查（之後加新的 SSR 會自動出現） */
export function signinPickPool(): DogData[] {
  return DOGS.filter((d) => d.rarity === 'SSR');
}

const isPick = (dogId: unknown): dogId is string =>
  typeof dogId === 'string' && signinPickPool().some((d) => d.id === dogId);

/** 第 index 格（0～6）在打到第 chapter 章時給什麼；pick 是玩家選的 SSR 狗 */
export function signinReward(index: number, chapter: number, pick = ''): SigninReward {
  const def = SIGNIN_TABLE[((index % SIGNIN_DAYS) + SIGNIN_DAYS) % SIGNIN_DAYS];
  const ch = Math.max(1, Math.floor(chapter) || 1);
  const reward: SigninReward = { food: def.foodPerChapter * ch, bones: def.bones };
  if (def.snacks > 0) reward.snack = { id: snackDrop(ch, false).id, amount: def.snacks };
  if (def.ssrShards) reward.shards = { dogId: isPick(pick) ? pick : '', amount: def.ssrShards };
  return reward;
}

/** 獎勵的文字，例：「糧草 300・骨頭幣 100・小肉乾 ×5」「流星碎片 ×15」（還沒選是「SSR 碎片 ×15」） */
export function signinRewardText(r: SigninReward): string {
  const parts: string[] = [];
  const res = rewardText(r);
  if (res) parts.push(res);
  if (r.snack) parts.push(snackLabel(r.snack.id, r.snack.amount));
  if (r.shards) {
    const name = DOGS.find((d) => d.id === r.shards?.dogId)?.name ?? 'SSR ';
    parts.push(`${name}碎片 ×${r.shards.amount}`);
  }
  return parts.join('・');
}

type SigninFields = Pick<GameState, 'signin' | 'cleared'>;

const chapterOf = (state: Pick<GameState, 'cleared'>): number =>
  REGIONS[currentChapterIndex(state)]?.chapter ?? 1;

/**
 * 今天能不能簽到：今天還沒領過就可以。
 * 手機時間被調回過去（上次簽到的日期比今天還晚）不給領，免得來回調時間一直領。
 */
export function signinReady(
  state: Pick<GameState, 'signin'>,
  now: number,
  o?: TimeOptions,
): boolean {
  return state.signin.day < dayKey(now, o);
}

/** 遊戲日（yyyy-mm-dd）是第幾天，拿來算兩個日期差幾天 */
const dayNumber = (key: string): number => Math.round(Date.parse(`${key}T00:00:00Z`) / 86_400_000);

/**
 * 這一輪已經連續簽了幾格（0～7），算到「現在」為止：
 * - 今天簽過了：就是存檔記的格數（第 7 天領完當天是 7）。
 * - 昨天簽過、今天還沒：接著昨天的；昨天剛好領完第 7 天就是新的一輪，從 0 開始。
 * - 中間漏了一天以上：斷掉，從 0 開始。
 */
export function signinStreak(
  state: Pick<GameState, 'signin'>,
  now: number,
  o?: TimeOptions,
): number {
  const { day, streak } = state.signin;
  if (!day) return 0;
  const gap = dayNumber(dayKey(now, o)) - dayNumber(day);
  if (gap <= 0) return streak;
  if (gap === 1) return streak % SIGNIN_DAYS;
  return 0;
}

/** 這一輪是不是因為漏簽斷掉了（畫面上提醒一句用） */
export function signinBroken(
  state: Pick<GameState, 'signin'>,
  now: number,
  o?: TimeOptions,
): boolean {
  const { day, streak } = state.signin;
  if (!day || streak <= 0 || streak >= SIGNIN_DAYS) return false;
  return dayNumber(dayKey(now, o)) - dayNumber(day) > 1;
}

export type SigninCellStatus = 'claimed' | 'today' | 'later';

export interface SigninCell {
  /** 第幾天（1～7） */
  day: number;
  reward: SigninReward;
  status: SigninCellStatus;
}

export interface SigninView {
  cells: SigninCell[];
  /** 今天還能不能領 */
  ready: boolean;
  /** 今天要領（或今天已經領了）的是第幾格，0～6 */
  index: number;
  /** 累計簽到幾天 */
  total: number;
  /** 上一輪因為漏簽斷掉，這次從第 1 天重新開始 */
  broken: boolean;
  /** 第 7 天選了哪隻 SSR 狗；空字串是還沒選 */
  pick: string;
}

/**
 * 畫面上的七格。今天還沒領：前面領過的打勾、輪到的那格是「今天」。
 * 今天領過了：連同今天那格都打勾（第 7 天領完當天七格全勾，隔天才換新的一輪）。
 */
export function signinView(state: SigninFields, now: number, o?: TimeOptions): SigninView {
  const ready = signinReady(state, now, o);
  const streak = signinStreak(state, now, o);
  const index = ready ? streak : Math.max(0, streak - 1);
  const chapter = chapterOf(state);
  const pick = isPick(state.signin.pick) ? state.signin.pick : '';
  const cells: SigninCell[] = SIGNIN_TABLE.map((_, i) => ({
    day: i + 1,
    reward: signinReward(i, chapter, pick),
    status: i < streak ? 'claimed' : ready && i === index ? 'today' : 'later',
  }));
  return {
    cells,
    ready,
    index,
    total: state.signin.count,
    broken: ready && signinBroken(state, now, o),
    pick,
  };
}

/** 設定第 7 天要哪隻 SSR 狗的碎片；不是 SSR 的狗不理會 */
export function setSigninPick<S extends Pick<GameState, 'signin'>>(state: S, dogId: string): S {
  if (!isPick(dogId) || state.signin.pick === dogId) return state;
  return { ...state, signin: { ...state.signin, pick: dogId } };
}

/** 每天第一次進主頁要不要自動跳出簽到：今天還沒簽、今天也還沒跳過 */
export function signinPopup(
  state: Pick<GameState, 'signin'>,
  now: number,
  o?: TimeOptions,
): boolean {
  return signinReady(state, now, o) && state.signin.shown !== dayKey(now, o);
}

/** 記下今天已經自動跳出過簽到，回主頁不會再跳 */
export function markSigninShown<S extends Pick<GameState, 'signin'>>(
  state: S,
  now: number,
  o?: TimeOptions,
): S {
  const today = dayKey(now, o);
  if (state.signin.shown === today) return state;
  return { ...state, signin: { ...state.signin, shown: today } };
}

/** 網址加 ?signin=0 可以關掉自動跳出（畫面測試用，免得每個測試一進主頁就被帶走） */
export function signinPopupFromSearch(search: string): boolean {
  const v = new URLSearchParams(search).get('signin');
  return v !== '0' && v !== 'false';
}

type ClaimFields = SigninFields & Pick<GameState, 'resources' | 'snacks' | 'shards'>;

/**
 * 簽到領今天的獎勵。今天領過了就原封不動回傳、reward 為 null。
 * 輪到第 7 天但還沒選 SSR 狗：也不動，needPick 為 true，畫面要先讓玩家選。
 */
export function claimSignin<S extends ClaimFields>(
  state: S,
  now: number,
  o?: TimeOptions,
): { state: S; reward: SigninReward | null; day: number; needPick?: boolean } {
  if (!signinReady(state, now, o)) return { state, reward: null, day: 0 };
  const index = signinStreak(state, now, o);
  const reward = signinReward(index, chapterOf(state), state.signin.pick);
  if (reward.shards && !reward.shards.dogId) {
    return { state, reward: null, day: index + 1, needPick: true };
  }
  let next: S = {
    ...state,
    signin: {
      ...state.signin,
      day: dayKey(now, o),
      count: state.signin.count + 1,
      streak: index + 1,
    },
    resources: {
      food: state.resources.food + reward.food,
      bones: state.resources.bones + reward.bones,
    },
  };
  if (reward.snack) next = addSnacks(next, reward.snack.id, reward.snack.amount);
  if (reward.shards) {
    const { dogId, amount } = reward.shards;
    next = { ...next, shards: { ...next.shards, [dogId]: (next.shards[dogId] ?? 0) + amount } };
  }
  return { state: next, reward, day: index + 1 };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 讀檔時檢查：日期要是 yyyy-mm-dd、次數是 0 以上的整數；舊存檔沒有這個欄位就從頭開始。
 * 改成連續簽之前的存檔沒有 streak：照累計天數換算成這一輪領到第幾格。
 */
export function sanitizeSignin(raw: unknown): SigninState {
  if (typeof raw !== 'object' || raw === null) {
    return { day: '', count: 0, streak: 0, pick: '', shown: '' };
  }
  const v = raw as Record<string, unknown>;
  const day = typeof v.day === 'string' && DAY_RE.test(v.day) ? v.day : '';
  const int = (x: unknown): number | null =>
    typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : null;
  // 有領過的日期就至少領過一次
  const count = Math.max(int(v.count) ?? 0, day ? 1 : 0);
  const fromCount = count === 0 ? 0 : ((count - 1) % SIGNIN_DAYS) + 1;
  const streak = day
    ? Math.min(SIGNIN_DAYS, Math.max(1, Math.min(count, int(v.streak) ?? fromCount)))
    : 0;
  return {
    day,
    count,
    streak,
    pick: isPick(v.pick) ? v.pick : '',
    shown: typeof v.shown === 'string' && DAY_RE.test(v.shown) ? v.shown : '',
  };
}
