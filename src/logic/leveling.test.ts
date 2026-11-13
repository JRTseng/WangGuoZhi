import { describe, expect, it } from 'vitest';
import { DOGS, findDog } from '../data/dogs';
import type { DogProgress } from '../state/gameState';
import { createRng } from './battle';
import {
  BONUS_DRIFT_LIMIT,
  MAX_LEVEL,
  STAR_MAX,
  dogStats,
  levelCapForStar,
  levelCapOf,
  starBonus,
  starOf,
  addExp,
  baseStats,
  bonusDrift,
  expNeeded,
  expeditionExp,
  fixedGrowth,
  formatGain,
  initialProgress,
  levelUp,
  rollBonus,
  stageExp,
  sumUps,
} from './leveling';

const fresh = (): DogProgress => initialProgress({ role: '前排／突擊', level: 1 });
/** 滿星的狗：等級上限才是 MAX_LEVEL（T007） */
const maxStar = (): DogProgress => ({ ...fresh(), star: STAR_MAX });
const ATTACKER = '前排／突擊' as const;
const GUARD = '前排／守護' as const;
const LEADER = '隊長／補給' as const;

describe('expNeeded', () => {
  it('越高等需要越多經驗，前期升得快', () => {
    expect(expNeeded(1)).toBe(20);
    for (let lv = 2; lv < MAX_LEVEL; lv++) expect(expNeeded(lv)).toBeGreaterThan(expNeeded(lv - 1));
  });
  it('滿級不需要經驗', () => {
    expect(expNeeded(MAX_LEVEL)).toBe(0);
    expect(expNeeded(MAX_LEVEL + 5)).toBe(0);
  });
});

describe('fixedGrowth', () => {
  it('突擊攻擊 +3 防禦 +2；守護攻擊 +2 防禦 +3', () => {
    expect(fixedGrowth(ATTACKER, 2)).toEqual({ attack: 3, defense: 2 });
    expect(fixedGrowth(ATTACKER, 3)).toEqual({ attack: 3, defense: 2 });
    expect(fixedGrowth(GUARD, 2)).toEqual({ attack: 2, defense: 3 });
  });
  it('後排與隊長輪流 +3／+2，兩級下來攻防各 +5', () => {
    for (const role of [LEADER, '後排／謀略', '後排／幸運'] as const) {
      const a = fixedGrowth(role, 2);
      const b = fixedGrowth(role, 3);
      expect(a.attack + a.defense).toBe(5);
      expect(a.attack + b.attack).toBe(5);
      expect(a.defense + b.defense).toBe(5);
    }
  });
});

describe('rollBonus', () => {
  it('只會是 0、1、2，三種都抽得到', () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) seen.add(rollBonus(0, rng));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
  it('到上限時往平均拉回', () => {
    expect(rollBonus(BONUS_DRIFT_LIMIT, () => 0.99)).toBe(0);
    expect(rollBonus(-BONUS_DRIFT_LIMIT, () => 0)).toBe(2);
    expect(rollBonus(BONUS_DRIFT_LIMIT - 1, () => 0.99)).toBe(2);
    expect(rollBonus(0, () => 1)).toBe(2); // 亂數剛好是 1 也不會超出
  });
});

