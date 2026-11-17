import Phaser from 'phaser';
import { COLORS } from '../../config';

/**
 * 我的家（T033）的家具圖：用幾何圖形畫的佔位美術，之後可以換正式的圖。
 * 每件家具的原點在底部中央（踩在地上的那一點），往上是負的 y。
 * drawFurniture 畫整件；drawFurnitureFront 只畫「擋在角色前面」的那一部分
 * （泳池的水、紙箱的前板…），角色鑽進去時蓋在牠身上，看起來就像泡在裡面。
 */
type G = Phaser.GameObjects.Graphics;
type Pt = readonly [number, number];

const INK = COLORS.inkHex;
const WOOD = 0xb98a5a;
const WOOD_D = 0x8a5a30;
const CREAM = 0xfff3e0;
const RED = 0xd9534f;
const BLUE = 0x4f9fd8;
const GREEN = 0x5fae5a;
const YELLOW = 0xf4c430;
const GREY = 0xa9adb5;
const WATER = 0x6fc4ea;
const PINK = 0xf29bb5;

class Pen {
  constructor(private readonly g: G) {
    g.lineStyle(2.5, INK, 1);
  }
  /** 圓角方塊：左上角 (x, y) */
  r(x: number, y: number, w: number, h: number, c: number, rad = 4): this {
    this.g.fillStyle(c, 1);
    this.g.fillRoundedRect(x, y, w, h, Math.min(rad, w / 2, h / 2));
    this.g.strokeRoundedRect(x, y, w, h, Math.min(rad, w / 2, h / 2));
    return this;
  }
  /** 橢圓：中心 (x, y)，寬高 */
  e(x: number, y: number, w: number, h: number, c: number): this {
    this.g.fillStyle(c, 1);
    this.g.fillEllipse(x, y, w, h);
    this.g.strokeEllipse(x, y, w, h);
    return this;
  }
  c(x: number, y: number, rad: number, c: number): this {
    return this.e(x, y, rad * 2, rad * 2, c);
  }
  /** 多邊形 */
  p(pts: readonly Pt[], c: number): this {
    const ps = pts.map(([x, y]) => ({ x, y }));
    this.g.fillStyle(c, 1);
    this.g.fillPoints(ps, true);
    this.g.strokePoints(ps, true);
    return this;
  }
  /** 線 */
  l(x1: number, y1: number, x2: number, y2: number, c: number = INK, w = 2.5): this {
    this.g.lineStyle(w, c, 1);
    this.g.lineBetween(x1, y1, x2, y2);
    this.g.lineStyle(2.5, INK, 1);
    return this;
  }
  /** 沒有外框的色塊（花紋、反光） */
  dot(x: number, y: number, rad: number, c: number, a = 1): this {
    this.g.fillStyle(c, a);
    this.g.fillCircle(x, y, rad);
    return this;
  }
  bar(x: number, y: number, w: number, h: number, c: number, a = 1): this {
    this.g.fillStyle(c, a);
    this.g.fillRect(x, y, w, h);
    return this;
  }
}

