import Phaser from 'phaser';
import { COLORS } from '../../config';
import type { GearData } from '../../data/equipment';
import { darken } from '../ui';
import { drawBandage, drawCone, drawHeadGearBack, drawHeadGearFront } from './gearArt';

export interface HeadOptions {
  /** 未擁有：整隻變暗、眼睛變問號 */
  dark?: boolean;
  /** 閉眼（睡覺） */
  eyesClosed?: boolean;
  /** Boss：粗眉毛、獠牙 */
  fierce?: boolean;
  /** 身上的裝備（T014）：頭飾會畫在頭上 */
  gear?: readonly Pick<GearData, 'slot' | 'style' | 'color' | 'accent'>[];
  /** 受傷外觀（T014）：1 貼 OK 繃；2 再加頭套（已經戴頭飾就不加） */
  hurt?: 0 | 1 | 2;
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
  const gear = opts.dark ? [] : (opts.gear ?? []);
  const hurt = opts.dark ? 0 : (opts.hurt ?? 0);
  const hasHeadGear = gear.some((x) => x.slot === 'head');

  // 頭套那一圈畫在頭後面：身上的頭飾，或掛彩時戴的
  drawHeadGearBack(g, gear, r, x, y);
  if (hurt === 2 && !hasHeadGear) drawCone(g, x, y, r, 0xdfeaf2, 0x8d99ae);

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
    // 耳朵內側（T014 美化）：粉粉的一小塊
    if (!opts.dark && r >= 14) {
      g.fillStyle(0xf4b6a6, 0.85);
      g.fillTriangle(
        x + side * r * 0.82,
        y - r * 0.38,
        x + side * r * 0.74,
        y - r * 0.98,
        x + side * r * 0.36,
        y - r * 0.78,
      );
      g.fillStyle(main, 1);
    }
  }
  g.fillStyle(main, 1);
  g.fillCircle(x, y, r);
  g.strokeCircle(x, y, r);
  // 額頭的亮部
  if (!opts.dark && r >= 14) {
    g.fillStyle(0xffffff, 0.14);
    g.fillEllipse(x - r * 0.25, y - r * 0.55, r * 0.7, r * 0.34);
  }
  g.fillStyle(acc, 1);
  g.fillEllipse(x, y + r * 0.35, r * 0.95, r * 0.62);

  if (opts.dark) {
    g.fillStyle(0x6b5a4a, 1);
    g.fillCircle(x - r * 0.35, y - r * 0.15, Math.max(2, r * 0.09));
    g.fillCircle(x + r * 0.35, y - r * 0.15, Math.max(2, r * 0.09));
    return;
  }

  // 腮紅（兇的頭目不畫）
  if (!opts.fierce && r >= 14) {
    g.fillStyle(0xff7f7f, 0.32);
    g.fillEllipse(x - r * 0.62, y + r * 0.16, r * 0.3, r * 0.2);
    g.fillEllipse(x + r * 0.62, y + r * 0.16, r * 0.3, r * 0.2);
  }
  drawEyes(g, x, y, r, !!opts.eyesClosed);
  g.fillStyle(COLORS.inkHex, 1);
  g.fillCircle(x, y + r * 0.22, Math.max(2.5, r * 0.12));
  // 嘴巴：鼻子下面一個小小的 w
  if (!opts.fierce && r >= 14) {
    g.lineStyle(Math.max(1.5, r * 0.055), COLORS.inkHex, 1);
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(x + side * r * 0.1, y + r * 0.36, r * 0.1, 0, Math.PI);
      g.strokePath();
    }
  }
  drawHeadGearFront(g, gear, r, x, y);
  if (hurt > 0) {
    drawBandage(g, x - r * 0.42, y - r * 0.5, r * 0.62, -0.5);
    if (hurt === 2) drawBandage(g, x + r * 0.58, y + r * 0.42, r * 0.5, 0.6);
  }

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
    g.fillCircle(x - ex + r * 0.035, ey - r * 0.035, Math.max(1, r * 0.04));
    g.fillCircle(x + ex + r * 0.035, ey - r * 0.035, Math.max(1, r * 0.04));
    if (r >= 20) {
      g.fillCircle(x - ex - r * 0.03, ey + r * 0.04, r * 0.02);
      g.fillCircle(x + ex - r * 0.03, ey + r * 0.04, r * 0.02);
    }
  }
}