describe('levelUp', () => {
  it('固定成長正確，隨機加成在 0 到 +2 之間', () => {
    const rng = createRng(7);
    let p = maxStar();
    for (let i = 0; i < 99; i++) {
      const r = levelUp(p, ATTACKER, rng);
      expect(r.up!.attack.fixed).toBe(3);
      expect(r.up!.defense.fixed).toBe(2);
      for (const b of [r.up!.attack.bonus, r.up!.defense.bonus]) {
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(2);
      }
      expect(r.progress.growthAttack - p.growthAttack).toBe(3 + r.up!.attack.bonus);
      expect(r.progress.growthDefense - p.growthDefense).toBe(2 + r.up!.defense.bonus);
      p = r.progress;
    }
    expect(p.level).toBe(MAX_LEVEL);
  });

  it('跑 1000 次從 1 級練到滿級，累積隨機加成和平均的差距都在 ±4 內', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = createRng(seed);
      let p = maxStar();
      while (p.level < MAX_LEVEL) {
        p = levelUp(p, seed % 2 ? ATTACKER : LEADER, rng).progress;
        const d = bonusDrift(p);
        expect(Math.abs(d.attack)).toBeLessThanOrEqual(BONUS_DRIFT_LIMIT);
        expect(Math.abs(d.defense)).toBeLessThanOrEqual(BONUS_DRIFT_LIMIT);
      }
    }
  });

  it('同一個亂數種子得到同樣的結果', () => {
    const run = (seed: number) => {
      const rng = createRng(seed);
      let p = fresh();
      for (let i = 0; i < 30; i++) p = levelUp(p, GUARD, rng).progress;
      return p;
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });

  it('滿級不再升', () => {
    const p = { ...maxStar(), level: MAX_LEVEL };
    const r = levelUp(p, ATTACKER, createRng(1));
    expect(r.up).toBeNull();
    expect(r.progress).toBe(p);
  });
});

