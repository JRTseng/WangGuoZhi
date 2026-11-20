import { DOGS, factionOf, findDog, type DogRarity, type Faction } from '../data/dogs';
import { findGear } from '../data/equipment';
import { REGIONS } from '../data/regions';
import type { GameState, RatLoot } from '../state/gameState';
import { createRng, mixSeed } from './battle';
import { rollDrop } from './equipment';
import { playerFaction } from './faction';
import { currentChapterIndex } from './progress';
import { applyRatLoot, ratLootText } from './ratRaid';
import { findSnack, snackDrop } from './snacks';
import { dayKey, type TimeOptions } from './stamina';

/**
 * 商城（T039）：主頁右上「商城」進來，用糧草與骨頭幣換東西。全部是純函式。
 *
 * - 每天（當地 05:00 換日，和體力、簽到一樣）換一批，一批六樣：
 *   每日禮物（免費）、零食、零食大包、角色碎片、稀有碎片、裝備。
 * - 賣什麼只看日期與陣營（碎片優先挑已經有的角色），所以同一天怎麼開都一樣；
 *   零食的種類與糧草的量跟著主線打到第幾章。
 * - 每樣東西一天能買的次數有限，存檔只記「哪一天、每一格買了幾次」。
 * - 只花遊戲裡的糧草與骨頭幣，不接真的付費。
 */

export type MallKind = 'gift' | 'snack' | 'snackPack' | 'shards' | 'rareShards' | 'gear';

/** 一批商品的順序（存檔的 bought 照這個順序記） */
export const MALL_SLOTS: readonly MallKind[] = [
  'gift',
  'snack',
  'snackPack',
  'shards',
  'rareShards',
  'gear',
];

/** 每一格一天能買幾次（稀有碎片抽到 SSR 時只有 1 次） */
export const MALL_LIMIT: Readonly<Record<MallKind, number>> = {
  gift: 1,
  snack: 3,
  snackPack: 1,
  shards: 2,
  rareShards: 2,
  gear: 1,
};

/** 數字都是暫定，等 Jimmy 看過再調 */
export const MALL = {
  /** 每日禮物：糧草，每章這麼多 */
  giftFoodPerChapter: 200,
  /** 零食一次幾個；糧草價 = 那種零食的經驗 × 個數 × snackFoodRate */
  snackAmount: 3,
  snackFoodRate: 2,
  /** 零食大包一次幾個，以及各種零食的骨頭幣價 */
  packAmount: 10,
  packBones: { small: 30, mid: 60, big: 120 } as Readonly<Record<string, number>>,
  /** 碎片一次幾個，以及各稀有度的骨頭幣價 */
  shardAmount: 5,
  shardBones: { N: 10, R: 20, SR: 40, SSR: 100 } as Readonly<Record<DogRarity, number>>,
  /** 稀有碎片那一格出 SSR 的機率，其餘是 SR */
  rareSSRRate: 0.2,
  /** 裝備各稀有度的骨頭幣價 */
  gearBones: { N: 15, R: 30, SR: 60, SSR: 120 } as Readonly<Record<DogRarity, number>>,
} as const;

/** 商城的存檔 */
export interface MallState {
  /** 這份購買紀錄是哪一個遊戲日的 */
  day: string;
  /** 每一格今天買了幾次（順序同 MALL_SLOTS） */
  bought: number[];
}

export const EMPTY_MALL: MallState = { day: '', bought: [] };

export type MallCurrency = 'free' | 'food' | 'bones';

export interface MallGood {
  slot: number;
  kind: MallKind;
  /** 格子上的小標題：「每日禮物」「零食」…… */
  title: string;
  /** 買了拿到什麼 */
  item: RatLoot;
  /** 拿到的東西的文字：「小肉乾 ×3」 */
  text: string;
  currency: MallCurrency;
  price: number;
  limit: number;
  bought: number;
  left: number;
}

const TITLES: Readonly<Record<MallKind, string>> = {
  gift: '每日禮物',
  snack: '零食',
  snackPack: '零食大包',
  shards: '角色碎片',
  rareShards: '稀有碎片',
  gear: '裝備',
};

