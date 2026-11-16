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

/**
 * 要不要把畫面轉 90 度：觸控裝置直拿的時候才轉（手機開著直向鎖定也能橫著玩）。
 * 電腦上把視窗拉成直的不轉，畫面照樣是橫的、上下留邊。
 */
export function shouldRotate(width: number, height: number, touch: boolean): boolean {
  return touch && orientationFor(width, height) === 'portrait';
}

/**
 * 畫面順時針轉 90 度以後（手機頂端變成遊戲的左邊），把手指在螢幕上的位置換回沒轉之前的位置。
 * viewWidth 是直拿時螢幕的寬。
 */
export function unrotatePoint(
  pageX: number,
  pageY: number,
  viewWidth: number,
): { x: number; y: number } {
  return { x: pageY, y: viewWidth - pageX };
}
