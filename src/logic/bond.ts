import { findDog } from '../data/dogs';
import type { GameState, RatLoot } from '../state/gameState';
import { applyRatLoot, ratLootText } from './ratRaid';
import { findSnack, snackCount, type SnackId } from './snacks';
import { dayKey, type TimeOptions } from './stamina';

/**
 * 好感度（T042）：每個角色各自有一條好感度，0～10 級。全部是純函式。
 *
 * 怎麼漲：
 * - 在主頁摸摸主頁角色：每個角色一天一次 +10（再摸只是撒嬌，不會再加）
 * - 一起出征：打贏每隻上陣的 +3、打輸 +1（爬塔、老鼠幫、自動出征都算）
 * - 在「我的家」摸住在家裡的角色（和主頁算同一次）、送牠零食（T044）：
 *   小肉乾 +5、香烤肉排 +12、大骨頭 +30，每個角色一天最多收 3 次
 *
 * 升級的禮物當場自動入袋，不用另外按領取。好感度不影響攻防，純收集與獎勵。
 */

export interface BondState {
  /** 每個角色累積的好感度，以角色 id 為鍵；沒記的是 0 */
  points: Record<string, number>;
  /** petted 是哪一個遊戲日的（05:00 換日） */
  day: string;
  /** 今天摸過的角色 */
  petted: string[];
  /** 今天每個角色收了幾次零食（T044），和 petted 一起換日 */
  gifted: Record<string, number>;
}

export const EMPTY_BOND: BondState = { points: {}, day: '', petted: [], gifted: {} };

export const BOND = {
  /** 摸摸：每個角色一天一次 */
  pet: 10,
  /** 一起出征打贏／打輸，每隻上陣的角色 */
  win: 3,
  lose: 1,
} as const;

/** 升到第 n 級要累積多少好感度（索引 = 等級，第 0 級是 0） */
export const BOND_NEED: readonly number[] = [0, 10, 30, 60, 100, 150, 220, 300, 400, 520, 660];

export const BOND_MAX_LEVEL = BOND_NEED.length - 1;

/** 升到每一級送的禮物（碎片是那個角色自己的） */
const REWARDS: readonly { food?: number; bones?: number; shards?: number }[] = [
  {},
  { food: 100 },
  { bones: 10 },
  { shards: 2 },
  { food: 300 },
  { bones: 30, shards: 3 },
  { food: 500 },
  { bones: 30 },
  { shards: 5 },
  { food: 1000 },
  { bones: 100, shards: 10 },
];

/** 累積這麼多好感度是第幾級 */
export function bondLevel(points: number): number {
  let level = 0;
  while (level < BOND_MAX_LEVEL && points >= BOND_NEED[level + 1]) level += 1;
  return level;
}

/** 某個角色升到第 level 級的禮物 */
export function bondReward(dogId: string, level: number): RatLoot[] {
  const r = REWARDS[level];
  if (!r) return [];
  const out: RatLoot[] = [];
  if (r.food) out.push({ kind: 'food', amount: r.food });
  if (r.bones) out.push({ kind: 'bones', amount: r.bones });
  if (r.shards) out.push({ kind: 'shards', id: dogId, amount: r.shards });
  return out;
}

export interface BondView {
  level: number;
  /** 累積的好感度 */
  points: number;
  /** 這一級已經累積多少、這一級一共要多少（滿級時 need 為 0） */
  into: number;
  need: number;
  max: boolean;
  /** 下一級的禮物（滿級是空的） */
  next: RatLoot[];
}

type BondFields = Pick<GameState, 'bond'>;

export function bondView(state: BondFields, dogId: string): BondView {
  const points = state.bond.points[dogId] ?? 0;
  const level = bondLevel(points);
  const max = level >= BOND_MAX_LEVEL;
  return {
    level,
    points,
    into: max ? 0 : points - BOND_NEED[level],
    need: max ? 0 : BOND_NEED[level + 1] - BOND_NEED[level],
    max,
    next: max ? [] : bondReward(dogId, level + 1),
  };
}

/** 資料視窗上的一行：「♥3（15／40）下一級送 糧草 +300」 */
export function bondText(v: BondView): string {
  if (v.max) return `♥${v.level}（滿了）`;
  return `♥${v.level}（${v.into}／${v.need}）下一級送 ${v.next.map(ratLootText).join('、')}`;
}

/** 一次升級：誰、升到幾級、送了什麼 */
export interface BondUp {
  dogId: string;
  level: number;
  gifts: RatLoot[];
}

type GainFields = Pick<GameState, 'bond' | 'owned' | 'resources' | 'snacks' | 'gear' | 'shards'>;

/**
 * 幫幾個角色加好感度；跨過等級就把禮物放進口袋（一次跨好幾級就每一級都送）。
 * 沒擁有的、認不得的角色不加；滿級後不再累積。
 */
