import type { DogData } from '../data/dogs';
import { RARITY_ORDER, ROLE_KEYS, roleKeyOf } from './dogFilter';

/**
 * 訓練場的排序：幫玩家看出資源該花在哪隻狗身上。
 * 純函式；稀有度與定位的順序沿用選狗畫面（src/logic/dogFilter.ts）。
 */

export type TrainingSortKey = 'rarity' | 'level' | 'power' | 'star' | 'role';

/** 按鈕輪流切換的順序；第一個是預設 */
export const TRAINING_SORTS: readonly TrainingSortKey[] = [
  'rarity',
  'level',
  'power',
  'star',
  'role',
];
export const DEFAULT_TRAINING_SORT: TrainingSortKey = 'rarity';

export const TRAINING_SORT_LABEL: Record<TrainingSortKey, string> = {
  rarity: '稀有度',
  level: '等級',
  power: '戰力',
  star: '可升星',
  role: '定位',
};

export function isTrainingSort(v: unknown): v is TrainingSortKey {
  return typeof v === 'string' && (TRAINING_SORTS as readonly string[]).includes(v);
}

/** 換到下一個排序條件 */
export function nextTrainingSort(current: TrainingSortKey): TrainingSortKey {
  return TRAINING_SORTS[(TRAINING_SORTS.indexOf(current) + 1) % TRAINING_SORTS.length];
}

/** 排序要看的數字（由畫面從遊戲狀態查出來） */
export interface TrainingSortInfo {
  level: number;
  power: number;
  star: number;
  /** 手上的碎片 */
  shards: number;
  /** 升下一星要幾個碎片；滿星為 0 */
  starCost: number;
}

const rarityRank = (d: DogData): number => (d.rarity ? RARITY_ORDER.indexOf(d.rarity) : -1);

/** 定位照選狗畫面的順序（突擊、守護、謀略、幸運、補給、補血），認不得的排最後 */
const roleRank = (d: DogData): number => {
  const k = roleKeyOf(d);
  return k ? ROLE_KEYS.indexOf(k) : ROLE_KEYS.length;
};

/** 離升星多近：碎片夠了是 1，滿星排最後 */
const starProgress = (i: TrainingSortInfo): number =>
  i.starCost <= 0 ? -1 : Math.min(1, i.shards / i.starCost);

/**
 * 依條件排序，回傳新陣列：
 * - 稀有度：高到低，同稀有度看等級
 * - 等級、戰力：高到低
 * - 可升星：碎片夠升星的排最前面，再來是離升星最近的，滿星排最後
 * - 定位：同定位的排在一起
 * 同分時依序看稀有度、等級、戰力，再同分維持原本順序。
 */
export function sortTrainingDogs(
  dogs: readonly DogData[],
  sort: TrainingSortKey,
  infoOf: (dog: DogData) => TrainingSortInfo,
): DogData[] {
  const infos = new Map(dogs.map((d) => [d.id, infoOf(d)]));
  const info = (d: DogData): TrainingSortInfo => infos.get(d.id)!;
  const first = (a: DogData, b: DogData): number => {
    switch (sort) {
      case 'level':
        return info(b).level - info(a).level;
      case 'power':
        return info(b).power - info(a).power;
      case 'star':
        return starProgress(info(b)) - starProgress(info(a));
      case 'role':
        return roleRank(a) - roleRank(b);
      default:
        return 0;
    }
  };
  return [...dogs].sort(
    (a, b) =>
      first(a, b) ||
      rarityRank(b) - rarityRank(a) ||
      info(b).level - info(a).level ||
      info(b).power - info(a).power,
  );
}
