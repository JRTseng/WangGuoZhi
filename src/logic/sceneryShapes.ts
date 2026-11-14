/**
 * 場景背景用的形狀與顏色計算（T016）。全部是純函式、用固定種子，
 * 同一個場景每次畫出來都一樣（截圖比對才穩定），真正畫在 src/scenes/components/sceneryArt.ts。
 */

export interface Pt {
  x: number;
  y: number;
}

/** 兩個顏色（0xrrggbb）照比例混在一起：t = 0 是 a，t = 1 是 b */
export function mixColor(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const ch = (shift: number) => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * k);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** 固定種子的亂數（mulberry32）：同一個種子每次都產生同一串 0～1 的數字 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 山稜線的樣子：圓丘、尖峰、沙丘（一邊緩一邊陡）、平頂台地 */
export type RidgeStyle = 'hills' | 'peaks' | 'dunes' | 'mesa';

export interface RidgeOptions {
  seed: number;
  width: number;
  /** 山腳的 y（畫面座標，往下為正） */
  base: number;
  /** 最高的山有多高 */
  height: number;
  style: RidgeStyle;
  /** 每隔幾個像素取一點，預設 8 */
  step?: number;
  /** 大約有幾座山，預設 5 */
  bumps?: number;
}

/** 0～1 的高度曲線，x 也是 0～1 */
function profile(style: RidgeStyle, seed: number, bumps: number): (x: number) => number {
  const rnd = seeded(seed);
  if (style === 'hills') {
    const waves = [1, 2.3, 4.1].map((f, i) => ({
      f: f * bumps * Math.PI,
      p: rnd() * Math.PI * 2,
      a: [0.6, 0.28, 0.12][i],
    }));
    return (x) => {
      const v = waves.reduce((s, w) => s + w.a * (0.5 + 0.5 * Math.sin(x * w.f + w.p)), 0);
      return 0.25 + 0.75 * v;
    };
  }
  // 其餘三種都先決定幾個山頂的位置與高度
  const tops = Array.from({ length: bumps + 2 }, (_, i) => ({
    x: (i - 0.5 + (rnd() - 0.5) * 0.5) / bumps,
    h: 0.45 + rnd() * 0.55,
    w: (0.55 + rnd() * 0.5) / bumps,
  }));
  if (style === 'peaks') {
    const jag = Array.from({ length: 6 }, () => rnd() * Math.PI * 2);
    return (x) => {
      let v = 0;
      for (const t of tops) v = Math.max(v, t.h * (1 - Math.abs(x - t.x) / t.w));
      const rough = 0.03 * Math.sin(x * 90 + jag[0]) + 0.02 * Math.sin(x * 190 + jag[1]);
      return Math.max(0.06, v + rough * Math.min(1, v * 3));
    };
  }
  if (style === 'dunes') {
    return (x) => {
      let v = 0;
      for (const t of tops) {
        const d = (x - t.x) / t.w;
        // 迎風面緩（左邊），背風面陡（右邊）
        const s = d < 0 ? 1 - Math.min(1, -d) : 1 - Math.min(1, d * 2.4);
        v = Math.max(v, t.h * s * s * (3 - 2 * s));
      }
      return 0.12 + 0.88 * v;
    };
  }
  // mesa：平頂、兩側很陡
  return (x) => {
    let v = 0;
    for (const t of tops) {
      const d = Math.abs(x - t.x) / (t.w * 0.6);
      v = Math.max(v, t.h * Math.min(1, Math.max(0, (1 - d) * 5)));
    }
    return 0.08 + 0.92 * v;
  };
}

/**
 * 一條山稜線：從最左邊到最右邊的點，y 都不超過 base（山不會陷到山腳底下），
 * 最高不超過 base - height。
 */
export function ridge(o: RidgeOptions): Pt[] {
  const step = o.step ?? 8;
  const f = profile(o.style, o.seed, o.bumps ?? 5);
  const out: Pt[] = [];
  const n = Math.ceil(o.width / step);
  for (let i = 0; i <= n; i++) {
    const x = Math.min(o.width, i * step);
    const v = Math.min(1, Math.max(0, f(x / o.width)));
    out.push({ x, y: o.base - v * o.height });
  }
  return out;
}

/** 把山稜線補成可以填色的多邊形（往下延伸到 bottom） */
export function ridgePolygon(line: readonly Pt[], bottom: number): Pt[] {
  if (line.length === 0) return [];
  return [...line, { x: line[line.length - 1].x, y: bottom }, { x: line[0].x, y: bottom }];
}

export interface ScatterPoint extends Pt {
  /** 大小倍率：越下面（越近）越大 */
  s: number;
  /** 0～1 的亂數，畫的人拿來挑顏色或樣式 */
  k: number;
}

/**
 * 在一塊區域裡撒 count 個點（地上的草、石頭、落葉）。
 * 由上到下排好，後畫的蓋住先畫的，看起來才有遠近。
 */
export function scatter(
  seed: number,
  count: number,
  area: { x: number; y: number; width: number; height: number },
): ScatterPoint[] {
  const rnd = seeded(seed);
  const out: ScatterPoint[] = [];
  for (let i = 0; i < count; i++) {
    const fy = rnd();
    out.push({
      x: area.x + rnd() * area.width,
      y: area.y + fy * area.height,
      s: 0.6 + fy * 0.6,
      k: rnd(),
    });
  }
  return out.sort((a, b) => a.y - b.y);
}

/** 兩個端點之間往下垂的繩子（掛燈籠用）：回傳 n + 1 個點 */
export function sag(a: Pt, b: Pt, drop: number, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t + drop * 4 * t * (1 - t),
    });
  }
  return out;
}
