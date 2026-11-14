import Phaser from 'phaser';
import {
  mixColor,
  ridge,
  ridgePolygon,
  scatter,
  seeded,
  type Pt,
  type RidgeStyle,
  type ScatterPoint,
} from '../../logic/sceneryShapes';

/**
 * 畫場景用的零件（T016）：天空、山、樹、房子、水、會動的小東西。
 * 每個場景怎麼組合在 sceneryArt.ts。全部用 Phaser 的繪圖功能畫，沒有圖檔。
 */

type G = Phaser.GameObjects.Graphics;

/** 畫一張場景時共用的資訊 */
export interface Paint {
  scene: Phaser.Scene;
  /** 所有東西都加進這個容器，照加入的順序由後往前疊 */
  box: Phaser.GameObjects.Container;
  w: number;
  h: number;
  /** 地平線的 y */
  hy: number;
  /** 會不會動（低畫質不動） */
  live: boolean;
  /** 飄落物的數量（照畫質） */
  count: number;
  /** 這張場景開的所有動畫，場景收掉時一起停 */
  tweens: Phaser.Tweens.Tween[];
  /** 不會動的畫布：畫完以後會烤成一張圖，之後每一格就不用重算（見 bakeLayers） */
  still: Set<G>;
}

export const P = (x: number, y: number): Pt => ({ x, y });

/** 開一張新的畫布疊在最上面 */
export function layer(p: Paint): G {
  const g = p.scene.add.graphics();
  p.box.add(g);
  p.still.add(g);
  return g;
}

/** 開一個動畫並記下來。要跳到中間（seekMs）的動畫，每個屬性都要寫明 from，不然會從 0 開始算。 */
export function tween(
  p: Paint,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
  seekMs = 0,
): Phaser.Tweens.Tween {
  // 會動的畫布不能烤成圖
  for (const target of [config.targets].flat()) p.still.delete(target as G);
  const t = p.scene.tweens.add(config);
  if (seekMs > 0) t.seek(seekMs);
  p.tweens.push(t);
  return t;
}

export function poly(g: G, pts: readonly Pt[], color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillPoints(pts as Pt[], true);
}

export function line(g: G, pts: readonly Pt[], width: number, color: number, alpha = 1): void {
  g.lineStyle(width, color, alpha);
  g.strokePoints(pts as Pt[], false);
}

// ---------------------------------------------------------------- 天空

/** 天空漸層：上、下兩色，可以再加一個中間色 */
export function sky(p: Paint, g: G, top: number, bottom: number, mid?: number): void {
  const end = p.hy + 4;
  if (mid === undefined) {
    g.fillGradientStyle(top, top, bottom, bottom, 1);
    g.fillRect(0, 0, p.w, end);
    return;
  }
  const half = Math.round(end * 0.55);
  g.fillGradientStyle(top, top, mid, mid, 1);
  g.fillRect(0, 0, p.w, half);
  g.fillGradientStyle(mid, mid, bottom, bottom, 1);
  g.fillRect(0, half, p.w, end - half);
}

/** 太陽或月亮：一圈一圈淡淡的光暈加上本體 */
export function glowDisc(g: G, x: number, y: number, r: number, color: number, glow: number): void {
  for (let i = 4; i >= 1; i--) {
    g.fillStyle(glow, 0.07);
    g.fillCircle(x, y, r * (1 + i * 0.5));
  }
  g.fillStyle(color, 1);
  g.fillCircle(x, y, r);
}

/** 月亮：光暈、本體、幾個淡淡的坑 */
export function moon(g: G, x: number, y: number, r: number): void {
  glowDisc(g, x, y, r, 0xfff6d8, 0xfff6d8);
  g.fillStyle(0xe9dcb4, 0.7);
  g.fillCircle(x - r * 0.3, y - r * 0.2, r * 0.22);
  g.fillCircle(x + r * 0.25, y + r * 0.3, r * 0.16);
  g.fillCircle(x + r * 0.3, y - r * 0.35, r * 0.1);
}