type HasMall = Pick<GameState, 'mall'>;
type GoodsFields = HasMall & Pick<GameState, 'cleared' | 'owned' | 'faction'>;
type BuyFields = GoodsFields & Pick<GameState, 'resources' | 'snacks' | 'gear' | 'shards'>;

/** 把每日換新結算到 now；手機時間被調回過去不重置 */
export function mallAt(state: HasMall, now: number, o?: TimeOptions): MallState {
  const day = dayKey(now, o);
  return state.mall.day >= day ? state.mall : { day, bought: [] };
}

const chapterOf = (state: Pick<GameState, 'cleared'>): number =>
  REGIONS[currentChapterIndex(state)]?.chapter ?? 1;

/** 遊戲日（yyyy-mm-dd）換成整數，當亂數種子 */
const dayNumber = (key: string): number => Math.round(Date.parse(`${key}T00:00:00Z`) / 86_400_000);

const MALL_SALT = 0x3a11;

function slotRng(day: string, slot: number, faction: Faction): () => number {
  return createRng(mixSeed(dayNumber(day), slot, faction === 'cat' ? 1 : 0, MALL_SALT));
}

/**
 * 從這個陣營、這幾種稀有度的角色裡挑一隻：先照當天的亂數排好順序，
 * 有已經擁有的就挑排最前面的那隻（買了馬上用得到），都沒有才挑第一隻。
 */
function pickDog(
  rng: () => number,
  faction: Faction,
  rarities: readonly DogRarity[],
  owned: readonly string[],
): string {
  const pool = DOGS.filter(
    (d) => factionOf(d) === faction && rarities.includes(d.rarity ?? 'N'),
  ).map((d) => ({ id: d.id, key: rng() }));
  pool.sort((a, b) => a.key - b.key);
  return (pool.find((d) => owned.includes(d.id)) ?? pool[0])?.id ?? DOGS[0].id;
}

/** 今天這一批商品 */
export function mallGoods(state: GoodsFields, now: number, o?: TimeOptions): MallGood[] {
  const mall = mallAt(state, now, o);
  const chapter = chapterOf(state);
  const faction = playerFaction(state);
  const snackId = snackDrop(chapter, false).id;
  const snackExp = findSnack(snackId)?.exp ?? 100;
  return MALL_SLOTS.map((kind, slot) => {
    const rng = slotRng(mall.day, slot, faction);
    let item: RatLoot;
    let currency: MallCurrency = 'bones';
    let price = 0;
    let limit = MALL_LIMIT[kind];
    switch (kind) {
      case 'gift':
        item = { kind: 'food', amount: MALL.giftFoodPerChapter * chapter };
        currency = 'free';
        break;
      case 'snack':
        item = { kind: 'snack', id: snackId, amount: MALL.snackAmount };
        currency = 'food';
        price = snackExp * MALL.snackAmount * MALL.snackFoodRate;
        break;
      case 'snackPack':
        item = { kind: 'snack', id: snackId, amount: MALL.packAmount };
        price = MALL.packBones[snackId] ?? MALL.packBones.small;
        break;
      case 'shards': {
        const id = pickDog(rng, faction, ['N', 'R'], state.owned);
        item = { kind: 'shards', id, amount: MALL.shardAmount };
        price = MALL.shardBones[findDog(id)?.rarity ?? 'N'];
        break;
      }
      case 'rareShards': {
        const ssr = rng() < MALL.rareSSRRate;
        const id = pickDog(rng, faction, [ssr ? 'SSR' : 'SR'], state.owned);
        const rarity = findDog(id)?.rarity ?? 'SR';
        item = { kind: 'shards', id, amount: MALL.shardAmount };
        price = MALL.shardBones[rarity];
        if (rarity === 'SSR') limit = 1;
        break;
      }
      case 'gear': {
        // 用頭目關的比重（好東西多一點），一定有一件
        const g = rollDrop(chapter, true, rng, true);
        if (g) {
          item = { kind: 'gear', id: g.id };
          price = MALL.gearBones[g.rarity];
        } else {
          item = { kind: 'snack', id: snackId, amount: MALL.snackAmount };
          price = MALL.packBones[snackId] ?? MALL.packBones.small;
        }
        break;
      }
    }
    const bought = Math.min(limit, Math.max(0, Math.floor(mall.bought[slot] ?? 0)));
    return {
      slot,
      kind,
      title: TITLES[kind],
      item,
      text: mallItemText(item),
      currency,
      price,
      limit,
      bought,
      left: limit - bought,
    };
  });
}

