import { findDog } from '../data/dogs';
import { REGIONS } from '../data/regions';
import type { FrisbeeState, GameState } from '../state/gameState';
import { createRng } from './battle';
import { boardingStage } from './boarding';
import { addExp, levelCapOf, progressOf, stageExp, sumUps, type DogExpGain } from './leveling';
import { addSnacks, snackDrop, type SnackId } from './snacks';
import { dayKey, type TimeOptions } from './stamina';

/**
 * 訓練場每日小遊戲「接飛盤」（T022）：飛盤一個一個丟出來，
 * 手指按著左右滑（或移動滑鼠）帶狗狗跑到落點就接到，不用一直點。
 * 每天第一次玩有獎勵（05:00 換日），之後可以再玩但沒有獎勵。
 * 全部是純函式；時間、亂數由呼叫端傳入。
 */

/** 一場丟幾個飛盤 */
export const FRISBEE_COUNT = 8;
/** 開始後多久丟第一個、之後每隔多久丟一個（毫秒） */
export const FRISBEE_FIRST_MS = 900;
export const FRISBEE_GAP_MS = 1900;
/** 飛盤在空中飛多久：第一個最慢，最後一個最快 */
export const FRISBEE_FLIGHT_MS = { first: 1700, last: 1350 } as const;
/** 落點離場地左右邊緣至少多遠（場地寬度的比例） */
export const FRISBEE_EDGE = 0.1;
/** 相鄰兩個落點最多差多遠（場地寬度的比例），確保跑得到 */
export const FRISBEE_MAX_STEP = 0.5;
/** 相鄰兩個落點至少差多遠，免得站著不動就一直接到 */
export const FRISBEE_MIN_STEP = 0.15;
/** 狗狗一秒跑多遠（場地寬度的比例） */
export const FRISBEE_DOG_SPEED = 0.7;
/** 落地時狗狗離落點多近算接到（場地寬度的比例） */
export const FRISBEE_REACH = 0.065;
/** 飛盤最高飛到多高（場地高度的比例，0 是接的高度、1 是場地頂端） */
export const FRISBEE_ARC = 0.82;

/** 獎勵：參加就有「最高已通關關卡經驗」的 BASE 倍，每接到一個再加 PER_CATCH 倍 */
export const FRISBEE_EXP_BASE = 0.5;
export const FRISBEE_EXP_PER_CATCH = 0.15;

/** 一個飛盤：什麼時候丟、飛多久、從哪一邊丟、落在哪裡 */
export interface FrisbeeThrow {
  /** 開始後第幾毫秒丟出 */
  at: number;
  /** 飛多久落地 */
  flight: number;
  /** 從左邊（0）還是右邊（1）丟進來 */
  from: 0 | 1;
  /** 落點（場地寬度的比例，0～1） */
  landX: number;
}

/** 這一場的飛盤怎麼丟；同一個種子結果一樣 */
export function frisbeePlan(seed: number, count: number = FRISBEE_COUNT): FrisbeeThrow[] {
  const rng = createRng(seed);
  const lo = FRISBEE_EDGE;
  const hi = 1 - FRISBEE_EDGE;
  const out: FrisbeeThrow[] = [];
  // 狗狗從場地中間出發
  let prev = 0.5;
  for (let i = 0; i < count; i++) {
    let landX = prev;
    for (let tries = 0; tries < 20; tries++) {
      landX = lo + rng() * (hi - lo);
      const step = Math.abs(landX - prev);
      if (step >= FRISBEE_MIN_STEP && step <= FRISBEE_MAX_STEP) break;
      // 試了很多次都不合：往場地比較空的那一邊挪一步
      if (tries === 19) landX = prev < 0.5 ? prev + FRISBEE_MIN_STEP : prev - FRISBEE_MIN_STEP;
    }
    const k = count <= 1 ? 0 : i / (count - 1);
    out.push({
      at: FRISBEE_FIRST_MS + i * FRISBEE_GAP_MS,
      flight: Math.round(
        FRISBEE_FLIGHT_MS.first + (FRISBEE_FLIGHT_MS.last - FRISBEE_FLIGHT_MS.first) * k,
      ),
      from: rng() < 0.5 ? 0 : 1,
      landX,
    });
    prev = landX;
  }
  return out;
}

/** 整場多久結束（最後一個飛盤落地） */
export function frisbeeDuration(plan: readonly FrisbeeThrow[]): number {
  const last = plan[plan.length - 1];
  return last ? last.at + last.flight : 0;
}

/**
 * 飛盤在開始後第 t 毫秒的位置：x 是場地寬度的比例（會從場外飛進來），
 * y 是高度的比例（0 是接的高度、越大越高）；還沒丟是 null；p 是飛了幾成（落地後是 1）。
 */
export function frisbeePos(
  th: FrisbeeThrow,
  t: number,
): { x: number; y: number; p: number } | null {
  if (t < th.at) return null;
  const p = Math.min(1, (t - th.at) / th.flight);
  if (p >= 1) return { x: th.landX, y: 0, p: 1 };
  const startX = th.from === 0 ? -0.08 : 1.08;
  // 從場邊半空中丟出，先往上再落下
  const startY = 0.35;
  const y = startY * (1 - p) + 4 * (FRISBEE_ARC - startY / 2) * p * (1 - p);
  return { x: startX + (th.landX - startX) * p, y: Math.max(0, y), p };
}

