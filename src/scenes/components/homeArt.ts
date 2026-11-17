import Phaser from 'phaser';
import type { HomeStyle } from '../../logic/home';
import type { Rect } from '../../logic/layout';
import { darken } from '../ui';

/**
 * 我的家（T033）的背景：屋內（牆、窗戶、地板）與庭院（天空、遠景、圍籬、地面），
 * 顏色與遠景照選的風格畫。area 是整個場景的範圍，horizon 是牆腳／地平線的 y。
 */
type G = Phaser.GameObjects.Graphics;

const INK = 0x3b2a1a;

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => {
    const x = (a >> s) & 0xff;
    const y = (b >> s) & 0xff;
    return Math.round(x + (y - x) * t) << s;
  };
  return ch(16) | ch(8) | ch(0);
}

/** 固定的亂數（同一個風格每次畫出來一樣） */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function sky(g: G, x: number, y: number, w: number, h: number, style: HomeStyle): void {
  const bands = 8;
  for (let i = 0; i < bands; i++) {
    g.fillStyle(mix(style.sky[0], style.sky[1], i / (bands - 1)), 1);
    g.fillRect(x, y + (h * i) / bands, w, h / bands + 1);
  }
}

function backdrop(g: G, x: number, base: number, w: number, style: HomeStyle): void {
  const r = rng(style.id.length * 7919 + style.far);
  const far = style.far;
  const dark = darken(far, 0.82);
  switch (style.backdrop) {
    case 'hills':
      g.fillStyle(dark, 1);
      g.fillEllipse(x + w * 0.22, base, w * 0.6, 90);
      g.fillEllipse(x + w * 0.85, base, w * 0.5, 70);
      g.fillStyle(far, 1);
      g.fillEllipse(x + w * 0.55, base + 4, w * 0.7, 64);
      break;
    case 'sea':
      g.fillStyle(far, 1);
      g.fillRect(x, base - 42, w, 44);
      g.fillStyle(0xffffff, 0.55);
      for (let i = 0; i < 14; i++) g.fillRect(x + r() * w, base - 36 + r() * 30, 18 + r() * 26, 2);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(x + w * 0.7, base - 44, x + w * 0.7, base - 70, x + w * 0.7 + 18, base - 44);
      break;
    case 'snow':
      for (const [cx, hh, ww] of [
        [0.18, 96, 220],
        [0.5, 124, 280],
        [0.82, 88, 230],
      ] as const) {
        g.fillStyle(far, 1);
        g.fillTriangle(x + w * cx - ww / 2, base, x + w * cx, base - hh, x + w * cx + ww / 2, base);
        g.fillStyle(0xffffff, 1);
        g.fillTriangle(
          x + w * cx - ww * 0.14,
          base - hh * 0.72,
          x + w * cx,
          base - hh,
          x + w * cx + ww * 0.14,
          base - hh * 0.72,
        );
      }
      break;
    case 'bamboo':
      for (let i = 0; i < 26; i++) {
        const bx = x + (i + r() * 0.6) * (w / 26);
        const hh = 70 + r() * 60;
        g.fillStyle(i % 2 ? far : dark, 1);
        g.fillRect(bx, base - hh, 7, hh);
        g.fillStyle(mix(far, 0xffffff, 0.25), 1);
        for (let k = 18; k < hh; k += 22) g.fillRect(bx, base - k, 7, 2);
        g.fillStyle(far, 1);
        g.fillEllipse(bx + 8, base - hh + 6, 26, 9);
      }
      break;
    case 'forest':
      for (let i = 0; i < 16; i++) {
        const tx = x + (i + 0.5) * (w / 16) + (r() - 0.5) * 20;
        const rad = 26 + r() * 16;
        g.fillStyle(0x7a5230, 1);
        g.fillRect(tx - 4, base - 30, 8, 30);
        g.fillStyle(i % 3 === 0 ? dark : far, 1);
        g.fillCircle(tx, base - 34 - rad * 0.5, rad);
        g.fillStyle(mix(far, 0xffffff, 0.3), 0.7);
        g.fillCircle(tx - rad * 0.3, base - 40 - rad * 0.7, rad * 0.3);
      }
      break;
    case 'dunes':
      g.fillStyle(dark, 1);
      g.fillEllipse(x + w * 0.25, base + 6, w * 0.7, 80);
      g.fillStyle(far, 1);
      g.fillEllipse(x + w * 0.75, base + 8, w * 0.8, 60);
      // 仙人掌
      g.fillStyle(0x5c9a52, 1);
      for (const cx of [0.12, 0.6, 0.9]) {
        g.fillRoundedRect(x + w * cx, base - 46, 12, 46, 6);
        g.fillRoundedRect(x + w * cx - 12, base - 32, 10, 8, 4);
        g.fillRoundedRect(x + w * cx - 12, base - 40, 8, 14, 4);
        g.fillRoundedRect(x + w * cx + 12, base - 26, 12, 8, 4);
        g.fillRoundedRect(x + w * cx + 16, base - 36, 8, 16, 4);
      }
      break;
    case 'lake':
      g.fillStyle(0x6fae6a, 1);
      g.fillEllipse(x + w * 0.3, base - 30, w * 0.6, 70);
      g.fillEllipse(x + w * 0.8, base - 30, w * 0.5, 54);
      g.fillStyle(far, 1);
      g.fillRect(x, base - 34, w, 36);
      g.fillStyle(0xffffff, 0.45);
      for (let i = 0; i < 10; i++) g.fillRect(x + r() * w, base - 28 + r() * 22, 30 + r() * 30, 2);
      break;
    case 'clouds':
      for (let i = 0; i < 14; i++) {
        g.fillStyle(i % 2 ? far : mix(far, style.sky[1], 0.4), 1);
        g.fillEllipse(x + (i + r()) * (w / 13), base - 6 - r() * 22, 110 + r() * 60, 44 + r() * 20);
      }
      break;
    case 'city':
      for (let i = 0; i < 20; i++) {
        const bw = 30 + r() * 26;
        const bh = 40 + r() * 80;
        const bx = x + i * (w / 19) - 10;
        g.fillStyle(i % 2 ? far : dark, 1);
        g.fillRect(bx, base - bh, bw, bh);
        g.fillStyle(0xffe9a8, 0.9);
        for (let wy = base - bh + 8; wy < base - 8; wy += 12)
          for (let wx = bx + 5; wx < bx + bw - 6; wx += 9) if (r() > 0.45) g.fillRect(wx, wy, 4, 5);
      }
      break;
    case 'volcano':
      g.fillStyle(far, 1);
      g.fillTriangle(x + w * 0.3, base, x + w * 0.56, base - 120, x + w * 0.82, base);
      g.fillStyle(dark, 1);
      g.fillTriangle(x + w * 0.02, base, x + w * 0.2, base - 60, x + w * 0.4, base);
      g.fillStyle(0xe0452b, 1);
      g.fillTriangle(
        x + w * 0.56 - 30,
        base - 92,
        x + w * 0.56,
        base - 120,
        x + w * 0.56 + 30,
        base - 92,
      );
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(x + w * 0.56 + 6, base - 134, 12);
      g.fillCircle(x + w * 0.56 + 22, base - 152, 16);
      g.fillCircle(x + w * 0.56 + 44, base - 172, 20);
      break;
  }
}

