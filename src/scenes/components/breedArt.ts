import Phaser from 'phaser';
import { COLORS } from '../../config';
import { mixColor } from '../../logic/sceneryShapes';

/**
 * 照真實犬種畫的狗（T025 第二步，Jimmy 2026-11-16：「根據真實狗狗的模樣去設計角色」）。
 * 每個犬種有自己的頭（耳朵、臉型、毛色花紋、眼睛）、身體與尾巴；還沒畫的犬種用原本的通用畫法。
 * 全部原創、用程式畫，參考的是犬種本身的外觀特徵。
 *
 * 光從右上方來：亮面在右上、暗面在左下。
 */

type G = Phaser.GameObjects.Graphics;

export interface BreedPalette {
  /** 主要毛色 */
  main: number;
  /** 淺色的毛（肚子、臉頰、嘴邊） */
  under: number;
}

export interface BreedHeadOptions {
  eyesClosed?: boolean;
  /** 兇的（頭目）：不畫腮紅與微笑 */
  fierce?: boolean;
}

export interface BreedArt {
  /** 眼睛的位置與眼皮顏色（以頭的半徑為單位），閉眼時蓋眼皮用 */
  eye: { dx: number; dy: number; r: number; lid: (pal: BreedPalette) => number };
  head: (g: G, x: number, y: number, r: number, pal: BreedPalette, o: BreedHeadOptions) => void;
  /** 身體（側身，原點在腳底中央，基準約 150 x 130） */
  body: (g: G, pal: BreedPalette) => void;
  /** 尾巴（原點在尾巴根部） */
  tail: (g: G, pal: BreedPalette) => void;
}

const INK = COLORS.inkHex;
const dark = (c: number, k: number) => mixColor(c, 0x1a0f08, k);
const lite = (c: number, k: number) => mixColor(c, 0xffffff, k);

/**
 * 先收集一組形狀，畫的時候先全部放大一圈塗描邊色、再照原本大小塗顏色，
 * 好幾個形狀疊在一起時外面只有一圈描邊，裡面不會有線。
 */
class Shapes {
  private readonly list: ((g: G, grow: number) => void)[] = [];
  circle(x: number, y: number, r: number): this {
    this.list.push((g, k) => g.fillCircle(x, y, r + k));
    return this;
  }
  ellipse(x: number, y: number, w: number, h: number): this {
    this.list.push((g, k) => g.fillEllipse(x, y, w + k * 2, h + k * 2));
    return this;
  }
  tri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    this.list.push((g, k) => {
      g.fillTriangle(x1, y1, x2, y2, x3, y3);
      if (k > 0) {
        g.lineStyle(k * 2, INK, 1);
        g.strokeTriangle(x1, y1, x2, y2, x3, y3);
      }
    });
    return this;
  }
  rrect(x: number, y: number, w: number, h: number, rad: number): this {
    this.list.push((g, k) => g.fillRoundedRect(x - k, y - k, w + k * 2, h + k * 2, rad + k));
    return this;
  }
  draw(g: G, color: number, line: number): void {
    g.fillStyle(INK, 1);
    for (const s of this.list) s(g, line);
    g.fillStyle(color, 1);
    for (const s of this.list) s(g, 0);
  }
}

function eyes(
  g: G,
  x: number,
  y: number,
  r: number,
  e: { dx: number; dy: number; r: number },
  closed: boolean,
  iris?: number,
): void {
  for (const side of [-1, 1]) {
    const ex = x + side * e.dx * r;
    const ey = y + e.dy * r;
    if (closed) {
      g.lineStyle(Math.max(2, r * 0.07), INK, 1);
      g.beginPath();
      g.arc(ex, ey - r * 0.03, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
      g.strokePath();
      continue;
    }
    const er = Math.max(2.5, e.r * r);
    g.fillStyle(INK, 1);
    g.fillCircle(ex, ey, er);
    if (iris !== undefined) {
      g.fillStyle(iris, 1);
      g.fillCircle(ex, ey, er * 0.74);
      g.fillStyle(INK, 1);
      g.fillCircle(ex, ey, er * 0.36);
    }
    g.fillStyle(0xffffff, 1);
    g.fillCircle(ex + er * 0.34, ey - er * 0.36, Math.max(1, er * 0.34));
  }
}

function nose(g: G, x: number, y: number, r: number, size: number): void {
  const w = Math.max(3, r * size);
  g.fillStyle(INK, 1);
  g.fillEllipse(x, y, w * 2, w * 1.4);
  g.fillTriangle(x - w * 0.8, y, x + w * 0.8, y, x, y + w * 1.1);
  g.fillStyle(0xffffff, 0.5);
  g.fillEllipse(x + w * 0.25, y - w * 0.3, w * 0.7, w * 0.35);
}

function smile(g: G, x: number, y: number, r: number, tongue: boolean): void {
  if (tongue) {
    g.fillStyle(0xf08a94, 1);
    g.fillEllipse(x, y + r * 0.1, r * 0.2, r * 0.26);
    g.fillStyle(0xd96a78, 1);
    g.fillRect(x - r * 0.012, y + r * 0.04, r * 0.024, r * 0.14);
  }
  g.lineStyle(Math.max(1.5, r * 0.055), INK, 1);
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(x + side * r * 0.11, y, r * 0.11, 0, Math.PI);
    g.strokePath();
  }
}

