import { findDog, type DogData } from '../data/dogs';
import type { StageData } from '../data/regions';
import type { DogProgress, GameState } from '../state/gameState';
import { calcPower } from './power';

/**
 * 升級（T005）：經驗值、每級成長、隨機加成。全部是純函式，亂數由外面傳入。
 *
 * 每升一級：
 * - 固定成長：主屬性 +3、副屬性 +2（突擊攻擊為主、守護防禦為主；其餘定位攻防輪流 +3／+2）
 * - 隨機加成：攻擊、防禦各自再加 0、+1 或 +2（平均 +1）
 * - 同一隻狗累積的隨機加成和平均（每級 +1）的差距不會超過 ±BONUS_DRIFT_LIMIT
 * 結果在升級當下就寫進狀態，之後不會重抽。
 */

/** 等級上限（滿星時；星數低的狗上限比較低，見 levelCapOf） */
export const MAX_LEVEL = 100;

// ---- 星數（T007）：重複抽到換碎片，在訓練場升星（操作在 src/logic/star.ts） ----

/** 最高幾星；新拿到的狗是 1 星 */
export const STAR_MAX = 5;
/** 1 星的等級上限，之後每升一星 + STAR_LEVEL_CAP_STEP，滿星剛好是 MAX_LEVEL（暫定） */
export const STAR_LEVEL_CAP_BASE = 60;
export const STAR_LEVEL_CAP_STEP = 10;
/** 每升一星，攻擊、防禦各多「資料檔基礎值」的這個比例（暫定） */
export const STAR_STAT_RATE = 0.1;

/** 這隻狗幾星（舊存檔沒有這個欄位就是 1 星） */
export function starOf(p: Pick<DogProgress, 'star'>): number {
  return Math.min(STAR_MAX, Math.max(1, Math.floor(p.star ?? 1)));
}

/** 幾星的等級上限 */
export function levelCapForStar(star: number): number {
  const s = Math.min(STAR_MAX, Math.max(1, Math.floor(star)));
  return Math.min(MAX_LEVEL, STAR_LEVEL_CAP_BASE + STAR_LEVEL_CAP_STEP * (s - 1));
}

/** 這隻狗目前的等級上限（看星數） */
export function levelCapOf(p: Pick<DogProgress, 'star'>): number {
  return levelCapForStar(starOf(p));
}

/** 幾星讓一項基礎屬性多多少 */
export function starBonus(base: number, star: number): number {
  const s = Math.min(STAR_MAX, Math.max(1, Math.floor(star)));
  return Math.round(Math.max(0, base) * STAR_STAT_RATE * (s - 1));
}
/** 每級所需經驗 = EXP_BASE × 等級^EXP_CURVE（暫定，等 Jimmy 手機實測後再調） */
export const EXP_BASE = 20;
export const EXP_CURVE = 1.5;
/** 打輸拿到的經驗比例 */
export const DEFEAT_EXP_RATE = 0.5;
/** 隨機加成的平均值（每級） */
export const BONUS_AVERAGE = 1;
/** 累積隨機加成和平均的差距上限 */
export const BONUS_DRIFT_LIMIT = 4;

/** 一項屬性在升級時的成長：固定值 + 隨機加成 */
export interface StatGain {
  fixed: number;
  bonus: number;
}

/** 升一級的結果 */
export interface LevelUp {
  /** 升到第幾級 */
  level: number;
  attack: StatGain;
  defense: StatGain;
}

/** 一隻狗在一次收成裡拿到的經驗與成長（寫進出征紀錄，結算畫面照著顯示） */
export interface DogExpGain {
  dogId: string;
  /** 實際拿到的經驗（滿級為 0） */
  exp: number;
  fromLevel: number;
  toLevel: number;
  /** 這次連升幾級的成長合計；沒升級都是 0 */
  attack: StatGain;
  defense: StatGain;
}

/** 這一級升到下一級需要多少經驗；到等級上限（cap，預設是滿星的上限）回傳 0 */
export function expNeeded(level: number, cap: number = MAX_LEVEL): number {
  const lv = Math.max(1, Math.floor(level));
  if (lv >= Math.min(cap, MAX_LEVEL)) return 0;
  return Math.round(EXP_BASE * lv ** EXP_CURVE);
}

