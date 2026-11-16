/**
 * 狗的體型（T025）：小型、中型、大型的狗在畫面上看起來大小不同。
 * 只影響外觀，不影響數值與戰鬥。
 */
import type { DogSize } from '../data/dogs';

/** 全身的狗（主頁、劇情、小遊戲）照體型放大或縮小多少 */
export const BODY_SCALE: Record<DogSize, number> = { 小型: 0.8, 中型: 1, 大型: 1.18 };

/** 戰鬥頭像照體型放大或縮小多少（差距小一點，才不會擠到旁邊的格子） */
export const HEAD_SCALE: Record<DogSize, number> = { 小型: 0.88, 中型: 1, 大型: 1.1 };

/** 全身的狗的縮放倍數；沒寫體型的（敵人、頭目）當中型 */
export function bodyScale(size: DogSize | undefined): number {
  return size ? BODY_SCALE[size] : 1;
}

/** 戰鬥頭像的縮放倍數 */
export function headScale(size: DogSize | undefined): number {
  return size ? HEAD_SCALE[size] : 1;
}
