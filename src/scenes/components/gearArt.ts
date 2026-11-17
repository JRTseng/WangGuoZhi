import Phaser from 'phaser';
import { COLORS } from '../../config';
import type { GearData } from '../../data/equipment';

/**
 * 裝備的佔位圖（T014）：用幾何圖形畫，正式美術之後再換。
 * drawGearIcon 畫倉庫裡的小圖示；drawBodyGear、drawHeadGear 把裝備畫在全身狗狗（DogSprite）身上。
 */
type Look = Pick<GearData, 'slot' | 'style' | 'color' | 'accent'>;
type G = Phaser.GameObjects.Graphics;
type P = readonly [number, number];

function poly(g: G, cx: number, cy: number, s: number, pts: readonly P[], fill: number): void {
  const ps = pts.map(([x, y]) => ({ x: cx + x * s, y: cy + y * s }));
  g.fillStyle(fill, 1);
  g.fillPoints(ps, true);
  g.strokePoints(ps, true);
}

const TEE: readonly P[] = [
  [-0.45, -0.8],
  [-0.98, -0.42],
  [-0.72, -0.05],
  [-0.5, -0.22],
  [-0.5, 0.82],
  [0.5, 0.82],
  [0.5, -0.22],
  [0.72, -0.05],
  [0.98, -0.42],
  [0.45, -0.8],
  [0.18, -0.62],
  [-0.18, -0.62],
];
const VEST: readonly P[] = [
  [-0.5, -0.82],
  [-0.62, 0.82],
  [0.62, 0.82],
  [0.5, -0.82],
  [0.2, -0.55],
  [0, -0.2],
  [-0.2, -0.55],
];
const CROWN: readonly P[] = [
  [-0.85, 0.55],
  [-0.85, -0.5],
  [-0.42, 0.02],
  [0, -0.75],
  [0.42, 0.02],
  [0.85, -0.5],
  [0.85, 0.55],
];

/** 鈴鐺：中心 (x, y)，r 是半徑 */
function drawBell(g: G, x: number, y: number, r: number, gold: number): void {
  g.fillStyle(gold, 1);
  g.fillCircle(x, y, r);
  g.strokeCircle(x, y, r);
  g.fillStyle(0xfff3c4, 1);
  g.fillCircle(x - r * 0.35, y - r * 0.38, r * 0.22);
  g.fillStyle(COLORS.inkHex, 1);
  g.fillRect(x - r * 0.62, y + r * 0.05, r * 1.24, Math.max(1, r * 0.16));
  g.fillCircle(x, y + r * 0.48, r * 0.2);
}

/** 長命鎖：中心 (x, y)，r 是半寬 */
function drawLocket(g: G, x: number, y: number, r: number, gold: number): void {
  const pts = [
    { x: x - r, y: y - r * 0.55 },
    { x: x + r, y: y - r * 0.55 },
    { x: x + r * 0.78, y: y + r * 0.35 },
    { x, y: y + r * 0.8 },
    { x: x - r * 0.78, y: y + r * 0.35 },
  ];
  g.fillStyle(gold, 1);
  g.fillPoints(pts, true);
  g.strokePoints(pts, true);
  g.fillStyle(0xc0392b, 1);
  g.fillCircle(x, y - r * 0.02, r * 0.26);
}

/** 蝴蝶結（有兩條垂下來的緞帶）：中心 (x, y)，s 是半寬 */
function drawRibbon(g: G, x: number, y: number, s: number, color: number, knot: number): void {
  for (const k of [-1, 1]) {
    const tail = [
      { x: x + k * 0.05 * s, y },
      { x: x + k * 0.5 * s, y: y + 0.9 * s },
      { x: x + k * 0.12 * s, y: y + 0.72 * s },
    ];
    g.fillStyle(color, 1);
    g.fillPoints(tail, true);
    g.strokePoints(tail, true);
  }
  for (const k of [-1, 1]) {
    const wing = [
      { x, y },
      { x: x + k * 0.95 * s, y: y - 0.6 * s },
      { x: x + k * 0.95 * s, y: y + 0.45 * s },
    ];
    g.fillStyle(color, 1);
    g.fillPoints(wing, true);
    g.strokePoints(wing, true);
  }
  g.fillStyle(knot, 1);
  g.fillCircle(x, y, 0.24 * s);
  g.strokeCircle(x, y, 0.24 * s);
}