export function gainBond<S extends GainFields>(
  state: S,
  dogIds: readonly string[],
  amount: number,
): { state: S; ups: BondUp[] } {
  if (amount <= 0) return { state, ups: [] };
  const points = { ...state.bond.points };
  const ups: BondUp[] = [];
  const gifts: RatLoot[] = [];
  for (const id of new Set(dogIds)) {
    if (!state.owned.includes(id) || !findDog(id)) continue;
    const before = points[id] ?? 0;
    const after = Math.min(BOND_NEED[BOND_MAX_LEVEL], before + amount);
    if (after === before) continue;
    points[id] = after;
    for (let lv = bondLevel(before) + 1; lv <= bondLevel(after); lv += 1) {
      const g = bondReward(id, lv);
      ups.push({ dogId: id, level: lv, gifts: g });
      gifts.push(...g);
    }
  }
  if (Object.keys(points).every((id) => points[id] === state.bond.points[id])) {
    return { state, ups: [] };
  }
  const next = { ...state, bond: { ...state.bond, points } };
  return { state: applyRatLoot(next, gifts), ups };
}

/** 一起出征回來：上陣的每一隻都加一點 */
export function battleBond<S extends GainFields>(
  state: S,
  dogIds: readonly string[],
  win: boolean,
): { state: S; ups: BondUp[] } {
  return gainBond(state, dogIds, win ? BOND.win : BOND.lose);
}

/** 今天還能不能摸這個角色加好感度（滿級、沒擁有的不行） */
export function canPet(state: GainFields, dogId: string, now: number, o?: TimeOptions): boolean {
  if (!state.owned.includes(dogId)) return false;
  if (bondLevel(state.bond.points[dogId] ?? 0) >= BOND_MAX_LEVEL) return false;
  return state.bond.day !== dayKey(now, o) || !state.bond.petted.includes(dogId);
}

/** 摸摸：今天第一次摸這個角色就加好感度；摸過了就什麼都不變（gained 為 0） */
export function petDog<S extends GainFields>(
  state: S,
  dogId: string,
  now: number,
  o?: TimeOptions,
): { state: S; gained: number; ups: BondUp[] } {
  if (!canPet(state, dogId, now, o)) return { state, gained: 0, ups: [] };
  const today = bondToday(state.bond, now, o);
  const marked = { ...state, bond: { ...today, petted: [...today.petted, dogId] } };
  const r = gainBond(marked, [dogId], BOND.pet);
  return { ...r, gained: BOND.pet };
}

/** 換日了就把「今天摸過誰、送過幾次」清掉（累積的好感度不動） */
function bondToday(bond: BondState, now: number, o?: TimeOptions): BondState {
  const day = dayKey(now, o);
  if (bond.day === day) return { ...bond, gifted: bond.gifted ?? {} };
  return { ...bond, day, petted: [], gifted: {} };
}

// ---------------- 送零食（T044，在「我的家」） ----------------

/** 送一個零食加多少好感度 */
export const BOND_GIFT: Readonly<Record<SnackId, number>> = { small: 5, mid: 12, big: 30 };

/** 每個角色一天最多收幾次零食 */
export const GIFT_PER_DAY = 3;

/** 這個角色今天還能收幾次零食 */
export function giftsLeft(
  state: Pick<GameState, 'bond'>,
  dogId: string,
  now: number,
  o?: TimeOptions,
): number {
  const today = bondToday(state.bond, now, o);
  return Math.max(0, GIFT_PER_DAY - (today.gifted[dogId] ?? 0));
}

export type GiftBlock = 'unknown' | 'not-owned' | 'none-left' | 'maxed' | 'daily';

/** 能不能送：通過回傳 null */
export function giftBlock(
  state: GainFields,
  dogId: string,
  snackId: string,
  now: number,
  o?: TimeOptions,
): GiftBlock | null {
  if (!findDog(dogId) || !findSnack(snackId)) return 'unknown';
  if (!state.owned.includes(dogId)) return 'not-owned';
  if (bondLevel(state.bond.points[dogId] ?? 0) >= BOND_MAX_LEVEL) return 'maxed';
  if (giftsLeft(state, dogId, now, o) <= 0) return 'daily';
  if (snackCount(state, snackId) <= 0) return 'none-left';
  return null;
}

/** 不能送的原因，給畫面上的提示用 */
export function giftBlockText(block: GiftBlock): string {
  switch (block) {
    case 'maxed':
      return '好感度已經滿了，零食留給別人吧';
    case 'daily':
      return `今天已經吃 ${GIFT_PER_DAY} 次了，明天再送`;
    case 'none-left':
      return '這種零食沒有了，打贏關卡或去商城可以拿到';
    default:
      return '現在不能送';
  }
}