function celestial(g: G, x: number, y: number, style: HomeStyle): void {
  if (style.night) {
    g.fillStyle(0xfff3c4, 1);
    g.fillCircle(x, y, 16);
    g.fillStyle(style.sky[0], 1);
    g.fillCircle(x + 7, y - 4, 13);
  } else {
    g.fillStyle(0xfff3c4, 0.5);
    g.fillCircle(x, y, 24);
    g.fillStyle(0xfff6d8, 1);
    g.fillCircle(x, y, 15);
  }
}

/** 庭院 */
export function drawYard(g: G, area: Rect, horizon: number, style: HomeStyle): void {
  const { x, y, width: w, height: h } = area;
  sky(g, x, y, w, horizon - y, style);
  if (style.night) {
    const r = rng(77);
    g.fillStyle(0xffffff, 0.9);
    for (let i = 0; i < 50; i++) g.fillRect(x + r() * w, y + r() * (horizon - y - 40), 2, 2);
  }
  celestial(g, x + w * 0.86, y + 34, style);
  backdrop(g, x, horizon, w, style);
  // 地面
  g.fillStyle(style.ground[0], 1);
  g.fillRect(x, horizon, w, y + h - horizon);
  const r = rng(style.ground[0]);
  g.fillStyle(style.ground[1], 1);
  for (let i = 0; i < 26; i++) {
    const py = horizon + 14 + r() * (y + h - horizon - 20);
    g.fillEllipse(x + r() * w, py, 40 + r() * 70, 8 + r() * 8);
  }
  g.fillStyle(mix(style.ground[0], 0xffffff, 0.35), 0.8);
  for (let i = 0; i < 40; i++)
    g.fillRect(x + r() * w, horizon + 10 + r() * (y + h - horizon - 14), 3, 2);
  // 圍籬
  const fy = horizon - 22;
  g.lineStyle(2, INK, 1);
  g.fillStyle(style.fence, 1);
  g.fillRect(x, fy + 6, w, 5);
  g.fillRect(x, fy + 18, w, 5);
  g.strokeRect(x - 2, fy + 6, w + 4, 5);
  g.strokeRect(x - 2, fy + 18, w + 4, 5);
  for (let px = x + 10; px < x + w; px += 34) {
    g.fillRoundedRect(px, fy, 9, 30, 3);
    g.strokeRoundedRect(px, fy, 9, 30, 3);
  }
}