/** 星星；會動的時候挑幾顆一閃一閃 */
export function stars(p: Paint, g: G, seed: number, n = 46): void {
  const rnd = seeded(seed);
  for (let i = 0; i < n; i++) {
    const x = rnd() * p.w;
    const y = rnd() * p.hy * 0.8;
    const r = 0.7 + rnd() * 1.1;
    g.fillStyle(0xffffff, 0.45 + rnd() * 0.5);
    g.fillCircle(x, y, r);
    if (p.live && i % 6 === 0) {
      const s = p.scene.add.graphics();
      s.fillStyle(0xffffff, 1);
      s.fillCircle(0, 0, r + 0.8);
      s.setPosition(x, y).setAlpha(0);
      p.box.add(s);
      tween(
        p,
        {
          targets: s,
          alpha: { from: 0, to: 0.9 },
          duration: 900 + rnd() * 900,
          yoyo: true,
          repeat: -1,
        },
        rnd() * 1500,
      );
    }
  }
}

// ---------------------------------------------------------------- 山與地面

/** 畫一排山，回傳稜線（要在山上再畫東西時用） */
export function mountains(
  p: Paint,
  g: G,
  seed: number,
  style: RidgeStyle,
  base: number,
  height: number,
  color: number,
  bumps = 5,
  alpha = 1,
): Pt[] {
  const top = ridge({ seed, width: p.w, base, height, style, bumps });
  poly(g, ridgePolygon(top, Math.max(base, p.hy) + 6), color, alpha);
  return top;
}

/** 地面：上淺下深的漸層，地平線壓一條淡淡的陰影 */
export function ground(p: Paint, g: G, top: number, bottom: number): void {
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRect(0, p.hy, p.w, p.h - p.hy);
  g.fillStyle(mixColor(top, 0x000000, 0.35), 0.18);
  g.fillRect(0, p.hy, p.w, 3);
}

/** 地面上撒東西的位置（地平線往下一點到畫面底） */
export function onGround(p: Paint, seed: number, count: number, from = 0.06): ScatterPoint[] {
  const gh = p.h - p.hy;
  return scatter(seed, count, { x: 0, y: p.hy + gh * from, width: p.w, height: gh * (1 - from) });
}

/** 一撮草 */
export function tuft(g: G, x: number, y: number, s: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillTriangle(x - 5 * s, y, x - 2 * s, y, x - 6 * s, y - 8 * s);
  g.fillTriangle(x - 2 * s, y, x + 2 * s, y, x, y - 11 * s);
  g.fillTriangle(x + 2 * s, y, x + 5 * s, y, x + 6 * s, y - 7 * s);
}

/** 一顆石頭（底色加亮面） */
export function rock(g: G, x: number, y: number, s: number, color: number): void {
  g.fillStyle(mixColor(color, 0x000000, 0.3), 0.35);
  g.fillEllipse(x + 2 * s, y + 3 * s, 20 * s, 6 * s);
  g.fillStyle(color, 1);
  g.fillEllipse(x, y, 18 * s, 11 * s);
  g.fillStyle(mixColor(color, 0xffffff, 0.3), 1);
  g.fillEllipse(x - 3 * s, y - 2.5 * s, 9 * s, 4.5 * s);
}

/** 一朵小花 */
export function flower(g: G, x: number, y: number, s: number, petal: number, core: number): void {
  g.fillStyle(petal, 1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.fillCircle(x + Math.cos(a) * 2.6 * s, y + Math.sin(a) * 2.6 * s, 2 * s);
  }
  g.fillStyle(core, 1);
  g.fillCircle(x, y, 1.5 * s);
}

// ---------------------------------------------------------------- 樹

