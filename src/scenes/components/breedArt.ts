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
  /** 尾巴根部接在身體哪裡（沒寫就是一般體型的位置） */
  tailAt?: { x: number; y: number };
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

// ---------------------------------------------------------------- 其他犬種：用一張特徵表組出來

type Ear = 'prick' | 'tall' | 'small' | 'bat' | 'butterfly' | 'semi' | 'drop' | 'long' | 'rose';
type Face = 'plain' | 'under' | 'blaze' | 'tan' | 'darkMuzzle' | 'spots' | 'patches';
type Muzzle = 'short' | 'mid' | 'long' | 'flat';
type Coat = 'solid' | 'belly' | 'saddle' | 'spots' | 'chest' | 'tan';
type Tail = 'curl' | 'sickle' | 'plume' | 'whip' | 'stub' | 'flag' | 'pug';

/** 一個犬種的外觀特徵 */
interface BreedSpec {
  ear: Ear;
  face: Face;
  muzzle: Muzzle;
  /** 頭的寬度（1 是圓的，小於 1 比較窄長） */
  skull?: number;
  /** 臉頰：wide 蓬蓬的寬臉、tuft 尖尖的頰毛、jowl 下垂的嘴邊肉 */
  cheeks?: 'wide' | 'tuft' | 'jowl';
  /** 臉旁邊一圈毛的蓬鬆程度（0 沒有，1 很蓬） */
  ruff?: number;
  /** 眼睛：大小（頭半徑的比例）與虹膜顏色；兩眼不同色就給兩個 */
  eyeR?: number;
  iris?: number | [number, number];
  tongue?: boolean;
  /** 臉上的皺紋（巴哥、鬥牛犬） */
  wrinkle?: boolean;
  /** 身體：長度倍數、腿長、粗壯程度、毛的蓬鬆程度、下緣垂下來的長毛 */
  len?: number;
  leg?: number;
  bulk?: number;
  fluff?: number;
  skirt?: boolean;
  coat: Coat;
  tail: Tail;
}

const lum = (c: number) => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
/** 淺色的毛：點綴色比主色淺就用點綴色，不然用主色調亮 */
const lightOf = (p: BreedPalette) => (lum(p.under) > lum(p.main) ? p.under : lite(p.main, 0.4));
/** 深色的毛：點綴色比主色深就用點綴色，不然用主色調暗 */
const darkOf = (p: BreedPalette) => (lum(p.under) < lum(p.main) ? p.under : dark(p.main, 0.5));

const MUZZLE: Record<Muzzle, { w: number; h: number; y: number; nose: number; noseY: number }> = {
  short: { w: 0.66, h: 0.5, y: 0.36, nose: 0.09, noseY: 0.22 },
  mid: { w: 0.8, h: 0.62, y: 0.4, nose: 0.12, noseY: 0.24 },
  long: { w: 0.74, h: 0.8, y: 0.46, nose: 0.13, noseY: 0.32 },
  flat: { w: 1.05, h: 0.56, y: 0.36, nose: 0.12, noseY: 0.14 },
};