/** 屋內 */
export function drawIndoor(g: G, area: Rect, horizon: number, style: HomeStyle): void {
  const { x, y, width: w, height: h } = area;
  // 牆
  g.fillStyle(style.wall, 1);
  g.fillRect(x, y, w, horizon - y);
  g.fillStyle(mix(style.wall, 0x000000, 0.045), 1);
  for (let sx = x; sx < x + w; sx += 44) g.fillRect(sx, y, 22, horizon - y);
  // 窗戶：看得到這個風格的外面
  for (const cx of [0.27, 0.73]) {
    const ww = 132;
    const wh = 78;
    const wx = x + w * cx - ww / 2;
    const wy = y + 18;
    g.fillStyle(0xfff3e0, 1);
    g.lineStyle(3, INK, 1);
    g.fillRoundedRect(wx - 7, wy - 7, ww + 14, wh + 14, 6);
    g.strokeRoundedRect(wx - 7, wy - 7, ww + 14, wh + 14, 6);
    sky(g, wx, wy, ww, wh, style);
    g.fillStyle(style.far, 1);
    g.fillEllipse(wx + ww * 0.35, wy + wh, ww * 0.9, 44);
    g.fillStyle(style.ground[0], 1);
    g.fillRect(wx, wy + wh - 12, ww, 12);
    if (style.night) {
      g.fillStyle(0xffffff, 0.9);
      for (const [sx, sy] of [
        [0.2, 0.2],
        [0.5, 0.35],
        [0.8, 0.15],
        [0.65, 0.5],
      ] as const)
        g.fillRect(wx + ww * sx, wy + wh * sy, 2, 2);
    }
    g.lineStyle(3, INK, 1);
    g.strokeRect(wx, wy, ww, wh);
    g.fillStyle(0xfff3e0, 1);
    g.fillRect(wx + ww / 2 - 2, wy, 4, wh);
    g.fillRect(wx, wy + wh / 2 - 2, ww, 4);
    // 窗簾
    g.fillStyle(style.trim, 1);
    g.fillRoundedRect(wx - 16, wy - 12, 20, wh + 24, 6);
    g.fillRoundedRect(wx + ww - 4, wy - 12, 20, wh + 24, 6);
    g.strokeRoundedRect(wx - 16, wy - 12, 20, wh + 24, 6);
    g.strokeRoundedRect(wx + ww - 4, wy - 12, 20, wh + 24, 6);
  }
  // 地板
  g.fillStyle(style.floor, 1);
  g.fillRect(x, horizon, w, y + h - horizon);
  g.fillStyle(style.plank, 1);
  let row = 0;
  for (let py = horizon + 26; py < y + h; py += 30, row++) {
    g.fillRect(x, py, w, 2);
    for (let px = x + (row % 2 ? 60 : 140); px < x + w; px += 170) g.fillRect(px, py - 28, 2, 28);
  }
  // 牆腳板
  g.fillStyle(style.trim, 1);
  g.lineStyle(2, INK, 1);
  g.fillRect(x, horizon - 10, w, 12);
  g.strokeRect(x - 2, horizon - 10, w + 4, 12);
}

/** 風格選單上的小縮圖：上面庭院、下面屋內 */
export function drawStyleSwatch(g: G, r: Rect, style: HomeStyle): void {
  const half = Math.round(r.height * 0.56);
  for (let i = 0; i < 4; i++) {
    g.fillStyle(mix(style.sky[0], style.sky[1], i / 3), 1);
    g.fillRect(r.x, r.y + (half * 0.6 * i) / 4, r.width, (half * 0.6) / 4 + 1);
  }
  g.fillStyle(style.far, 1);
  g.fillEllipse(r.x + r.width * 0.4, r.y + half * 0.62, r.width * 0.8, half * 0.5);
  g.fillStyle(style.ground[0], 1);
  g.fillRect(r.x, r.y + half * 0.6, r.width, half * 0.4);
  g.fillStyle(style.wall, 1);
  g.fillRect(r.x, r.y + half, r.width, (r.height - half) * 0.5);
  g.fillStyle(style.trim, 1);
  g.fillRect(r.x, r.y + half + (r.height - half) * 0.5 - 3, r.width, 3);
  g.fillStyle(style.floor, 1);
  g.fillRect(r.x, r.y + half + (r.height - half) * 0.5, r.width, (r.height - half) * 0.5);
}