/** 五瓣小花：中心 (x, y)，r 是整朵的半徑 */
function drawFlower(g: G, x: number, y: number, r: number, petal: number, core: number): void {
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const px = x + Math.cos(a) * r * 0.55;
    const py = y + Math.sin(a) * r * 0.55;
    g.fillStyle(petal, 1);
    g.fillCircle(px, py, r * 0.42);
    g.strokeCircle(px, py, r * 0.42);
  }
  g.fillStyle(core, 1);
  g.fillCircle(x, y, r * 0.32);
  g.strokeCircle(x, y, r * 0.32);
}

/**
 * 飾品（T032）畫在頭的前面：頸飾掛在下巴下面，耳飾別在耳朵旁邊。
 * 頭的中心在 (x, y)，r 是頭的半徑；小頭像與全身像共用。
 */
export function drawAccessories(g: G, gears: readonly Look[], r: number, x = 0, y = 0): void {
  const lw = Math.max(1.5, r / 14);
  const neck = gears.find((k) => k.slot === 'neck');
  if (neck) {
    g.lineStyle(lw, COLORS.inkHex, 1);
    if (neck.style === 'scarf') {
      const pts = [
        { x: x - r * 0.62, y: y + r * 0.74 },
        { x: x + r * 0.62, y: y + r * 0.74 },
        { x: x + r * 0.08, y: y + r * 1.42 },
      ];
      g.fillStyle(neck.color, 1);
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
      g.fillStyle(neck.accent, 1);
      g.fillCircle(x + r * 0.03, y + r * 0.98, r * 0.07);
      g.fillCircle(x - r * 0.22, y + r * 0.88, r * 0.055);
      g.fillCircle(x + r * 0.28, y + r * 0.88, r * 0.055);
    } else {
      // 項圈：沿著下巴的一段弧
      g.lineStyle(lw * 2.6, COLORS.inkHex, 1);
      g.beginPath();
      g.arc(x, y, r * 0.99, 0.3 * Math.PI, 0.7 * Math.PI);
      g.strokePath();
      g.lineStyle(lw * 1.6, neck.color, 1);
      g.beginPath();
      g.arc(x, y, r * 0.99, 0.3 * Math.PI, 0.7 * Math.PI);
      g.strokePath();
      g.lineStyle(lw, COLORS.inkHex, 1);
      if (neck.style === 'locket') drawLocket(g, x, y + r * 1.2, r * 0.26, neck.accent);
      else drawBell(g, x, y + r * 1.18, r * 0.22, neck.accent);
    }
  }
  const ear = gears.find((k) => k.slot === 'ear');
  if (ear) {
    g.lineStyle(lw, COLORS.inkHex, 1);
    const ex = x - r * 0.72;
    const ey = y - r * 0.72;
    if (ear.style === 'flower') drawFlower(g, ex, ey, r * 0.34, ear.color, ear.accent);
    else drawRibbon(g, ex, ey, r * 0.36, ear.color, ear.accent);
  }
}

