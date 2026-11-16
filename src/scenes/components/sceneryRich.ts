import { P, mixColor, poly, roof, seeded, type G, type Paint } from './sceneryKit';

/**
 * 精緻版場景的零件（T025 第二步）：有明暗面與影子的樹、木造瞭望台、旗子、草地紋理、小路。
 * 光一律從右上方來（和場景的太陽同一邊），所以亮面在右上、暗面在左下、影子往左下拉。
 * 全部原創、用程式畫。
 */

export interface LeafPalette {
  trunk: number;
  dark: number;
  mid: number;
  light: number;
  glint: number;
}

/** 物體腳下往左下拉長的影子 */
export function castShadow(g: G, x: number, y: number, w: number, h: number, alpha = 0.22): void {
  g.fillStyle(0x2a1a10, alpha);
  poly(
    g,
    [
      P(x - w * 0.18, y - h * 0.5),
      P(x + w * 0.2, y - h * 0.5),
      P(x + w * 0.05, y + h * 0.5),
      P(x - w * 0.95, y + h * 0.6),
      P(x - w * 1.05, y + h * 0.1),
    ],
    0x2a1a10,
    alpha,
  );
  g.fillEllipse(x - w * 0.45, y + h * 0.1, w * 1.1, h, 12);
}

/**
 * 一棵枝葉茂密的樹：樹幹有亮暗面與樹根，樹冠是好幾團葉子疊起來，
 * 每一團都有暗、中、亮三層，最上面再點幾顆反光。同一個 seed 每次長得一樣。
 */
export function lushTree(
  g: G,
  x: number,
  y: number,
  s: number,
  pal: LeafPalette,
  seed: number,
): void {
  const rnd = seeded(seed);
  castShadow(g, x, y + 2 * s, 46 * s, 12 * s);
  // 樹幹：左邊暗、右邊亮，底下張開的樹根
  const bark = pal.trunk;
  const barkDark = mixColor(bark, 0x000000, 0.35);
  const barkLite = mixColor(bark, 0xffd9a0, 0.35);
  poly(
    g,
    [
      P(x - 10 * s, y + 1 * s),
      P(x - 5 * s, y - 6 * s),
      P(x - 4 * s, y - 40 * s),
      P(x + 4 * s, y - 40 * s),
      P(x + 5 * s, y - 6 * s),
      P(x + 11 * s, y + 1 * s),
    ],
    bark,
  );
  poly(
    g,
    [
      P(x - 10 * s, y + 1 * s),
      P(x - 5 * s, y - 6 * s),
      P(x - 4 * s, y - 40 * s),
      P(x - 1 * s, y - 40 * s),
      P(x - 1.5 * s, y + 1 * s),
    ],
    barkDark,
  );
  g.fillStyle(barkLite, 1);
  g.fillRect(x + 2 * s, y - 38 * s, 1.6 * s, 30 * s);
  // 樹枝
  g.lineStyle(3.2 * s, barkDark, 1);
  g.lineBetween(x - 1 * s, y - 26 * s, x - 17 * s, y - 44 * s);
  g.lineStyle(3 * s, bark, 1);
  g.lineBetween(x + 1 * s, y - 30 * s, x + 18 * s, y - 46 * s);

  // 樹冠：先決定每一團葉子的位置
  const clumps: { cx: number; cy: number; r: number }[] = [
    { cx: 0, cy: -60, r: 23 },
    { cx: -21, cy: -49, r: 17 },
    { cx: 22, cy: -51, r: 18 },
    { cx: -10, cy: -74, r: 15 },
    { cx: 12, cy: -76, r: 14 },
    { cx: -30, cy: -38, r: 11 },
    { cx: 31, cy: -40, r: 11 },
    { cx: 2, cy: -43, r: 15 },
  ].map((c) => ({
    cx: c.cx + (rnd() - 0.5) * 7,
    cy: c.cy + (rnd() - 0.5) * 6,
    r: c.r * (0.9 + rnd() * 0.25),
  }));
  const at = (c: { cx: number; cy: number }) => [x + c.cx * s, y + c.cy * s] as const;
  // 最底下一圈更暗的葉子，樹冠才有厚度
  g.fillStyle(mixColor(pal.dark, 0x000000, 0.3), 1);
  for (const c of clumps) {
    const [cx, cy] = at(c);
    g.fillCircle(cx - 2 * s, cy + 4 * s, c.r * s);
  }
  g.fillStyle(pal.dark, 1);
  for (const c of clumps) {
    const [cx, cy] = at(c);
    g.fillCircle(cx, cy, c.r * s);
    // 邊緣零碎的小葉子
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2;
      g.fillCircle(cx + Math.cos(a) * c.r * s, cy + Math.sin(a) * c.r * s, (2.5 + rnd() * 2.5) * s);
    }
  }
  g.fillStyle(pal.mid, 1);
  for (const c of clumps) {
    const [cx, cy] = at(c);
    g.fillCircle(cx + c.r * 0.16 * s, cy - c.r * 0.2 * s, c.r * 0.78 * s);
  }
  g.fillStyle(pal.light, 1);
  for (const c of clumps) {
    const [cx, cy] = at(c);
    g.fillCircle(cx + c.r * 0.34 * s, cy - c.r * 0.4 * s, c.r * 0.46 * s);
  }
  // 反光的小亮點與葉縫的暗點
  for (const c of clumps) {
    const [cx, cy] = at(c);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(pal.glint, 0.95);
      g.fillRect(cx + (rnd() * 0.9 - 0.1) * c.r * s, cy - rnd() * c.r * 0.8 * s, 2, 2);
      g.fillStyle(mixColor(pal.dark, 0x000000, 0.25), 0.8);
      g.fillRect(cx - rnd() * c.r * 0.8 * s, cy + (rnd() * 0.9 - 0.2) * c.r * s, 2, 2);
    }
  }
}