function specArt(spec: BreedSpec): BreedArt {
  const sk = spec.skull ?? 1;
  const mz = MUZZLE[spec.muzzle];
  const eyeDy = spec.muzzle === 'flat' ? -0.06 : spec.muzzle === 'long' ? -0.2 : -0.13;
  const eye = {
    dx: 0.36 * Math.max(0.82, sk),
    dy: eyeDy,
    r: spec.eyeR ?? 0.105,
    lid: (p: BreedPalette) => (spec.face === 'patches' ? darkOf(p) : p.main),
  };
  const leg = spec.leg ?? 36;
  const len = spec.len ?? 1;
  const bulk = spec.bulk ?? 1;
  const fluff = spec.fluff ?? 0;
  const bw = 118 * len;
  const bh = 56 * bulk;
  /** 身體中心：腿短身體就低，身體長就往後延伸（頭的位置不變） */
  const bx = -(len - 1) * 52;
  const by = -(leg + bh * 0.36);

  function upEars(g: G, x: number, y: number, r: number, pal: BreedPalette, lw: number): void {
    const c =
      spec.face === 'patches' || spec.face === 'spots' || spec.face === 'darkMuzzle'
        ? darkOf(pal)
        : dark(pal.main, 0.14);
    const e = new Shapes();
    const inner: [number, number, number, number, number, number][] = [];
    for (const s of [-1, 1]) {
      const px = (k: number) => x + s * r * k * sk;
      if (spec.ear === 'prick') {
        e.tri(px(0.98), y - r * 0.2, px(0.8), y - r * 1.22, px(0.2), y - r * 0.8);
        inner.push([px(0.84), y - r * 0.44, px(0.76), y - r * 0.98, px(0.42), y - r * 0.76]);
      } else if (spec.ear === 'tall') {
        e.tri(px(0.9), y - r * 0.4, px(0.62), y - r * 1.5, px(0.12), y - r * 0.82);
        inner.push([px(0.72), y - r * 0.6, px(0.6), y - r * 1.2, px(0.34), y - r * 0.8]);
      } else if (spec.ear === 'small') {
        e.circle(px(0.72), y - r * 0.78, r * 0.26);
      } else if (spec.ear === 'bat') {
        e.tri(px(1.08), y - r * 0.3, px(0.92), y - r * 1.28, px(0.14), y - r * 0.8);
        e.circle(px(0.88), y - r * 1.12, r * 0.2);
        inner.push([px(0.92), y - r * 0.5, px(0.86), y - r * 1.06, px(0.4), y - r * 0.78]);
      } else if (spec.ear === 'butterfly') {
        // 蝴蝶翅膀一樣往外張開的大耳朵，邊緣有長長的飾毛
        e.ellipse(px(1.02), y - r * 0.72, r * 0.9, r * 1.2);
        e.tri(px(1.3), y - r * 0.3, px(1.62), y - r * 0.02, px(0.9), y - r * 0.2);
        e.tri(px(1.4), y - r * 0.8, px(1.72), y - r * 0.6, px(1.1), y - r * 0.4);
        inner.push([px(0.8), y - r * 0.4, px(1.0), y - r * 1.1, px(0.6), y - r * 0.8]);
      } else if (spec.ear === 'semi') {
        e.tri(px(0.96), y - r * 0.26, px(0.78), y - r * 1.16, px(0.2), y - r * 0.8);
        inner.push([px(0.82), y - r * 0.46, px(0.75), y - r * 0.9, px(0.44), y - r * 0.76]);
      }
    }
    e.draw(g, c, lw);
    for (const t of inner) {
      g.fillStyle(0xf4b6a6, 0.8);
      g.fillTriangle(...t);
    }
    if (spec.ear === 'semi') {
      // 耳尖往前折下來
      for (const s of [-1, 1]) {
        const px = (k: number) => x + s * r * k * sk;
        new Shapes()
          .tri(px(0.92), y - r * 0.98, px(0.56), y - r * 1.12, px(0.5), y - r * 0.74)
          .draw(g, dark(c, 0.2), lw * 0.7);
      }
    }
  }

  function hangEars(g: G, x: number, y: number, r: number, pal: BreedPalette, lw: number): void {
    if (spec.ear !== 'drop' && spec.ear !== 'long' && spec.ear !== 'rose') return;
    const c =
      spec.face === 'plain' || spec.face === 'under'
        ? dark(pal.main, 0.22)
        : spec.face === 'blaze'
          ? dark(pal.main, 0.18)
          : darkOf(pal);
    for (const s of [-1, 1]) {
      const px = (k: number) => x + s * r * k * sk;
      const e = new Shapes();
      if (spec.ear === 'rose') {
        e.ellipse(px(0.92), y - r * 0.58, r * 0.44, r * 0.36);
        e.tri(px(0.7), y - r * 0.8, px(1.16), y - r * 0.5, px(0.86), y - r * 0.34);
      } else {
        const long = spec.ear === 'long' ? 1.5 : 1;
        e.ellipse(px(1.0), y - r * 0.5 + r * 0.42 * long, r * 0.52, r * 0.9 * long);
        e.circle(px(0.9), y - r * 0.56, r * 0.3);
        if (spec.ear === 'long') {
          // 長耳朵的毛是一撮一撮捲的
          e.circle(px(0.86), y + r * 0.62, r * 0.2).circle(px(1.14), y + r * 0.7, r * 0.2);
          e.circle(px(1.0), y + r * 0.86, r * 0.22);
        }
      }
      e.draw(g, c, lw);
      g.fillStyle(lite(c, 0.3), 0.6);
      if (spec.ear !== 'rose') g.fillEllipse(px(1.04), y - r * 0.2, r * 0.16, r * 0.5);
    }
  }

  const art: BreedArt = {
    tailAt: { x: bx - bw * 0.44, y: by - bh * 0.1 },
    eye,
    head(g, x, y, r, pal, o) {
      const lw = Math.max(2, r / 14);
      const main = pal.main;
      const light = lightOf(pal);
      const deep = darkOf(pal);
      const rx = r * sk;
      upEars(g, x, y, r, pal, lw);
      // 臉旁邊的毛
      if (spec.ruff) {
        const ruff = new Shapes();
        fluffRing(
          ruff,
          x,
          y + r * 0.1,
          r * (0.86 + spec.ruff * 0.1),
          r * 0.9,
          r * (0.2 + spec.ruff * 0.14),
          13,
        );
        ruff.draw(g, dark(main, 0.16), lw);
        g.fillStyle(lite(main, 0.3), 0.7);
        for (let i = 0; i < 13; i++) {
          const a = (i / 13) * Math.PI * 2 + 0.2;
          if (Math.sin(a) > 0 || Math.cos(a) < -0.4) continue;
          g.fillCircle(x + Math.cos(a) * r * 0.94, y + r * 0.02 + Math.sin(a) * r * 0.9, r * 0.1);
        }
      }
      // 頭
      const skull = new Shapes().ellipse(x, y, rx * 2, r * 2);
      if (spec.cheeks === 'wide') {
        skull
          .ellipse(x - r * 0.6, y + r * 0.28, r, r * 0.95)
          .ellipse(x + r * 0.6, y + r * 0.28, r, r * 0.95);
      } else if (spec.cheeks === 'tuft') {
        skull
          .tri(x - rx * 0.7, y - r * 0.1, x - rx * 1.2, y + r * 0.5, x - rx * 0.4, y + r * 0.86)
          .tri(x + rx * 0.7, y - r * 0.1, x + rx * 1.2, y + r * 0.5, x + rx * 0.4, y + r * 0.86);
      } else if (spec.cheeks === 'jowl') {
        skull
          .ellipse(x - r * 0.44, y + r * 0.62, r * 0.8, r * 0.76)
          .ellipse(x + r * 0.44, y + r * 0.62, r * 0.8, r * 0.76);
      }
      if (spec.muzzle === 'long') skull.ellipse(x, y + r * 0.56, r * 0.82, r * 0.96);
      skull.draw(g, main, lw);
      // 暗面與亮面
      g.fillStyle(dark(main, 0.3), 0.28);
      g.fillEllipse(x - rx * 0.66, y + r * 0.2, rx * 0.56, r * 1.0);
      g.fillStyle(lite(main, 0.5), 0.45);
      g.fillEllipse(x + rx * 0.28, y - r * 0.62, rx * 0.8, r * 0.3);

      // 花紋
      if (spec.face === 'patches') {
        // 白底，兩眼各一大塊深色，中間留一道白
        g.fillStyle(deep, 1);
        for (const s of [-1, 1]) g.fillEllipse(x + s * rx * 0.5, y - r * 0.2, rx * 0.74, r * 0.98);
        g.fillStyle(main, 1);
        g.fillEllipse(x, y - r * 0.3, rx * 0.3, r * 1.3);
      } else if (spec.face === 'spots') {
        g.fillStyle(deep, 1);
        for (const [dx, dy, k] of [
          [-0.6, -0.5, 0.16],
          [0.5, -0.66, 0.12],
          [0.72, 0.1, 0.13],
          [-0.76, 0.2, 0.1],
          [0.1, -0.78, 0.09],
          [-0.2, 0.72, 0.09],
          [0.42, 0.66, 0.08],
        ]) {
          g.fillCircle(x + dx * rx, y + dy * r, k * r);
        }
        g.fillEllipse(x + rx * 0.38, y - r * 0.16, rx * 0.44, r * 0.5);
      } else if (spec.face === 'blaze') {
        // 額頭到嘴邊一道白
        g.fillStyle(light, 1);
        g.fillEllipse(x, y - r * 0.34, rx * 0.3, r * 1.2);
        g.fillTriangle(x - rx * 0.2, y - r * 0.9, x + rx * 0.2, y - r * 0.9, x, y - r * 0.4);
      } else if (spec.face === 'tan') {
        // 眉毛上兩個點、臉頰兩塊
        g.fillStyle(pal.under, 1);
        for (const s of [-1, 1]) {
          g.fillEllipse(x + s * rx * 0.36, y + eyeDy * r - r * 0.3, rx * 0.2, r * 0.13);
          g.fillEllipse(x + s * rx * 0.58, y + r * 0.42, rx * 0.44, r * 0.4);
        }
      }
      if (spec.cheeks === 'jowl') {
        g.fillStyle(
          spec.face === 'darkMuzzle' ? deep : spec.face === 'plain' ? lite(main, 0.22) : light,
          1,
        );
        g.fillEllipse(x - r * 0.42, y + r * 0.62, r * 0.66, r * 0.62);
        g.fillEllipse(x + r * 0.42, y + r * 0.62, r * 0.66, r * 0.62);
      }
      if (spec.cheeks === 'wide' || spec.face === 'under') {
        g.fillStyle(light, 1);
        g.fillEllipse(x - rx * 0.54, y + r * 0.42, rx * 0.78, r * 0.6);
        g.fillEllipse(x + rx * 0.54, y + r * 0.42, rx * 0.78, r * 0.6);
      }
      // 嘴
      const muzzleColor =
        spec.face === 'darkMuzzle'
          ? deep
          : spec.face === 'tan'
            ? pal.under
            : spec.face === 'plain'
              ? lite(main, 0.22)
              : spec.face === 'spots' || spec.face === 'patches'
                ? main
                : light;
      g.fillStyle(muzzleColor, 1);
      g.fillEllipse(x, y + r * mz.y, r * mz.w, r * mz.h);
      if (spec.face === 'darkMuzzle' && spec.muzzle === 'flat') {
        // 巴哥的黑面罩：從嘴往上到眼睛下緣
        g.fillStyle(deep, 0.5);
        g.fillEllipse(x, y + r * 0.2, rx * 1.0, r * 0.4);
      }
      g.fillStyle(dark(muzzleColor, 0.22), 0.5);
      g.fillEllipse(x - r * 0.12, y + r * (mz.y + mz.h * 0.34), r * mz.w * 0.7, r * mz.h * 0.22);
      if (spec.wrinkle) {
        g.lineStyle(Math.max(1.5, r * 0.05), dark(main, 0.45), 0.9);
        for (const s of [-1, 1]) {
          g.beginPath();
          g.arc(
            x + s * r * 0.2,
            y - r * 0.5,
            r * 0.26,
            s > 0 ? Math.PI * 1.1 : Math.PI * 1.5,
            s > 0 ? Math.PI * 1.5 : Math.PI * 1.9,
          );
          g.strokePath();
          g.lineBetween(x + s * r * 0.5, y + r * 0.1, x + s * r * 0.7, y + r * 0.3);
        }
      }
      if (!o.fierce && spec.face !== 'darkMuzzle') blush(g, x, y, r, 0.64 * sk, 0.2);
      // 眼睛周圍的毛很深的時候，墊一圈淺色，眼睛才看得到
      const around = spec.face === 'patches' ? deep : main;
      const darkFur = lum(around) < 95;
      if (darkFur && !o.eyesClosed) {
        g.fillStyle(lite(around, 0.18), 1);
        for (const s of [-1, 1]) {
          g.fillCircle(x + s * eye.dx * r, y + eye.dy * r, Math.max(3.2, (eye.r + 0.03) * r));
        }
      }
      if (Array.isArray(spec.iris)) {
        eyes(g, x - 1000, y, r, eye, !!o.eyesClosed);
        for (const [s, c] of [
          [-1, spec.iris[0]],
          [1, spec.iris[1]],
        ]) {
          oneEye(g, x + s * eye.dx * r, y + eye.dy * r, r, eye.r, !!o.eyesClosed, c);
        }
      } else {
        // 深色毛的狗給琥珀色的眼珠，眼神才出得來
        eyes(g, x, y, r, eye, !!o.eyesClosed, spec.iris ?? (darkFur ? 0xb07a3c : undefined));
      }
      if (lum(muzzleColor) < 95) {
        // 深色的嘴：鼻子外面墊一圈淺一點的，才不會糊在一起
        g.fillStyle(lite(muzzleColor, 0.18), 1);
        g.fillEllipse(
          x,
          y + r * (mz.noseY + 0.04),
          r * (mz.nose * 2 + 0.16),
          r * (mz.nose * 1.6 + 0.2),
        );
      }
      nose(g, x, y + r * mz.noseY, r, mz.nose);
      const mouthY = y + r * (mz.noseY + (spec.muzzle === 'long' ? 0.24 : 0.19));
      if (!o.fierce) smile(g, x, mouthY, r, !!spec.tongue && !o.eyesClosed);
      hangEars(g, x, y, r, pal, lw);
    },
    body(g, pal) {
      const main = pal.main;
      const light = lightOf(pal);
      const deep = darkOf(pal);
      const legColor =
        spec.coat === 'chest' || spec.coat === 'tan'
          ? spec.coat === 'tan'
            ? pal.under
            : light
          : main;
      const sock =
        spec.coat === 'solid' || spec.coat === 'spots'
          ? lite(main, 0.12)
          : spec.coat === 'tan'
            ? pal.under
            : light;
      const lw = 15 * Math.min(1.25, Math.max(0.85, bulk));
      const back = bx - bw * 0.3;
      const front = bx + bw * 0.34;
      legs(
        g,
        [back - 8, back + 10, front - 10, front + 8],
        -leg,
        lw,
        spec.coat === 'tan' ? main : legColor,
        sock,
        spec.coat === 'tan' ? leg * 0.5 : 10,
      );
      const sil = new Shapes()
        .ellipse(bx, by, bw, bh)
        .ellipse(bx + bw * 0.34, by - 5, 48 * bulk, 52 * bulk);
      if (fluff > 0) fluffRing(sil, bx, by, bw * 0.47, bh * 0.44, 8 + fluff * 6, 16);
      if (spec.skirt)
        for (let i = 0; i < 9; i++)
          sil.circle(bx - bw * 0.4 + (i * bw * 0.8) / 8, by + bh * 0.44, 8);
      sil.draw(g, dark(main, 0.26), 3);
      g.fillStyle(main, 1);
      g.fillEllipse(bx + 3, by - 4, bw - 8, bh - 10);
      g.fillEllipse(bx + bw * 0.34 + 1, by - 8, 42 * bulk, 44 * bulk);
      if (fluff > 0) {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 + 0.2;
          g.fillCircle(
            bx + 3 + Math.cos(a) * bw * 0.45,
            by - 3 + Math.sin(a) * bh * 0.4,
            5 + fluff * 5,
          );
        }
      }
      if (spec.skirt) {
        // 垂下來的長毛，一綹一綹的
        for (let i = 0; i < 9; i++) {
          g.fillStyle(i % 2 ? main : dark(main, 0.14), 1);
          g.fillCircle(bx - bw * 0.4 + (i * bw * 0.8) / 8 + 2, by + bh * 0.4, 6.5);
        }
      }
      // 背上的亮面
      g.fillStyle(lite(main, 0.4), 0.5);
      g.fillEllipse(bx + 6, by - bh * 0.34, bw * 0.66, bh * 0.2);
      // 花紋
      if (spec.coat === 'saddle') {
        g.fillStyle(deep, 1);
        g.fillEllipse(bx - 8, by - bh * 0.2, bw * 0.84, bh * 0.52);
        g.fillStyle(lite(deep, 0.25), 0.5);
        g.fillEllipse(bx, by - bh * 0.36, bw * 0.5, bh * 0.12);
      } else if (spec.coat === 'spots') {
        g.fillStyle(deep, 1);
        const pts = [
          [-0.34, -0.1, 7],
          [-0.16, 0.16, 5],
          [0.02, -0.2, 8],
          [0.2, 0.1, 6],
          [0.34, -0.14, 5],
          [-0.24, -0.28, 4],
          [0.1, 0.28, 4],
          [0.42, 0.16, 4],
        ];
        for (const [dx, dy, k] of pts) g.fillCircle(bx + dx * bw, by + dy * bh, k);
      }
      if (
        spec.coat === 'belly' ||
        spec.coat === 'chest' ||
        spec.coat === 'saddle' ||
        spec.coat === 'tan'
      ) {
        const c = spec.coat === 'tan' ? pal.under : light;
        g.fillStyle(c, 1);
        g.fillEllipse(bx + bw * 0.36, by + 4, 28 * bulk, 36 * bulk);
        if (spec.coat !== 'tan') g.fillEllipse(bx + 12, by + bh * 0.3, bw * 0.6, bh * 0.3);
        if (spec.coat === 'chest') {
          // 白色的圍脖
          g.fillEllipse(bx + bw * 0.3, by - 8, 30 * bulk, 50 * bulk);
        }
        g.fillStyle(dark(c, 0.2), 0.6);
        g.fillEllipse(bx + 8, by + bh * 0.4, bw * 0.5, 6);
      }
    },
    tail(g, pal) {
      const main = pal.main;
      const light = lightOf(pal);
      const s = new Shapes();
      switch (spec.tail) {
        case 'curl':
          s.circle(-6, -22, 19).draw(g, dark(main, 0.2), 3);
          g.fillStyle(main, 1);
          g.fillCircle(-4, -24, 16);
          g.fillStyle(light, 1);
          g.fillCircle(-3, -20, 10);
          g.fillStyle(main, 1);
          g.fillCircle(-1, -18, 5);
          break;
        case 'pug':
          s.circle(-2, -12, 11).draw(g, dark(main, 0.2), 3);
          g.fillStyle(main, 1);
          g.fillCircle(-1, -13, 9);
          g.fillStyle(dark(main, 0.3), 1);
          g.fillCircle(0, -11, 4);
          break;
        case 'sickle':
          s.ellipse(-12, -14, 22, 38)
            .ellipse(-18, -34, 20, 28)
            .circle(-14, -46, 9)
            .draw(g, dark(main, 0.2), 3);
          g.fillStyle(main, 1);
          g.fillEllipse(-9, -18, 12, 28);
          g.fillStyle(light, 1);
          g.fillCircle(-13, -47, 7);
          break;
        case 'plume':
          s.circle(4, -30, 17)
            .circle(16, -42, 15)
            .circle(-8, -18, 13)
            .circle(26, -30, 12)
            .draw(g, dark(main, 0.18), 3);
          g.fillStyle(main, 1);
          g.fillCircle(6, -33, 13);
          g.fillCircle(17, -44, 11);
          g.fillStyle(lite(main, 0.4), 1);
          g.fillCircle(10, -40, 8);
          g.fillCircle(22, -34, 6);
          break;
        case 'whip':
          s.ellipse(-8, -12, 11, 30).ellipse(-13, -30, 9, 22).circle(-15, -42, 4).draw(g, main, 3);
          g.fillStyle(lite(main, 0.3), 0.6);
          g.fillEllipse(-6, -16, 3, 20);
          break;
        case 'stub':
          s.circle(-2, -6, 9).draw(g, main, 3);
          g.fillStyle(lite(main, 0.3), 0.6);
          g.fillCircle(0, -9, 4);
          break;
        case 'flag':
          // 往後伸、下面掛著長毛的尾巴
          s.ellipse(-16, -4, 40, 14).circle(-34, -6, 8);
          for (let i = 0; i < 5; i++) s.circle(-30 + i * 7, 5 + (i % 2) * 3, 7);
          s.draw(g, dark(main, 0.18), 3);
          g.fillStyle(main, 1);
          g.fillEllipse(-15, -6, 34, 9);
          g.fillStyle(light, 1);
          g.fillCircle(-34, -6, 6);
          break;
      }
    },
  };
  return art;
}

