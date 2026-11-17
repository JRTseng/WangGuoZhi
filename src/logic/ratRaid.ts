import { findDog } from '../data/dogs';
import { findGear } from '../data/equipment';
import { RAT_TIERS, ratStageId, ratTierOf } from '../data/rats';
import { REGIONS } from '../data/regions';
import type { GameState, RatLoot, RatState } from '../state/gameState';
import { createRng, mixSeed } from './battle';
import { addGear, rollDrop } from './equipment';
import { addSnacks, findSnack, snackDrop, snackLabel, type SnackId } from './snacks';
import { dayKey, type TimeOptions } from './stamina';

/**
 * 活動事件「刺青老鼠幫來襲」（T034，Jimmy 2026-11-17）。全部是純函式。
 *
 * - 老鼠幫在設定的時段出現（現在先全天；之後要改成每天中午只要改 RAT_RAID.hours）。
 * - 每天（當地 05:00 換日）可以打贏 dailyWins 波，不花體力；打輸沒有獎勵、可以一直重打。
 * - 強度跟著主線打到第幾章（1～10 級）。
 * - 打贏給「很多隨機寶物」：糧草、骨頭幣、經驗零食、裝備、碎片，一次抽 lootRolls 樣，第一樣一定是裝備。
 */
export const RAT_RAID = {
  /** 幾點到幾點會出現（當地時間，含起不含迄）。每天中午的寫法：[{ from: 12, to: 14 }] */
  hours: [{ from: 0, to: 24 }] as readonly { from: number; to: number }[],
  /** 每天可以打贏幾波 */
  dailyWins: 3,
  /** 打贏一波抽幾樣寶物 */
  lootRolls: 5,
};

/** 打過這一關才會遇到老鼠幫：第 1 章的頭目 */
export const RAT_UNLOCK_STAGE = REGIONS[0].stages[REGIONS[0].stages.length - 1].id;

export const EMPTY_RATS: RatState = { day: '', wins: 0, total: 0 };

type HasRats = Pick<GameState, 'rats'>;
type HasCleared = Pick<GameState, 'cleared'>;