/** 小圖示：中心 (cx, cy)，s 是半徑（整個圖大約 2s 見方） */
export function drawGearIcon(g: G, cx: number, cy: number, s: number, gear: Look): void {
  const { color, accent } = gear;
  const lw = Math.max(1.5, s / 9);
  g.lineStyle(lw, COLORS.inkHex, 1);
  const dot = (x: number, y: number, r: number, c = accent) => {
    g.fillStyle(c, 1);
    g.fillCircle(cx + x * s, cy + y * s, r * s);
  };
  const box = (x: number, y: number, w: number, h: number, c = accent) => {
    g.fillStyle(c, 1);
    g.fillRect(cx + x * s, cy + y * s, w * s, h * s);
  };
  switch (gear.style) {
    case 'bib':
      g.fillStyle(color, 1);
      g.fillRoundedRect(cx - 0.65 * s, cy - 0.35 * s, 1.3 * s, 1.15 * s, 0.55 * s);
      g.strokeRoundedRect(cx - 0.65 * s, cy - 0.35 * s, 1.3 * s, 1.15 * s, 0.55 * s);
      g.lineStyle(lw * 1.6, accent, 1);
      g.beginPath();
      g.arc(cx, cy - 0.4 * s, 0.42 * s, Math.PI * 0.05, Math.PI * 0.95, true);
      g.strokePath();
      dot(0, 0.3, 0.2);
      break;
    case 'sweater':
      poly(g, cx, cy, s, TEE, color);
      box(-0.5, 0.05, 1, 0.2);
      box(-0.5, 0.45, 1, 0.12);
      break;
    case 'vest':
      poly(g, cx, cy, s, VEST, color);
      dot(0, 0.15, 0.1);
      dot(0, 0.5, 0.1);
      break;
    case 'robe':
      poly(g, cx, cy, s, TEE, color);
      box(-0.5, 0.25, 1, 0.18);
      box(-0.5, 0.68, 1, 0.14);
      dot(0, 0.34, 0.14, 0xffffff);
      break;
    case 'mitt':
    case 'boxing': {
      const big = gear.style === 'boxing';
      g.fillStyle(color, 1);
      g.fillCircle(cx - 0.55 * s, cy + 0.05 * s, 0.28 * s);
      g.strokeCircle(cx - 0.55 * s, cy + 0.05 * s, 0.28 * s);
      g.fillCircle(cx + 0.05 * s, cy - 0.12 * s, (big ? 0.68 : 0.6) * s);
      g.strokeCircle(cx + 0.05 * s, cy - 0.12 * s, (big ? 0.68 : 0.6) * s);
      g.fillStyle(accent, 1);
      g.fillRoundedRect(cx - 0.4 * s, cy + 0.48 * s, 0.9 * s, 0.34 * s, 0.1 * s);
      g.strokeRoundedRect(cx - 0.4 * s, cy + 0.48 * s, 0.9 * s, 0.34 * s, 0.1 * s);
      if (big) dot(-0.15, -0.35, 0.14, 0xffffff);
      else {
        dot(0.05, -0.02, 0.2);
        for (const x of [-0.25, 0.05, 0.35]) dot(x, -0.4, 0.1);
      }
      break;
    }
    case 'diaper':
      poly(
        g,
        cx,
        cy,
        s,
        [
          [-0.85, -0.5],
          [0.85, -0.5],
          [0.6, 0.2],
          [0.22, 0.68],
          [-0.22, 0.68],
          [-0.6, 0.2],
        ],
        color,
      );
      box(-0.85, -0.5, 0.35, 0.28);
      box(0.5, -0.5, 0.35, 0.28);
      break;
    case 'shorts':
    case 'trousers': {
      const leg = gear.style === 'shorts' ? 0.35 : 0.85;
      poly(
        g,
        cx,
        cy,
        s,
        [
          [-0.7, -0.75],
          [0.7, -0.75],
          [0.8, leg],
          [0.12, leg],
          [0, -0.15],
          [-0.12, leg],
          [-0.8, leg],
        ],
        color,
      );
      box(-0.7, -0.75, 1.4, 0.2);
      if (gear.style === 'trousers') dot(-0.45, 0.3, 0.15);
      break;
    }
    case 'sneaker':
      poly(
        g,
        cx,
        cy,
        s,
        [
          [-0.85, -0.3],
          [-0.25, -0.4],
          [0.1, 0],
          [0.7, 0.1],
          [0.88, 0.45],
          [-0.85, 0.45],
        ],
        color,
      );
      g.fillStyle(accent, 1);
      g.fillRect(cx - 0.85 * s, cy + 0.45 * s, 1.73 * s, 0.2 * s);
      g.strokeRect(cx - 0.85 * s, cy + 0.45 * s, 1.73 * s, 0.2 * s);
      dot(-0.2, 0.08, 0.1);
      break;
    case 'boots':
      poly(
        g,
        cx,
        cy,
        s,
        [
          [-0.55, -0.85],
          [0.05, -0.85],
          [0.05, -0.05],
          [0.7, 0.1],
          [0.88, 0.5],
          [-0.55, 0.5],
        ],
        color,
      );
      g.fillStyle(accent, 1);
      g.fillRect(cx - 0.55 * s, cy + 0.5 * s, 1.43 * s, 0.2 * s);
      g.strokeRect(cx - 0.55 * s, cy + 0.5 * s, 1.43 * s, 0.2 * s);
      box(-0.55, -0.85, 0.6, 0.22);
      break;
    case 'bandana':
      poly(
        g,
        cx,
        cy,
        s,
        [
          [-0.9, -0.45],
          [0.9, -0.45],
          [0, 0.75],
        ],
        color,
      );
      dot(0, -0.1, 0.12);
      dot(-0.35, -0.22, 0.09);
      dot(0.35, -0.22, 0.09);
      break;
    case 'cone':
      poly(
        g,
        cx,
        cy,
        s,
        [
          [-0.4, -0.6],
          [0.4, -0.6],
          [0.92, 0.6],
          [-0.92, 0.6],
        ],
        color,
      );
      g.lineStyle(lw * 1.5, accent, 1);
      g.lineBetween(cx - 0.92 * s, cy + 0.6 * s, cx + 0.92 * s, cy + 0.6 * s);
      g.lineBetween(cx - 0.4 * s, cy - 0.6 * s, cx + 0.4 * s, cy - 0.6 * s);
      break;
    case 'bow':
      poly(
        g,
        cx,
        cy,
        s,
        [
          [0, 0],
          [-0.9, -0.55],
          [-0.9, 0.55],
        ],
        color,
      );
      poly(
        g,
        cx,
        cy,
        s,
        [
          [0, 0],
          [0.9, -0.55],
          [0.9, 0.55],
        ],
        color,
      );
      g.fillStyle(accent, 1);
      g.fillCircle(cx, cy, 0.24 * s);
      g.strokeCircle(cx, cy, 0.24 * s);
      break;
    case 'hat':
      g.fillStyle(color, 1);
      g.fillEllipse(cx, cy - 0.1 * s, 1.15 * s, 1.1 * s);
      g.strokeEllipse(cx, cy - 0.1 * s, 1.15 * s, 1.1 * s);
      g.fillEllipse(cx, cy + 0.38 * s, 1.9 * s, 0.42 * s);
      g.strokeEllipse(cx, cy + 0.38 * s, 1.9 * s, 0.42 * s);
      box(-0.5, 0.05, 1, 0.16);
      break;
    case 'crown':
      poly(g, cx, cy, s, CROWN, color);
      dot(0, 0.2, 0.16);
      dot(-0.5, 0.25, 0.1, 0xffffff);
      dot(0.5, 0.25, 0.1, 0xffffff);
      break;
    case 'bell':
      // 項圈＋鈴鐺
      g.lineStyle(lw * 2.4, color, 1);
      g.beginPath();
      g.arc(cx, cy - 0.55 * s, 0.8 * s, 0.12 * Math.PI, 0.88 * Math.PI);
      g.strokePath();
      g.lineStyle(lw, COLORS.inkHex, 1);
      drawBell(g, cx, cy + 0.38 * s, 0.46 * s, accent);
      break;
    case 'scarf':
      box(-0.9, -0.7, 1.8, 0.34, color);
      poly(
        g,
        cx,
        cy,
        s,
        [
          [-0.78, -0.4],
          [0.78, -0.4],
          [0, 0.85],
        ],
        color,
      );
      dot(0, -0.02, 0.11);
      dot(-0.3, -0.2, 0.08);
      dot(0.3, -0.2, 0.08);
      break;
    case 'locket':
      // 紅繩＋金鎖片
      g.lineStyle(lw * 1.6, color, 1);
      g.beginPath();
      g.arc(cx, cy - 0.6 * s, 0.78 * s, 0.14 * Math.PI, 0.86 * Math.PI);
      g.strokePath();
      g.lineStyle(lw, COLORS.inkHex, 1);
      drawLocket(g, cx, cy + 0.36 * s, 0.5 * s, accent);
      break;
    case 'ribbon':
      drawRibbon(g, cx, cy, s, color, accent);
      break;
    case 'flower':
      drawFlower(g, cx, cy, 0.9 * s, color, accent);
      break;
  }
}

