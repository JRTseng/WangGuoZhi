/**
 * 戰力 = 攻擊 + 防禦，四捨五入為整數。
 * 攻防已經是「基礎值 + 升級成長值」（見 src/logic/leveling.ts），
 * 所以等級越高戰力越高；T005 起不再另外乘等級修正（Jimmy 2026-11-12）。
 * 攻防負數視為 0。
 */
export function calcPower(attack: number, defense: number): number {
  return Math.round(Math.max(0, attack) + Math.max(0, defense));
}
