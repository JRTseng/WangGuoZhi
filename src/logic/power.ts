/** 每升一級，戰力加成的比例（1 級無加成） */
export const LEVEL_BONUS_RATE = 0.1;

/**
 * 戰力 = (攻擊 + 防禦) × 等級修正，四捨五入為整數。
 * 等級修正 = 1 + (等級 − 1) × LEVEL_BONUS_RATE
 * 例：攻 40、防 50、3 級 → 90 × 1.2 = 108
 * 等級小於 1 視為 1，攻防負數視為 0。
 */
export function calcPower(attack: number, defense: number, level: number): number {
  const base = Math.max(0, attack) + Math.max(0, defense);
  const lv = Math.max(1, Math.floor(level));
  return Math.round(base * (1 + (lv - 1) * LEVEL_BONUS_RATE));
}