/** 圓圓的樹（楓樹、桃樹、一般的樹都用它換顏色） */
export function roundTree(
  g: G,
  x: number,
  y: number,
  s: number,
  trunk: number,
  dark: number,
  mid: number,
  light: number,
): void {
  g.fillStyle(mixColor(trunk, 0x000000, 0.4), 0.22);
  g.fillEllipse(x + 4 * s, y + 2 * s, 46 * s, 9 * s);
  poly(
    g,
    [P(x - 5 * s, y), P(x + 5 * s, y), P(x + 3 * s, y - 36 * s), P(x - 3 * s, y - 36 * s)],
    trunk,
  );
  g.lineStyle(3 * s, trunk, 1);
  g.lineBetween(x, y - 24 * s, x - 14 * s, y - 40 * s);
  g.lineBetween(x, y - 28 * s, x + 15 * s, y - 42 * s);
  const blobs = (list: number[][], color: number) => {
    g.fillStyle(color, 1);
    for (const [dx, dy, r] of list) g.fillCircle(x + dx * s, y + dy * s, r * s);
  };
  blobs(
    [
      [0, -54, 25],
      [-20, -42, 18],
      [20, -44, 19],
      [-8, -36, 14],
      [10, -34, 13],
    ],
    dark,
  );
  blobs(
    [
      [-4, -59, 19],
      [-19, -47, 13],
      [16, -49, 14],
      [2, -42, 12],
    ],
    mid,
  );
  blobs(
    [
      [-9, -65, 10],
      [10, -58, 8],
      [-21, -51, 6],
      [20, -53, 5],
    ],
    light,
  );
}

/** 松樹；snow 給顏色就每一層蓋雪 */
export function pine(
  g: G,
  x: number,
  y: number,
  s: number,
  trunk: number,
  leaf: number,
  snow?: number,
): void {
  g.fillStyle(trunk, 1);
  g.fillRect(x - 3 * s, y - 10 * s, 6 * s, 12 * s);
  const tiers = [
    [26, -6, -34],
    [21, -24, -50],
    [15, -40, -64],
  ];
  for (const [half, bottom, top] of tiers) {
    g.fillStyle(leaf, 1);
    g.fillTriangle(x - half * s, y + bottom * s, x + half * s, y + bottom * s, x, y + top * s);
    g.fillStyle(mixColor(leaf, 0x000000, 0.25), 1);
    g.fillTriangle(x, y + bottom * s, x + half * s, y + bottom * s, x, y + top * s);
    if (snow !== undefined) {
      g.fillStyle(snow, 1);
      const mid = bottom + (top - bottom) * 0.45;
      g.fillTriangle(
        x - half * 0.55 * s,
        y + mid * s,
        x + half * 0.55 * s,
        y + mid * s,
        x,
        y + top * s,
      );
      g.fillCircle(x - half * 0.45 * s, y + mid * s, 3 * s);
      g.fillCircle(x + half * 0.4 * s, y + mid * s, 3.4 * s);
    }
  }
}

/** 一根竹子：竹節、頂端幾片葉子 */
export function bamboo(
  g: G,
  x: number,
  y: number,
  top: number,
  width: number,
  color: number,
  rnd: () => number,
): void {
  const lean = (rnd() - 0.5) * 16;
  const node = mixColor(color, 0x000000, 0.3);
  const hi = mixColor(color, 0xffffff, 0.3);
  const n = Math.max(3, Math.round((y - top) / 30));
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const x0 = x + lean * t0 * t0;
    const x1 = x + lean * t1 * t1;
    const y0 = y - (y - top) * t0;
    const y1 = y - (y - top) * t1;
    poly(
      g,
      [P(x0 - width / 2, y0), P(x0 + width / 2, y0), P(x1 + width / 2, y1), P(x1 - width / 2, y1)],
      color,
    );
    g.fillStyle(hi, 0.7);
    g.fillRect(x0 - width / 2 + 1, y1, Math.max(1, width * 0.22), y0 - y1);
    g.fillStyle(node, 1);
    g.fillRect(x1 - width / 2 - 1, y1 - 1, width + 2, 2);
  }
  // 葉子：頂端往兩邊垂下的細長三角形
  const tx = x + lean;
  const leaf = mixColor(color, 0x2f6b3a, 0.35);
  const count = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1;
    const ly = top + rnd() * (y - top) * 0.35;
    const lx = x + lean * ((y - ly) / (y - top)) ** 2;
    const len = (14 + rnd() * 14) * (width / 8 + 0.4);
    const drop = 4 + rnd() * 10;
    g.fillStyle(i % 3 ? leaf : mixColor(leaf, 0xffffff, 0.18), 1);
    g.fillTriangle(lx, ly - 2, lx, ly + 3, lx + side * len, ly + drop);
  }
  g.fillStyle(leaf, 1);
  g.fillTriangle(tx - 2, top + 2, tx + 2, top + 2, tx + 5, top - 18);
}

