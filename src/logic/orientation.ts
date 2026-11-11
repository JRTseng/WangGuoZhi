import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/** 手機直放／橫放 */
export type Orientation = 'portrait' | 'landscape';

/** 依可用的畫面寬高判斷方向（正方形算直式） */
export function orientationFor(width: number, height: number): Orientation {
  return width > height ? 'landscape' : 'portrait';
}

/** 各方向的遊戲設計尺寸：直式 390 x 844，橫式把寬高對調 */
export function gameSizeFor(o: Orientation): { width: number; height: number } {
  return o === 'landscape'
    ? { width: GAME_HEIGHT, height: GAME_WIDTH }
    : { width: GAME_WIDTH, height: GAME_HEIGHT };
}