/** 狗狗往目標跑 dt 毫秒後的位置（位置都是場地寬度的比例） */
export function moveDog(x: number, target: number, dt: number): number {
  const t = Math.min(1, Math.max(0, target));
  const step = (FRISBEE_DOG_SPEED * Math.max(0, dt)) / 1000;
  if (Math.abs(t - x) <= step) return t;
  return x + Math.sign(t - x) * step;
}

/** 落地當下狗狗在 dogX，有沒有接到 */
export function frisbeeCaught(th: Pick<FrisbeeThrow, 'landX'>, dogX: number): boolean {
  return Math.abs(dogX - th.landX) <= FRISBEE_REACH + 1e-9;
}

type FrisbeeFields = Pick<GameState, 'frisbee'>;

/** 今天還能不能拿獎勵（每天第一次玩才有） */
export function frisbeeReady(state: FrisbeeFields, now: number, o?: TimeOptions): boolean {
  return state.frisbee.day !== dayKey(now, o);
}

/** 接到 catches 個可以拿多少經驗；全部接到再送一個零食 */
export function frisbeeReward(
  state: Pick<GameState, 'cleared'>,
  catches: number,
  total: number = FRISBEE_COUNT,
): { exp: number; snack: { id: SnackId; amount: number } | null } {
  const stage = boardingStage(state);
  const n = Math.min(total, Math.max(0, Math.floor(catches)));
  const exp = Math.max(
    1,
    Math.round(stageExp(stage) * (FRISBEE_EXP_BASE + FRISBEE_EXP_PER_CATCH * n)),
  );
  const chapter = REGIONS.findIndex((r) => r.stages.some((s) => s.id === stage.id)) + 1;
  return { exp, snack: n >= total ? snackDrop(Math.max(1, chapter), false) : null };
}

/** 預設讓誰上場：主頁那隻；牠滿級了就換一隻還能拿經驗的 */
export function frisbeeDefaultDog(state: Pick<GameState, 'owned' | 'dogs' | 'lobbyDogId'>): string {
  const canGrow = (id: string): boolean => {
    const d = findDog(id);
    if (!d) return false;
    const p = progressOf(state, d);
    return p.level < levelCapOf(p);
  };
  const ids = state.owned.filter((id) => !!findDog(id));
  if (ids.includes(state.lobbyDogId) && canGrow(state.lobbyDogId)) return state.lobbyDogId;
  return ids.find(canGrow) ?? (ids.includes(state.lobbyDogId) ? state.lobbyDogId : ids[0]);
}

export interface FrisbeeResult {
  catches: number;
  total: number;
  /** 這一場有沒有獎勵（今天第一次才有） */
  rewarded: boolean;
  /** 是不是刷新了最佳紀錄 */
  newBest: boolean;
  gain: DogExpGain | null;
  snack: { id: SnackId; amount: number } | null;
}

/**
 * 玩完結算：今天第一次玩就把經驗給上場的狗、全部接到再送零食，並記下今天玩過了；
 * 不是第一次只更新最佳紀錄。
 */
export function finishFrisbee<
  S extends Pick<GameState, 'frisbee' | 'owned' | 'dogs' | 'cleared' | 'snacks'>,
>(
  state: S,
  dogId: string,
  catches: number,
  now: number,
  rng: () => number,
  o?: TimeOptions,
  total: number = FRISBEE_COUNT,
): { state: S; result: FrisbeeResult } {
  const n = Math.min(total, Math.max(0, Math.floor(catches)));
  const newBest = n > state.frisbee.best;
  const best = Math.max(state.frisbee.best, n);
  const dog = findDog(dogId);
  if (!frisbeeReady(state, now, o) || !dog || !state.owned.includes(dogId)) {
    return {
      state: newBest ? { ...state, frisbee: { ...state.frisbee, best } } : state,
      result: { catches: n, total, rewarded: false, newBest, gain: null, snack: null },
    };
  }
  const reward = frisbeeReward(state, n, total);
  const before = progressOf(state, dog);
  const r = addExp(before, dog.role, reward.exp, rng, dog.rarity);
  let next: S = {
    ...state,
    dogs: { ...state.dogs, [dogId]: r.progress },
    frisbee: { day: dayKey(now, o), best },
  };
  if (reward.snack) next = addSnacks(next, reward.snack.id, reward.snack.amount);
  return {
    state: next,
    result: {
      catches: n,
      total,
      rewarded: true,
      newBest,
      gain: {
        dogId,
        exp: r.gained,
        fromLevel: before.level,
        toLevel: r.progress.level,
        ...sumUps(r.ups),
      },
      snack: reward.snack,
    },
  };
}

/** 結算的評語 */
export function frisbeeComment(catches: number, total: number = FRISBEE_COUNT): string {
  if (catches >= total) return '全部接到，太厲害了！';
  if (catches >= total * 0.6) return '接得不錯，尾巴搖個不停';
  if (catches > 0) return '有接到幾個，明天再來';
  return '一個都沒接到，但跑得很開心';
}

/** 讀檔時檢查：日期要是字串、最佳紀錄 0～一場的個數 */
export function sanitizeFrisbee(raw: unknown): FrisbeeState {
  if (typeof raw !== 'object' || raw === null) return { day: '', best: 0 };
  const v = raw as Record<string, unknown>;
  const day = typeof v.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.day) ? v.day : '';
  const best =
    typeof v.best === 'number' && Number.isFinite(v.best)
      ? Math.min(FRISBEE_COUNT, Math.max(0, Math.floor(v.best)))
      : 0;
  return { day, best };
}