/**
 * 畫在全身狗狗的身體上（DogSprite 的座標：腳底中央是原點，身體是以 (0, -56) 為中心的橢圓，
 * 四隻腳在 x = -40、-22、22、40）。後腳穿鞋子、前腳戴手套。
 */
export function drawBodyGear(g: G, gears: readonly Look[]): void {
  const by = (slot: Look['slot']) => gears.find((x) => x.slot === slot);
  const line = COLORS.inkHex;
  g.lineStyle(3, line, 1);

  const pants = by('pants');
  if (pants) {
    g.fillStyle(pants.color, 1);
    if (pants.style !== 'diaper') {
      const len = pants.style === 'shorts' ? 14 : 27;
      for (const lx of [-40, -22]) {
        g.fillRoundedRect(lx - 9, -38, 18, len, 4);
        g.strokeRoundedRect(lx - 9, -38, 18, len, 4);
      }
    }
    g.fillEllipse(-31, -55, 52, 50);
    g.strokeEllipse(-31, -55, 52, 50);
    g.fillStyle(pants.accent, 1);
    if (pants.style === 'diaper') {
      g.fillRoundedRect(-22, -66, 14, 9, 3);
      g.strokeRoundedRect(-22, -66, 14, 9, 3);
    } else g.fillRect(-12, -76, 5, 42);
  }

  const clothes = by('clothes');
  if (clothes) {
    g.fillStyle(clothes.color, 1);
    if (clothes.style === 'bib') {
      g.fillEllipse(36, -50, 32, 36);
      g.strokeEllipse(36, -50, 32, 36);
      g.fillStyle(clothes.accent, 1);
      g.fillCircle(36, -45, 5);
    } else {
      if (clothes.style !== 'vest') {
        for (const lx of [22, 40]) {
          g.fillRoundedRect(lx - 9, -38, 18, 12, 4);
          g.strokeRoundedRect(lx - 9, -38, 18, 12, 4);
        }
      }
      g.fillEllipse(8, -57, 74, 56);
      g.strokeEllipse(8, -57, 74, 56);
      g.fillStyle(clothes.accent, 1);
      if (clothes.style === 'sweater') {
        g.fillRect(-4, -83, 7, 52);
        g.fillRect(14, -83, 7, 52);
      } else if (clothes.style === 'vest') {
        g.fillCircle(8, -68, 4);
        g.fillCircle(8, -54, 4);
        g.fillCircle(8, -40, 4);
      } else {
        g.fillRect(2, -84, 12, 54);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(8, -57, 5);
      }
    }
  }

  const shoes = by('shoes');
  if (shoes) {
    for (const lx of [-40, -22]) {
      const top = shoes.style === 'boots' ? -22 : -13;
      g.fillStyle(shoes.color, 1);
      g.fillRoundedRect(lx - 10, top, 23, -top, 5);
      g.strokeRoundedRect(lx - 10, top, 23, -top, 5);
      g.fillStyle(shoes.accent, 1);
      g.fillRect(lx - 9, -4, 21, 3);
    }
  }

  const gloves = by('gloves');
  if (gloves) {
    for (const lx of [22, 40]) {
      const r = gloves.style === 'boxing' ? 12 : 10.5;
      g.fillStyle(gloves.color, 1);
      g.fillCircle(lx + 1, -r + 1, r);
      g.strokeCircle(lx + 1, -r + 1, r);
      g.fillStyle(gloves.accent, 1);
      g.fillRoundedRect(lx - 8, -r * 2 - 3, 18, 6, 2);
      g.strokeRoundedRect(lx - 8, -r * 2 - 3, 18, 6, 2);
    }
  }
}