/** 升到 toLevel 那一級的固定成長 */
export function fixedGrowth(
  role: DogData['role'],
  toLevel: number,
): { attack: number; defense: number } {
  if (role.includes('突擊')) return { attack: 3, defense: 2 };
  if (role.includes('守護')) return { attack: 2, defense: 3 };
  // 後排與隊長：攻防各 +2.5，輪流給 +3／+2
  return toLevel % 2 === 0 ? { attack: 3, defense: 2 } : { attack: 2, defense: 3 };
}

/**
 * 抽一次隨機加成（0、1、2）。drift 是目前累積加成和平均的差距；
 * 已經到上限還抽到會超出的值，就改成往平均拉回的那一邊。
 */
export function rollBonus(drift: number, rng: () => number): number {
  const r = Math.min(2, Math.floor(rng() * 3));
  if (drift >= BONUS_DRIFT_LIMIT && r === 2) return 0;
  if (drift <= -BONUS_DRIFT_LIMIT && r === 0) return 2;
  return r;
}

/** 累積隨機加成和平均的差距（正的代表運氣比平均好） */
export function bonusDrift(p: DogProgress): { attack: number; defense: number } {
  return {
    attack: p.bonusAttack - p.rolls * BONUS_AVERAGE,
    defense: p.bonusDefense - p.rolls * BONUS_AVERAGE,
  };
}

/** 新拿到的狗的養成進度：資料檔的等級若大於 1，之前的等級用固定成長 + 平均加成補上 */
export function initialProgress(dog: Pick<DogData, 'role' | 'level'>): DogProgress {
  const level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(dog.level)));
  const p: DogProgress = {
    level,
    exp: 0,
    growthAttack: 0,
    growthDefense: 0,
    bonusAttack: 0,
    bonusDefense: 0,
    rolls: 0,
  };
  for (let lv = 2; lv <= level; lv++) {
    const f = fixedGrowth(dog.role, lv);
    p.growthAttack += f.attack + BONUS_AVERAGE;
    p.growthDefense += f.defense + BONUS_AVERAGE;
    p.bonusAttack += BONUS_AVERAGE;
    p.bonusDefense += BONUS_AVERAGE;
    p.rolls++;
  }
  return p;
}

/** 升一級（已到這隻狗的等級上限則不變） */
export function levelUp(
  p: DogProgress,
  role: DogData['role'],
  rng: () => number,
): { progress: DogProgress; up: LevelUp | null } {
  if (p.level >= levelCapOf(p)) return { progress: p, up: null };
  const level = p.level + 1;
  const fixed = fixedGrowth(role, level);
  const drift = bonusDrift(p);
  const attack: StatGain = { fixed: fixed.attack, bonus: rollBonus(drift.attack, rng) };
  const defense: StatGain = { fixed: fixed.defense, bonus: rollBonus(drift.defense, rng) };
  return {
    progress: {
      ...p,
      level,
      exp: p.exp,
      growthAttack: p.growthAttack + attack.fixed + attack.bonus,
      growthDefense: p.growthDefense + defense.fixed + defense.bonus,
      bonusAttack: p.bonusAttack + attack.bonus,
      bonusDefense: p.bonusDefense + defense.bonus,
      rolls: p.rolls + 1,
    },
    up: { level, attack, defense },
  };
}

/**
 * 加經驗：滿了就自動升級，可以連升，多的經驗留到下一級。
 * 到等級上限（看星數）後經驗不再累積（歸零）。
 */
export function addExp(
  p: DogProgress,
  role: DogData['role'],
  amount: number,
  rng: () => number,
): { progress: DogProgress; gained: number; ups: LevelUp[] } {
  const cap = levelCapOf(p);
  const gained = p.level >= cap ? 0 : Math.max(0, Math.floor(amount));
  let cur: DogProgress = { ...p, exp: p.level >= cap ? 0 : p.exp + gained };
  const ups: LevelUp[] = [];
  while (cur.level < cap && cur.exp >= expNeeded(cur.level, cap)) {
    const r = levelUp({ ...cur, exp: cur.exp - expNeeded(cur.level, cap) }, role, rng);
    cur = r.progress;
    if (r.up) ups.push(r.up);
  }
  if (cur.level >= cap) cur = { ...cur, exp: 0 };
  return { progress: cur, gained, ups };
}

