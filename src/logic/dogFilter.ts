import type { DogData, DogRarity, DogSize } from '../data/dogs';
import { TEAM_SIZE } from './expedition';
import { baseStats } from './leveling';

/**
 * 選狗畫面的篩選、排序與自動編隊（T015）。
 * 純函式：傳入狗狗清單與「擁有／出征中」的 id，回傳新的清單，不改原陣列。
 */

/** 定位（從 DogData.role 的「前排／突擊」這類字串取後半） */
export type RoleKey = '突擊' | '守護' | '謀略' | '幸運' | '補給';
export const ROLE_KEYS: readonly RoleKey[] = ['突擊', '守護', '謀略', '幸運', '補給'];

/** 狀態：可出征（擁有且沒在出征）／出征中 */
export type StatusKey = 'idle' | 'busy';
export const STATUS_KEYS: readonly StatusKey[] = ['idle', 'busy'];
export const STATUS_LABEL: Record<StatusKey, string> = { idle: '可出征', busy: '出征中' };

export const RARITY_ORDER: readonly DogRarity[] = ['N', 'R', 'SR', 'SSR'];

export interface DogFilter {
  role: RoleKey | 'all';
  status: StatusKey | 'all';
  /** 以下三項 T007 之後才有資料；沒填資料的狗只會出現在 all */
  rarity: DogRarity | 'all';
  size: DogSize | 'all';
  element: string | 'all';
}

/** 預設：全部（All） */
export const ALL_FILTER: DogFilter = {
  role: 'all',
  status: 'all',
  rarity: 'all',
  size: 'all',
  element: 'all',
};

export type SortKey = 'power' | 'level' | 'rarity';
export const SORT_LABEL: Record<SortKey, string> = {
  power: '戰力',
  level: '等級',
  rarity: '稀有度',
};

/** 查一隻狗目前的等級與戰力（T005 起會隨升級改變，由狀態查出來） */
export type StatsOf = (dog: DogData) => { level: number; power: number };

/** 誰擁有、誰在出征，以及怎麼查目前的等級與戰力（沒給就用初始數字） */
export interface DogContext {
  owned: ReadonlySet<string> | readonly string[];
  busy: ReadonlySet<string> | readonly string[];
  stats?: StatsOf;
}

const has = (set: ReadonlySet<string> | readonly string[], id: string): boolean =>
  Array.isArray(set) ? set.includes(id) : (set as ReadonlySet<string>).has(id);

export function roleKeyOf(dog: Pick<DogData, 'role'>): RoleKey | undefined {
  return ROLE_KEYS.find((k) => dog.role.includes(k));
}

export function powerOf(dog: DogData, stats: StatsOf = baseStats): number {
  return stats(dog).power;
}

/** 可出征：擁有且沒在出征 */
export function isIdle(dog: DogData, ctx: DogContext): boolean {
  return has(ctx.owned, dog.id) && !has(ctx.busy, dog.id);
}

export function matchesFilter(dog: DogData, filter: DogFilter, ctx: DogContext): boolean {
  if (filter.role !== 'all' && roleKeyOf(dog) !== filter.role) return false;
  if (filter.status === 'idle' && !isIdle(dog, ctx)) return false;
  if (filter.status === 'busy' && !has(ctx.busy, dog.id)) return false;
  if (filter.rarity !== 'all' && dog.rarity !== filter.rarity) return false;
  if (filter.size !== 'all' && dog.size !== filter.size) return false;
  if (filter.element !== 'all' && dog.element !== filter.element) return false;
  return true;
}

export function filterDogs(
  dogs: readonly DogData[],
  filter: DogFilter,
  ctx: DogContext,
): DogData[] {
  return dogs.filter((d) => matchesFilter(d, filter, ctx));
}

const rarityRank = (d: DogData): number => (d.rarity ? RARITY_ORDER.indexOf(d.rarity) : -1);

/**
 * 排序（都是高到低）：擁有的排前面，再依排序條件；
 * 同分時依戰力，再同分維持原本順序（穩定排序）。
 */
export function sortDogs(
  dogs: readonly DogData[],
  sort: SortKey,
  owned?: ReadonlySet<string> | readonly string[],
  stats: StatsOf = baseStats,
): DogData[] {
  const numbers = new Map(dogs.map((d) => [d.id, stats(d)]));
  const power = (d: DogData): number => numbers.get(d.id)!.power;
  const key = (d: DogData): number =>
    sort === 'level' ? numbers.get(d.id)!.level : sort === 'rarity' ? rarityRank(d) : power(d);
  const own = (d: DogData): number => (!owned || has(owned, d.id) ? 1 : 0);
  return [...dogs].sort((a, b) => own(b) - own(a) || key(b) - key(a) || power(b) - power(a));
}

/** 篩選後排序，選狗畫面直接用這個 */
export function listDogs(
  dogs: readonly DogData[],
  filter: DogFilter,
  sort: SortKey,
  ctx: DogContext,
): DogData[] {
  return sortDogs(filterDogs(dogs, filter, ctx), sort, ctx.owned, ctx.stats);
}

/**
 * 一鍵自動編隊：可出征（擁有且沒在出征）的狗裡戰力最高的幾隻，戰力高的排前面。
 * 不看目前的篩選條件。可出征的不到 size 隻就全上。
 */
export function autoTeam(dogs: readonly DogData[], ctx: DogContext, size = TEAM_SIZE): string[] {
  return sortDogs(
    dogs.filter((d) => isIdle(d, ctx)),
    'power',
    undefined,
    ctx.stats,
  )
    .slice(0, Math.max(0, size))
    .map((d) => d.id);
}

/** 換到下一個排序條件（按鈕輪流切換用） */
export function nextSort(current: SortKey, options: readonly SortKey[]): SortKey {
  const i = options.indexOf(current);
  return options[(i + 1) % options.length] ?? 'power';
}

/** 有哪些排序可選：稀有度要等有資料才出現 */
export function sortOptions(dogs: readonly DogData[]): SortKey[] {
  return dogs.some((d) => d.rarity) ? ['power', 'level', 'rarity'] : ['power', 'level'];
}
