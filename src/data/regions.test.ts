import { describe, expect, it } from 'vitest';
import {
  BOSS_WEIGHT,
  REGIONS,
  chapterName,
  findRegionOfStage,
  findStage,
  parseLineup,
  teamMaxOf,
} from './regions';
import { STORIES } from './stories';

describe('regions', () => {
  it('10 個章節，每章 5 小節', () => {
    expect(REGIONS.map((r) => r.chapter)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(REGIONS.map((r) => r.name)).size).toBe(10);
    expect(chapterName(1)).toBe('第一章');
    expect(chapterName(10)).toBe('第十章');
    for (const r of REGIONS) expect(r.stages).toHaveLength(5);
  });
  it('第 1 章是落葉坡，難度由低到高', () => {
    expect(REGIONS[0].name).toBe('落葉坡');
    expect(REGIONS[0].stages.map((s) => s.difficulty)).toEqual([1, 2, 3, 3, 4]);
  });
  it('每章只有最後一關是 Boss', () => {
    for (const r of REGIONS) {
      expect(r.stages.map((s) => !!s.boss)).toEqual([false, false, false, false, true]);
    }
    expect(REGIONS.slice(0, 3).map((r) => r.stages[4].boss!.breed)).toEqual([
      '高山犬',
      '大丹犬',
      '藏獒',
    ]);
    // Boss 的名字與犬種都不重複
    expect(new Set(REGIONS.map((r) => r.stages[4].boss!.name)).size).toBe(10);
    expect(new Set(REGIONS.map((r) => r.stages[4].boss!.breed)).size).toBe(10);
  });
  it('關卡 id 不重複，獎勵為正', () => {
    const ids = REGIONS.flatMap((r) => r.stages.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of REGIONS.flatMap((r) => r.stages)) {
      expect(s.reward.food).toBeGreaterThan(0);
      expect(s.reward.bones).toBeGreaterThan(0);
    }
  });
  it('findStage / findRegionOfStage', () => {
    expect(findStage('luoyepo-2')?.name).toBe('紅葉林');
    expect(findStage('nope')).toBeUndefined();
    expect(findRegionOfStage('zhulindu-3')?.chapter).toBe(2);
    expect(findRegionOfStage('nope')).toBeUndefined();
  });

  describe('關卡敵人（T018）', () => {
    const gang = { name: '測試', color: 0x808080 };
    const boss = { name: '大王', breed: '獒', color: 1, accent: 2 };

    it('陣容字串：前排/中排/後排，一個字母一隻，同名加甲乙丙', () => {
      const list = parseLineup('gag/B/s', gang, boss);
      expect(list.map((e) => `${e.name}:${e.role}:${e.row}`)).toEqual([
        '測試盾兵甲:守護:0',
        '測試先鋒:突擊:0',
        '測試盾兵乙:守護:0',
        '大王:頭目:1',
        '測試投石手:謀略:2',
      ]);
      expect(list[3]).toMatchObject({ weight: BOSS_WEIGHT, canUlt: true, look: { big: true } });
      expect(list[0].canUlt).toBeUndefined();
      // 精銳會放大絕招；藥師補得比較少
      expect(parseLineup('e/h', gang)[0].canUlt).toBe(true);
      expect(parseLineup('e/h', gang)[1]).toMatchObject({
        role: '補血',
        trait: 'smallHeal',
        row: 1,
      });
      expect(() => parseLineup('x', gang)).toThrow();
    });

    it('上陣數量跟著敵人數量：頭目算兩隻，最多 5 隻', () => {
      expect(teamMaxOf(parseLineup('ee', gang))).toBe(2);
      expect(teamMaxOf(parseLineup('mm/m', gang))).toBe(3);
      expect(teamMaxOf(parseLineup('mm/B', gang, boss))).toBe(4);
      expect(teamMaxOf(parseLineup('mmm/mmm', gang))).toBe(5);
      expect(teamMaxOf(parseLineup('gg/B/s', gang, boss))).toBe(5);
    });

    it('每一關都有敵人，一排最多 3 隻；Boss 關有頭目加 2～4 隻小兵，其他關沒有頭目', () => {
      for (const s of REGIONS.flatMap((r) => r.stages)) {
        expect(s.enemies.length, s.id).toBeGreaterThanOrEqual(2);
        expect(s.teamMax, s.id).toBe(teamMaxOf(s.enemies));
        for (const row of [0, 1, 2]) {
          expect(s.enemies.filter((e) => e.row === row).length, s.id).toBeLessThanOrEqual(3);
        }
        // 最前面一定有人擋著
        expect(
          s.enemies.some((e) => e.row === 0),
          s.id,
        ).toBe(true);
        const bosses = s.enemies.filter((e) => e.role === '頭目');
        expect(bosses.length, s.id).toBe(s.boss ? 1 : 0);
        if (s.boss) {
          expect(bosses[0].name).toBe(s.boss.name);
          expect(s.enemies.length - 1, s.id).toBeGreaterThanOrEqual(2);
          expect(s.enemies.length - 1, s.id).toBeLessThanOrEqual(4);
          // 頭目會把藥師的補血吃得太兇，Boss 關不放藥師
          expect(
            s.enemies.some((e) => e.role === '補血'),
            s.id,
          ).toBe(false);
        }
      }
    });

    it('建議戰力與難度一章比一章高；每章打倒 Boss 都有一段劇情', () => {
      const bossPower = REGIONS.map((r) => r.stages[4].recommendedPower);
      expect([...bossPower].sort((a, b) => a - b)).toEqual(bossPower);
      // 每一章 Boss 關的難度都比上一章高
      const diff = REGIONS.map((r) => r.stages[4].difficulty);
      expect(new Set(diff).size).toBe(diff.length);
      expect([...diff].sort((x, y) => x - y)).toEqual(diff);
      for (const r of REGIONS) {
        expect(
          STORIES.some((s) => s.unlockAfter === r.stages[4].id),
          r.id,
        ).toBe(true);
      }
    });
  });
});
