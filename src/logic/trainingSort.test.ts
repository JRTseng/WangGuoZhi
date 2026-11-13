import { describe, expect, it } from 'vitest';
import { DOGS, type DogData, type DogRarity, type DogRole } from '../data/dogs';
import {
  DEFAULT_TRAINING_SORT,
  TRAINING_SORTS,
  isTrainingSort,
  nextTrainingSort,
  sortTrainingDogs,
  type TrainingSortInfo,
} from './trainingSort';

type Row = Partial<TrainingSortInfo> & { rarity?: DogRarity; role?: DogRole };
const BASE: TrainingSortInfo = { level: 1, power: 100, star: 1, shards: 0, starCost: 10 };

function run(rows: Record<string, Row>, sort: Parameters<typeof sortTrainingDogs>[1]): string[] {
  const dogs: DogData[] = Object.entries(rows).map(([id, r]) => ({
    ...DOGS[0],
    id,
    name: id,
    rarity: r.rarity,
    role: r.role ?? DOGS[0].role,
  }));
  return sortTrainingDogs(dogs, sort, (d) => ({ ...BASE, ...rows[d.id] })).map((d) => d.id);
}

describe('訓練場排序', () => {
  it('預設是稀有度：高到低，同稀有度看等級，再看戰力', () => {
    expect(DEFAULT_TRAINING_SORT).toBe('rarity');
    expect(
      run(
        {
          n: { rarity: 'N', level: 30 },
          r: { rarity: 'R', level: 5 },
          ssr: { rarity: 'SSR' },
          srLow: { rarity: 'SR', level: 2 },
          srHigh: { rarity: 'SR', level: 9 },
          srHighStrong: { rarity: 'SR', level: 9, power: 200 },
        },
        'rarity',
      ),
    ).toEqual(['ssr', 'srHighStrong', 'srHigh', 'srLow', 'r', 'n']);
  });

  it('等級與戰力：高到低，同分時稀有度高的在前', () => {
    const rows: Record<string, Row> = {
      a: { rarity: 'N', level: 10, power: 150 },
      b: { rarity: 'SR', level: 10, power: 120 },
      c: { rarity: 'SSR', level: 3, power: 300 },
    };
    expect(run(rows, 'level')).toEqual(['b', 'a', 'c']);
    expect(run(rows, 'power')).toEqual(['c', 'a', 'b']);
  });

  it('可升星：碎片夠的最前面，再來離升星最近的，滿星最後', () => {
    expect(
      run(
        {
          maxed: { rarity: 'SSR', star: 5, starCost: 0, shards: 99 },
          none: { rarity: 'SSR' },
          half: { rarity: 'N', shards: 10, starCost: 20 },
          ready: { rarity: 'N', shards: 12, starCost: 10 },
          readySr: { rarity: 'SR', shards: 10, starCost: 10 },
          near: { rarity: 'N', shards: 9, starCost: 10 },
        },
        'star',
      ),
    ).toEqual(['readySr', 'ready', 'near', 'half', 'none', 'maxed']);
  });

  it('定位：同定位排在一起，順序和選狗畫面一樣', () => {
    expect(
      run(
        {
          heal: { role: '後排／補血' },
          guardN: { role: '前排／守護', rarity: 'N' },
          rush: { role: '前排／突擊' },
          guardSr: { role: '前排／守護', rarity: 'SR' },
        },
        'role',
      ),
    ).toEqual(['rush', 'guardSr', 'guardN', 'heal']);
  });

  it('不改原本的陣列', () => {
    const dogs = DOGS.slice(0, 5);
    const before = dogs.map((d) => d.id);
    sortTrainingDogs(dogs, 'power', (d) => ({ ...BASE, power: d.baseAttack }));
    expect(dogs.map((d) => d.id)).toEqual(before);
  });

  it('按鈕輪流切換一圈會回到原本的條件', () => {
    let s = DEFAULT_TRAINING_SORT;
    const seen = TRAINING_SORTS.map(() => (s = nextTrainingSort(s)));
    expect(new Set(seen).size).toBe(TRAINING_SORTS.length);
    expect(s).toBe(DEFAULT_TRAINING_SORT);
  });

  it('存檔裡認不得的排序條件不算數', () => {
    expect(isTrainingSort('star')).toBe(true);
    expect(isTrainingSort('name')).toBe(false);
    expect(isTrainingSort(3)).toBe(false);
  });
});