/** 遠一點的樹林：一排小樹疊在一起，只有暗、亮兩層，越後面越淡 */
export function treeLine(
  p: Paint,
  g: G,
  seed: number,
  baseY: number,
  size: number,
  palettes: readonly LeafPalette[],
  fade: number,
  hazeColor: number,
  gap?: [number, number],
): void {
  const rnd = seeded(seed);
  const step = size * 1.5;
  for (let x = -size; x < p.w + size; x += step * (0.7 + rnd() * 0.6)) {
    const pal = palettes[Math.floor(rnd() * palettes.length)];
    const r = size * (0.8 + rnd() * 0.5);
    const y = baseY - r * 0.9 + (rnd() - 0.5) * size * 0.3;
    if (gap && x > gap[0] && x < gap[1]) continue;
    const tone = (c: number) => mixColor(c, hazeColor, fade);
    g.fillStyle(tone(mixColor(pal.trunk, 0x000000, 0.2)), 1);
    g.fillRect(x - 1.5, y, 3, r * 1.2);
    g.fillStyle(tone(pal.dark), 1);
    g.fillCircle(x, y, r);
    g.fillCircle(x - r * 0.7, y + r * 0.35, r * 0.7);
    g.fillCircle(x + r * 0.7, y + r * 0.3, r * 0.72);
    g.fillStyle(tone(pal.mid), 1);
    g.fillCircle(x + r * 0.15, y - r * 0.18, r * 0.75);
    g.fillCircle(x + r * 0.75, y + r * 0.15, r * 0.45);
    g.fillStyle(tone(pal.light), 1);
    g.fillCircle(x + r * 0.32, y - r * 0.38, r * 0.42);
  }
}

/** 草地的紋理：一排一排的草尖，越靠近鏡頭越大越疏；再撒一些被陽光照亮的光斑 */
export function grassField(
  p: Paint,
  g: G,
  seed: number,
  base: number,
  shade: number,
  lite: number,
): void {
  const rnd = seeded(seed);
  const gh = p.h - p.hy;
  // 一條一條深淺交錯的橫帶，模擬地面往遠處延伸
  for (let i = 0; i < 9; i++) {
    const t0 = (i / 9) ** 1.6;
    const t1 = ((i + 0.5) / 9) ** 1.6;
    g.fillStyle(i % 2 ? shade : lite, 0.1);
    g.fillRect(0, p.hy + 3 + t0 * gh, p.w, Math.max(2, (t1 - t0) * gh));
  }
  // 陽光照到的光斑
  for (let i = 0; i < 14; i++) {
    const t = 0.1 + rnd() * 0.9;
    g.fillStyle(lite, 0.16);
    g.fillEllipse(
      rnd() * p.w,
      p.hy + t * gh,
      (50 + rnd() * 90) * (0.4 + t),
      (8 + rnd() * 10) * (0.4 + t),
    );
  }
  // 草尖
  for (let i = 0; i < 260; i++) {
    const t = rnd() ** 1.3;
    const x = rnd() * p.w;
    const y = p.hy + 5 + t * (gh - 5);
    const k = 0.5 + t * 1.2;
    const c = rnd() < 0.5 ? shade : rnd() < 0.5 ? lite : base;
    g.fillStyle(c, 0.85);
    g.fillTriangle(x - 2 * k, y, x + 2 * k, y, x - 1 * k, y - 6 * k);
    g.fillTriangle(x + 1 * k, y, x + 4 * k, y, x + 5 * k, y - 5 * k);
  }
}