const ART: Record<string, (p: Pen) => void> = {
  // ---------------- 屋內 ----------------
  sofa: (p) => {
    p.r(-62, -62, 124, 44, 0xc86f5a, 10)
      .r(-70, -40, 22, 40, 0xb55a48, 8)
      .r(48, -40, 22, 40, 0xb55a48, 8)
      .r(-50, -34, 100, 22, 0xe08a72, 6)
      .r(-50, -14, 100, 14, 0xb55a48, 4)
      .l(0, -34, 0, -13);
  },
  armchair: (p) => {
    p.r(-30, -60, 60, 40, 0x5f9ea8, 10)
      .r(-38, -38, 16, 38, 0x4a8792, 6)
      .r(22, -38, 16, 38, 0x4a8792, 6)
      .r(-24, -32, 48, 20, 0x7fbcc6, 6)
      .r(-24, -14, 48, 14, 0x4a8792, 4);
  },
  rug: (p) => {
    p.e(0, -8, 150, 44, 0xe9b872).e(0, -8, 116, 30, 0xf6dba0).e(0, -8, 70, 16, 0xd9534f);
  },
  cattree: (p) => {
    p.r(-34, -10, 68, 10, 0xd8c3a5, 3)
      .r(-8, -62, 14, 54, 0xc9a86a, 3)
      .r(-40, -70, 56, 10, 0xe6d3b3, 4)
      .r(10, -118, 14, 50, 0xc9a86a, 3)
      .r(-14, -126, 60, 10, 0xe6d3b3, 4)
      .r(-36, -48, 28, 26, 0xb98a5a, 6)
      .c(-22, -35, 8, 0x5c3d22);
    for (const y of [-52, -40, -28, -18]) p.l(-8, y, 6, y, 0xa98a52, 1.5);
    p.l(30, -116, 34, -98, 0x8a5a30, 1.5).c(34, -94, 5, RED);
  },
  box: (p) => {
    p.p(
      [
        [-40, -34],
        [-52, -50],
        [-30, -44],
      ],
      0xcfa26a,
    )
      .p(
        [
          [40, -34],
          [52, -50],
          [30, -44],
        ],
        0xcfa26a,
      )
      .r(-40, -40, 80, 14, 0x9a7446, 2)
      .r(-40, -30, 80, 30, 0xd9b27c, 3)
      .l(0, -30, 0, 0, 0xb98a5a, 2);
  },
  yarn: (p) => {
    p.c(0, -14, 14, PINK)
      .l(-10, -20, 8, -6, 0xd9708f, 1.5)
      .l(-12, -12, 4, -26, 0xd9708f, 1.5)
      .l(-4, -2, 12, -18, 0xd9708f, 1.5)
      .l(12, -6, 26, -2, PINK, 2);
  },
  bed: (p) => {
    p.e(0, -12, 100, 36, 0x7a9ad0).e(0, -15, 74, 22, CREAM).e(-20, -18, 26, 12, 0xf6d9b8);
  },
  bowl: (p) => {
    p.p(
      [
        [-22, -16],
        [22, -16],
        [16, 0],
        [-16, 0],
      ],
      RED,
    )
      .e(0, -16, 44, 10, 0x8a5a30)
      .dot(-6, -17, 3, 0xb98a5a)
      .dot(5, -16, 3, 0xb98a5a);
  },
  plant: (p) => {
    p.e(-12, -52, 26, 40, GREEN)
      .e(12, -54, 26, 44, 0x4f9a4a)
      .e(0, -66, 24, 46, 0x6fbe6a)
      .p(
        [
          [-18, -30],
          [18, -30],
          [13, 0],
          [-13, 0],
        ],
        0xc9703f,
      )
      .r(-20, -34, 40, 8, 0xd98a55, 3);
  },
  fishtank: (p) => {
    p.r(-34, -22, 68, 22, WOOD_D, 3)
      .r(-30, -70, 60, 50, 0xbfe6f6, 4)
      .bar(-28, -62, 56, 40, WATER, 0.9)
      .p(
        [
          [-12, -44],
          [-2, -50],
          [-2, -38],
        ],
        0xf2a03d,
      )
      .e(4, -44, 16, 10, 0xf2a03d)
      .e(-14, -30, 10, 6, RED)
      .l(18, -22, 14, -40, GREEN, 3)
      .l(22, -22, 24, -46, 0x4f9a4a, 3);
  },
  shelf: (p) => {
    p.r(-36, -112, 72, 112, WOOD, 4);
    for (const y of [-104, -70, -36]) p.r(-30, y, 60, 28, 0x7a5230, 2);
    const books = [RED, BLUE, YELLOW, GREEN, 0x8e44ad, 0xe08a3c];
    for (const [row, y] of [-104, -70].entries())
      for (let i = 0; i < 6; i++)
        p.r(-27 + i * 9, y + 6 + ((i + row) % 3) * 2, 8, 22 - ((i + row) % 3) * 2, books[i], 1);
    p.c(-12, -18, 8, 0xf6d9b8).r(4, -28, 20, 20, 0xd8c3a5, 3);
  },
  lamp: (p) => {
    p.e(0, -4, 34, 10, 0x6b5a48)
      .r(-3, -86, 6, 84, 0x6b5a48, 2)
      .p(
        [
          [-12, -112],
          [12, -112],
          [22, -80],
          [-22, -80],
        ],
        0xffe9a8,
      )
      .dot(0, -76, 16, 0xfff3c4, 0.35);
  },
  table: (p) => {
    p.r(-34, -12, 8, 12, WOOD_D, 2)
      .r(26, -12, 8, 12, WOOD_D, 2)
      .r(-44, -32, 88, 12, WOOD, 4)
      .r(-36, -22, 72, 6, WOOD_D, 2)
      .r(-10, -42, 14, 10, CREAM, 3)
      .l(4, -38, 9, -38);
  },
  tv: (p) => {
    p.r(-44, -24, 88, 24, WOOD_D, 3)
      .r(-40, -82, 80, 54, 0x3a3f4a, 5)
      .r(-34, -76, 68, 42, 0x8fd0f0, 3)
      .bar(-34, -50, 68, 16, 0x8ccf6a, 1)
      .dot(18, -66, 6, 0xfff3c4)
      .r(-6, -28, 12, 6, 0x3a3f4a, 1);
  },
  fireplace: (p) => {
    p.r(-46, -84, 92, 84, 0xc98f6a, 4)
      .r(-54, -92, 108, 12, 0x8a5a30, 3)
      .r(-30, -56, 60, 56, 0x3b2a1a, 6)
      .p(
        [
          [-16, -4],
          [-10, -30],
          [-2, -16],
          [4, -40],
          [12, -18],
          [18, -4],
        ],
        0xf28a2a,
      )
      .p(
        [
          [-6, -4],
          [0, -22],
          [8, -4],
        ],
        YELLOW,
      )
      .r(-22, -8, 44, 8, WOOD_D, 3);
  },
  scratch: (p) => {
    p.r(-26, -8, 52, 8, 0xd8c3a5, 3)
      .r(-8, -78, 16, 70, 0xc9a86a, 4)
      .r(-18, -86, 36, 10, 0xe6d3b3, 4);
    for (let y = -70; y < -12; y += 8) p.l(-8, y, 8, y + 3, 0xa98a52, 1.5);
  },
  tunnel: (p) => {
    p.r(-56, -40, 112, 40, 0x6fb0e0, 18)
      .e(-50, -20, 26, 40, 0x3b6ea5)
      .e(-50, -20, 16, 28, 0x2a2a3a);
    for (const x of [-24, 2, 28]) p.l(x, -40, x, 0, 0x4f8ac0, 2);
  },
  cushion: (p) => {
    p.e(0, -10, 84, 30, 0xf2c14b).e(0, -13, 60, 18, 0xf6d98a).dot(0, -13, 3, 0xd99a1c);
  },
  clock: (p) => {
    p.r(-20, -120, 40, 120, WOOD, 5)
      .c(0, -96, 15, CREAM)
      .l(0, -96, 0, -106)
      .l(0, -96, 7, -93)
      .r(-12, -70, 24, 56, 0x7a5230, 3)
      .l(0, -68, 0, -36, YELLOW, 2)
      .c(0, -32, 6, YELLOW);
  },
  toybox: (p) => {
    p.c(-16, -34, 9, RED)
      .c(4, -36, 8, BLUE)
      .r(10, -44, 14, 14, YELLOW, 3)
      .r(-36, -30, 72, 30, 0xe08a3c, 4)
      .r(-36, -30, 72, 8, 0xc06a22, 3)
      .dot(0, -12, 5, CREAM);
  },
  fan: (p) => {
    p.e(0, -4, 36, 10, GREY).r(-3, -50, 6, 48, GREY, 2).c(0, -68, 24, 0xe4eef0);
    for (const a of [0, 2.1, 4.2]) p.e(Math.cos(a) * 10, -68 + Math.sin(a) * 10, 16, 12, 0x8fc4e0);
    p.c(0, -68, 4, GREY);
  },
  kotatsu: (p) => {
    p.e(0, -8, 150, 40, 0xd9534f)
      .p(
        [
          [-54, -34],
          [54, -34],
          [66, -6],
          [-66, -6],
        ],
        0xe8756a,
      )
      .r(-50, -44, 100, 12, WOOD, 3)
      .c(-14, -50, 7, 0xf28a2a)
      .c(4, -50, 7, 0xf28a2a);
  },
  fountainbowl: (p) => {
    p.r(-20, -18, 40, 18, 0x8fc4e0, 6)
      .e(0, -18, 40, 10, WATER)
      .r(-5, -40, 10, 22, 0xe4eef0, 4)
      .l(0, -40, -8, -24, WATER, 2)
      .l(0, -40, 8, -24, WATER, 2);
  },
  bone: (p) => {
    p.r(-18, -14, 36, 10, CREAM, 4)
      .c(-18, -16, 6, CREAM)
      .c(-18, -6, 6, CREAM)
      .c(18, -16, 6, CREAM)
      .c(18, -6, 6, CREAM);
    p.bar(-17, -12, 34, 6, CREAM);
  },
  mouse: (p) => {
    p.l(12, -6, 28, -10, 0x8a8f98, 2)
      .e(0, -8, 28, 16, GREY)
      .c(-8, -16, 5, PINK)
      .c(-2, -17, 5, PINK)
      .dot(-11, -8, 1.5, INK);
  },

  // ---------------- 庭院 ----------------
  pool: (p) => {
    p.e(0, -22, 190, 78, 0xf4f8fb).e(0, -22, 168, 62, WATER);
    p.dot(-30, -30, 10, 0xffffff, 0.35).dot(34, -14, 7, 0xffffff, 0.3);
    p.c(66, -44, 11, RED).c(66, -44, 5, 0xffffff);
  },
  frisbee: (p) => {
    p.e(0, -6, 34, 12, RED).e(0, -7, 20, 6, 0xf6a09c);
  },
  ball: (p) => {
    p.c(0, -13, 13, 0xf2c14b).l(-12, -13, 12, -13, RED, 3).dot(-4, -18, 3, 0xffffff, 0.6);
  },
  kennel: (p) => {
    p.r(-44, -56, 88, 56, 0xe0b27a, 3)
      .p(
        [
          [-56, -52],
          [0, -96],
          [56, -52],
        ],
        0xc0563a,
      )
      .r(-18, -38, 36, 38, 0x3b2a1a, 16)
      .r(-14, -66, 28, 10, CREAM, 3);
  },
  parasol: (p) => {
    p.r(-3, -100, 6, 100, 0xf4ead8, 2)
      .p(
        [
          [-64, -92],
          [0, -128],
          [64, -92],
        ],
        RED,
      )
      .p(
        [
          [-22, -92],
          [0, -128],
          [22, -92],
        ],
        CREAM,
      )
      .e(0, -3, 40, 10, GREY);
  },
  flowers: (p) => {
    p.r(-50, -16, 100, 16, WOOD_D, 3).bar(-46, -22, 92, 8, 0x5c9a52);
    const cs = [RED, YELLOW, PINK, 0xffffff, 0x8e44ad];
    for (let i = 0; i < 5; i++) {
      const x = -38 + i * 19;
      p.l(x, -18, x, -34, 0x4f9a4a, 2).c(x, -38, 7, cs[i]).dot(x, -38, 2.5, YELLOW);
    }
  },
  hammock: (p) => {
    p.r(-66, -70, 6, 70, WOOD_D, 2)
      .r(60, -70, 6, 70, WOOD_D, 2)
      .p(
        [
          [-62, -62],
          [-30, -34],
          [30, -34],
          [62, -62],
          [34, -26],
          [-34, -26],
        ],
        0xf6d98a,
      )
      .l(-20, -33, -20, -27, RED, 3)
      .l(0, -33, 0, -27, RED, 3)
      .l(20, -33, 20, -27, RED, 3);
  },
  catgrass: (p) => {
    for (const [x, h] of [
      [-12, 24],
      [-6, 32],
      [0, 28],
      [6, 34],
      [12, 22],
    ] as const)
      p.l(x, -16, x + (x > 0 ? 3 : -3), -16 - h, 0x6fbe6a, 3);
    p.p(
      [
        [-18, -18],
        [18, -18],
        [13, 0],
        [-13, 0],
      ],
      0x8fc4e0,
    );
  },
  tree: (p) => {
    p.r(-10, -70, 20, 70, WOOD_D, 4)
      .c(-26, -92, 30, 0x4f9a4a)
      .c(26, -92, 30, 0x4f9a4a)
      .c(0, -116, 34, GREEN)
      .dot(-14, -122, 5, 0x8fd47a, 0.8)
      .c(16, -84, 5, RED)
      .c(-22, -78, 5, RED);
  },
  bench: (p) => {
    p.r(-48, -18, 8, 18, WOOD_D, 2)
      .r(40, -18, 8, 18, WOOD_D, 2)
      .r(-54, -28, 108, 10, WOOD, 3)
      .r(-54, -54, 108, 8, WOOD, 3)
      .r(-54, -42, 108, 8, WOOD, 3)
      .r(-50, -54, 6, 30, WOOD_D, 2)
      .r(44, -54, 6, 30, WOOD_D, 2);
  },
  slide: (p) => {
    p.r(-44, -72, 8, 72, GREY, 2)
      .r(-22, -72, 8, 72, GREY, 2)
      .l(-40, -20, -18, -20)
      .l(-40, -40, -18, -40)
      .r(-48, -80, 38, 10, YELLOW, 3)
      .p(
        [
          [-12, -78],
          [60, -6],
          [60, 0],
          [44, 0],
          [-12, -62],
        ],
        RED,
      );
  },
  sandbox: (p) => {
    p.r(-60, -30, 120, 30, WOOD, 4)
      .e(0, -24, 108, 20, 0xf1dba0)
      .p(
        [
          [18, -26],
          [30, -44],
          [42, -26],
        ],
        0xe3c684,
      )
      .r(-36, -40, 12, 14, BLUE, 2)
      .l(-30, -40, -30, -48, BLUE, 2);
  },
  tent: (p) => {
    p.p(
      [
        [-58, 0],
        [0, -84],
        [58, 0],
      ],
      0xf2a03d,
    )
      .p(
        [
          [-16, 0],
          [0, -50],
          [16, 0],
        ],
        0x3b2a1a,
      )
      .l(0, -84, 0, -94)
      .p(
        [
          [0, -94],
          [14, -90],
          [0, -86],
        ],
        RED,
      );
  },
  bbq: (p) => {
    p.l(-16, -34, -22, 0, 0x4a4a52, 3)
      .l(16, -34, 22, 0, 0x4a4a52, 3)
      .p(
        [
          [-28, -48],
          [28, -48],
          [20, -30],
          [-20, -30],
        ],
        0x4a4a52,
      )
      .e(0, -48, 56, 12, 0x2a2a30)
      .r(-18, -54, 14, 6, 0xc0563a, 2)
      .r(2, -54, 14, 6, 0xc0563a, 2)
      .dot(-6, -68, 5, 0xffffff, 0.5)
      .dot(4, -80, 6, 0xffffff, 0.35);
  },
  fountain: (p) => {
    p.e(0, -12, 110, 34, 0xd9dde4)
      .e(0, -14, 92, 24, WATER)
      .r(-7, -52, 14, 40, 0xd9dde4, 3)
      .e(0, -52, 44, 12, 0xd9dde4)
      .l(0, -72, 0, -54, WATER, 4)
      .l(-2, -68, -16, -52, WATER, 2)
      .l(2, -68, 16, -52, WATER, 2);
  },
  swing: (p) => {
    p.l(-44, 0, -30, -100, WOOD_D, 5)
      .l(44, 0, 30, -100, WOOD_D, 5)
      .r(-36, -106, 72, 8, WOOD_D, 3)
      .l(-16, -98, -16, -36, 0x8a8f98, 2)
      .l(16, -98, 16, -36, 0x8a8f98, 2)
      .r(-22, -38, 44, 8, RED, 3);
  },
  tire: (p) => {
    p.e(0, -18, 58, 36, 0x3a3f4a)
      .e(0, -18, 30, 18, 0x74b957)
      .l(-20, -30, -12, -24, 0x5a6270, 2)
      .l(20, -30, 12, -24, 0x5a6270, 2);
  },
  hurdle: (p) => {
    p.r(-40, -44, 6, 44, 0xffffff, 2)
      .r(34, -44, 6, 44, 0xffffff, 2)
      .r(-40, -40, 80, 8, RED, 2)
      .bar(-20, -39, 14, 6, 0xffffff)
      .bar(8, -39, 14, 6, 0xffffff)
      .r(-40, -22, 80, 6, BLUE, 2);
  },
  agility: (p) => {
    p.r(-4, -20, 8, 20, GREY, 2)
      .e(0, -4, 44, 10, GREY)
      .c(0, -52, 34, YELLOW)
      .c(0, -52, 25, 0x74b957);
    p.dot(0, -52, 24, 0x8ccf6a, 1);
  },
  lantern: (p) => {
    p.r(-14, -12, 28, 12, GREY, 3)
      .r(-6, -44, 12, 34, 0xbfc4cc, 2)
      .r(-16, -70, 32, 26, 0xd9dde4, 3)
      .r(-8, -64, 16, 14, 0xffe9a8, 2)
      .p(
        [
          [-24, -68],
          [0, -90],
          [24, -68],
        ],
        GREY,
      );
  },
  pond: (p) => {
    p.e(0, -16, 130, 46, 0x8a9a8a).e(0, -16, 112, 34, 0x5fb0d6);
    p.e(-24, -18, 22, 10, 0x5fae5a).e(26, -10, 18, 8, 0x5fae5a).c(-24, -20, 4, PINK);
    p.e(8, -22, 14, 6, 0xf2a03d);
  },
  stump: (p) => {
    p.r(-26, -28, 52, 28, WOOD_D, 5)
      .e(0, -28, 52, 16, 0xe0b27a)
      .e(0, -28, 30, 9, 0xcf9c60)
      .e(0, -28, 12, 4, WOOD);
  },
  snowman: (p) => {
    p.c(0, -20, 22, 0xffffff)
      .c(0, -52, 15, 0xffffff)
      .dot(-5, -55, 2, INK)
      .dot(5, -55, 2, INK)
      .p(
        [
          [0, -51],
          [14, -48],
          [0, -46],
        ],
        0xf28a2a,
      )
      .r(-12, -42, 24, 6, RED, 2)
      .r(-10, -76, 20, 12, 0x3a3f4a, 2)
      .r(-14, -66, 28, 4, 0x3a3f4a, 1)
      .dot(0, -24, 2, INK)
      .dot(0, -14, 2, INK);
  },
  picnic: (p) => {
    p.p(
      [
        [-56, -22],
        [40, -30],
        [62, -4],
        [-44, 0],
      ],
      0xfafafa,
    );
    for (const x of [-40, -12, 16, 44]) p.bar(x, -22, 10, 18, RED, 0.75);
    p.r(-22, -36, 30, 18, 0xcfa26a, 4).l(-18, -36, 4, -44, WOOD_D, 2).c(26, -20, 7, 0xf28a2a);
  },
  campfire: (p) => {
    p.l(-22, -4, 18, -12, WOOD_D, 7)
      .l(22, -4, -18, -12, WOOD_D, 7)
      .p(
        [
          [-16, -8],
          [-10, -34],
          [-2, -20],
          [4, -48],
          [12, -22],
          [18, -8],
        ],
        0xf28a2a,
      )
      .p(
        [
          [-6, -8],
          [1, -28],
          [8, -8],
        ],
        YELLOW,
      )
      .c(-28, -4, 5, GREY)
      .c(28, -4, 5, GREY);
  },
};