/** 椰子樹：彎彎的樹幹加放射狀的葉子 */
export function palm(g: G, x: number, y: number, s: number, lean: number): void {
  const trunk = 0x9a7446;
  const segs = 9;
  let px = x;
  let py = y;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const nx = x + lean * t * t * s;
    const ny = y - 78 * t * s;
    const wd = (7 - t * 3) * s;
    poly(g, [P(px - wd, py), P(px + wd, py), P(nx + wd * 0.9, ny), P(nx - wd * 0.9, ny)], trunk);
    g.fillStyle(0x7a5a34, 1);
    g.fillRect(nx - wd, ny, wd * 2, 1.5);
    px = nx;
    py = ny;
  }
  const fronds = [-2.7, -2.1, -1.5, -0.6, 0, 0.5, 1.2];
  fronds.forEach((a, i) => {
    const len = (40 + (i % 3) * 6) * s;
    const ex = px + Math.cos(a) * len;
    const ey = py + Math.sin(a) * len * 0.55 + 14 * s;
    const mx = px + Math.cos(a) * len * 0.5;
    const my = py + Math.sin(a) * len * 0.55 - 8 * s;
    g.fillStyle(i % 2 ? 0x3f9b63 : 0x2f8552, 1);
    g.fillTriangle(px, py - 3 * s, mx, my - 5 * s, ex, ey);
    g.fillTriangle(px, py + 3 * s, mx, my - 5 * s, ex, ey);
  });
  g.fillStyle(0x6b4a2a, 1);
  g.fillCircle(px - 3 * s, py + 3 * s, 3.5 * s);
  g.fillCircle(px + 3 * s, py + 4 * s, 3.5 * s);
}

/** 枯樹：歪歪的樹幹與分岔的樹枝 */
export function deadTree(
  g: G,
  x: number,
  y: number,
  s: number,
  color: number,
  rnd: () => number,
): void {
  const lean = (rnd() - 0.5) * 14 * s;
  const topX = x + lean;
  const topY = y - 58 * s;
  poly(g, [P(x - 6 * s, y), P(x + 6 * s, y), P(topX + 2 * s, topY), P(topX - 2 * s, topY)], color);
  const branch = (
    bx: number,
    by: number,
    angle: number,
    len: number,
    wd: number,
    depth: number,
  ) => {
    const ex = bx + Math.cos(angle) * len;
    const ey = by + Math.sin(angle) * len;
    g.lineStyle(wd, color, 1);
    g.lineBetween(bx, by, ex, ey);
    if (depth <= 0) return;
    branch(ex, ey, angle - 0.5 - rnd() * 0.3, len * 0.62, wd * 0.65, depth - 1);
    branch(ex, ey, angle + 0.35 + rnd() * 0.3, len * 0.55, wd * 0.65, depth - 1);
  };
  for (const t of [0.45, 0.65, 0.85]) {
    const bx = x + lean * t;
    const by = y - 58 * s * t;
    const side = rnd() < 0.5 ? -1 : 1;
    branch(bx, by, -Math.PI / 2 + side * (0.7 + rnd() * 0.4), (20 + rnd() * 10) * s, 3 * s, 1);
  }
  branch(topX, topY, -Math.PI / 2 - 0.3, 16 * s, 2.5 * s, 1);
}

// ---------------------------------------------------------------- 建築