function blush(g: G, x: number, y: number, r: number, dx: number, dy: number): void {
  g.fillStyle(0xff7f7f, 0.3);
  g.fillEllipse(x - r * dx, y + r * dy, r * 0.3, r * 0.18);
  g.fillEllipse(x + r * dx, y + r * dy, r * 0.3, r * 0.18);
}

/** 四條腿：後面那兩條在背光面比較暗；socks 是腳掌往上淺色的高度 */
function legs(
  g: G,
  xs: readonly number[],
  top: number,
  width: number,
  color: number,
  sock: number,
  sockH: number,
): void {
  const far = [xs[1], xs[2]];
  const near = [xs[0], xs[3]];
  for (const [list, c] of [
    [far, dark(color, 0.3)],
    [near, color],
  ] as const) {
    for (const lx of list) {
      new Shapes().rrect(lx - width / 2, top, width, -top, 6).draw(g, c, 3);
      g.fillStyle(c === color ? sock : dark(sock, 0.22), 1);
      g.fillRoundedRect(lx - width / 2, -sockH, width, sockH, 5);
      // 腳趾
      g.fillStyle(INK, 0.55);
      g.fillRect(lx - 1.5, -5, 1.5, 5);
      g.fillRect(lx + 2.5, -5, 1.5, 5);
    }
  }
}

// ---------------------------------------------------------------- 柴犬

const shiba: BreedArt = {
  eye: { dx: 0.36, dy: -0.12, r: 0.1, lid: (p) => p.main },
  head(g, x, y, r, pal, o) {
    const lw = Math.max(2, r / 14);
    const main = pal.main;
    // 三角形的立耳，微微往前傾
    const ears = new Shapes();
    for (const s of [-1, 1]) {
      ears.tri(
        x + s * r * 0.98,
        y - r * 0.2,
        x + s * r * 0.78,
        y - r * 1.22,
        x + s * r * 0.2,
        y - r * 0.8,
      );
    }
    ears.draw(g, dark(main, 0.12), lw);
    for (const s of [-1, 1]) {
      g.fillStyle(pal.under, 1);
      g.fillTriangle(
        x + s * r * 0.84,
        y - r * 0.42,
        x + s * r * 0.75,
        y - r * 1.0,
        x + s * r * 0.4,
        y - r * 0.76,
      );
      g.fillStyle(0xf4b6a6, 0.8);
      g.fillTriangle(
        x + s * r * 0.78,
        y - r * 0.5,
        x + s * r * 0.73,
        y - r * 0.88,
        x + s * r * 0.5,
        y - r * 0.74,
      );
    }
    // 寬寬的臉：圓頭加上兩邊蓬蓬的臉頰
    new Shapes()
      .circle(x, y, r)
      .ellipse(x - r * 0.6, y + r * 0.28, r * 1.0, r * 0.95)
      .ellipse(x + r * 0.6, y + r * 0.28, r * 1.0, r * 0.95)
      .draw(g, main, lw);
    // 暗面（左下）與額頭的亮面
    g.fillStyle(dark(main, 0.3), 0.3);
    g.fillEllipse(x - r * 0.72, y + r * 0.2, r * 0.6, r * 1.0);
    g.fillStyle(lite(main, 0.5), 0.5);
    g.fillEllipse(x + r * 0.28, y - r * 0.62, r * 0.8, r * 0.34);
    // 裏白：臉頰、嘴邊、下巴是奶油色
    g.fillStyle(pal.under, 1);
    g.fillEllipse(x - r * 0.56, y + r * 0.4, r * 0.84, r * 0.66);
    g.fillEllipse(x + r * 0.56, y + r * 0.4, r * 0.84, r * 0.66);
    g.fillEllipse(x, y + r * 0.42, r * 1.0, r * 0.78);
    g.fillStyle(dark(pal.under, 0.16), 0.6);
    g.fillEllipse(x - r * 0.5, y + r * 0.6, r * 0.7, r * 0.24);
    // 眉毛上的兩個小白點（柴犬的招牌）
    g.fillStyle(pal.under, 1);
    g.fillEllipse(x - r * 0.36, y - r * 0.42, r * 0.22, r * 0.14);
    g.fillEllipse(x + r * 0.36, y - r * 0.42, r * 0.22, r * 0.14);
    if (!o.fierce) blush(g, x, y, r, 0.66, 0.2);
    eyes(g, x, y, r, shiba.eye, !!o.eyesClosed);
    nose(g, x, y + r * 0.2, r, 0.12);
    if (!o.fierce) smile(g, x, y + r * 0.4, r, false);
  },
  body(g, pal) {
    const main = pal.main;
    legs(g, [-40, -22, 22, 40], -36, 16, main, pal.under, 15);
    // 身體：先塗暗面，再往右上疊亮一點的毛，左下就留一道陰影
    new Shapes().ellipse(0, -56, 120, 58).ellipse(40, -62, 50, 54).draw(g, dark(main, 0.26), 3);
    g.fillStyle(main, 1);
    g.fillEllipse(3, -60, 112, 48);
    g.fillEllipse(41, -65, 44, 46);
    g.fillStyle(lite(main, 0.4), 0.55);
    g.fillEllipse(6, -74, 84, 14);
    // 裏白：胸口與肚子
    g.fillStyle(pal.under, 1);
    g.fillEllipse(46, -52, 30, 40);
    g.fillEllipse(14, -38, 74, 20);
    g.fillStyle(dark(pal.under, 0.2), 0.7);
    g.fillEllipse(8, -32, 66, 8);
  },
  tail(g, pal) {
    // 捲起來貼在背上的尾巴
    new Shapes().circle(-6, -22, 19).draw(g, dark(pal.main, 0.2), 3);
    g.fillStyle(pal.main, 1);
    g.fillCircle(-4, -24, 16);
    g.fillStyle(pal.under, 1);
    g.fillCircle(-3, -20, 10);
    g.fillStyle(pal.main, 1);
    g.fillCircle(-1, -18, 5);
    g.fillStyle(lite(pal.main, 0.4), 0.6);
    g.fillEllipse(0, -36, 16, 5);
  },
};

