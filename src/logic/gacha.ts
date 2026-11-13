import { DOGS, type DogData, type DogRarity } from '../data/dogs';
import type { GameState } from '../state/gameState';
import { initialProgress } from './leveling';

/**
 * 召募（抽卡，T007）。全部是純函式，亂數由外面傳入，回傳新的狀態。
 *
 * 規則（數值都是暫定）：
 * - 先依機率決定稀有度，再從該稀有度的狗裡平均抽一隻。
 * - 一次抽 1 隻或 10 隻，最多 10 隻。目前不花資源、不限次數（Jimmy 2026-11-11）。
 * - 十連保底：10 隻裡如果前 9 隻都沒有 SR 以上，第 10 隻一定是 SR 以上。
 * - SSR 保底：連續 PITY_SSR - 1 抽沒出 SSR，下一抽一定是 SSR。
 * - 抽到沒有的狗就加入；已經有的換成那隻狗的碎片，到訓練場升星（src/logic/star.ts）。
 */

/** 稀有度由低到高 */
export const RARITIES: readonly DogRarity[] = ['N', 'R', 'SR', 'SSR'];
/** 各稀有度的機率（百分比，加起來 100） */
export const GACHA_RATES: Readonly<Record<DogRarity, number>> = { N: 55, R: 30, SR: 12, SSR: 3 };
/** 一次最多抽幾隻 */
export const GACHA_MAX_PULLS = 10;
/** 第幾抽一定出 SSR（連續這麼多抽裡至少一隻） */
export const PITY_SSR = 50;
/** 重複抽到一隻狗換幾個碎片 */
export const SHARDS_PER_DUPLICATE = 10;

const rank = (r: DogRarity): number => RARITIES.indexOf(r);

/**
 * 現在抽得到哪些狗：有稀有度的都算，關卡送的狗（rewardOnly，例如暖桶）也抽得到。
 * （原本要先通關拿到才會進池子；Jimmy 2026-11-13 認為抽不到是 bug，改成一開始就在池子裡。
 * 先抽到的話，通關時改送碎片，見 expedition.ts 的 GIFT_DUPLICATE_SHARDS。）
 */
export function gachaPool(): DogData[] {
  return DOGS.filter((d) => d.rarity);
}

export interface RollOptions {
  /** 這一抽之前已經連續幾抽沒出 SSR */
  sinceSSR: number;
  /** 這一抽至少要 SR（十連保底） */
  atLeastSR?: boolean;
}

/** 抽一次稀有度 */
export function rollRarity(rng: () => number, o: RollOptions): DogRarity {
  if (o.sinceSSR + 1 >= PITY_SSR) return 'SSR';
  const x = Math.min(0.999999, Math.max(0, rng())) * 100;
  let acc = 0;
  let rarity: DogRarity = 'N';
  // 從最稀有的開始切，x 越小越稀有
  for (const r of [...RARITIES].reverse()) {
    acc += GACHA_RATES[r];
    if (x < acc) {
      rarity = r;
      break;
    }
  }
  if (o.atLeastSR && rank(rarity) < rank('SR')) return 'SR';
  return rarity;
}

/** 從池子裡抽一隻指定稀有度的狗；那個稀有度沒有狗就往低一階找，再沒有往高找 */
export function pickDog(
  pool: readonly DogData[],
  rarity: DogRarity,
  rng: () => number,
): DogData | undefined {
  const order = [
    ...RARITIES.slice(0, rank(rarity) + 1).reverse(),
    ...RARITIES.slice(rank(rarity) + 1),
  ];
  for (const r of order) {
    const list = pool.filter((d) => d.rarity === r);
    if (list.length > 0) return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  }
  return undefined;
}

/** 抽到的一隻 */
export interface PullItem {
  dogId: string;
  rarity: DogRarity;
  /** 第一次拿到（加入）；false 表示重複，換成碎片 */
  isNew: boolean;
  /** 這一抽換到幾個碎片（新狗為 0） */
  shards: number;
}

type GachaFields = Pick<GameState, 'owned' | 'dogs' | 'shards' | 'gacha'>;

/**
 * 抽 count 隻（1～10，超出範圍會夾住）。池子是按下去當下決定的。
 * 回傳新的狀態與依序抽到的結果。
 */
export function pull<S extends GachaFields>(
  state: S,
  count: number,
  rng: () => number,
): { state: S; items: PullItem[] } {
  const n = Math.min(GACHA_MAX_PULLS, Math.max(1, Math.floor(count) || 1));
  const pool = gachaPool();
  const owned = [...state.owned];
  const dogs = { ...state.dogs };
  const shards = { ...state.shards };
  let { pulls, sinceSSR } = state.gacha;
  const items: PullItem[] = [];
  let gotSR = false;
  for (let i = 0; i < n; i++) {
    const guarantee = n === GACHA_MAX_PULLS && i === n - 1 && !gotSR;
    const dog = pickDog(pool, rollRarity(rng, { sinceSSR, atLeastSR: guarantee }), rng);
    if (!dog || !dog.rarity) break;
    const rarity = dog.rarity;
    pulls++;
    sinceSSR = rarity === 'SSR' ? 0 : sinceSSR + 1;
    if (rank(rarity) >= rank('SR')) gotSR = true;
    const isNew = !owned.includes(dog.id);
    if (isNew) {
      owned.push(dog.id);
      // 以前留下的養成進度（理論上不會有）就沿用，沒有才從頭開始
      dogs[dog.id] = dogs[dog.id] ?? initialProgress(dog);
    } else {
      shards[dog.id] = (shards[dog.id] ?? 0) + SHARDS_PER_DUPLICATE;
    }
    items.push({ dogId: dog.id, rarity, isNew, shards: isNew ? 0 : SHARDS_PER_DUPLICATE });
  }
  if (items.length === 0) return { state, items };
  return { state: { ...state, owned, dogs, shards, gacha: { pulls, sinceSSR } }, items };
}

/** 再幾抽之內一定出 SSR（含下一抽） */
export function pullsToPity(gacha: Pick<GameState['gacha'], 'sinceSSR'>): number {
  return Math.max(1, PITY_SSR - gacha.sinceSSR);
}

/** 已擁有幾隻／全部幾隻（含關卡送的） */
export function collection(owned: readonly string[]): { owned: number; total: number } {
  return { owned: DOGS.filter((d) => owned.includes(d.id)).length, total: DOGS.length };
}

/** 召募畫面看板上主打的狗：最稀有的幾隻 */
export function featuredDogs(count = 3): DogData[] {
  return [...DOGS]
    .filter((d) => d.rarity && !d.rewardOnly)
    .sort((a, b) => rank(b.rarity!) - rank(a.rarity!))
    .slice(0, count);
}

/** 抽到的結果裡最稀有的是哪一階（畫面決定要不要放特效） */
export function bestRarity(items: readonly PullItem[]): DogRarity | null {
  let best: DogRarity | null = null;
  for (const it of items) if (!best || rank(it.rarity) > rank(best)) best = it.rarity;
  return best;
}