/** 商品的文字：糧草與骨頭幣不寫「+」，其他和老鼠幫寶物一樣 */
export function mallItemText(item: RatLoot): string {
  if (item.kind === 'food') return `糧草 ${item.amount.toLocaleString('en-US')}`;
  if (item.kind === 'bones') return `骨頭幣 ${item.amount}`;
  if (item.kind === 'gear') return findGear(item.id)?.name ?? item.id;
  return ratLootText(item);
}

/** 價錢的文字：「免費」「糧草 600」「骨頭幣 30」 */
export function mallPriceText(good: Pick<MallGood, 'currency' | 'price'>): string {
  if (good.currency === 'free') return '免費';
  const n = good.price.toLocaleString('en-US');
  return good.currency === 'food' ? `糧草 ${n}` : `骨頭幣 ${n}`;
}

export type MallBlock = 'unknown' | 'sold-out' | 'food' | 'bones';

/** 能不能買：通過回傳 null */
export function mallBlock(
  state: GoodsFields & Pick<GameState, 'resources'>,
  slot: number,
  now: number,
  o?: TimeOptions,
): MallBlock | null {
  const good = mallGoods(state, now, o)[slot];
  if (!good) return 'unknown';
  if (good.left <= 0) return 'sold-out';
  if (good.currency !== 'free' && state.resources[good.currency] < good.price) {
    return good.currency;
  }
  return null;
}

/** 買一次第 slot 格的東西：扣錢、給東西、記今天買了幾次 */
export function buyMall<S extends BuyFields>(
  state: S,
  slot: number,
  now: number,
  o?: TimeOptions,
): { state: S; good: MallGood | null; block: MallBlock | null } {
  const block = mallBlock(state, slot, now, o);
  const good = mallGoods(state, now, o)[slot] ?? null;
  if (block || !good) return { state, good, block: block ?? 'unknown' };
  const mall = mallAt(state, now, o);
  const bought = MALL_SLOTS.map((_, i) => Math.max(0, Math.floor(mall.bought[i] ?? 0)));
  bought[slot] += 1;
  let next: S = { ...state, mall: { day: mall.day, bought } };
  if (good.currency !== 'free') {
    next = {
      ...next,
      resources: {
        ...next.resources,
        [good.currency]: next.resources[good.currency] - good.price,
      },
    };
  }
  return { state: applyRatLoot(next, [good.item]), good, block: null };
}

/** 今天的每日禮物還沒領（主頁「商城」紅點用） */
export function mallGiftReady(state: HasMall, now: number, o?: TimeOptions): boolean {
  const slot = MALL_SLOTS.indexOf('gift');
  return (mallAt(state, now, o).bought[slot] ?? 0) < MALL_LIMIT.gift;
}

/** 讀檔時整理商城欄位；舊存檔沒有這個欄位就是今天都還沒買 */
export function sanitizeMall(raw: unknown): MallState {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY_MALL };
  const r = raw as { day?: unknown; bought?: unknown };
  if (typeof r.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return { ...EMPTY_MALL };
  const list = Array.isArray(r.bought) ? r.bought : [];
  return {
    day: r.day,
    bought: MALL_SLOTS.map((kind, i) => {
      const n: unknown = list[i];
      return typeof n === 'number' && Number.isInteger(n) && n > 0
        ? Math.min(n, MALL_LIMIT[kind])
        : 0;
    }),
  };
}
