import Phaser from 'phaser';
import { COLORS } from '../../config';
import { darken } from '../ui';

export interface HeadOptions {
  /** 未擁有：整隻變暗、眼睛變問號 */
  dark?: boolean;
  /** 閉眼（睡覺） */
  eyesClosed?: boolean;
  /** Boss：粗眉毛、獠牙 */
  fierce?: boolean;
}

/**
 * 幾何佔位狗頭：圓頭 + 兩個三角耳 + 嘴套 + 眼鼻。
 * 卡片、主頁、地圖 Boss、劇情都用這一個，畫風一致。
 */
export function drawDogHead(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  color: number,
  accent: number,
  opts: HeadOptions = {},
): void {
  const main = opts.dark ? darken(color, 0.72) : color;
  const acc = opts.dark ? darken(accent, 0.72) : accent;
  const line = opts.dark ? 0x1a1410 : COLORS.inkHex;
  const lw = Math.max(2, r / 14);

  g.fillStyle(main, 1);
  g.lineStyle(lw, line, 1);
  for (const side of [-1, 1]) {
    const pts = [
      { x: x + side * r * 0.95, y: y - r * 0.15 },
      { x: x + side * r * 0.8, y: y - r * 1.2 },
      { x: x + side * r * 0.15, y: y - r * 0.85 },
    ];
    g.fillPoints(pts, true);
    g.strokePoints(pts, true);
  }
  g.fillStyle(main, 1);
  g.fillCircle(x, y, r);
  g.strokeCircle(x, y, r);
  g.fillStyle(acc, 1);
  g.fillEllipse(x, y + r * 0.35, r * 0.95, r * 0.62);

  if (opts.dark) {
    g.fillStyle(0x6b5a4a, 1);
    g.fillCircle(x - r * 0.35, y - r * 0.15, Math.max(2, r * 0.09));
    g.fillCircle(x + r * 0.35, y - r * 0.15, Math.max(2, r * 0.09));
    return;
  }

  drawEyes(g, x, y, r, !!opts.eyesClosed);
  g.fillStyle(COLORS.inkHex, 1);
  g.fillCircle(x, y + r * 0.22, Math.max(2.5, r * 0.12));

  if (opts.fierce) {
    g.lineStyle(Math.max(3, r * 0.1), COLORS.inkHex, 1);
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(x + side * r * 0.6, y - r * 0.42);
      g.lineTo(x + side * r * 0.15, y - r * 0.28);
      g.strokePath();
    }
    g.fillStyle(0xffffff, 1);
    for (const side of [-1, 1]) {
      g.fillTriangle(
        x + side * r * 0.12,
        y + r * 0.45,
        x + side * r * 0.28,
        y + r * 0.45,
        x + side * r * 0.2,
        y + r * 0.66,
      );
    }
  }
}

/** 眼睛（張開：圓點；閉上：一條弧線） */
export function drawEyes(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  closed: boolean,
): void {
  const ex = r * 0.35;
  const ey = y - r * 0.15;
  if (closed) {
    g.lineStyle(Math.max(2, r * 0.07), COLORS.inkHex, 1);
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(x + side * ex, ey - r * 0.04, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
      g.strokePath();
    }
  } else {
    g.fillStyle(COLORS.inkHex, 1);
    g.fillCircle(x - ex, ey, Math.max(2.5, r * 0.1));
    g.fillCircle(x + ex, ey, Math.max(2.5, r * 0.1));
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x - ex + r * 0.03, ey - r * 0.03, Math.max(1, r * 0.035));
    g.fillCircle(x + ex + r * 0.03, ey - r * 0.03, Math.max(1, r * 0.035));
  }
}