// ---------------------------------------------------------------- 哈士奇

const husky: BreedArt = {
  eye: { dx: 0.35, dy: -0.14, r: 0.13, lid: (p) => p.under },
  head(g, x, y, r, pal, o) {
    const lw = Math.max(2, r / 14);
    const coat = dark(pal.main, 0.3);
    const white = pal.under;
    // 又高又尖、靠得很近的耳朵
    const ears = new Shapes();
    for (const s of [-1, 1]) {
      ears.tri(
        x + s * r * 0.86,
        y - r * 0.4,
        x + s * r * 0.56,
        y - r * 1.42,
        x + s * r * 0.1,
        y - r * 0.82,
      );
    }
    ears.draw(g, coat, lw);
    for (const s of [-1, 1]) {
      g.fillStyle(white, 1);
      g.fillTriangle(
        x + s * r * 0.7,
        y - r * 0.56,
        x + s * r * 0.55,
        y - r * 1.18,
        x + s * r * 0.3,
        y - r * 0.8,
      );
      g.fillStyle(0xf4b6a6, 0.75);
      g.fillTriangle(
        x + s * r * 0.64,
        y - r * 0.62,
        x + s * r * 0.54,
        y - r * 1.02,
        x + s * r * 0.38,
        y - r * 0.8,
      );
    }
    // 頭：圓頭加上兩邊尖尖的白色頰毛
    new Shapes()
      .circle(x, y, r)
      .tri(x - r * 0.7, y - r * 0.1, x - r * 1.22, y + r * 0.5, x - r * 0.4, y + r * 0.86)
      .tri(x + r * 0.7, y - r * 0.1, x + r * 1.22, y + r * 0.5, x + r * 0.4, y + r * 0.86)
      .draw(g, white, lw);
    // 深色的頭頂，從額頭往兩眼中間收成一個尖（面罩）
    g.fillStyle(coat, 1);
    g.beginPath();
    g.arc(x, y, r, Math.PI * 1.02, Math.PI * 1.98, false);
    g.closePath();
    g.fillPath();
    g.fillEllipse(x, y - r * 0.1, r * 1.9, r * 0.5);
    // 眼睛上方兩塊白色、兩頰與嘴邊的白
    g.fillStyle(white, 1);
    g.fillEllipse(x - r * 0.4, y - r * 0.16, r * 0.62, r * 0.66);
    g.fillEllipse(x + r * 0.4, y - r * 0.16, r * 0.62, r * 0.66);
    g.fillEllipse(x, y + r * 0.36, r * 1.5, r * 1.04);
    // 兩眼中間那道深色的尖
    g.fillStyle(coat, 1);
    g.fillTriangle(x - r * 0.2, y - r * 0.56, x + r * 0.2, y - r * 0.56, x, y + r * 0.02);
    // 亮面與暗面
    g.fillStyle(lite(coat, 0.45), 0.5);
    g.fillEllipse(x + r * 0.34, y - r * 0.72, r * 0.6, r * 0.22);
    g.fillStyle(0x6a7a90, 0.22);
    g.fillEllipse(x - r * 0.62, y + r * 0.42, r * 0.5, r * 0.8);
    // 比較長的嘴
    g.fillStyle(lite(white, 0.6), 1);
    g.fillEllipse(x, y + r * 0.44, r * 0.74, r * 0.62);
    eyes(g, x, y, r, husky.eye, !!o.eyesClosed, 0x6cc8f2);
    // 上眼線，眼神比較銳利
    if (!o.eyesClosed) {
      g.lineStyle(Math.max(1.5, r * 0.05), INK, 1);
      for (const s of [-1, 1]) {
        g.lineBetween(x + s * r * 0.2, y - r * 0.24, x + s * r * 0.52, y - r * 0.3);
      }
    }
    nose(g, x, y + r * 0.26, r, 0.14);
    if (!o.fierce) smile(g, x, y + r * 0.5, r, false);
  },
  body(g, pal) {
    const coat = dark(pal.main, 0.3);
    const white = pal.under;
    legs(g, [-42, -24, 24, 42], -42, 15, white, lite(white, 0.5), 10);
    new Shapes().ellipse(0, -60, 124, 54).ellipse(42, -66, 50, 54).draw(g, dark(white, 0.24), 3);
    // 肚子與胸口是白的
    g.fillStyle(white, 1);
    g.fillEllipse(3, -62, 116, 46);
    g.fillEllipse(44, -66, 44, 48);
    // 背上一大片深色的毛，往肩膀蓋下來
    g.fillStyle(coat, 1);
    g.fillEllipse(-6, -72, 108, 30);
    g.fillEllipse(24, -78, 60, 24);
    g.fillEllipse(-40, -66, 36, 32);
    g.fillStyle(pal.main, 1);
    g.fillEllipse(-4, -66, 96, 12);
    g.fillStyle(lite(coat, 0.4), 0.5);
    g.fillEllipse(4, -82, 70, 7);
    // 胸前蓬蓬的白毛
    g.fillStyle(lite(white, 0.6), 1);
    g.fillTriangle(34, -62, 60, -60, 46, -34);
  },
  tail(g, pal) {
    const coat = dark(pal.main, 0.3);
    // 又粗又蓬、像鐮刀一樣往上彎的尾巴，尾端是白的
    new Shapes()
      .ellipse(-12, -14, 26, 40)
      .ellipse(-18, -34, 24, 30)
      .circle(-14, -48, 11)
      .draw(g, coat, 3);
    g.fillStyle(pal.main, 1);
    g.fillEllipse(-8, -16, 12, 30);
    g.fillStyle(pal.under, 1);
    g.fillCircle(-13, -49, 9);
    g.fillEllipse(-9, -38, 10, 16);
  },
};