/** 一條從鏡頭前彎向遠處的泥土小路，邊緣不整齊，路上有車轍與小石子 */
export function dirtPath(
  p: Paint,
  g: G,
  seed: number,
  farX: number,
  nearX: number,
  color: number,
): void {
  const rnd = seeded(seed);
  const gh = p.h - p.hy;
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = p.hy + 3 + t * (gh + 4);
    // 彎一下再過來
    const cx = farX + (nearX - farX) * t * t + Math.sin(t * Math.PI) * p.w * 0.06;
    const half = 7 + t * t * 120;
    left.push(P(cx - half + (rnd() - 0.5) * 6 * (0.3 + t), y));
    right.push(P(cx + half + (rnd() - 0.5) * 6 * (0.3 + t), y));
  }
  const shape = [...left, ...right.reverse()];
  poly(g, shape, mixColor(color, 0x000000, 0.18));
  // 路面比邊緣亮一點，內縮一圈
  const inner = shape.map((q, i) => P(q.x + (i <= n ? 3 : -3), q.y));
  poly(g, inner, color);
  // 車轍與小石子
  for (let i = 0; i < 70; i++) {
    const t = rnd() ** 1.2;
    const k = Math.round(t * n);
    const a = left[Math.min(n, k)];
    const b = right[n - Math.min(n, k)];
    const x = a.x + 4 + rnd() * Math.max(2, b.x - a.x - 8);
    const y = p.hy + 4 + t * gh;
    g.fillStyle(
      rnd() < 0.6 ? mixColor(color, 0x000000, 0.28) : mixColor(color, 0xffffff, 0.35),
      0.7,
    );
    g.fillRect(x, y, 2 + Math.round(t * 8 * rnd()), 2);
  }
}

/** 一面掛在竿子上的長旗，旗面有狗腳印 */
export function pawBanner(g: G, x: number, y: number, s: number, cloth: number): void {
  const pole = 0x5a3d2a;
  g.fillStyle(mixColor(pole, 0x000000, 0.3), 1);
  g.fillRect(x - 1.5 * s, y - 62 * s, 3 * s, 62 * s);
  g.fillStyle(mixColor(pole, 0xffd9a0, 0.35), 1);
  g.fillRect(x, y - 62 * s, 1 * s, 62 * s);
  g.fillStyle(0xe8c46a, 1);
  g.fillCircle(x, y - 63 * s, 2.6 * s);
  // 旗面：上面掛著、下緣是燕尾
  const left = x + 2 * s;
  poly(
    g,
    [
      P(left, y - 58 * s),
      P(left + 20 * s, y - 56 * s),
      P(left + 20 * s, y - 22 * s),
      P(left + 10 * s, y - 28 * s),
      P(left, y - 20 * s),
    ],
    cloth,
  );
  poly(
    g,
    [
      P(left, y - 58 * s),
      P(left + 6 * s, y - 57.4 * s),
      P(left + 6 * s, y - 24 * s),
      P(left, y - 20 * s),
    ],
    mixColor(cloth, 0x000000, 0.25),
  );
  g.fillStyle(0xfde9b0, 1);
  g.fillRect(left, y - 55 * s, 20 * s, 2 * s);
  // 狗腳印
  const px = left + 11 * s;
  const py = y - 40 * s;
  g.fillEllipse(px, py + 2 * s, 7 * s, 6 * s);
  for (const [dx, dy] of [
    [-4, -3],
    [-1.3, -5.5],
    [1.8, -5.5],
    [4.4, -3],
  ]) {
    g.fillCircle(px + dx * s, py + dy * s, 1.5 * s);
  }
}