describe('addExp', () => {
  it('經驗不夠就只累積', () => {
    const r = addExp(fresh(), ATTACKER, 19, createRng(1));
    expect(r.progress).toMatchObject({ level: 1, exp: 19 });
    expect(r.ups).toEqual([]);
    expect(r.gained).toBe(19);
  });

  it('滿了自動升級，多的經驗留到下一級', () => {
    const r = addExp(fresh(), ATTACKER, 30, createRng(1));
    expect(r.progress).toMatchObject({ level: 2, exp: 10 });
    expect(r.ups).toHaveLength(1);
    expect(r.ups[0].level).toBe(2);
  });

  it('一次可以連升好幾級', () => {
    const need = expNeeded(1) + expNeeded(2) + expNeeded(3);
    const r = addExp(fresh(), ATTACKER, need + 5, createRng(1));
    expect(r.progress).toMatchObject({ level: 4, exp: 5 });
    expect(r.ups.map((u) => u.level)).toEqual([2, 3, 4]);
    const sum = sumUps(r.ups);
    expect(sum.attack.fixed).toBe(9);
    expect(sum.defense.fixed).toBe(6);
    expect(r.progress.growthAttack).toBe(sum.attack.fixed + sum.attack.bonus);
  });

  it('到 100 級就停，經驗不再累積', () => {
    const r = addExp(maxStar(), ATTACKER, 100_000_000, createRng(3));
    expect(r.progress).toMatchObject({ level: MAX_LEVEL, exp: 0 });
    expect(r.ups).toHaveLength(MAX_LEVEL - 1);
    const again = addExp(r.progress, ATTACKER, 500, createRng(3));
    expect(again.progress).toEqual(r.progress);
    expect(again.gained).toBe(0);
    expect(again.ups).toEqual([]);
  });

  it('不改動傳入的進度', () => {
    const p = fresh();
    const snapshot = JSON.stringify(p);
    addExp(p, ATTACKER, 500, createRng(1));
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});

describe('初始進度與數字', () => {
  it('1 級沒有成長；資料檔等級較高的用固定成長 + 平均加成補上，運氣為 0', () => {
    expect(baseStats(findDog('abai')!)).toMatchObject({ level: 1, attack: 34, defense: 36 });
    const daer = baseStats(findDog('daer')!); // 3 級、隊長
    expect(daer).toMatchObject({ level: 3, attack: 42 + 5 + 2, defense: 48 + 5 + 2, luck: 0 });
    expect(daer.power).toBe(104);
    const heixuan = baseStats(findDog('heixuan')!); // 2 級、突擊
    expect(heixuan).toMatchObject({ attack: 64 + 4, defense: 30 + 3, power: 101 });
  });

  it('dogStats：攻防 = 基礎值 + 成長值，戰力 = 攻 + 防', () => {
    const d = findDog('abai')!;
    const p = { ...initialProgress(d), level: 5, exp: 7, growthAttack: 12, growthDefense: 15 };
    const s = dogStats({ dogs: { abai: p } }, d);
    expect(s).toMatchObject({ level: 5, exp: 7, attack: 46, defense: 51, power: 97 });
    expect(s.expNeed).toBe(expNeeded(5));
  });

  it('滿級估算：固定成長攻防合計 495，隨機約 198 上下不超過 8', () => {
    for (const d of DOGS) {
      const start = { ...initialProgress({ ...d, level: 1 }), star: STAR_MAX };
      const r = addExp(start, d.role, 1e9, createRng(11));
      const p = r.progress;
      const fixed = p.growthAttack + p.growthDefense - p.bonusAttack - p.bonusDefense;
      expect(fixed).toBe(495);
      expect(Math.abs(p.bonusAttack + p.bonusDefense - 198)).toBeLessThanOrEqual(8);
    }
  });
});

describe('關卡經驗', () => {
  it('只看難度，越難給越多；打輸拿一半', () => {
    expect(stageExp({ difficulty: 1 })).toBe(90);
    expect(stageExp({ difficulty: 7 })).toBe(270);
    expect(expeditionExp({ difficulty: 1 }, true)).toBe(90);
    expect(expeditionExp({ difficulty: 1 }, false)).toBe(45);
  });
});

describe('formatGain', () => {
  it('顯示固定成長與括號裡的隨機加成', () => {
    expect(formatGain({ attack: { fixed: 3, bonus: 1 }, defense: { fixed: 2, bonus: 0 } })).toBe(
      '攻 +3（+1）\u3000防 +2（+0）',
    );
  });
});

describe('星數與等級上限（T007）', () => {
  it('沒有星數欄位就是 1 星；星數夾在 1～5', () => {
    expect(starOf(fresh())).toBe(1);
    expect(starOf({ star: 3 })).toBe(3);
    expect(starOf({ star: 99 })).toBe(STAR_MAX);
    expect(starOf({ star: 0 })).toBe(1);
  });

  it('等級上限：1 星 60，每星 +10，滿星 100', () => {
    expect([1, 2, 3, 4, 5].map(levelCapForStar)).toEqual([60, 70, 80, 90, 100]);
    expect(levelCapOf(fresh())).toBe(60);
    expect(levelCapOf(maxStar())).toBe(MAX_LEVEL);
  });

  it('1 星練到 60 級就停，升星後可以繼續升', () => {
    const r = addExp(fresh(), ATTACKER, 100_000_000, createRng(3));
    expect(r.progress).toMatchObject({ level: 60, exp: 0 });
    expect(addExp(r.progress, ATTACKER, 500, createRng(3)).gained).toBe(0);
    expect(levelUp(r.progress, ATTACKER, createRng(1)).up).toBeNull();
    const two = addExp({ ...r.progress, star: 2 }, ATTACKER, 100_000_000, createRng(3));
    expect(two.progress).toMatchObject({ level: 70, exp: 0 });
    expect(expNeeded(60, 60)).toBe(0);
    expect(expNeeded(60, 70)).toBeGreaterThan(0);
  });

  it('每升一星攻防各多基礎值的 10%，算進攻防與戰力', () => {
    expect(starBonus(50, 1)).toBe(0);
    expect(starBonus(50, 2)).toBe(5);
    expect(starBonus(74, 5)).toBe(30);
    const dog = findDog('daer')!;
    const one = dogStats({ dogs: {} }, dog);
    const three = dogStats({ dogs: { daer: { ...initialProgress(dog), star: 3 } } }, dog);
    expect(one).toMatchObject({ star: 1, levelCap: 60, starAttack: 0, starDefense: 0 });
    expect(three).toMatchObject({ star: 3, levelCap: 80, starAttack: 8, starDefense: 10 });
    expect(three.attack).toBe(one.attack + 8);
    expect(three.power).toBe(one.power + 18);
  });

  it('到等級上限時經驗顯示為 0、不需要經驗', () => {
    const dog = findDog('daer')!;
    const s = dogStats({ dogs: { daer: { ...initialProgress(dog), level: 60, exp: 0 } } }, dog);
    expect(s).toMatchObject({ level: 60, exp: 0, expNeed: 0 });
  });
});