/** 把連升幾級的成長加總 */
export function sumUps(ups: readonly LevelUp[]): { attack: StatGain; defense: StatGain } {
  const sum = (pick: (u: LevelUp) => StatGain): StatGain => ({
    fixed: ups.reduce((s, u) => s + pick(u).fixed, 0),
    bonus: ups.reduce((s, u) => s + pick(u).bonus, 0),
  });
  return { attack: sum((u) => u.attack), defense: sum((u) => u.defense) };
}

/**
 * 一關給隊伍裡每隻狗多少經驗（不平分）：越難給越多。
 * T019 起每一關都花一樣的體力，所以只看難度。暫定公式：30 ×（難度 + 2）。
 */
export function stageExp(stage: Pick<StageData, 'difficulty'>): number {
  return 30 * (stage.difficulty + 2);
}

/** 這次出征每隻狗拿多少經驗：打贏全額，打輸一半 */
export function expeditionExp(stage: Pick<StageData, 'difficulty'>, win: boolean): number {
  const full = stageExp(stage);
  return win ? full : Math.floor(full * DEFEAT_EXP_RATE);
}

// ---- 讀取：畫面與戰鬥都用這裡的數字 ----

type HasDogs = Pick<GameState, 'dogs'>;

/** 這隻狗的養成進度；狀態裡還沒有（例如還沒擁有）就用初始值 */
export function progressOf(state: HasDogs, dog: DogData): DogProgress {
  return state.dogs[dog.id] ?? initialProgress(dog);
}

/** 一隻狗目前的數字：攻防 = 基礎值 + 星數加成 + 升級成長 + 特訓加成，戰力由攻防算出 */
export interface DogStats {
  level: number;
  exp: number;
  /** 升下一級需要的經驗；到等級上限為 0 */
  expNeed: number;
  /** 星數（T007）與這個星數的等級上限 */
  star: number;
  levelCap: number;
  /** 星數帶來的攻防加成（已算進攻防） */
  starAttack: number;
  starDefense: number;
  attack: number;
  defense: number;
  power: number;
  growthAttack: number;
  growthDefense: number;
  /** 訓練場特訓的次數（每次 +1，已算進攻防） */
  drillAttack: number;
  drillDefense: number;
  /** 隨機加成累積和平均的差距（正的代表運氣好） */
  luck: number;
}

export function dogStats(state: HasDogs, dog: DogData): DogStats {
  const p = progressOf(state, dog);
  const drillAttack = p.drillAttack ?? 0;
  const drillDefense = p.drillDefense ?? 0;
  const star = starOf(p);
  const levelCap = levelCapForStar(star);
  const starAttack = starBonus(dog.baseAttack, star);
  const starDefense = starBonus(dog.baseDefense, star);
  const attack = dog.baseAttack + starAttack + p.growthAttack + drillAttack;
  const defense = dog.baseDefense + starDefense + p.growthDefense + drillDefense;
  const drift = bonusDrift(p);
  const expNeed = expNeeded(p.level, levelCap);
  return {
    level: p.level,
    exp: expNeed === 0 ? 0 : p.exp,
    expNeed,
    star,
    levelCap,
    starAttack,
    starDefense,
    attack,
    defense,
    power: calcPower(attack, defense),
    growthAttack: p.growthAttack,
    growthDefense: p.growthDefense,
    drillAttack,
    drillDefense,
    luck: drift.attack + drift.defense,
  };
}

export function dogStatsById(state: HasDogs, dogId: string): DogStats | undefined {
  const d = findDog(dogId);
  return d ? dogStats(state, d) : undefined;
}

/** 還沒進狀態的狗（或沒有狀態可查時）用的初始數字 */
export function baseStats(dog: DogData): DogStats {
  return dogStats({ dogs: {} }, dog);
}

/** 結算畫面用的一行字，例如「攻 +3（+1） 防 +2（+0）」：固定成長（隨機加成） */
export function formatGain(g: Pick<DogExpGain, 'attack' | 'defense'>): string {
  return `攻 +${g.attack.fixed}（+${g.attack.bonus}）\u3000防 +${g.defense.fixed}（+${g.defense.bonus}）`;
}
