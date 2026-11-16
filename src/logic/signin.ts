import { REGIONS } from '../data/regions';
import type { Resources } from '../data/resources';
import type { GameState, SigninState } from '../state/gameState';
import { currentChapterIndex } from './progress';
import { rewardText } from './quests';
import { addSnacks, snackDrop, snackLabel, type SnackId } from './snacks';
import { dayKey, type TimeOptions } from './stamina';

/**
 * 七日簽到（T026）：主頁「獎勵」進來，每天領一次，七天一輪，領完第 7 天從第 1 天再來。
 * 全部是純函式。
 *
 * - 換日跟體力、每日任務一樣是當地 05:00。
 * - 漏簽不會歸零：哪天沒來，下次來接著領下一格。
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
}

/** 第 1～7 天的獎勵；第 7 天是大獎 */
export const SIGNIN_TABLE: readonly SigninDef[] = [
  { foodPerChapter: 300, bones: 0, snacks: 0 },
  { foodPerChapter: 0, bones: 20, snacks: 0 },
  { foodPerChapter: 0, bones: 0, snacks: 3 },
  { foodPerChapter: 500, bones: 0, snacks: 0 },
  { foodPerChapter: 0, bones: 30, snacks: 0 },
  { foodPerChapter: 0, bones: 0, snacks: 5 },
  { foodPerChapter: 1000, bones: 100, snacks: 5 },
];

/** 一天的獎勵：糧草、骨頭幣，有的天再加經驗零食 */
export interface SigninReward extends Resources {
  snack?: { id: SnackId; amount: number };
}

/** 第 index 格（0～6）在打到第 chapter 章時給什麼 */
export function signinReward(index: number, chapter: number): SigninReward {
  const def = SIGNIN_TABLE[((index % SIGNIN_DAYS) + SIGNIN_DAYS) % SIGNIN_DAYS];
  const ch = Math.max(1, Math.floor(chapter) || 1);
  const reward: SigninReward = { food: def.foodPerChapter * ch, bones: def.bones };
  if (def.snacks > 0) reward.snack = { id: snackDrop(ch, false).id, amount: def.snacks };
  return reward;
}

/** 獎勵的文字，例：「糧草 300・骨頭幣 100・小肉乾 ×5」 */
export function signinRewardText(r: SigninReward): string {
  const parts: string[] = [];
  const res = rewardText(r);
  if (res) parts.push(res);
  if (r.snack) parts.push(snackLabel(r.snack.id, r.snack.amount));
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
}

/**
 * 畫面上的七格。今天還沒領：前面領過的打勾、輪到的那格是「今天」。
 * 今天領過了：連同今天那格都打勾（第 7 天領完當天七格全勾，隔天才換新的一輪）。
 */
export function signinView(state: SigninFields, now: number, o?: TimeOptions): SigninView {
  const ready = signinReady(state, now, o);
  const total = state.signin.count;
  const index = ready
    ? total % SIGNIN_DAYS
    : (((total - 1) % SIGNIN_DAYS) + SIGNIN_DAYS) % SIGNIN_DAYS;
  const claimed = ready ? index : total > 0 ? index + 1 : 0;
  const chapter = chapterOf(state);
  const cells: SigninCell[] = SIGNIN_TABLE.map((_, i) => ({
    day: i + 1,
    reward: signinReward(i, chapter),
    status: i < claimed ? 'claimed' : ready && i === index ? 'today' : 'later',
  }));
  return { cells, ready, index, total };
}

type ClaimFields = SigninFields & Pick<GameState, 'resources' | 'snacks'>;

/** 簽到領今天的獎勵。今天領過了就原封不動回傳、reward 為 null */
export function claimSignin<S extends ClaimFields>(
  state: S,
  now: number,
  o?: TimeOptions,
): { state: S; reward: SigninReward | null; day: number } {
  if (!signinReady(state, now, o)) return { state, reward: null, day: 0 };
  const index = state.signin.count % SIGNIN_DAYS;
  const reward = signinReward(index, chapterOf(state));
  let next: S = {
    ...state,
    signin: { day: dayKey(now, o), count: state.signin.count + 1 },
    resources: {
      food: state.resources.food + reward.food,
      bones: state.resources.bones + reward.bones,
    },
  };
  if (reward.snack) next = addSnacks(next, reward.snack.id, reward.snack.amount);
  return { state: next, reward, day: index + 1 };
}

/** 讀檔時檢查：日期要是 yyyy-mm-dd、次數是 0 以上的整數；舊存檔沒有這個欄位就從頭開始 */
export function sanitizeSignin(raw: unknown): SigninState {
  if (typeof raw !== 'object' || raw === null) return { day: '', count: 0 };
  const v = raw as Record<string, unknown>;
  const day = typeof v.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.day) ? v.day : '';
  const count =
    typeof v.count === 'number' && Number.isFinite(v.count) ? Math.max(0, Math.floor(v.count)) : 0;
  // 有領過的日期就至少領過一次
  return { day, count: day && count === 0 ? 1 : count };
}