/** 擋在角色前面的那一部分（沒有的家具不用寫） */
const FRONT: Record<string, (p: Pen) => void> = {
  pool: (p) => {
    p.bar(-84, -22, 168, 4, WATER).e(0, -8, 150, 26, WATER).dot(-20, -6, 8, 0xffffff, 0.3);
    // 蓋掉橢圓上半圈的外框，只留下面那一段水
    p.bar(-76, -22, 152, 12, WATER);
  },
  box: (p) => {
    p.r(-40, -30, 80, 30, 0xd9b27c, 3).l(0, -30, 0, 0, 0xb98a5a, 2);
  },
  tunnel: (p) => {
    p.r(-30, -40, 86, 40, 0x6fb0e0, 18);
    for (const x of [2, 28]) p.l(x, -40, x, 0, 0x4f8ac0, 2);
  },
  kotatsu: (p) => {
    p.p(
      [
        [-54, -34],
        [54, -34],
        [66, -6],
        [-66, -6],
      ],
      0xe8756a,
    ).r(-50, -44, 100, 12, WOOD, 3);
  },
  sandbox: (p) => {
    p.r(-60, -18, 120, 18, WOOD, 4).bar(-52, -24, 104, 8, 0xf1dba0);
  },
  tent: (p) => {
    p.p(
      [
        [-58, 0],
        [0, -84],
        [-4, -40],
        [-16, 0],
      ],
      0xf2a03d,
    ).p(
      [
        [58, 0],
        [0, -84],
        [4, -40],
        [16, 0],
      ],
      0xf2a03d,
    );
  },
};

/** 每件家具大概多大（寬、高），給圖示縮放與像素圖的範圍用 */
export const FURNITURE_BOX = { x: -100, y: -140, width: 200, height: 152 } as const;

export function drawFurniture(g: G, id: string): void {
  const art = ART[id];
  if (art) art(new Pen(g));
  else new Pen(g).r(-20, -30, 40, 30, GREY);
}

export function hasFurnitureArt(id: string): boolean {
  return !!ART[id];
}

/** 這件家具有沒有「擋在前面」的部分 */
export function hasFurnitureFront(id: string): boolean {
  return !!FRONT[id];
}

export function drawFurnitureFront(g: G, id: string): void {
  FRONT[id]?.(new Pen(g));
}