/** 翹角屋頂：y 是屋簷的高度，往上畫 */
export function roof(
  g: G,
  cx: number,
  y: number,
  rw: number,
  rh: number,
  color: number,
  trim?: number,
): void {
  const tip = Math.max(4, rw * 0.07);
  poly(
    g,
    [
      P(cx - rw / 2 - tip, y - tip * 0.9),
      P(cx - rw / 2 + tip * 0.6, y),
      P(cx + rw / 2 - tip * 0.6, y),
      P(cx + rw / 2 + tip, y - tip * 0.9),
      P(cx + rw * 0.3, y - rh * 0.55),
      P(cx + rw * 0.2, y - rh),
      P(cx - rw * 0.2, y - rh),
      P(cx - rw * 0.3, y - rh * 0.55),
    ],
    color,
  );
  g.fillStyle(trim ?? mixColor(color, 0x000000, 0.3), 1);
  g.fillRect(cx - rw * 0.22, y - rh - 2, rw * 0.44, 3);
  g.fillRect(cx - rw / 2 + tip * 0.6, y - 2, rw - tip * 1.2, 2);
}

/** 一間小屋：牆、翹角屋頂、門或窗（lit 給顏色就是亮著燈） */
export function house(
  g: G,
  cx: number,
  y: number,
  bw: number,
  bh: number,
  wall: number,
  roofColor: number,
  lit?: number,
): void {
  g.fillStyle(wall, 1);
  g.fillRect(cx - bw / 2, y - bh, bw, bh);
  g.fillStyle(mixColor(wall, 0x000000, 0.25), 1);
  g.fillRect(cx - bw / 2, y - bh, bw, 3);
  roof(g, cx, y - bh, bw * 1.3, bh * 0.75, roofColor);
  if (lit !== undefined) {
    g.fillStyle(lit, 0.25);
    g.fillRect(cx - bw * 0.2 - 2, y - bh * 0.72 - 2, bw * 0.4 + 4, bh * 0.5 + 4);
    g.fillStyle(lit, 1);
    g.fillRect(cx - bw * 0.2, y - bh * 0.72, bw * 0.4, bh * 0.5);
    g.fillStyle(mixColor(wall, 0x000000, 0.4), 1);
    g.fillRect(cx - 0.75, y - bh * 0.72, 1.5, bh * 0.5);
    g.fillRect(cx - bw * 0.2, y - bh * 0.5, bw * 0.4, 1.5);
  } else {
    g.fillStyle(mixColor(wall, 0x000000, 0.55), 1);
    g.fillRect(cx - bw * 0.14, y - bh * 0.62, bw * 0.28, bh * 0.62);
  }
}

/** 一段城牆：牆面、垛口、磚縫 */
export function wall(g: G, x: number, y: number, w: number, hgt: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillRect(x, y - hgt, w, hgt);
  const dark = mixColor(color, 0x000000, 0.22);
  g.fillStyle(dark, 1);
  for (let bx = x; bx < x + w; bx += 22) g.fillRect(bx, y - hgt - 9, 13, 10);
  g.fillStyle(dark, 0.45);
  for (let row = 0; row * 11 < hgt - 6; row++) {
    const by = y - hgt + 8 + row * 11;
    g.fillRect(x, by, w, 1);
    for (let bx = x + (row % 2 ? 14 : 0); bx < x + w; bx += 28) g.fillRect(bx, by, 1, 11);
  }
  g.fillStyle(mixColor(color, 0xffffff, 0.2), 1);
  g.fillRect(x, y - hgt, w, 2);
}

/** 燈籠（含光暈） */
export function lantern(g: G, x: number, y: number, s: number, color = 0xe0452b): void {
  g.fillStyle(0xffb347, 0.16);
  g.fillCircle(x, y, 20 * s);
  g.fillStyle(0xffb347, 0.2);
  g.fillCircle(x, y, 13 * s);
  g.fillStyle(color, 1);
  g.fillEllipse(x, y, 16 * s, 19 * s);
  g.fillStyle(mixColor(color, 0xffe08a, 0.55), 1);
  g.fillEllipse(x - 2 * s, y - 1 * s, 6 * s, 12 * s);
  g.fillStyle(0xffd56b, 1);
  g.fillRect(x - 4 * s, y - 11 * s, 8 * s, 2.5 * s);
  g.fillRect(x - 4 * s, y + 8.5 * s, 8 * s, 2.5 * s);
  g.fillRect(x - 0.75 * s, y + 11 * s, 1.5 * s, 6 * s);
}

