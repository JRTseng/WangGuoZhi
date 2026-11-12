import { describe, expect, it } from 'vitest';
import { DOGS, STARTER_DOG_IDS, type DogData } from '../data/dogs';
import {
  ALL_FILTER,
  autoTeam,
  filterDogs,
  listDogs,
  nextSort,
  roleKeyOf,
  sortDogs,
  sortOptions,
} from './dogFilter';

const ctx = { owned: STARTER_DOG_IDS, busy: new Set<string>() };
const ids = (dogs: readonly DogData[]) => dogs.map((d) => d.id);
const dog = (id: string, patch: Partial<DogData> = {}): DogData => ({
  ...DOGS[0],
  id,
  name: id,
  ...patch,
});

describe('選狗篩選', () => {
  it('預設（全部）顯示所有狗狗', () => {
    expect(filterDogs(DOGS, ALL_FILTER, ctx)).toHaveLength(DOGS.length);
  });

  it('每隻狗都對得到一個定位', () => {
    for (const d of DOGS) expect(roleKeyOf(d), d.name).toBeDefined();
  });

  it('依定位篩選', () => {
    const by = (role: (typeof ALL_FILTER)['role']) =>
      ids(filterDogs(DOGS, { ...ALL_FILTER, role }, ctx));
    expect(by('突擊')).toEqual(['heixuan']);
    expect(by('守護')).toEqual(['changxu', 'tieya']);
    expect(by('謀略')).toEqual(['xiaosuan', 'shuangyan']);
    expect(by('幸運')).toEqual(['abai']);
    expect(by('補給')).toEqual(['daer', 'duantui']);
    expect(by('補血')).toEqual(['nuantong']);
  });

  it('依狀態篩選：可出征要擁有且沒在出征', () => {
    const c = { owned: STARTER_DOG_IDS, busy: new Set(['daer', 'abai']) };
    expect(ids(filterDogs(DOGS, { ...ALL_FILTER, status: 'idle' }, c))).toEqual([
      'heixuan',
      'changxu',
      'xiaosuan',
    ]);
    expect(ids(filterDogs(DOGS, { ...ALL_FILTER, status: 'busy' }, c))).toEqual(['daer', 'abai']);
  });

  it('條件可以疊加', () => {
    const c = { owned: STARTER_DOG_IDS, busy: ['changxu'] };
    expect(ids(filterDogs(DOGS, { ...ALL_FILTER, role: '守護', status: 'idle' }, c))).toEqual([]);
    expect(ids(filterDogs(DOGS, { ...ALL_FILTER, role: '守護', status: 'busy' }, c))).toEqual([
      'changxu',
    ]);
  });

  it('稀有度、體型、屬性（預留）：有資料才篩得到', () => {
    const dogs = [
      dog('a', { rarity: 'SSR', size: '大型', element: '火' }),
      dog('b', { rarity: 'N', size: '小型' }),
      dog('c'),
    ];
    const c = { owned: ['a', 'b', 'c'], busy: [] };
    expect(ids(filterDogs(dogs, { ...ALL_FILTER, rarity: 'SSR' }, c))).toEqual(['a']);
    expect(ids(filterDogs(dogs, { ...ALL_FILTER, size: '小型' }, c))).toEqual(['b']);
    expect(ids(filterDogs(dogs, { ...ALL_FILTER, element: '火' }, c))).toEqual(['a']);
    expect(ids(filterDogs(dogs, ALL_FILTER, c))).toEqual(['a', 'b', 'c']);
  });
});

describe('選狗排序', () => {
  it('預設戰力高到低，擁有的排前面', () => {
    expect(ids(listDogs(DOGS, ALL_FILTER, 'power', ctx))).toEqual([
      'changxu', // 114
      'daer', // 108
      'heixuan', // 103
      'xiaosuan', // 72
      'abai', // 70
      'nuantong', // 124，未擁有（第 1 章通關才送）
      'tieya', // 115，未擁有
      'shuangyan', // 90
      'duantui', // 84
    ]);
  });

  it('依等級，同等級再比戰力', () => {
    expect(ids(sortDogs(DOGS.slice(0, 5), 'level'))).toEqual([
      'daer',
      'changxu',
      'heixuan',
      'xiaosuan',
      'abai',
    ]);
  });

  it('依稀有度 SSR 到 N，沒資料的排最後', () => {
    const dogs = [
      dog('n', { rarity: 'N' }),
      dog('x'),
      dog('ssr', { rarity: 'SSR' }),
      dog('r', { rarity: 'R' }),
    ];
    expect(ids(sortDogs(dogs, 'rarity'))).toEqual(['ssr', 'r', 'n', 'x']);
  });

  it('不改動原陣列', () => {
    const before = ids(DOGS);
    sortDogs(DOGS, 'power');
    expect(ids(DOGS)).toEqual(before);
  });

  it('稀有度排序要等有資料才出現；按鈕輪流切換', () => {
    expect(sortOptions(DOGS)).toEqual(['power', 'level']);
    expect(sortOptions([dog('a', { rarity: 'R' })])).toEqual(['power', 'level', 'rarity']);
    expect(nextSort('power', ['power', 'level'])).toBe('level');
    expect(nextSort('level', ['power', 'level'])).toBe('power');
  });
});

describe('自動編隊', () => {
  it('挑可出征中戰力最高的 5 隻', () => {
    const owned = DOGS.map((d) => d.id);
    expect(autoTeam(DOGS, { owned, busy: [] })).toEqual([
      'nuantong',
      'tieya',
      'changxu',
      'daer',
      'heixuan',
    ]);
  });

  it('出征中、未擁有的不會被選', () => {
    const owned = DOGS.map((d) => d.id).filter((id) => id !== 'tieya');
    expect(autoTeam(DOGS, { owned, busy: ['changxu'] })).toEqual([
      'nuantong',
      'daer',
      'heixuan',
      'shuangyan',
      'duantui',
    ]);
  });

  it('可出征的不到 5 隻就全上；沒有就空隊', () => {
    expect(autoTeam(DOGS, { owned: ['abai', 'daer'], busy: [] })).toEqual(['daer', 'abai']);
    expect(autoTeam(DOGS, { owned: STARTER_DOG_IDS, busy: STARTER_DOG_IDS })).toEqual([]);
  });
});
