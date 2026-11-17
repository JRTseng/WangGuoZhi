import { afterEach, describe, expect, it } from 'vitest';
import { REGIONS, findStage } from './regions';
import { STORIES, STORIES_BY_FACTION, findStory } from './stories';
import { towerStage } from './tower';
import { applyWorld, worldFaction } from './world';
import { wt } from './worldText';
import { breedArtOf } from '../scenes/components/breedArt';
import { findDog } from './dogs';
import { MAIN_QUESTS } from '../logic/quests';

afterEach(() => applyWorld('dog'));

const snapshot = () =>
  REGIONS.map((r) => ({
    description: r.description,
    gang: r.gang.name,
    stages: r.stages.map((s) => ({
      name: s.name,
      boss: s.boss?.name,
      enemies: s.enemies.map((e) => `${e.name}/${e.look?.breed}`),
    })),
  }));
const numbers = () =>
  REGIONS.flatMap((r) =>
    r.stages.map((s) => ({
      id: s.id,
      scale: s.scale,
      teamMax: s.teamMax,
      power: s.recommendedPower,
      reward: s.reward,
      enemies: s.enemies.map((e) => [e.role, e.row, e.weight, !!e.canUlt, e.trait]),
    })),
  );

describe('兩個陣營的世界（T031）', () => {
  it('喵國：每一章的介紹、敵人、頭目都換成貓，數值一個都不變', () => {
    const dog = snapshot();
    const dogNumbers = numbers();
    applyWorld('cat');
    expect(worldFaction()).toBe('cat');
    const cat = snapshot();
    expect(numbers()).toEqual(dogNumbers);
    cat.forEach((r, i) => {
      expect(r.description).not.toBe(dog[i].description);
      expect(r.gang).not.toBe(dog[i].gang);
      r.stages.forEach((s, j) => {
        for (const e of s.enemies) {
          const [name, breed] = e.split('/');
          expect(dog[i].stages[j].enemies.some((x) => x.startsWith(`${name}/`))).toBe(false);
          expect(breedArtOf(breed), breed).toBeTruthy();
          expect(/貓|石虎|兔猻|雲豹|雪豹|白虎/.test(breed), breed).toBe(true);
        }
        if (s.boss) expect(s.boss).not.toBe(dog[i].stages[j].boss);
      });
    });
    const names = REGIONS.map((r) => r.stages[r.stages.length - 1].boss!.name);
    expect(new Set(names).size).toBe(10);
    expect(findStage('luoyepo-5')!.name).toBe('石虎・葉影');
    // 第 1 章通關送的夥伴照舊
    expect(findStage('luoyepo-5')!.firstClearDog).toBe('nuantong');
  });

  it('換回汪國：全部還原', () => {
    const dog = snapshot();
    applyWorld('cat');
    applyWorld('dog');
    expect(snapshot()).toEqual(dog);
    expect(findStage('luoyepo-5')!.boss!.name).toBe('雷吼');
  });

  it('登天塔與主線任務的頭目名字跟著換', () => {
    expect(towerStage(10)!.boss!.name).toBe('塔主雷吼');
    expect(towerStage(1)!.boss!.name.endsWith('犬')).toBe(true);
    applyWorld('cat');
    expect(towerStage(10)!.boss!.name).toBe('塔主葉影');
    expect(towerStage(1)!.boss!.name.endsWith('貓')).toBe(true);
    expect(MAIN_QUESTS.find((q) => q.id === 'main-luoyepo-boss')!.title).toContain('葉影');
  });

  it('劇情：兩邊一樣多、解鎖的時機一樣、內容不同，說話的都是自己陣營的', () => {
    const dog = STORIES_BY_FACTION.dog;
    const cat = STORIES_BY_FACTION.cat;
    expect(cat.map((s) => s.unlockAfter)).toEqual(dog.map((s) => s.unlockAfter));
    expect(cat.map((s) => s.art)).toEqual(dog.map((s) => s.art));
    for (const s of cat) {
      expect(s.id.startsWith('cat-')).toBe(true);
      expect(findStory(s.id)).toBe(s);
      for (const l of s.lines) {
        if (l.speaker) expect(findDog(l.speaker)?.faction, l.speaker).toBe('cat');
      }
    }
    expect(STORIES.map((s) => s.id)).toEqual(dog.map((s) => s.id));
    applyWorld('cat');
    expect(STORIES.map((s) => s.id)).toEqual(cat.map((s) => s.id));
    // 汪國的劇情還是找得到（存檔裡看過的不會被清掉）
    expect(findStory('prologue')).toBeTruthy();
  });

  it('畫面上的字跟著陣營換：狗狗說成貓咪，回到汪國就換回來', () => {
    expect(wt('擁有 {n} 隻狗狗')).toBe('擁有 {n} 隻狗狗');
    applyWorld('cat');
    expect(wt('擁有 {n} 隻狗狗')).toBe('擁有 {n} 隻貓咪');
    expect(wt('汪國招賢榜')).toBe('喵國招賢榜');
    expect(wt('別的狗穿不下')).toBe('別的貓穿不下');
    applyWorld('dog');
    expect(wt('汪王')).toBe('汪王');
  });
});