/** 這個時間的當地時刻（0～24 的小數） */
function localHour(now: number, o?: TimeOptions): number {
  const tz = o?.tzOffsetMin ?? new Date(now).getTimezoneOffset();
  const d = new Date(now - tz * 60_000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

/** 現在是不是老鼠幫會出現的時段 */
export function ratHoursOpen(now: number, o?: TimeOptions): boolean {
  const h = localHour(now, o);
  return RAT_RAID.hours.some((s) => h >= s.from && h < s.to);
}

/** 時段的文字：「全天」或「12:00～14:00」 */
export function ratHoursText(): string {
  const all = RAT_RAID.hours.some((s) => s.from <= 0 && s.to >= 24);
  if (all) return '全天';
  const hm = (h: number) =>
    `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  return RAT_RAID.hours.map((s) => `${hm(s.from)}～${hm(s.to)}`).join('、');
}

export function ratUnlocked(state: HasCleared): boolean {
  return state.cleared.includes(RAT_UNLOCK_STAGE);
}

/** 把每日重置結算到 now；手機時間被調回過去不重置 */
export function ratsAt(state: HasRats, now: number, o?: TimeOptions): RatState {
  const day = dayKey(now, o);
  return state.rats.day >= day ? state.rats : { ...state.rats, day, wins: 0 };
}

/** 今天還能打贏幾波 */
export function ratWavesLeft(state: HasRats, now: number, o?: TimeOptions): number {
  return Math.max(0, RAT_RAID.dailyWins - ratsAt(state, now, o).wins);
}

/** 老鼠幫的強度：主線打到第幾章就是第幾級 */
export function ratTier(state: HasCleared): number {
  let tier = 1;
  REGIONS.forEach((r) => {
    if (r.stages.some((s) => state.cleared.includes(s.id))) tier = Math.max(tier, r.chapter);
  });
  return Math.min(RAT_TIERS, tier);
}

/** 現在該打哪一關 */
export function ratStageNow(state: HasCleared): string {
  return ratStageId(ratTier(state));
}

/** 主頁要不要出現老鼠幫：已解鎖而且在時段內 */
export function ratVisible(state: HasCleared, now: number, o?: TimeOptions): boolean {
  return ratUnlocked(state) && ratHoursOpen(now, o);
}

/** 這一關現在能不能打 */
export function ratCanFight(
  state: HasRats & HasCleared,
  stageId: string,
  now: number,
  o?: TimeOptions,
): boolean {
  const tier = ratTierOf(stageId);
  return (
    tier > 0 &&
    tier === ratTier(state) &&
    ratVisible(state, now, o) &&
    ratWavesLeft(state, now, o) > 0
  );
}

const LOOT_SALT = 0x4a71;
/** 每一樣寶物抽到的比重 */
const LOOT_WEIGHTS = { food: 25, bones: 20, snack: 25, gear: 15, shards: 15 } as const;
type LootKind = keyof typeof LOOT_WEIGHTS;

const int = (rng: () => number, min: number, max: number) =>
  min + Math.min(max - min, Math.floor(rng() * (max - min + 1)));

function pickKind(rng: () => number): LootKind {
  const kinds = Object.keys(LOOT_WEIGHTS) as LootKind[];
  let x = rng() * kinds.reduce((s, k) => s + LOOT_WEIGHTS[k], 0);
  for (const k of kinds) {
    if (x < LOOT_WEIGHTS[k]) return k;
    x -= LOOT_WEIGHTS[k];
  }
  return 'food';
}

/**
 * 打贏一波抽到的寶物。只看種子、級數與擁有哪些角色，所以同一仗怎麼算都一樣。
 * 同樣的東西會合併成一筆（裝備每件各一筆）。
 */
export function rollRatLoot(seed: number, tier: number, owned: readonly string[]): RatLoot[] {
  const rng = createRng(mixSeed(seed, LOOT_SALT));
  const out: RatLoot[] = [];
  const keyOf = (x: RatLoot) => ('id' in x ? `${x.kind}:${x.id}` : x.kind);
  const add = (item: RatLoot) => {
    const same = item.kind === 'gear' ? undefined : out.find((x) => keyOf(x) === keyOf(item));
    if (same && 'amount' in same && 'amount' in item) same.amount += item.amount;
    else out.push(item);
  };
  for (let i = 0; i < RAT_RAID.lootRolls; i++) {
    const kind = i === 0 ? 'gear' : pickKind(rng);
    if (kind === 'gear') {
      const g = rollDrop(tier, true, rng, true);
      if (g) add({ kind: 'gear', id: g.id });
      else add({ kind: 'bones', amount: 10 + 4 * tier });
    } else if (kind === 'food') add({ kind, amount: (300 + 150 * tier) * int(rng, 2, 4) });
    else if (kind === 'bones') add({ kind, amount: 10 + 4 * tier + int(rng, 0, 10) });
    else if (kind === 'snack') {
      add({ kind, id: snackDrop(tier, false).id, amount: int(rng, 2, 4) });
    } else if (owned.length > 0) {
      const id = owned[Math.min(owned.length - 1, Math.floor(rng() * owned.length))];
      add({ kind: 'shards', id, amount: int(rng, 2, 4) });
    } else add({ kind: 'bones', amount: 10 + 4 * tier });
  }
  return out;
}

/** 把寶物加進存檔 */
export function applyRatLoot<S extends Pick<GameState, 'resources' | 'snacks' | 'gear' | 'shards'>>(
  state: S,
  loot: readonly RatLoot[],
): S {
  let s = state;
  for (const item of loot) {
    if (item.kind === 'gear') s = addGear(s, item.id);
    else if (item.kind === 'snack') s = addSnacks(s, item.id as SnackId, item.amount);
    else if (item.kind === 'shards') {
      s = { ...s, shards: { ...s.shards, [item.id]: (s.shards[item.id] ?? 0) + item.amount } };
    } else {
      s = {
        ...s,
        resources: { ...s.resources, [item.kind]: s.resources[item.kind] + item.amount },
      };
    }
  }
  return s;
}

/** 一樣寶物的文字：「糧草 +1,200」「大骨頭 ×3」 */
export function ratLootText(item: RatLoot): string {
  switch (item.kind) {
    case 'food':
      return `糧草 +${item.amount.toLocaleString('en-US')}`;
    case 'bones':
      return `骨頭幣 +${item.amount}`;
    case 'snack':
      return snackLabel(item.id, item.amount);
    case 'gear':
      return `裝備「${findGear(item.id)?.name ?? item.id}」`;
    case 'shards':
      return `${findDog(item.id)?.name ?? item.id}碎片 ×${item.amount}`;
  }
}

/** 打贏一波：記今天的次數與累計 */
export function ratWin<S extends HasRats>(state: S, now: number, o?: TimeOptions): S {
  const r = ratsAt(state, now, o);
  return { ...state, rats: { ...r, wins: r.wins + 1, total: r.total + 1 } };
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** 讀檔時的檢查：壞掉的欄位回到預設 */
export function sanitizeRats(raw: unknown): RatState {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY_RATS };
  const r = raw as Record<string, unknown>;
  return {
    day: typeof r.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.day) ? r.day : '',
    wins: isInt(r.wins) ? r.wins : 0,
    total: isInt(r.total) ? r.total : 0,
  };
}

/** 讀檔時檢查一筆寶物 */
export function isRatLoot(v: unknown): v is RatLoot {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (r.kind === 'gear') return typeof r.id === 'string' && !!findGear(r.id);
  if (!isInt(r.amount)) return false;
  if (r.kind === 'food' || r.kind === 'bones') return true;
  if (r.kind === 'snack') return typeof r.id === 'string' && !!findSnack(r.id);
  return r.kind === 'shards' && typeof r.id === 'string' && !!findDog(r.id);
}
