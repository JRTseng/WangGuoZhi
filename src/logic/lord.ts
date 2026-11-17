import { wt } from '../data/worldText';
import type { GameState, LordState } from '../state/gameState';

/**
 * 城主等級（2026-11-15 Jimmy：「城主的等級提升也要設計一下」）。全部是純函式，數值都是暫定。
 *
 * - 城主經驗只從出征來：打贏 +20、打輸 +8（和一場花的體力差不多），自動出征也算。
 * - 升到下一級要「目前等級 × 100」經驗（Lv.1 → 2 要 100，也就是打贏 5 場），最高 60 級。
 * - 每升一級：送糧草「新等級 × 200」、骨頭幣「新等級 × 20」。
 *   （沒有做「升級補滿體力」：自動出征會因此一直打下去，等體力規則定案再說。）
 * - 每 10 級換一個稱號（小城主 → 縣令 → 太守 → 刺史 → 州牧 → 大將軍 → 汪王），只是顯示用。
 * - 舊存檔沒有城主等級：照累計勝場補算經驗（不補發升級獎勵）。
 */
export const LORD_MAX_LEVEL = 60;
export const LORD_EXP_WIN = 20;
export const LORD_EXP_LOSE = 8;

export const INITIAL_LORD: LordState = { level: 1, exp: 0 };

/** 這一級升到下一級要多少經驗；滿級回傳 0 */
export function lordExpNeeded(level: number): number {
  const lv = Math.max(1, Math.floor(level));
  return lv >= LORD_MAX_LEVEL ? 0 : lv * 100;
}

/** 升到 level 級時送的獎勵 */
export function lordReward(level: number): { food: number; bones: number } {
  return { food: level * 200, bones: level * 20 };
}

const TITLES: readonly (readonly [number, string])[] = [
  [60, '汪王'],
  [50, '大將軍'],
  [40, '州牧'],
  [30, '刺史'],
  [20, '太守'],
  [10, '縣令'],
  [1, '小城主'],
];

/** 這個等級的稱號 */
export function lordTitle(level: number): string {
  return wt((TITLES.find(([lv]) => level >= lv) ?? TITLES[TITLES.length - 1])[1]);
}

/** 一場出征給多少城主經驗 */
export function lordExpOf(win: boolean): number {
  return win ? LORD_EXP_WIN : LORD_EXP_LOSE;
}

/** 這次拿到的城主經驗與升級結果（寫進出征紀錄，結算照著顯示） */
export interface LordGain {
  exp: number;
  fromLevel: number;
  toLevel: number;
  /** 升級送的糧草、骨頭幣合計；沒升級都是 0 */
  food: number;
  bones: number;
}

/** 只算等級與經驗，不動資源：加上 amount 經驗後的城主狀態與這次的結果 */
export function gainLordExp(lord: LordState, amount: number): { lord: LordState; gain: LordGain } {
  const fromLevel = lord.level;
  let level = lord.level;
  const gained = level >= LORD_MAX_LEVEL ? 0 : Math.max(0, Math.floor(amount));
  let exp = level >= LORD_MAX_LEVEL ? 0 : lord.exp + gained;
  let food = 0;
  let bones = 0;
  while (level < LORD_MAX_LEVEL && exp >= lordExpNeeded(level)) {
    exp -= lordExpNeeded(level);
    level++;
    const r = lordReward(level);
    food += r.food;
    bones += r.bones;
  }
  if (level >= LORD_MAX_LEVEL) exp = 0;
  return { lord: { level, exp }, gain: { exp: gained, fromLevel, toLevel: level, food, bones } };
}

/** 給城主經驗：升級的話獎勵直接進資源 */
export function addLordExp<T extends Pick<GameState, 'lord' | 'resources'>>(
  state: T,
  amount: number,
): { state: T; gain: LordGain } {
  const { lord, gain } = gainLordExp(state.lord, amount);
  const up = gain.toLevel > gain.fromLevel;
  return {
    gain,
    state: {
      ...state,
      lord,
      resources: up
        ? {
            ...state.resources,
            food: state.resources.food + gain.food,
            bones: state.resources.bones + gain.bones,
          }
        : state.resources,
    },
  };
}

/** 舊存檔：照累計勝場補算城主等級（不發獎勵） */
export function lordFromWins(wins: number): LordState {
  return gainLordExp(INITIAL_LORD, Math.max(0, Math.floor(wins)) * LORD_EXP_WIN).lord;
}

/** 讀檔：等級與經驗要是合理的整數；沒有這個欄位就照勝場補算 */
export function sanitizeLord(raw: unknown, wins: number): LordState {
  if (typeof raw !== 'object' || raw === null) return lordFromWins(wins);
  const v = raw as Record<string, unknown>;
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (!ok(v.level) || !ok(v.exp)) return lordFromWins(wins);
  const level = Math.min(LORD_MAX_LEVEL, Math.max(1, Math.floor(v.level)));
  const need = lordExpNeeded(level);
  const exp = need === 0 ? 0 : Math.min(need - 1, Math.max(0, Math.floor(v.exp)));
  return { level, exp };
}

/** 結算上的訊息：升級才寫（平常的經驗看主頁左上的經驗條） */
export function lordNotes(gain: LordGain | undefined): string[] {
  if (!gain || gain.toLevel <= gain.fromLevel) return [];
  return [
    `城主升到 Lv.${gain.toLevel}「${lordTitle(gain.toLevel)}」！糧草 +${gain.food}、骨頭幣 +${gain.bones}`,
  ];
}