/** 木造的瞭望台：四根柱子、交叉的支架、平台欄杆、翹角屋頂，旁邊一把梯子 */
export function watchtower(g: G, x: number, y: number, s: number, roofColor: number): void {
  const wood = 0x8a5a33;
  const dark = mixColor(wood, 0x000000, 0.38);
  const lite = mixColor(wood, 0xffe0a8, 0.35);
  castShadow(g, x, y + 2 * s, 44 * s, 12 * s, 0.24);
  // 柱子（左邊在背光面）
  for (const [dx, c] of [
    [-17, dark],
    [-7, mixColor(wood, 0x000000, 0.2)],
    [9, wood],
    [17, wood],
  ] as const) {
    g.fillStyle(c, 1);
    g.fillRect(x + dx * s - 2 * s, y - 62 * s, 4 * s, 62 * s);
  }
  g.fillStyle(lite, 1);
  g.fillRect(x + 17.6 * s, y - 62 * s, 1.4 * s, 62 * s);
  // 交叉支架
  g.lineStyle(2.4 * s, dark, 1);
  g.lineBetween(x - 17 * s, y - 4 * s, x + 17 * s, y - 34 * s);
  g.lineStyle(2.4 * s, wood, 1);
  g.lineBetween(x + 17 * s, y - 4 * s, x - 17 * s, y - 34 * s);
  // 平台與欄杆
  g.fillStyle(dark, 1);
  g.fillRect(x - 24 * s, y - 45 * s, 48 * s, 4 * s);
  g.fillStyle(lite, 1);
  g.fillRect(x - 24 * s, y - 47 * s, 48 * s, 2 * s);
  g.fillStyle(wood, 1);
  g.fillRect(x - 23 * s, y - 60 * s, 46 * s, 2.4 * s);
  for (let dx = -22; dx <= 22; dx += 6.3)
    g.fillRect(x + dx * s - 0.8 * s, y - 60 * s, 1.6 * s, 14 * s);
  // 屋頂下的陰影與屋頂
  g.fillStyle(0x2a1a10, 0.35);
  g.fillRect(x - 21 * s, y - 72 * s, 42 * s, 5 * s);
  for (const dx of [-17, 17]) {
    g.fillStyle(dx < 0 ? dark : wood, 1);
    g.fillRect(x + dx * s - 2 * s, y - 76 * s, 4 * s, 16 * s);
  }
  roof(g, x, y - 74 * s, 62 * s, 17 * s, roofColor, mixColor(roofColor, 0xffffff, 0.45));
  // 屋瓦的紋路
  g.fillStyle(mixColor(roofColor, 0x000000, 0.25), 0.8);
  for (let dx = -20; dx <= 20; dx += 6) g.fillRect(x + dx * s, y - 88 * s, 1.4 * s, 12 * s);
  // 梯子
  g.fillStyle(dark, 1);
  g.fillRect(x + 23 * s, y - 45 * s, 2 * s, 46 * s);
  g.fillRect(x + 30 * s, y - 45 * s, 2 * s, 46 * s);
  g.fillStyle(lite, 1);
  for (let dy = -40; dy < 0; dy += 7) g.fillRect(x + 23 * s, y + dy * s, 9 * s, 1.6 * s);
}

/** 一捆稻草：圓圓的側面有一圈一圈的紋路 */
export function hayBale(g: G, x: number, y: number, s: number): void {
  castShadow(g, x, y, 20 * s, 7 * s, 0.2);
  g.fillStyle(0xb8862e, 1);
  g.fillEllipse(x, y - 9 * s, 26 * s, 20 * s);
  g.fillStyle(0xe2b54a, 1);
  g.fillEllipse(x + 2 * s, y - 10 * s, 21 * s, 16 * s);
  g.fillStyle(0xf6dc86, 1);
  g.fillEllipse(x + 4 * s, y - 12 * s, 12 * s, 8 * s);
  g.lineStyle(1.4 * s, 0x9a6c1e, 0.9);
  g.strokeEllipse(x + 1 * s, y - 9.5 * s, 14 * s, 10 * s);
  g.strokeEllipse(x + 1 * s, y - 9.5 * s, 6 * s, 4 * s);
  g.fillStyle(0x7a4a2a, 1);
  g.fillRect(x - 12 * s, y - 10 * s, 24 * s, 1.6 * s);
}

/** 木柵欄：一根一根的木樁有亮暗面，橫木微微下垂 */
export function woodFence(g: G, x0: number, x1: number, y: number, s: number): void {
  const wood = 0x8a5a33;
  const dark = mixColor(wood, 0x000000, 0.35);
  const lite = mixColor(wood, 0xffe0a8, 0.4);
  g.fillStyle(0x2a1a10, 0.18);
  g.fillRect(x0 - 8 * s, y + 1 * s, x1 - x0, 3 * s);
  for (const dy of [-13, -6]) {
    g.fillStyle(dark, 1);
    g.fillRect(x0, y + dy * s, x1 - x0, 3.4 * s);
    g.fillStyle(lite, 1);
    g.fillRect(x0, y + dy * s, x1 - x0, 1.2 * s);
  }
  const n = Math.max(2, Math.round((x1 - x0) / (26 * s)));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    g.fillStyle(dark, 1);
    g.fillRect(x - 3 * s, y - 20 * s, 6 * s, 22 * s);
    g.fillStyle(wood, 1);
    g.fillRect(x - 1 * s, y - 20 * s, 4 * s, 22 * s);
    g.fillStyle(lite, 1);
    g.fillRect(x + 1.6 * s, y - 20 * s, 1.4 * s, 21 * s);
    g.fillStyle(wood, 1);
    g.fillTriangle(x - 3 * s, y - 20 * s, x + 3 * s, y - 20 * s, x, y - 24 * s);
  }
}