/** 旗子：旗桿加一面飄著的三角旗 */
export function flag(g: G, x: number, y: number, hgt: number, pole: number, cloth: number): void {
  g.fillStyle(pole, 1);
  g.fillRect(x - 1.5, y - hgt, 3, hgt);
  poly(
    g,
    [
      P(x + 1.5, y - hgt),
      P(x + 26, y - hgt + 5),
      P(x + 18, y - hgt + 10),
      P(x + 28, y - hgt + 16),
      P(x + 1.5, y - hgt + 18),
    ],
    cloth,
  );
  g.fillStyle(mixColor(cloth, 0xffffff, 0.35), 1);
  g.fillRect(x + 1.5, y - hgt + 2, 14, 2);
}

// ---------------------------------------------------------------- 水

/** 一片水面：漸層、幾道亮亮的水紋；會動的時候水紋左右晃 */
export function water(
  p: Paint,
  g: G,
  y0: number,
  y1: number,
  top: number,
  bottom: number,
  seed: number,
  x0 = 0,
  x1 = p.w,
): void {
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const rnd = seeded(seed);
  const n = Math.round(((x1 - x0) * (y1 - y0)) / 1500) + 4;
  for (let i = 0; i < n; i++) {
    const fy = rnd();
    const y = y0 + 2 + fy * (y1 - y0 - 4);
    const len = 10 + fy * 26 + rnd() * 10;
    const x = x0 + rnd() * (x1 - x0 - len);
    if (p.live && i % 2 === 0) {
      const s = p.scene.add.graphics();
      s.fillStyle(0xffffff, 0.55);
      s.fillRect(0, 0, len, 1.5);
      s.setPosition(x, y).setAlpha(0.2);
      p.box.add(s);
      tween(
        p,
        {
          targets: s,
          x: { from: x, to: x + 10 },
          alpha: { from: 0.2, to: 0.75 },
          duration: 1400 + rnd() * 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        },
        rnd() * 1200,
      );
    } else {
      g.fillStyle(0xffffff, 0.3);
      g.fillRect(x, y, len, 1.5);
    }
  }
}

// ---------------------------------------------------------------- 會動的東西

/** 一朵雲的形狀（畫在自己的畫布原點） */
function cloudShape(g: G, s: number, color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  g.fillEllipse(0, 0, 96 * s, 26 * s);
  g.fillEllipse(-26 * s, -8 * s, 50 * s, 28 * s);
  g.fillEllipse(6 * s, -14 * s, 54 * s, 34 * s);
  g.fillEllipse(34 * s, -5 * s, 44 * s, 24 * s);
  g.fillStyle(0xffffff, alpha * 0.5);
  g.fillEllipse(2 * s, -18 * s, 36 * s, 14 * s);
}

/** 幾朵雲；會動的時候慢慢飄過去 */
export function clouds(
  p: Paint,
  seed: number,
  n: number,
  color = 0xffffff,
  alpha = 0.85,
  yFrom = 0.08,
  yTo = 0.5,
): void {
  const rnd = seeded(seed);
  for (let i = 0; i < n; i++) {
    const c = p.scene.add.graphics();
    const s = 0.6 + rnd() * 0.7;
    cloudShape(c, s, color, alpha);
    const y = p.hy * (yFrom + ((i + rnd() * 0.6) / n) * (yTo - yFrom));
    const x = ((i + 0.3 + rnd() * 0.5) / n) * p.w;
    c.setPosition(x, y);
    p.box.add(c);
    if (!p.live) continue;
    const duration = 60_000 + rnd() * 40_000;
    tween(
      p,
      { targets: c, x: { from: -90, to: p.w + 90 }, duration, repeat: -1 },
      ((x + 90) / (p.w + 180)) * duration,
    );
  }
}

