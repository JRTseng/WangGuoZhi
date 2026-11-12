import Phaser from 'phaser';
import { COLORS } from '../../config';

/** 經驗條：底色 + 目前進度（0 到 1）。滿級整條畫成金色。 */
export function drawExpBar(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  ratio: number,
  maxed = false,
): void {
  const r = height / 2;
  g.fillStyle(0xe9dcc8, 1);
  g.fillRoundedRect(x, y, width, height, r);
  const p = maxed ? 1 : Math.min(1, Math.max(0, ratio));
  if (p > 0) {
    g.fillStyle(maxed ? 0xd8a24a : COLORS.harvest, 1);
    g.fillRoundedRect(x, y, Math.max(height, width * p), height, r);
  }
}

/** 經驗條旁邊的字：「經驗 10/57」或「已滿級」 */
export function expLabel(exp: number, expNeed: number): string {
  return expNeed > 0 ? `經驗 ${exp}/${expNeed}` : '已滿級';
}