/** 單獨畫一隻眼睛（兩眼不同色的時候用） */
function oneEye(
  g: G,
  ex: number,
  ey: number,
  r: number,
  size: number,
  closed: boolean,
  iris: number,
): void {
  if (closed) {
    g.lineStyle(Math.max(2, r * 0.07), INK, 1);
    g.beginPath();
    g.arc(ex, ey - r * 0.03, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
    g.strokePath();
    return;
  }
  const er = Math.max(2.5, size * r);
  g.fillStyle(INK, 1);
  g.fillCircle(ex, ey, er);
  g.fillStyle(iris, 1);
  g.fillCircle(ex, ey, er * 0.74);
  g.fillStyle(INK, 1);
  g.fillCircle(ex, ey, er * 0.36);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(ex + er * 0.34, ey - er * 0.36, Math.max(1, er * 0.34));
}

// ---------------------------------------------------------------- 視覺型獵犬（靈緹、蘇俄牧羊犬）

/**
 * 靈緹與蘇俄牧羊犬：頭又窄又長、耳朵往後貼、脖子長、胸很深、腰往上收、腿細長、尾巴低低地垂著。
 * silky 是蘇俄牧羊犬那種波浪長毛：脖子、胸口、肚子、後腿與尾巴都掛著長毛。
 */
function sighthound(silky: boolean): BreedArt {
  const eye = { dx: 0.3, dy: -0.3, r: 0.09, lid: (p: BreedPalette) => p.main };
  return {
    tailAt: { x: -60, y: -80 },
    eye,
    head(g, x, y, r, pal, o) {
      const lw = Math.max(2, r / 14);
      const main = pal.main;
      const light = lightOf(pal);
      // 往後貼的小耳朵（玫瑰耳）
      const ears = new Shapes();
      for (const s of [-1, 1]) {
        ears.tri(
          x + s * r * 0.42,
          y - r * 0.86,
          x + s * r * 1.12,
          y - r * 0.5,
          x + s * r * 0.56,
          y - r * 0.26,
        );
        if (silky) ears.circle(x + s * r * 0.98, y - r * 0.4, r * 0.16);
      }
      ears.draw(g, dark(main, 0.2), lw);
      // 蘇俄牧羊犬脖子兩側的波浪長毛
      if (silky) {
        const ruff = new Shapes();
        for (const s of [-1, 1]) {
          for (let i = 0; i < 4; i++) {
            ruff.circle(x + s * r * (0.62 - i * 0.07), y + r * (0.2 + i * 0.26), r * 0.24);
          }
        }
        ruff.draw(g, dark(main, 0.1), lw);
      }
      // 窄窄的頭，往下接一條很長的嘴
      new Shapes()
        .ellipse(x, y - r * 0.26, r * 1.36, r * 1.42)
        .ellipse(x, y + r * 0.42, r * 0.8, r * 1.3)
        .circle(x, y + r * 0.96, r * 0.3)
        .draw(g, main, lw);
      // 暗面與亮面
      g.fillStyle(dark(main, 0.3), 0.26);
      g.fillEllipse(x - r * 0.42, y - r * 0.1, r * 0.4, r * 1.0);
      g.fillStyle(lite(main, 0.5), 0.5);
      g.fillEllipse(x + r * 0.16, y - r * 0.78, r * 0.6, r * 0.24);
      // 鼻梁一道淺色，一路到嘴
      g.fillStyle(light, 1);
      g.fillEllipse(x, y + r * 0.3, r * 0.3, r * 1.5);
      g.fillEllipse(x, y + r * 0.86, r * 0.56, r * 0.5);
      g.fillStyle(dark(light, 0.2), 0.5);
      g.fillEllipse(x - r * 0.1, y + r * 1.08, r * 0.36, r * 0.12);
      if (!o.fierce) blush(g, x, y, r, 0.5, -0.02);
      eyes(g, x, y, r, eye, !!o.eyesClosed, 0x7a4a22);
      nose(g, x, y + r * 0.84, r, 0.1);
      if (!o.fierce) smile(g, x, y + r * 1.0, r * 0.8, false);
    },
    body(g, pal) {
      const main = pal.main;
      const light = lightOf(pal);
      const leg = 52;
      legs(g, [-52, -38, 20, 34], -leg, 10, main, light, 12);
      // 深胸、往上收的腰、圓圓的後腿
      const sil = new Shapes()
        .ellipse(26, -76, 54, 60)
        .ellipse(-12, -84, 84, 30)
        .ellipse(-44, -76, 40, 42)
        .ellipse(40, -96, 30, 44);
      if (silky) {
        for (let i = 0; i < 6; i++) sil.circle(4 + i * 8, -50 + Math.abs(i - 3) * 2, 7);
        for (let i = 0; i < 5; i++) sil.circle(-24 + i * 7, -68 - i, 6);
        for (let i = 0; i < 4; i++) sil.circle(-60 + i * 3, -64 + i * 8, 7);
      }
      sil.draw(g, dark(main, 0.26), 3);
      g.fillStyle(main, 1);
      g.fillEllipse(27, -78, 48, 54);
      g.fillEllipse(-11, -86, 78, 24);
      g.fillEllipse(-43, -78, 34, 36);
      g.fillEllipse(41, -98, 24, 38);
      if (silky) {
        // 一綹一綹的長毛
        for (let i = 0; i < 6; i++) {
          g.fillStyle(i % 2 ? main : dark(main, 0.12), 1);
          g.fillCircle(5 + i * 8, -52 + Math.abs(i - 3) * 2, 5.5);
        }
        for (let i = 0; i < 5; i++) {
          g.fillStyle(i % 2 ? dark(main, 0.12) : main, 1);
          g.fillCircle(-23 + i * 7, -70 - i, 4.5);
        }
        for (let i = 0; i < 4; i++) {
          g.fillStyle(i % 2 ? main : dark(main, 0.12), 1);
          g.fillCircle(-59 + i * 3, -66 + i * 8, 5.5);
        }
      }
      // 背上的亮面、胸口的淺色、肚子下面的暗面
      g.fillStyle(lite(main, 0.45), 0.55);
      g.fillEllipse(-8, -93, 70, 7);
      g.fillStyle(light, 1);
      g.fillEllipse(38, -68, 22, 40);
      g.fillStyle(dark(main, 0.3), 0.3);
      g.fillEllipse(-14, -74, 60, 7);
      // 肋骨的線條（靈緹很瘦）
      if (!silky) {
        g.lineStyle(1.6, dark(main, 0.3), 0.5);
        for (const dx of [8, 16, 24]) g.lineBetween(dx, -88, dx - 4, -62);
      }
    },
    tail(g, pal) {
      const main = pal.main;
      const s = new Shapes().ellipse(-14, 2, 36, 9).ellipse(-30, 6, 16, 8).circle(-38, 4, 4);
      if (silky) for (let i = 0; i < 5; i++) s.circle(-34 + i * 7, 11 + (i % 2) * 2, 6);
      s.draw(g, dark(main, 0.18), 3);
      g.fillStyle(main, 1);
      g.fillEllipse(-14, 1, 32, 6);
      g.fillStyle(lightOf(pal), 1);
      g.fillCircle(-38, 4, 3);
    },
  };
}

/** 每個犬種的特徵（鍵是 src/data/dogs.ts 的 breed） */
const SPECS: Record<string, BreedSpec> = {
  黑色拉布拉多: {
    ear: 'drop',
    face: 'plain',
    muzzle: 'mid',
    tongue: true,
    bulk: 1.08,
    coat: 'solid',
    tail: 'whip',
  },
  阿富汗獵犬: {
    ear: 'long',
    face: 'darkMuzzle',
    muzzle: 'long',
    skull: 0.86,
    leg: 40,
    skirt: true,
    coat: 'solid',
    tail: 'sickle',
  },
  邊境牧羊犬: {
    ear: 'semi',
    face: 'blaze',
    muzzle: 'mid',
    cheeks: 'tuft',
    fluff: 0.4,
    coat: 'chest',
    tail: 'flag',
  },
  薩摩耶: {
    ear: 'prick',
    face: 'plain',
    muzzle: 'short',
    ruff: 0.9,
    tongue: true,
    fluff: 1,
    coat: 'solid',
    tail: 'plume',
  },
  德國牧羊犬: {
    ear: 'tall',
    face: 'darkMuzzle',
    muzzle: 'long',
    bulk: 1.05,
    coat: 'saddle',
    tail: 'flag',
  },
  柯基: {
    ear: 'bat',
    face: 'blaze',
    muzzle: 'mid',
    cheeks: 'wide',
    leg: 16,
    len: 1.12,
    coat: 'chest',
    tail: 'stub',
  },
  吉娃娃: {
    ear: 'bat',
    face: 'under',
    muzzle: 'short',
    skull: 0.94,
    eyeR: 0.14,
    leg: 30,
    bulk: 0.86,
    coat: 'belly',
    tail: 'sickle',
  },
  米格魯: { ear: 'drop', face: 'blaze', muzzle: 'mid', leg: 30, coat: 'chest', tail: 'whip' },
  臘腸犬: {
    ear: 'drop',
    face: 'tan',
    muzzle: 'long',
    skull: 0.9,
    leg: 14,
    len: 1.3,
    bulk: 0.88,
    coat: 'tan',
    tail: 'whip',
  },
  法國鬥牛犬: {
    ear: 'bat',
    face: 'under',
    muzzle: 'flat',
    wrinkle: true,
    leg: 26,
    bulk: 1.12,
    coat: 'chest',
    tail: 'stub',
  },
  大麥町: { ear: 'drop', face: 'spots', muzzle: 'mid', leg: 40, coat: 'spots', tail: 'whip' },
  喜樂蒂: {
    ear: 'semi',
    face: 'blaze',
    muzzle: 'long',
    skull: 0.9,
    ruff: 0.7,
    fluff: 0.6,
    coat: 'chest',
    tail: 'flag',
  },
  台灣犬: {
    ear: 'prick',
    face: 'tan',
    muzzle: 'mid',
    skull: 0.94,
    bulk: 0.92,
    coat: 'tan',
    tail: 'sickle',
  },
  杜賓: {
    ear: 'tall',
    face: 'tan',
    muzzle: 'long',
    skull: 0.86,
    leg: 42,
    bulk: 0.94,
    coat: 'tan',
    tail: 'stub',
  },
  高加索犬: {
    ear: 'small',
    face: 'darkMuzzle',
    muzzle: 'mid',
    cheeks: 'jowl',
    ruff: 0.8,
    bulk: 1.28,
    fluff: 0.8,
    coat: 'solid',
    tail: 'plume',
  },
  聖伯納犬: {
    ear: 'drop',
    face: 'blaze',
    muzzle: 'mid',
    cheeks: 'jowl',
    tongue: true,
    bulk: 1.3,
    coat: 'chest',
    tail: 'flag',
  },
  紐芬蘭犬: {
    ear: 'drop',
    face: 'plain',
    muzzle: 'mid',
    cheeks: 'jowl',
    ruff: 0.5,
    bulk: 1.3,
    fluff: 0.7,
    coat: 'solid',
    tail: 'flag',
  },
  澳洲牧羊犬: {
    ear: 'semi',
    face: 'blaze',
    muzzle: 'mid',
    cheeks: 'tuft',
    iris: [0x6cc8f2, 0x8a5a2b],
    fluff: 0.5,
    coat: 'chest',
    tail: 'stub',
  },
  芬蘭狐狸犬: {
    ear: 'prick',
    face: 'under',
    muzzle: 'mid',
    cheeks: 'tuft',
    ruff: 0.4,
    fluff: 0.4,
    coat: 'belly',
    tail: 'curl',
  },
  蝴蝶犬: {
    ear: 'butterfly',
    face: 'patches',
    muzzle: 'short',
    eyeR: 0.12,
    leg: 28,
    bulk: 0.86,
    fluff: 0.4,
    coat: 'solid',
    tail: 'plume',
  },
  可卡獵犬: {
    ear: 'long',
    face: 'plain',
    muzzle: 'mid',
    leg: 30,
    skirt: true,
    coat: 'solid',
    tail: 'stub',
  },
  黃金獵犬: {
    ear: 'drop',
    face: 'under',
    muzzle: 'mid',
    tongue: true,
    bulk: 1.1,
    skirt: true,
    coat: 'belly',
    tail: 'flag',
  },
  鬥牛犬: {
    ear: 'rose',
    face: 'under',
    muzzle: 'flat',
    cheeks: 'jowl',
    wrinkle: true,
    leg: 24,
    bulk: 1.3,
    coat: 'chest',
    tail: 'stub',
  },
  巴哥: {
    ear: 'rose',
    face: 'darkMuzzle',
    muzzle: 'flat',
    wrinkle: true,
    eyeR: 0.135,
    leg: 24,
    bulk: 1.1,
    coat: 'solid',
    tail: 'pug',
  },
  // ---- 關卡的頭目（src/data/regions.ts 的 boss.breed） ----
  高山犬: {
    ear: 'drop',
    face: 'tan',
    muzzle: 'mid',
    cheeks: 'jowl',
    bulk: 1.25,
    coat: 'tan',
    tail: 'flag',
  },
  大丹犬: {
    ear: 'tall',
    face: 'darkMuzzle',
    muzzle: 'long',
    skull: 0.92,
    cheeks: 'jowl',
    leg: 46,
    bulk: 1.1,
    coat: 'belly',
    tail: 'whip',
  },
  藏獒: {
    ear: 'drop',
    face: 'tan',
    muzzle: 'mid',
    cheeks: 'jowl',
    ruff: 1,
    bulk: 1.3,
    fluff: 0.9,
    coat: 'tan',
    tail: 'plume',
  },
  伯恩山犬: {
    ear: 'drop',
    face: 'blaze',
    muzzle: 'mid',
    cheeks: 'wide',
    bulk: 1.25,
    fluff: 0.5,
    coat: 'chest',
    tail: 'flag',
  },
  坎高犬: {
    ear: 'drop',
    face: 'darkMuzzle',
    muzzle: 'mid',
    cheeks: 'jowl',
    bulk: 1.25,
    coat: 'solid',
    tail: 'sickle',
  },
  尋血獵犬: {
    ear: 'long',
    face: 'darkMuzzle',
    muzzle: 'long',
    cheeks: 'jowl',
    wrinkle: true,
    bulk: 1.15,
    coat: 'saddle',
    tail: 'whip',
  },
  羅威那: {
    ear: 'drop',
    face: 'tan',
    muzzle: 'mid',
    cheeks: 'wide',
    bulk: 1.3,
    coat: 'tan',
    tail: 'stub',
  },
  萊昂貝格犬: {
    ear: 'drop',
    face: 'darkMuzzle',
    muzzle: 'mid',
    cheeks: 'jowl',
    ruff: 0.9,
    bulk: 1.3,
    fluff: 0.7,
    coat: 'solid',
    tail: 'plume',
  },
  愛爾蘭獵狼犬: {
    ear: 'rose',
    face: 'under',
    muzzle: 'long',
    skull: 0.86,
    cheeks: 'tuft',
    ruff: 0.4,
    leg: 48,
    fluff: 0.5,
    coat: 'belly',
    tail: 'whip',
  },
  英國獒犬: {
    ear: 'drop',
    face: 'darkMuzzle',
    muzzle: 'flat',
    cheeks: 'jowl',
    wrinkle: true,
    bulk: 1.35,
    coat: 'solid',
    tail: 'whip',
  },
  // ---- 關卡的小兵（src/data/regions.ts 的 ENEMY_KINDS.breed） ----
  土狗: { ear: 'semi', face: 'under', muzzle: 'mid', coat: 'belly', tail: 'sickle' },
  比特犬: {
    ear: 'rose',
    face: 'blaze',
    muzzle: 'short',
    cheeks: 'wide',
    bulk: 1.15,
    coat: 'chest',
    tail: 'whip',
  },
  沙皮犬: {
    ear: 'small',
    face: 'under',
    muzzle: 'flat',
    cheeks: 'jowl',
    wrinkle: true,
    bulk: 1.2,
    leg: 28,
    coat: 'solid',
    tail: 'curl',
  },
  惠比特犬: {
    ear: 'rose',
    face: 'blaze',
    muzzle: 'long',
    skull: 0.82,
    leg: 44,
    bulk: 0.82,
    coat: 'chest',
    tail: 'whip',
  },
  傑克羅素㹴: {
    ear: 'semi',
    face: 'patches',
    muzzle: 'short',
    leg: 26,
    bulk: 0.9,
    coat: 'spots',
    tail: 'stub',
  },
  貴賓犬: {
    ear: 'long',
    face: 'plain',
    muzzle: 'mid',
    skull: 0.9,
    ruff: 0.8,
    fluff: 1,
    coat: 'solid',
    tail: 'plume',
  },
  獒犬: {
    ear: 'drop',
    face: 'darkMuzzle',
    muzzle: 'mid',
    cheeks: 'jowl',
    wrinkle: true,
    bulk: 1.3,
    coat: 'solid',
    tail: 'whip',
  },
};

/** 已經照犬種畫好的（鍵是 src/data/dogs.ts 的 breed）；沒有的用通用畫法 */
export const BREED_ART: Readonly<Record<string, BreedArt>> = {
  柴犬: shiba,
  秋田犬: shiba,
  哈士奇: husky,
  博美: pom,
  靈緹: sighthound(false),
  蘇俄牧羊犬: sighthound(true),
  ...Object.fromEntries(Object.entries(SPECS).map(([k, v]) => [k, specArt(v)])),
};

export function breedArtOf(breed: string | undefined): BreedArt | undefined {
  return breed ? BREED_ART[breed] : undefined;
}