/** 幾條橫的霧；會動的時候慢慢左右移 */
export function fog(p: Paint, seed: number, ys: number[], color: number, alpha: number): void {
  const rnd = seeded(seed);
  ys.forEach((y, i) => {
    const f = p.scene.add.graphics();
    f.fillStyle(color, alpha);
    const wd = p.w * (0.5 + rnd() * 0.4);
    f.fillEllipse(0, 0, wd, 16 + rnd() * 12);
    f.fillEllipse(wd * 0.3, 5, wd * 0.6, 12);
    f.fillEllipse(-wd * 0.32, -4, wd * 0.5, 12);
    const x = ((i * 0.37 + rnd() * 0.3) % 1) * p.w;
    f.setPosition(x, y);
    p.box.add(f);
    if (!p.live) return;
    tween(
      p,
      {
        targets: f,
        x: { from: x, to: x + (i % 2 ? -1 : 1) * (50 + rnd() * 40) },
        duration: 9000 + rnd() * 6000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      },
      rnd() * 6000,
    );
  });
}

/** 一閃一閃的光點（螢火蟲、火星、海面的亮點）；不會動的時候就畫成固定的點 */
export function sparkles(
  p: Paint,
  seed: number,
  n: number,
  area: { x: number; y: number; width: number; height: number },
  color: number,
  radius = 2,
  float = 10,
): void {
  const rnd = seeded(seed);
  for (let i = 0; i < n; i++) {
    const x = area.x + rnd() * area.width;
    const y = area.y + rnd() * area.height;
    const s = p.scene.add.graphics();
    s.fillStyle(color, 0.25);
    s.fillCircle(0, 0, radius * 2.6);
    s.fillStyle(color, 1);
    s.fillCircle(0, 0, radius);
    s.setPosition(x, y).setAlpha(p.live ? 0.1 : 0.7);
    p.box.add(s);
    if (!p.live) continue;
    const duration = 1200 + rnd() * 1600;
    tween(
      p,
      {
        targets: s,
        alpha: { from: 0.1, to: 1 },
        x: { from: x, to: x + (rnd() - 0.5) * float * 2 },
        y: { from: y, to: y - rnd() * float },
        duration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      },
      rnd() * duration,
    );
  }
}