/**
 * 畫在狗頭上（頭的中心在 (x, y)，r 是頭的半徑）。back 畫在頭後面（頭套那一圈），front 畫在頭前面。
 * 小頭像只有一支畫筆時 back、front 傳同一支，先呼叫 drawHeadGearBack 再畫頭、最後 drawHeadGearFront。
 */
export function drawHeadGearBack(back: G, gears: readonly Look[], r: number, x = 0, y = 0): void {
  const head = gears.find((g) => g.slot === 'head');
  if (head?.style !== 'cone') return;
  drawCone(back, x, y, r, head.color, head.accent);
}

/** 頭套那一圈（受傷外觀也用這個） */
export function drawCone(
  g: G,
  x: number,
  y: number,
  r: number,
  color: number,
  accent: number,
): void {
  g.fillStyle(color, 0.92);
  g.lineStyle(Math.max(1.5, r / 12), accent, 1);
  g.fillCircle(x, y + r * 0.08, r * 1.5);
  g.strokeCircle(x, y + r * 0.08, r * 1.5);
  g.lineStyle(Math.max(1, r / 18), COLORS.inkHex, 0.5);
  g.strokeCircle(x, y + r * 0.08, r * 1.5 + Math.max(1, r / 18));
}

export function drawHeadGearFront(front: G, gears: readonly Look[], r: number, x = 0, y = 0): void {
  drawAccessories(front, gears, r, x, y);
  const head = gears.find((g) => g.slot === 'head');
  if (!head || head.style === 'cone') return;
  if (head.style === 'bandana') {
    front.lineStyle(Math.max(1.5, r / 14), COLORS.inkHex, 1);
    front.fillStyle(head.color, 1);
    front.fillEllipse(x, y - r * 0.74, r * 1.36, r * 0.5);
    front.strokeEllipse(x, y - r * 0.74, r * 1.36, r * 0.5);
    front.fillTriangle(
      x + r * 0.6,
      y - r * 0.8,
      x + r * 1.05,
      y - r * 1.02,
      x + r * 1.0,
      y - r * 0.58,
    );
    front.strokeTriangle(
      x + r * 0.6,
      y - r * 0.8,
      x + r * 1.05,
      y - r * 1.02,
      x + r * 1.0,
      y - r * 0.58,
    );
    front.fillStyle(head.accent, 1);
    for (const k of [-0.35, 0, 0.35]) front.fillCircle(x + k * r, y - r * 0.76, r * 0.07);
    return;
  }
  const lift = head.style === 'bow' ? 0.98 : head.style === 'hat' ? 1.02 : 1.12;
  drawGearIcon(front, x, y - r * lift, r * (head.style === 'hat' ? 0.62 : 0.5), head);
}

export function drawHeadGear(back: G, front: G, gears: readonly Look[], r: number): void {
  drawHeadGearBack(back, gears, r);
  drawHeadGearFront(front, gears, r);
}

/** OK 繃：中心 (x, y)，長 len，轉 angle 弧度 */
export function drawBandage(g: G, x: number, y: number, len: number, angle: number): void {
  const w = len * 0.42;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const pt = (px: number, py: number) => ({ x: x + px * c - py * s, y: y + px * s + py * c });
  const strip = [
    pt(-len / 2, -w / 2),
    pt(len / 2, -w / 2),
    pt(len / 2, w / 2),
    pt(-len / 2, w / 2),
  ];
  g.lineStyle(Math.max(1, len / 14), 0x9a6b3f, 1);
  g.fillStyle(0xf6d7a8, 1);
  g.fillPoints(strip, true);
  g.strokePoints(strip, true);
  const pad = [
    pt(-len * 0.16, -w / 2),
    pt(len * 0.16, -w / 2),
    pt(len * 0.16, w / 2),
    pt(-len * 0.16, w / 2),
  ];
  g.fillStyle(0xfff3e0, 1);
  g.fillPoints(pad, true);
}