/** 送一個零食：扣一個零食、加好感度，升級的禮物照樣直接入袋 */
export function giftSnack<S extends GainFields>(
  state: S,
  dogId: string,
  snackId: string,
  now: number,
  o?: TimeOptions,
): { state: S; gained: number; ups: BondUp[]; block: GiftBlock | null } {
  const block = giftBlock(state, dogId, snackId, now, o);
  if (block) return { state, gained: 0, ups: [], block };
  const today = bondToday(state.bond, now, o);
  const before = state.bond.points[dogId] ?? 0;
  const marked = {
    ...state,
    snacks: { ...state.snacks, [snackId]: snackCount(state, snackId) - 1 },
    bond: { ...today, gifted: { ...today.gifted, [dogId]: (today.gifted[dogId] ?? 0) + 1 } },
  };
  const r = gainBond(marked, [dogId], BOND_GIFT[snackId as SnackId]);
  return { ...r, gained: (r.state.bond.points[dogId] ?? 0) - before, block: null };
}

/** 收到零食說的話 */
const GIFT_LINES: readonly (readonly string[])[] = [
  ['……給我的？謝謝', '（聞了聞，小口小口吃）', '還不錯'],
  ['是{snack}！我開動了', '（尾巴搖個不停）', '好吃，還有嗎'],
  ['最喜歡{snack}，也最喜歡你', '（吃完整個撲過來）', '一人一半，你也吃'],
];

export function giftLine(level: number, pick: number, snackName: string): string {
  const pool = GIFT_LINES[level >= 7 ? 2 : level >= 3 ? 1 : 0];
  const i = ((Math.floor(pick) % pool.length) + pool.length) % pool.length;
  return pool[i].replace('{snack}', snackName);
}

/** 升級的提示：「阿柴 好感度 ♥3！送 碎片 ×2」；一次升好幾級只講最後一級、禮物全部列出來 */
export function bondUpText(ups: readonly BondUp[]): string {
  if (ups.length === 0) return '';
  const last = ups[ups.length - 1];
  const name = findDog(last.dogId)?.name ?? last.dogId;
  const gifts = ups.flatMap((u) => u.gifts).map(ratLootText);
  return `${name} 好感度 ♥${last.level}！` + (gifts.length ? `送 ${gifts.join('、')}` : '');
}

/** 結算面板上的一行：「好感度升級：阿柴 ♥3 等 4 隻」（面板窄，只寫第一隻；禮物已經入袋） */
export function bondUpNote(ups: readonly BondUp[]): string {
  if (ups.length === 0) return '';
  const best = new Map<string, number>();
  for (const u of ups) best.set(u.dogId, Math.max(best.get(u.dogId) ?? 0, u.level));
  const [[id, lv]] = [...best];
  const more = best.size > 1 ? ` 等 ${best.size} 隻` : '';
  return `好感度升級：${findDog(id)?.name ?? id} ♥${lv}${more}`;
}

/** 被摸的時候說的話：好感度越高越黏人；likes 是小故事裡「喜歡」的東西 */
const LINES: readonly (readonly string[])[] = [
  ['（歪著頭看你）', '……可以摸，一下下就好', '（尾巴小小地搖了一下）', '你的手有點涼'],
  ['再摸一下也可以喔', '今天也一起加油吧', '（瞇起眼睛）好舒服', '摸頭的話，這邊、這邊'],
  ['最喜歡你了！', '今天也要一直在一起', '（整個靠過來）不准停', '有你在就什麼都不怕'],
];

export function petLine(level: number, pick: number, likes?: string): string {
  const tier = level >= 7 ? 2 : level >= 3 ? 1 : 0;
  const pool = likes && tier > 0 ? [...LINES[tier], `等一下一起去找${likes}好不好`] : LINES[tier];
  const i = ((Math.floor(pick) % pool.length) + pool.length) % pool.length;
  return pool[i];
}

/** 讀檔時整理好感度欄位；舊存檔沒有這個欄位就是全部從 0 開始 */
export function sanitizeBond(raw: unknown): BondState {
  if (typeof raw !== 'object' || raw === null)
    return { points: {}, day: '', petted: [], gifted: {} };
  const r = raw as { points?: unknown; day?: unknown; petted?: unknown; gifted?: unknown };
  const points: Record<string, number> = {};
  if (typeof r.points === 'object' && r.points !== null) {
    for (const [id, v] of Object.entries(r.points as Record<string, unknown>)) {
      if (!findDog(id) || typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
      points[id] = Math.min(BOND_NEED[BOND_MAX_LEVEL], Math.floor(v));
    }
  }
  const petted: string[] = [];
  if (Array.isArray(r.petted)) {
    for (const id of r.petted) {
      if (typeof id === 'string' && findDog(id) && !petted.includes(id)) petted.push(id);
    }
  }
  const gifted: Record<string, number> = {};
  if (typeof r.gifted === 'object' && r.gifted !== null) {
    for (const [id, v] of Object.entries(r.gifted as Record<string, unknown>)) {
      if (!findDog(id) || typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
      gifted[id] = Math.min(GIFT_PER_DAY, Math.floor(v));
    }
  }
  return { points, day: typeof r.day === 'string' ? r.day : '', petted, gifted };
}