/** 遠遠飛過的鳥（簡單的 V 字）；低畫質時停在原地 */
export function birds(p: Paint, seed: number, n: number, color: number, wingTip?: number): void {
  const rnd = seeded(seed);
  for (let i = 0; i < n; i++) {
    const b = p.scene.add.graphics();
    const s = 0.8 + rnd() * 0.6;
    b.lineStyle(2 * s, color, 1);
    b.beginPath();
    b.moveTo(-9 * s, -3 * s);
    b.lineTo(-4 * s, -6 * s);
    b.lineTo(0, 0);
    b.lineTo(4 * s, -6 * s);
    b.lineTo(9 * s, -3 * s);
    b.strokePath();
    if (wingTip !== undefined) {
      b.fillStyle(wingTip, 1);
      b.fillCircle(-9 * s, -3 * s, 1.6 * s);
      b.fillCircle(9 * s, -3 * s, 1.6 * s);
    }
    const y = p.hy * (0.18 + rnd() * 0.35);
    const x = p.w * (0.2 + rnd() * 0.6);
    b.setPosition(x, y);
    p.box.add(b);
    if (!p.live) continue;
    const duration = 26_000 + rnd() * 14_000;
    tween(
      p,
      { targets: b, x: { from: -20, to: p.w + 20 }, duration, repeat: -1 },
      ((x + 20) / (p.w + 40)) * duration,
    );
    tween(p, {
      targets: b,
      y: { from: y, to: y - 6 },
      scaleY: { from: 1, to: 0.6 },
      duration: 500 + rnd() * 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

/** 往上冒的煙：幾團圓圓的煙慢慢升上去、變大、變淡 */
export function smoke(p: Paint, x: number, y: number, color: number, size = 1, n = 5): void {
  for (let i = 0; i < n; i++) {
    const s = p.scene.add.graphics();
    s.fillStyle(color, 0.5);
    s.fillCircle(0, 0, 7 * size);
    const t = i / n;
    s.setPosition(x + t * 14 * size, y - t * 46 * size)
      .setScale(0.6 + t * 1.4)
      .setAlpha(0.6 * (1 - t));
    p.box.add(s);
    if (!p.live) continue;
    const duration = 5200;
    tween(
      p,
      {
        targets: s,
        x: { from: x, to: x + 18 * size },
        y: { from: y, to: y - 52 * size },
        scale: { from: 0.5, to: 2.2 },
        alpha: { from: 0.65, to: 0 },
        duration,
        repeat: -1,
      },
      t * duration,
    );
  }
}

/** 飄落物的種類 */
export type Drift = 'leaf' | 'petal' | 'snow' | 'rise' | 'sand' | 'none';

/** 飄落（或上升、橫飄）的小東西；數量照畫質，低畫質是 0 */
export function drifting(p: Paint, kind: Drift, colors: readonly number[]): void {
  if (kind === 'none') return;
  for (let i = 0; i < p.count; i++) {
    const g = p.scene.add.graphics();
    g.fillStyle(colors[i % colors.length], kind === 'rise' ? 0.9 : 1);
    if (kind === 'snow') g.fillCircle(0, 0, 2 + (i % 3));
    else if (kind === 'rise') g.fillEllipse(0, 0, 6, 8);
    else if (kind === 'petal') g.fillEllipse(0, 0, 8, 5);
    else if (kind === 'sand') g.fillEllipse(0, 0, 14, 2);
    else g.fillEllipse(0, 0, 12, 6);
    p.box.add(g);
    const duration = Math.round(Phaser.Math.Between(5000, 9000) * (kind === 'sand' ? 0.6 : 1));
    const x = Phaser.Math.Between(0, p.w);
    let config: Phaser.Types.Tweens.TweenBuilderConfig;
    if (kind === 'rise') {
      g.setPosition(x, p.hy);
      config = {
        targets: g,
        y: { from: p.hy, to: -20 },
        x: { from: x, to: x + Phaser.Math.Between(-60, 60) },
        duration,
        repeat: -1,
      };
    } else if (kind === 'sand') {
      const y = Phaser.Math.Between(Math.round(p.hy * 0.6), p.h);
      g.setPosition(-20, y).setAlpha(0.6);
      config = {
        targets: g,
        x: { from: -20, to: p.w + 20 },
        y: { from: y, to: y + Phaser.Math.Between(-12, 20) },
        duration,
        repeat: -1,
      };
    } else {
      g.setPosition(x, -10);
      config = {
        targets: g,
        y: { from: -10, to: p.hy + 40 },
        x: { from: x, to: x + Phaser.Math.Between(-60, 60) },
        angle: { from: 0, to: kind === 'snow' ? 0 : 360 },
        duration,
        repeat: -1,
      };
    }
    tween(p, config, Phaser.Math.Between(0, duration - 1));
  }
}

/**
 * 把不會動的畫布烤成圖：相鄰的幾張合成一張，疊放的順序不變。
 * 山稜線這種幾百個點的多邊形，留著畫布的話每一格都要重新切三角形，手機和測試機都吃不消；
 * 烤成圖以後每一格只是貼一張圖。
 */
export function bakeLayers(p: Paint): void {
  const out: Phaser.GameObjects.GameObject[] = [];
  let sheet: Phaser.GameObjects.RenderTexture | null = null;
  for (const child of [...p.box.list]) {
    if (!p.still.has(child as G)) {
      sheet = null;
      out.push(child);
      continue;
    }
    const g = child as G;
    if (!sheet) {
      sheet = p.scene.make.renderTexture({ x: 0, y: 0, width: p.w, height: p.h }, false);
      sheet.setOrigin(0, 0);
      out.push(sheet);
    }
    sheet.draw(g, g.x, g.y);
    g.destroy();
  }
  p.box.removeAll();
  p.box.add(out);
  p.still.clear();
}

export { mixColor, scatter, seeded };
export type { G };