// ---------------------------------------------------------------- 博美

/** 一圈蓬蓬的毛：沿著圓周排一圈小圓 */
function fluffRing(
  s: Shapes,
  x: number,
  y: number,
  rx: number,
  ry: number,
  blob: number,
  n: number,
): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    s.circle(x + Math.cos(a) * rx, y + Math.sin(a) * ry, blob);
  }
}

const pom: BreedArt = {
  eye: { dx: 0.3, dy: -0.04, r: 0.115, lid: (p) => p.main },
  head(g, x, y, r, pal, o) {
    const lw = Math.max(2, r / 14);
    const main = pal.main;
    // 小小的耳朵從毛裡冒出來
    const ears = new Shapes();
    for (const s of [-1, 1]) {
      ears.tri(
        x + s * r * 0.72,
        y - r * 0.66,
        x + s * r * 0.6,
        y - r * 1.24,
        x + s * r * 0.22,
        y - r * 0.88,
      );
    }
    ears.draw(g, dark(main, 0.14), lw);
    for (const s of [-1, 1]) {
      g.fillStyle(0xf4b6a6, 0.8);
      g.fillTriangle(
        x + s * r * 0.62,
        y - r * 0.78,
        x + s * r * 0.58,
        y - r * 1.06,
        x + s * r * 0.38,
        y - r * 0.86,
      );
    }
    // 臉旁邊一大圈蓬鬆的毛
    const ruff = new Shapes().circle(x, y, r * 0.96);
    fluffRing(ruff, x, y + r * 0.06, r * 0.9, r * 0.9, r * 0.32, 13);
    ruff.draw(g, dark(main, 0.16), lw);
    // 毛尖比較亮，一撮一撮的
    g.fillStyle(main, 1);
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2 + 0.2;
      g.fillCircle(
        x + Math.cos(a) * r * 0.86 + r * 0.04,
        y + r * 0.06 + Math.sin(a) * r * 0.86 - r * 0.05,
        r * 0.25,
      );
    }
    g.fillStyle(lite(main, 0.45), 0.9);
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2 + 0.2;
      if (Math.sin(a) > -0.1 || Math.cos(a) < -0.5) continue;
      g.fillCircle(
        x + Math.cos(a) * r * 0.9 + r * 0.08,
        y + r * 0.06 + Math.sin(a) * r * 0.9 - r * 0.1,
        r * 0.12,
      );
    }
    // 臉
    g.fillStyle(lite(main, 0.18), 1);
    g.fillCircle(x, y, r * 0.8);
    g.fillStyle(lite(main, 0.5), 0.55);
    g.fillEllipse(x + r * 0.2, y - r * 0.46, r * 0.62, r * 0.26);
    // 胸前與下巴的淺色毛
    g.fillStyle(pal.under, 1);
    g.fillEllipse(x, y + r * 0.72, r * 1.1, r * 0.5);
    // 短短的嘴
    g.fillEllipse(x, y + r * 0.34, r * 0.62, r * 0.48);
    if (!o.fierce) blush(g, x, y, r, 0.52, 0.24);
    eyes(g, x, y, r, pom.eye, !!o.eyesClosed);
    nose(g, x, y + r * 0.2, r, 0.085);
    if (!o.fierce) smile(g, x, y + r * 0.36, r, !o.eyesClosed);
  },
  body(g, pal) {
    const main = pal.main;
    // 腿很短，幾乎被毛蓋住
    legs(g, [-30, -16, 18, 32], -26, 13, main, pal.under, 9);
    const fur = new Shapes().ellipse(0, -54, 104, 62);
    fluffRing(fur, 0, -54, 46, 27, 13, 16);
    fur.draw(g, dark(main, 0.24), 3);
    g.fillStyle(main, 1);
    g.fillEllipse(3, -57, 98, 54);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2;
      g.fillCircle(3 + Math.cos(a) * 44, -57 + Math.sin(a) * 26, 10);
    }
    g.fillStyle(lite(main, 0.45), 0.8);
    for (let i = 0; i < 9; i++) g.fillCircle(-34 + i * 9, -84 + Math.abs(i - 4) * 2.2, 5);
    // 胸前一大團淺色的毛
    g.fillStyle(pal.under, 1);
    g.fillCircle(36, -50, 22);
    g.fillCircle(26, -36, 14);
    g.fillCircle(46, -38, 12);
    g.fillStyle(dark(pal.under, 0.16), 0.7);
    g.fillEllipse(30, -28, 34, 8);
  },
  tail(g, pal) {
    // 一大把羽毛一樣的尾巴，翻在背上
    const s = new Shapes()
      .circle(4, -30, 17)
      .circle(16, -42, 15)
      .circle(-8, -18, 13)
      .circle(26, -30, 12);
    s.draw(g, dark(pal.main, 0.18), 3);
    g.fillStyle(pal.main, 1);
    g.fillCircle(6, -33, 13);
    g.fillCircle(17, -44, 11);
    g.fillStyle(pal.under, 1);
    g.fillCircle(10, -40, 9);
    g.fillCircle(20, -46, 7);
    g.fillCircle(24, -32, 7);
  },
};

/** 已經照犬種畫好的（鍵是 src/data/dogs.ts 的 breed）；沒有的用通用畫法 */
export const BREED_ART: Readonly<Record<string, BreedArt>> = {
  柴犬: shiba,
  哈士奇: husky,
  博美: pom,
};

export function breedArtOf(breed: string | undefined): BreedArt | undefined {
  return breed ? BREED_ART[breed] : undefined;
}
