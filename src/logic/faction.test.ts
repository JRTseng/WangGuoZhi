import { describe, expect, it } from 'vitest';
import { CATS } from '../data/cats';
import { DOGS, STARTER_IDS, factionOf, findDog, rosterOf } from '../data/dogs';
import { DEFAULT_SKILL_LINES } from '../data/skillLines';
import { breedArtOf } from '../scenes/components/breedArt';
import { createInitialState } from '../state/gameState';
import {
  chooseFaction,
  factionFromSearch,
  isFreshSave,
  needFactionPick,
  playerFaction,
  sanitizeFaction,
} from './faction';
import { RARITIES, collection, featuredDogs, gachaPool, pull } from './gacha';
import { createRng } from './battle';
import { deserialize, serialize } from './save';
import { signinPickPool } from './signin';

const NOW = 1_800_000_000_000;
const fresh = () => createInitialState(NOW);

describe('喵國的貓（T029）', () => {
  it('20 隻：N 6／R 6／SR 4／SSR 4，六種定位都有，每隻都有台詞與畫法', () => {
    expect(CATS).toHaveLength(20);
    const count = (r: string) => CATS.filter((d) => d.rarity === r).length;
    expect(RARITIES.map(count)).toEqual([6, 6, 4, 4]);
    for (const role of ['補給', '突擊', '守護', '謀略', '幸運', '補血']) {
      expect(CATS.filter((d) => d.role.endsWith(role)).length, role).toBeGreaterThanOrEqual(2);
    }
    for (const c of CATS) {
      expect(factionOf(c)).toBe('cat');
      expect(c.breed.endsWith('貓'), c.name).toBe(true);
      expect(DEFAULT_SKILL_LINES[c.id], c.name).toBeTruthy();
      expect(breedArtOf(c.breed), c.breed).toBeTruthy();
    }
  });

  it('兩邊一開始各五隻，都是自己陣營的', () => {
    for (const f of ['dog', 'cat'] as const) {
      expect(STARTER_IDS[f]).toHaveLength(5);
      for (const id of STARTER_IDS[f]) expect(factionOf(findDog(id)!)).toBe(f);
    }
  });
});

describe('選陣營', () => {
  it('新存檔還沒選，當成汪國', () => {
    const s = fresh();
    expect(needFactionPick(s)).toBe(true);
    expect(playerFaction(s)).toBe('dog');
    expect(isFreshSave(s)).toBe(true);
  });

  it('剛開始就選喵國：手上換成五隻貓，隊伍與主頁角色也是貓', () => {
    const s = chooseFaction(fresh(), 'cat');
    expect(s.faction).toBe('cat');
    expect(s.owned).toEqual(STARTER_IDS.cat);
    expect(Object.keys(s.dogs).sort()).toEqual([...STARTER_IDS.cat].sort());
    expect(s.team).toEqual(STARTER_IDS.cat.slice(0, 3));
    expect(s.lobbyDogId).toBe('juzuo');
    expect(s.dogs.juzuo.level).toBe(3);
    expect(needFactionPick(s)).toBe(false);
    // 還沒開始玩，可以換回來，手上又是五隻狗
    const back = chooseFaction(s, 'dog');
    expect(back.owned).toEqual(STARTER_IDS.dog);
    expect(back.lobbyDogId).toBe('daer');
  });

  it('選汪國：什麼都不變，只記下陣營', () => {
    const s = fresh();
    const d = chooseFaction(s, 'dog');
    expect(d.owned).toEqual(s.owned);
    expect(d.team).toEqual(s.team);
    expect(d.faction).toBe('dog');
    expect(chooseFaction(d, 'dog')).toBe(d);
  });

  it('玩過的存檔換到喵國：原本的夥伴都留著，另外補五隻貓', () => {
    const played = { ...fresh(), gacha: { pulls: 10, sinceSSR: 3 }, owned: ['daer', 'liuxing'] };
    const s = chooseFaction(played, 'cat');
    expect(s.owned).toEqual(['daer', 'liuxing', ...STARTER_IDS.cat]);
    expect(s.team).toEqual(played.team);
    expect(s.lobbyDogId).toBe('daer');
    for (const id of STARTER_IDS.cat) expect(s.dogs[id]).toBeTruthy();
  });

  it('召募分陣營：汪國只抽得到狗，喵國只抽得到貓', () => {
    expect(gachaPool('dog')).toHaveLength(50);
    expect(
      gachaPool('cat')
        .map((d) => d.id)
        .sort(),
    ).toEqual(CATS.map((d) => d.id).sort());
    let s = chooseFaction(fresh(), 'cat');
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) s = pull(s, 10, rng).state;
    expect(s.owned.every((id) => factionOf(findDog(id)!) === 'cat')).toBe(true);
    expect(collection(s.owned, 'cat')).toEqual({ owned: 20, total: 20 });
    expect(featuredDogs(3, 'cat').every((d) => d.rarity === 'SSR' && d.faction === 'cat')).toBe(
      true,
    );
    expect(signinPickPool('cat')).toHaveLength(4);
    expect(signinPickPool('dog')).toHaveLength(10);
  });

  it('看得到的名單：自己陣營的全部，加上手上別陣營的', () => {
    expect(rosterOf('dog')).toHaveLength(50);
    expect(rosterOf('cat')).toHaveLength(20);
    expect(rosterOf('cat', ['daer'])).toHaveLength(21);
    expect(collection(['daer', 'juzuo'], 'cat')).toEqual({ owned: 2, total: 21 });
    expect(DOGS).toHaveLength(70);
  });

  it('存檔記得陣營；舊存檔沒有這一欄就是還沒選', () => {
    const s = chooseFaction(fresh(), 'cat');
    const back = deserialize(serialize(s, NOW), NOW);
    expect(back.state.faction).toBe('cat');
    expect(back.state.owned).toEqual(STARTER_IDS.cat);
    expect(sanitizeFaction(undefined)).toBe('');
    expect(sanitizeFaction('bird')).toBe('');
  });

  it('網址參數', () => {
    expect(factionFromSearch('?faction=cat')).toEqual({ pick: 'cat', popup: false });
    expect(factionFromSearch('?faction=0')).toEqual({ pick: null, popup: false });
    expect(factionFromSearch('?fast=1')).toEqual({ pick: null, popup: true });
  });
});
