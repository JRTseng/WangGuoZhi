import type { RegionScene } from '../../data/regions';
import { sag } from '../../logic/sceneryShapes';
import {
  P,
  bamboo,
  birds,
  clouds,
  deadTree,
  drifting,
  flag,
  flower,
  fog,
  glowDisc,
  ground,
  house,
  lantern,
  layer,
  line,
  mixColor,
  moon,
  mountains,
  onGround,
  palm,
  pine,
  poly,
  rock,
  roof,
  roundTree,
  seeded,
  sky,
  smoke,
  sparkles,
  stars,
  tuft,
  tween,
  wall,
  water,
  type G,
  type Paint,
} from './sceneryKit';

/**
 * 每個場景的畫法（T016）：十章各一張，加上秋祭燈會與主城。
 * 每張都是自己的遠景、中景、地面與會動的小東西，沒有互相借用。
 * 全部原創、用程式畫，授權見 docs/LICENSE-ASSETS.md。
 */

export type SceneryTheme = RegionScene | 'city';

/** 第一章 落葉坡：秋天午後，楓樹、木柵欄、滿地落葉 */
function slope(p: Paint): void {
  const { w, hy } = p;
  const g = layer(p);
  sky(p, g, 0x86c5ec, 0xfde3bd, 0xc9e4f0);
  glowDisc(g, w * 0.8, hy * 0.26, 22, 0xfff3c4, 0xffe9a8);
  mountains(p, g, 11, 'hills', hy, hy * 0.5, 0xe6c39a, 3);
  mountains(p, g, 12, 'hills', hy, hy * 0.34, 0xd9a066, 4);
  clouds(p, 13, 3);
  const m = layer(p);
  mountains(p, m, 14, 'hills', hy + 2, hy * 0.17, 0xc77a3c, 6);
  // 山坡上遠遠的小樹
  const rnd = seeded(15);
  for (let i = 0; i < 16; i++) {
    const x = rnd() * w;
    const y = hy - 6 - rnd() * hy * 0.1;
    m.fillStyle([0xd9542b, 0xe8892c, 0xf2c14e][i % 3], 1);
    m.fillCircle(x, y, 3 + rnd() * 3);
  }
  ground(p, m, 0xebc07a, 0xd39a52);
  // 小路的痕跡與落葉堆
  for (const s of onGround(p, 16, 26)) {
    m.fillStyle([0xd9542b, 0xe8892c, 0xf2c14e, 0xc8612d][Math.floor(s.k * 4)], 0.9);
    m.fillEllipse(s.x, s.y, 12 * s.s, 5 * s.s);
    m.fillEllipse(s.x + 7 * s.s, s.y + 2 * s.s, 9 * s.s, 4 * s.s);
  }
  for (const s of onGround(p, 17, 16)) tuft(m, s.x, s.y, s.s, 0xb9843a);
  for (const s of onGround(p, 18, 5, 0.3)) rock(m, s.x, s.y, s.s, 0xb39b80);
  // 木柵欄
  const fx0 = w * 0.36;
  const fx1 = w * 0.64;
  m.fillStyle(0x8a5a33, 1);
  m.fillRect(fx0, hy - 12, fx1 - fx0, 3);
  m.fillRect(fx0, hy - 5, fx1 - fx0, 3);
  for (let x = fx0; x <= fx1 + 1; x += (fx1 - fx0) / 8) {
    m.fillStyle(0x7a4a2a, 1);
    m.fillRect(x - 2.5, hy - 18, 5, 22);
    m.fillStyle(0xa87446, 1);
    m.fillRect(x - 2.5, hy - 18, 2, 22);
  }
  const reds: [number, number, number][] = [
    [0xb5391f, 0xd9542b, 0xee7a45],
    [0xc96a1f, 0xe8892c, 0xf6ad55],
    [0xcf9a24, 0xf2c14e, 0xfbe08a],
  ];
  const trees = [
    [0.04, 1.15],
    [0.14, 0.85],
    [0.25, 1.0],
    [0.72, 0.9],
    [0.84, 1.2],
    [0.96, 0.95],
  ];
  trees.forEach(([tx, s], i) => {
    const c = reds[i % 3];
    roundTree(m, tx * w, hy + 8 + (s - 0.85) * 14, s, 0x7a4a2a, c[0], c[1], c[2]);
  });
  drifting(p, 'leaf', [0xd94f2b, 0xe8892c, 0xf2c14e]);
}

/** 第二章 竹林渡：清晨起霧的渡口，竹林、小河、渡船 */
function bambooFerry(p: Paint): void {
  const { w, h, hy } = p;
  const g = layer(p);
  sky(p, g, 0xc5e3d4, 0xf5f7e8, 0xdfeedd);
  glowDisc(g, w * 0.3, hy * 0.3, 18, 0xfffbe6, 0xffffff);
  mountains(p, g, 21, 'hills', hy - 20, hy * 0.42, 0xbfdcc4, 3);
  mountains(p, g, 22, 'hills', hy - 20, hy * 0.26, 0x9cc7a4, 4);
  // 對岸遠遠的一排細竹
  const rnd = seeded(23);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w;
    bamboo(g, x, hy - 22, hy - 60 - rnd() * 50, 3, 0x8fbd97, rnd);
  }
  // 小河與對岸
  g.fillStyle(0x86b08a, 1);
  g.fillRect(0, hy - 26, w, 5);
  water(p, g, hy - 22, hy + 2, 0xa9d8cf, 0x7fbfb5, 24);
  const m = layer(p);
  // 渡船
  const bx = w * 0.6;
  const by = hy - 9;
  poly(
    m,
    [P(bx - 30, by - 5), P(bx + 34, by - 5), P(bx + 24, by + 4), P(bx - 22, by + 4)],
    0x7a5a3a,
  );
  m.fillStyle(0x9a7446, 1);
  m.fillRect(bx - 28, by - 7, 60, 3);
  m.fillStyle(0xd9c49a, 1);
  m.fillRoundedRect(bx - 12, by - 19, 26, 13, 5);
  m.lineStyle(2, 0x5a4028, 1);
  m.lineBetween(bx + 26, by - 30, bx + 30, by + 6);
  // 碼頭
  const dx = w * 0.3;
  m.fillStyle(0x8a6a44, 1);
  m.fillRect(dx - 40, hy - 6, 80, 5);
  m.fillStyle(0x6b4f30, 1);
  for (const o of [-36, -12, 12, 34]) m.fillRect(dx + o, hy - 8, 4, 16);
  m.fillRect(dx + 34, hy - 26, 3, 20);
  lantern(m, dx + 35.5, hy - 28, 0.55, 0xe07a3a);
  ground(p, m, 0xbfd9a2, 0x98bd80);
  for (const s of onGround(p, 25, 22)) tuft(m, s.x, s.y, s.s, 0x7fa86a);
  for (const s of onGround(p, 26, 10, 0.15)) flower(m, s.x, s.y, s.s, 0xffffff, 0xf2c14e);
  for (const s of onGround(p, 27, 5, 0.3)) rock(m, s.x, s.y, s.s, 0x9fb0a0);
  fog(p, 28, [hy - 34, hy - 12, hy + 6], 0xffffff, 0.4);
  // 近處兩側的粗竹，長到畫面上面
  const n = layer(p);
  const near = seeded(29);
  const xs = [0.02, 0.07, 0.12, 0.18, 0.83, 0.88, 0.94, 0.99];
  xs.forEach((tx, i) => {
    const color = i % 2 ? 0x5e8f5a : 0x76a86b;
    bamboo(
      n,
      tx * w,
      hy + 14 + near() * 18,
      h * (0.02 + near() * 0.14),
      7 + near() * 3,
      color,
      near,
    );
  });
  drifting(p, 'leaf', [0x7fb069, 0xa7c957, 0x8fbf6f]);
}

/** 第三章 雪嶺：雪山夜晚，月亮、極光、松樹、亮著燈的小木屋 */
function snowRidge(p: Paint): void {
  const { w, hy } = p;
  const g = layer(p);
  sky(p, g, 0x141d3b, 0x5a72a3, 0x2a3a66);
  // 極光
  for (let i = 0; i < 3; i++) {
    const y = hy * (0.2 + i * 0.1);
    poly(
      g,
      [
        P(-10, y + 26),
        P(w * 0.25, y - 6),
        P(w * 0.55, y + 16),
        P(w + 10, y - 12),
        P(w + 10, y + 16),
        P(w * 0.55, y + 40),
        P(w * 0.25, y + 20),
        P(-10, y + 50),
      ],
      [0x7ff0c0, 0x8fd6ff, 0xb9a6ff][i],
      0.1,
    );
  }
  stars(p, g, 31);
  moon(g, w * 0.78, hy * 0.24, 20);
  // 雪山：先畫白的，再蓋一層矮一點的山色，露出來的就是雪頂
  mountains(p, g, 32, 'peaks', hy, hy * 0.74, 0xf2f6fc, 4);
  mountains(p, g, 32, 'peaks', hy, hy * 0.74 * 0.7, 0x7f8fb6, 4);
  mountains(p, g, 33, 'peaks', hy, hy * 0.46, 0xe6edf7, 6);
  mountains(p, g, 33, 'peaks', hy, hy * 0.46 * 0.66, 0x9aa9cc, 6);
  const m = layer(p);
  mountains(p, m, 34, 'hills', hy + 2, hy * 0.16, 0xdfe7f3, 5);
  ground(p, m, 0xf4f7fb, 0xd5e0ef);
  // 雪地的起伏與陰影
  for (const s of onGround(p, 35, 14)) {
    m.fillStyle(0xc3d1e6, 0.5);
    m.fillEllipse(s.x, s.y + 3 * s.s, 70 * s.s, 9 * s.s);
    m.fillStyle(0xffffff, 1);
    m.fillEllipse(s.x - 4 * s.s, s.y, 64 * s.s, 9 * s.s);
  }
  for (const s of onGround(p, 36, 4, 0.3)) rock(m, s.x, s.y, s.s, 0x8f9bb3);
  // 小木屋
  const cx = w * 0.3;
  house(m, cx, hy + 4, 46, 26, 0x6b4a36, 0xf4f7fb, 0xffd56b);
  m.fillStyle(0x4f3626, 1);
  m.fillRect(cx + 12, hy - 50, 7, 14);
  m.fillStyle(0xffffff, 1);
  m.fillRect(cx + 11, hy - 52, 9, 3);
  m.fillStyle(0xffd56b, 0.14);
  m.fillEllipse(cx, hy + 10, 70, 12);
  smoke(p, cx + 15.5, hy - 56, 0xdfe7f3, 0.8);
  const t = layer(p);
  const trees = [
    [0.05, 1.1],
    [0.13, 0.8],
    [0.44, 0.75],
    [0.56, 0.95],
    [0.68, 0.8],
    [0.87, 1.15],
    [0.96, 0.9],
  ];
  for (const [tx, s] of trees)
    pine(t, tx * w, hy + 6 + (s - 0.75) * 16, s, 0x4f3626, 0x2f5a4a, 0xffffff);
  drifting(p, 'snow', [0xffffff]);
}

/** 活動 秋祭燈會：夜市、兩串燈籠、天燈與煙火 */
function lanternFair(p: Paint): void {
  const { w, hy } = p;
  const g = layer(p);
  sky(p, g, 0x180e30, 0x8a3a5c, 0x3d1c4a);
  stars(p, g, 41, 30);
  moon(g, w * 0.16, hy * 0.22, 16);
  // 遠處一整排屋頂與點點燈火
  const far = mountains(p, g, 42, 'mesa', hy, hy * 0.2, 0x2c1b3a, 9);
  const rnd = seeded(43);
  for (const pt of far) {
    if (rnd() < 0.5) continue;
    g.fillStyle(0xffd56b, 0.8);
    g.fillRect(pt.x, Math.min(hy - 6, pt.y + 5 + rnd() * 10), 2.5, 3);
  }
  if (p.live) fireworks(p);
  const m = layer(p);
  // 三棟樓
  const halls = [
    [0.16, 78, 44],
    [0.5, 96, 58],
    [0.84, 78, 44],
  ];
  for (const [tx, bw, bh] of halls) {
    const cx = tx * w;
    m.fillStyle(0x24152b, 1);
    m.fillRect(cx - bw / 2, hy - bh, bw, bh + 2);
    roof(m, cx, hy - bh, bw * 1.25, bh * 0.5, 0x5b3a70, 0xffd56b);
    m.fillStyle(0x24152b, 1);
    m.fillRect(cx - bw * 0.32, hy - bh * 1.5 - 14, bw * 0.64, 16);
    roof(m, cx, hy - bh * 1.5 - 14, bw * 0.84, bh * 0.4, 0x5b3a70, 0xffd56b);
    // 紅柱與亮著的窗
    m.fillStyle(0xb8342a, 1);
    for (const o of [-0.42, -0.14, 0.14, 0.42]) m.fillRect(cx + o * bw - 2, hy - bh, 4, bh);
    m.fillStyle(0xffd56b, 1);
    for (const o of [-0.28, 0, 0.28]) {
      m.fillRect(cx + o * bw - 7, hy - bh + 9, 14, bh * 0.42);
    }
    m.fillStyle(0xffb347, 0.14);
    m.fillEllipse(cx, hy + 10, bw * 1.4, 18);
  }
  ground(p, m, 0x55354a, 0x2f1c28);
  // 石板路與地上的燈影
  for (const s of onGround(p, 44, 46)) {
    m.fillStyle(0x1a0f18, 0.35);
    m.fillRect(s.x, s.y, 30 * s.s, 1.5);
    m.fillRect(s.x + 14 * s.s, s.y, 1.5, 6 * s.s);
  }
  for (const s of onGround(p, 45, 9, 0.12)) {
    m.fillStyle(s.k < 0.5 ? 0xffb347 : 0xff7b54, 0.1);
    m.fillEllipse(s.x, s.y, 90 * s.s, 14 * s.s);
  }
  // 攤位
  for (const [tx, color] of [
    [0.33, 0xd9542b],
    [0.67, 0x3f7fa8],
  ]) {
    const cx = tx * w;
    m.fillStyle(0x5a3a2a, 1);
    m.fillRect(cx - 26, hy - 4, 52, 14);
    m.fillRect(cx - 26, hy - 28, 3, 26);
    m.fillRect(cx + 23, hy - 28, 3, 26);
    for (let i = 0; i < 6; i++) {
      m.fillStyle(i % 2 ? 0xfff6e8 : color, 1);
      m.fillRect(cx - 30 + i * 10, hy - 36, 10, 10);
    }
    m.fillStyle(0xffd56b, 0.2);
    m.fillEllipse(cx, hy + 12, 70, 10);
  }
  // 兩串燈籠
  const colors = [0xe0452b, 0xf0823a, 0xe0452b, 0xf2b84b];
  for (const [y0, y1, drop, n] of [
    [hy * 0.36, hy * 0.42, 22, 9],
    [hy * 0.6, hy * 0.54, 16, 7],
  ]) {
    const rope = sag(P(-10, y0), P(w + 10, y1), drop, 40);
    line(m, rope, 1.5, 0x1a0f18);
    for (let i = 0; i < n; i++) {
      const pt = rope[Math.round(((i + 0.5) / n) * 40)];
      lantern(m, pt.x, pt.y + 12, 0.8, colors[i % colors.length]);
    }
  }
  drifting(p, 'rise', [0xffb347, 0xff7b54, 0xffd56b]);
}

/** 煙火：幾個位置輪流炸開一圈光點 */
function fireworks(p: Paint): void {
  const rnd = seeded(47);
  const colors = [0xffd56b, 0xff7b9c, 0x8fd6ff, 0xb9ffb0];
  for (let k = 0; k < 4; k++) {
    const f = p.scene.add.graphics();
    const color = colors[k];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      f.fillStyle(color, 1);
      f.fillCircle(Math.cos(a) * 26, Math.sin(a) * 26, 2);
      f.fillCircle(Math.cos(a + 0.2) * 15, Math.sin(a + 0.2) * 15, 1.4);
    }
    f.setPosition(p.w * (0.2 + k * 0.2 + rnd() * 0.08), p.hy * (0.16 + rnd() * 0.22));
    f.setScale(0.1).setAlpha(0);
    p.box.add(f);
    tween(p, {
      targets: f,
      scale: { from: 0.1, to: 1.25 },
      alpha: { from: 1, to: 0 },
      duration: 1300,
      ease: 'Cubic.easeOut',
      repeat: -1,
      repeatDelay: 3600,
      delay: 700 + k * 1200,
    });
  }
}

/** 第四章 桃花谷：粉紅的桃花林、小溪與石拱橋 */
function peachValley(p: Paint): void {
  const { w, hy } = p;
  const g = layer(p);
  sky(p, g, 0xaedcf5, 0xfde7ee, 0xd9ecf8);
  glowDisc(g, w * 0.22, hy * 0.26, 20, 0xfffbe6, 0xffffff);
  mountains(p, g, 51, 'hills', hy, hy * 0.52, 0xd9c7e6, 3);
  mountains(p, g, 52, 'hills', hy, hy * 0.36, 0xb7d9a6, 4);
  clouds(p, 53, 3, 0xffffff, 0.9);
  const m = layer(p);
  const hill = mountains(p, m, 54, 'hills', hy + 2, hy * 0.2, 0x98c984, 5);
  // 山坡上的桃花點點
  const rnd = seeded(55);
  for (const pt of hill) {
    if (rnd() < 0.45) continue;
    m.fillStyle(rnd() < 0.5 ? 0xf7a8c0 : 0xfbd0dc, 1);
    m.fillCircle(pt.x + rnd() * 6, pt.y + 4 + rnd() * (hy - pt.y - 4) * 0.8, 4 + rnd() * 4);
  }
  ground(p, m, 0xd3e7ab, 0xb1cf88);
  // 小溪：貼著地平線橫過去
  water(p, m, hy + 3, hy + 17, 0xa9dcee, 0x7fc4e0, 56);
  m.fillStyle(0xe9f3c8, 1);
  m.fillRect(0, hy + 1, w, 2.5);
  m.fillRect(0, hy + 16, w, 2.5);
  // 石拱橋
  const bx = w * 0.5;
  m.lineStyle(9, 0xb9b3a8, 1);
  m.beginPath();
  m.arc(bx, hy + 22, 34, Math.PI * 1.15, Math.PI * 1.85);
  m.strokePath();
  m.lineStyle(2, 0x8f8a80, 1);
  m.beginPath();
  m.arc(bx, hy + 22, 40, Math.PI * 1.15, Math.PI * 1.85);
  m.strokePath();
  m.fillStyle(0x8f8a80, 1);
  for (const a of [1.22, 1.36, 1.5, 1.64, 1.78]) {
    const x = bx + Math.cos(Math.PI * a) * 39;
    const y = hy + 22 + Math.sin(Math.PI * a) * 39;
    m.fillRect(x - 1.5, y - 7, 3, 8);
  }
  for (const s of onGround(p, 57, 30, 0.14)) {
    m.fillStyle(s.k < 0.5 ? 0xf7a8c0 : 0xfde2e9, 0.95);
    m.fillEllipse(s.x, s.y, 6 * s.s, 3.5 * s.s);
  }
  for (const s of onGround(p, 58, 16, 0.14)) tuft(m, s.x, s.y, s.s, 0x86b86a);
  for (const s of onGround(p, 59, 8, 0.2)) flower(m, s.x, s.y, s.s, 0xfff2a8, 0xf0a030);
  const trees = [
    [0.05, 1.2],
    [0.16, 0.9],
    [0.29, 1.0],
    [0.71, 1.0],
    [0.84, 0.88],
    [0.95, 1.2],
  ];
  for (const [tx, s] of trees) {
    roundTree(m, tx * w, hy + 26 + (s - 0.88) * 14, s, 0x5c3a2a, 0xe87aa0, 0xf7a8c0, 0xfde2e9);
  }
  drifting(p, 'petal', [0xf7a8c0, 0xfbd0dc, 0xffffff]);
}

/** 第五章 黃沙道：沙丘、台地、烽火台與路邊的破旗 */
function desertRoad(p: Paint): void {
  const { w, hy } = p;
  const g = layer(p);
  sky(p, g, 0xe9a04e, 0xfdeec8, 0xf6cd8a);
  glowDisc(g, w * 0.7, hy * 0.62, 30, 0xfff1c2, 0xffe08a);
  mountains(p, g, 61, 'mesa', hy, hy * 0.46, 0xd28f58, 4);
  mountains(p, g, 62, 'mesa', hy, hy * 0.28, 0xc27d48, 6);
  // 烽火台
  const tx = w * 0.2;
  poly(g, [P(tx - 16, hy), P(tx + 16, hy), P(tx + 11, hy - 46), P(tx - 11, hy - 46)], 0xa87446);
  g.fillStyle(0x8a5a33, 1);
  g.fillRect(tx - 14, hy - 52, 28, 7);
  for (const o of [-14, -4, 6]) g.fillRect(tx + o, hy - 58, 8, 7);
  g.fillRect(tx - 3, hy - 20, 6, 12);
  smoke(p, tx, hy - 60, 0x8f7a6a, 0.9);
  const m = layer(p);
  // 沙丘：深色在下、亮色往左上錯開，右邊露出背光面
  mountains(p, m, 63, 'dunes', hy + 4, hy * 0.2, 0xd19a52, 4);
  const dune = layer(p);
  dune.setPosition(-9, 3);
  mountains(p, dune, 63, 'dunes', hy + 4, hy * 0.2, 0xecc37f, 4);
  const n = layer(p);
  ground(p, n, 0xefd6a0, 0xdcb672);
  // 風吹出來的沙紋
  for (const s of onGround(p, 64, 34)) {
    n.fillStyle(0xc99a56, 0.45);
    n.fillEllipse(s.x, s.y, 46 * s.s, 2.5 * s.s);
    n.fillStyle(0xfbe9bf, 0.5);
    n.fillEllipse(s.x - 5 * s.s, s.y - 2 * s.s, 34 * s.s, 1.8 * s.s);
  }
  for (const s of onGround(p, 65, 7, 0.2)) rock(n, s.x, s.y, s.s, 0xb98a5a);
  // 乾草叢
  for (const s of onGround(p, 66, 9, 0.1)) tuft(n, s.x, s.y, s.s, 0xa9884a);
  // 枯樹與路標旗
  const rnd = seeded(67);
  deadTree(n, w * 0.88, hy + 16, 1.1, 0x6b4a30, rnd);
  deadTree(n, w * 0.07, hy + 12, 0.8, 0x7a5636, rnd);
  for (const [fx, color] of [
    [0.36, 0xc0392b],
    [0.52, 0xd98a2b],
    [0.68, 0xc0392b],
  ]) {
    flag(n, fx * w, hy + 6, 44, 0x6b4a30, color);
  }
  drifting(p, 'sand', [0xf3deb0, 0xe8c98a, 0xfff1cf]);
}

/** 第六章 霧沼澤：灰綠的天、枯樹、水窪、蘆葦、荷葉與螢火蟲 */
function mistMarsh(p: Paint): void {
  const { w, h, hy } = p;
  const g = layer(p);
  sky(p, g, 0x46584f, 0xb3c1a9, 0x7d9080);
  g.fillStyle(0xe9f0d6, 0.2);
  g.fillCircle(w * 0.62, hy * 0.34, 34);
  g.fillStyle(0xeef3de, 0.75);
  g.fillCircle(w * 0.62, hy * 0.34, 17);
  mountains(p, g, 71, 'hills', hy, hy * 0.36, 0x8ba08a, 7);
  mountains(p, g, 72, 'hills', hy, hy * 0.22, 0x6f8572, 11);
  fog(p, 73, [hy - 40, hy - 18], 0xdfe8dc, 0.3);
  const m = layer(p);
  const rnd = seeded(74);
  for (const [tx, s] of [
    [0.06, 1.15],
    [0.2, 0.8],
    [0.42, 0.7],
    [0.63, 0.85],
    [0.8, 1.0],
    [0.95, 1.2],
  ]) {
    deadTree(m, tx * w, hy + 6, s, 0x3a4a40, rnd);
  }
  ground(p, m, 0x71876a, 0x4f6249);
  // 水窪
  const pools = [
    [0.14, 0.2, 150, 22],
    [0.5, 0.12, 190, 18],
    [0.84, 0.26, 170, 26],
    [0.3, 0.62, 230, 36],
    [0.74, 0.74, 260, 40],
  ];
  const gh = h - hy;
  for (const [fx, fy, pw, ph] of pools) {
    const x = fx * w;
    const y = hy + fy * gh;
    m.fillStyle(0x3d4f3c, 1);
    m.fillEllipse(x, y + 2, pw + 8, ph + 5);
    m.fillStyle(0x3f6462, 1);
    m.fillEllipse(x, y, pw, ph);
    m.fillStyle(0x6f9a94, 0.6);
    m.fillEllipse(x - pw * 0.12, y - ph * 0.16, pw * 0.6, ph * 0.3);
    m.fillStyle(0xcfe3da, 0.5);
    m.fillRect(x - pw * 0.3, y - ph * 0.1, pw * 0.22, 1.5);
    m.fillRect(x + pw * 0.05, y + ph * 0.15, pw * 0.28, 1.5);
    // 荷葉
    for (let i = 0; i < 4; i++) {
      const lx = x + (rnd() - 0.5) * pw * 0.7;
      const ly = y + (rnd() - 0.5) * ph * 0.5;
      const r = 7 + rnd() * 5;
      m.fillStyle(i % 2 ? 0x6fa35a : 0x86b86a, 1);
      m.fillEllipse(lx, ly, r * 2, r * 0.9);
      m.fillStyle(0x3f6462, 1);
      m.fillTriangle(lx, ly, lx + r, ly - 2, lx + r, ly + 2);
      if (i === 0) flower(m, lx - 2, ly - 3, 1.1, 0xf7b8d0, 0xfff2a8);
    }
    // 蘆葦
    for (let i = 0; i < 7; i++) {
      const rx = x - pw / 2 + rnd() * pw;
      const ry = y + ph * 0.42 + rnd() * 4;
      const top = ry - 22 - rnd() * 18;
      m.lineStyle(1.5, 0x8f9a62, 1);
      m.lineBetween(rx, ry, rx + 2, top);
      m.fillStyle(0x6b4a2a, 1);
      m.fillEllipse(rx + 2, top - 3, 4, 10);
    }
  }
  for (const s of onGround(p, 75, 18)) tuft(m, s.x, s.y, s.s, 0x5e7a52);
  fog(p, 76, [hy + 6, hy + gh * 0.4], 0xdfe8dc, 0.22);
  sparkles(p, 77, 16, { x: 0, y: hy - 50, width: w, height: gh * 0.7 + 50 }, 0xe6ff8a, 1.8, 14);
}

/** 第七章 赤焰嶺：火山、岩漿、裂開的地面與飄上來的火星 */
function flameRidge(p: Paint): void {
  const { w, hy } = p;
  const g = layer(p);
  sky(p, g, 0x180b12, 0xc4502c, 0x5e1f24);
  stars(p, g, 81, 14);
  mountains(p, g, 82, 'peaks', hy, hy * 0.42, 0x4a2622, 6);
  // 火山口的紅光
  const vx = w * 0.6;
  const top = hy * 0.2;
  for (let i = 4; i >= 1; i--) {
    g.fillStyle(0xff7b3a, 0.08);
    g.fillCircle(vx, top, 24 + i * 18);
  }
  // 大火山與旁邊的小火山
  const cone = (cx: number, ty: number, half: number, mouth: number, color: number) => {
    poly(
      g,
      [
        P(cx - half, hy + 4),
        P(cx - half * 0.5, hy - (hy - ty) * 0.42),
        P(cx - mouth, ty),
        P(cx + mouth, ty),
        P(cx + half * 0.5, hy - (hy - ty) * 0.42),
        P(cx + half, hy + 4),
      ],
      color,
    );
    g.fillStyle(0xffb347, 1);
    g.fillEllipse(cx, ty + 1, mouth * 2, 6);
    g.fillStyle(0xfff1a8, 1);
    g.fillEllipse(cx, ty + 1, mouth * 1.2, 3);
  };
  cone(w * 0.22, hy * 0.5, w * 0.16, 10, 0x3a1c1c);
  cone(vx, top, w * 0.26, 20, 0x321618);
  // 岩漿順著山流下來
  const lava = (pts: number[][]) => {
    const path = pts.map(([dx, t]) => P(vx + dx, top + (hy - top) * t));
    line(g, path, 6, 0xe0452b);
    line(g, path, 3, 0xffb347);
    line(g, path, 1, 0xfff1a8);
  };
  lava([
    [-6, 0.02],
    [-18, 0.2],
    [-12, 0.42],
    [-40, 0.7],
    [-58, 1.02],
  ]);
  lava([
    [8, 0.02],
    [22, 0.24],
    [44, 0.5],
    [50, 0.78],
    [84, 1.02],
  ]);
  lava([
    [0, 0.02],
    [4, 0.3],
    [-2, 0.5],
  ]);
  smoke(p, vx - 4, top - 6, 0x3a2a2e, 2.2, 6);
  smoke(p, w * 0.22, hy * 0.5 - 4, 0x3a2a2e, 1.2, 4);
  const m = layer(p);
  mountains(p, m, 83, 'peaks', hy + 2, hy * 0.16, 0x231012, 9);
  ground(p, m, 0x55302a, 0x2a1516);
  // 地上的裂縫，底下透出岩漿的光
  const rnd = seeded(84);
  const cracks = layer(p);
  for (const s of onGround(p, 85, 12, 0.1)) {
    const path = [P(s.x, s.y)];
    let x = s.x;
    let y = s.y;
    const dir = s.k < 0.5 ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      x += (12 + rnd() * 20) * s.s * dir;
      y += (rnd() - 0.35) * 9 * s.s;
      path.push(P(x, y));
    }
    line(cracks, path, 4 * s.s, 0xe0452b, 0.6);
    line(cracks, path, 2 * s.s, 0xffb347, 1);
    line(cracks, path, 0.8 * s.s, 0xfff1a8, 1);
    // 分一條小岔
    const fork = [path[2], P(path[2].x + 16 * s.s * dir, path[2].y + 9 * s.s)];
    line(cracks, fork, 2.5 * s.s, 0xe0452b, 0.6);
    line(cracks, fork, 1.2 * s.s, 0xffb347, 1);
  }
  if (p.live) {
    tween(p, {
      targets: cracks,
      alpha: 0.55,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  const r = layer(p);
  for (const s of onGround(p, 86, 12, 0.05)) rock(r, s.x, s.y, s.s * 1.2, 0x3e2426);
  // 兩側的尖石
  for (const [tx, s] of [
    [0.03, 1.2],
    [0.1, 0.7],
    [0.9, 0.8],
    [0.97, 1.3],
  ]) {
    const x = tx * w;
    poly(r, [P(x - 20 * s, hy + 14), P(x + 20 * s, hy + 14), P(x + 4 * s, hy - 54 * s)], 0x1e0e10);
    poly(r, [P(x - 20 * s, hy + 14), P(x - 2 * s, hy + 14), P(x + 4 * s, hy - 54 * s)], 0x3a1c1c);
  }
  drifting(p, 'rise', [0xff7b54, 0xffb347, 0xffd56b]);
}

/** 第八章 碧海灣：藍色的海、帆船、燈塔、沙灘與椰子樹 */
function blueBay(p: Paint): void {
  const { w, hy } = p;
  const g = layer(p);
  const sea = hy - Math.max(28, hy * 0.26);
  sky(p, g, 0x4fb2ec, 0xdff4fb, 0x9ad6f5);
  glowDisc(g, w * 0.76, hy * 0.22, 22, 0xfffbe6, 0xffffff);
  clouds(p, 91, 4, 0xffffff, 0.95, 0.06, 0.42);
  const m = layer(p);
  // 遠方的小島
  mountains(p, m, 92, 'hills', sea + 2, hy * 0.16, 0x86bfae, 2);
  water(p, m, sea, hy + 2, 0x2f8fc0, 0x6fcbe0, 93);
  m.fillStyle(0xffffff, 0.5);
  m.fillRect(0, sea, w, 1.5);
  // 帆船
  const bx = w * 0.34;
  const by = sea + (hy - sea) * 0.45;
  poly(m, [P(bx - 22, by), P(bx + 26, by), P(bx + 18, by + 8), P(bx - 16, by + 8)], 0x7a4a2a);
  m.fillStyle(0x5a3a22, 1);
  m.fillRect(bx - 1, by - 40, 2.5, 40);
  poly(
    m,
    [P(bx + 3, by - 38), P(bx + 22, by - 30), P(bx + 22, by - 6), P(bx + 3, by - 3)],
    0xf2dfb4,
  );
  poly(
    m,
    [P(bx - 3, by - 32), P(bx - 16, by - 24), P(bx - 16, by - 6), P(bx - 3, by - 3)],
    0xe6c98f,
  );
  m.fillStyle(0xc9a56a, 1);
  for (const o of [-28, -20, -12]) m.fillRect(bx + 3, by + o, 19, 1.2);
  // 岬角與燈塔
  const lx = w * 0.9;
  poly(
    m,
    [
      P(w * 0.78, hy + 2),
      P(w * 0.84, hy - 16),
      P(w * 0.93, hy - 22),
      P(w + 4, hy - 12),
      P(w + 4, hy + 2),
    ],
    0x7f8f86,
  );
  poly(
    m,
    [
      P(w * 0.84, hy - 16),
      P(w * 0.93, hy - 22),
      P(w + 4, hy - 12),
      P(w + 4, hy - 6),
      P(w * 0.86, hy - 10),
    ],
    0x8fb87a,
  );
  poly(
    m,
    [P(lx - 7, hy - 20), P(lx + 7, hy - 20), P(lx + 4.5, hy - 62), P(lx - 4.5, hy - 62)],
    0xf7f4ea,
  );
  m.fillStyle(0xd9442b, 1);
  m.fillRect(lx - 6.2, hy - 36, 12.4, 7);
  m.fillRect(lx - 5.2, hy - 52, 10.4, 6);
  m.fillStyle(0x3b4a5a, 1);
  m.fillRect(lx - 6, hy - 66, 12, 4);
  m.fillStyle(0xffe08a, 1);
  m.fillRect(lx - 4, hy - 73, 8, 7);
  m.fillStyle(0xffe08a, 0.25);
  m.fillCircle(lx, hy - 70, 12);
  poly(m, [P(lx - 6, hy - 73), P(lx + 6, hy - 73), P(lx, hy - 81)], 0xd9442b);
  // 沙灘、浪花
  ground(p, m, 0xf6e7bd, 0xe0c488);
  m.fillStyle(0xd9c08a, 1);
  m.fillRect(0, hy, w, 7);
  const foam = layer(p);
  foam.fillStyle(0xffffff, 0.95);
  for (let x = -10; x < w + 20; x += 26) foam.fillEllipse(x, hy + 3, 34, 7);
  if (p.live) {
    tween(p, {
      targets: foam,
      y: 5,
      alpha: 0.6,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  const n = layer(p);
  for (const s of onGround(p, 94, 22, 0.14)) {
    n.fillStyle(0xcdb078, 0.5);
    n.fillEllipse(s.x, s.y, 30 * s.s, 2.2 * s.s);
  }
  // 貝殼與海星
  for (const s of onGround(p, 95, 9, 0.16)) {
    if (s.k < 0.4) {
      n.fillStyle(0xf08a5a, 1);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        n.fillTriangle(
          s.x + Math.cos(a) * 8 * s.s,
          s.y + Math.sin(a) * 5 * s.s,
          s.x + Math.cos(a + 1.3) * 2.6 * s.s,
          s.y + Math.sin(a + 1.3) * 1.8 * s.s,
          s.x + Math.cos(a - 1.3) * 2.6 * s.s,
          s.y + Math.sin(a - 1.3) * 1.8 * s.s,
        );
      }
      n.fillCircle(s.x, s.y, 2.6 * s.s);
    } else {
      n.fillStyle(0xfff6e8, 1);
      n.fillEllipse(s.x, s.y, 9 * s.s, 6 * s.s);
      n.fillStyle(0xf2b8a0, 1);
      n.fillEllipse(s.x, s.y + 1 * s.s, 5 * s.s, 3 * s.s);
    }
  }
  for (const s of onGround(p, 96, 4, 0.3)) rock(n, s.x, s.y, s.s, 0xa9a08f);
  palm(n, w * 0.06, hy + 30, 1.15, 22);
  palm(n, w * 0.15, hy + 18, 0.85, -14);
  palm(n, w * 0.7, hy + 16, 0.8, 16);
  birds(p, 97, 3, 0xffffff);
  sparkles(p, 98, 10, { x: 0, y: sea + 4, width: w, height: hy - sea - 8 }, 0xffffff, 1.2, 3);
}

/** 第九章 雲頂棧：雲海上的石峰、懸崖邊的木棧道、迎客松與白鶴 */
function cloudWalk(p: Paint): void {
  const { w, hy } = p;
  const g = layer(p);
  sky(p, g, 0x5f8fdc, 0xfde0c2, 0xb9cdee);
  glowDisc(g, w * 0.2, hy * 0.6, 24, 0xfff1c2, 0xffd9a0);
  // 石峰：一根一根的石柱，頂上長著小松樹
  const pillar = (cx: number, top: number, half: number, color: number, trees: boolean) => {
    const dark = mixColor(color, 0x000000, 0.22);
    poly(
      g,
      [
        P(cx - half * 1.3, hy + 4),
        P(cx - half * 1.05, hy - (hy - top) * 0.5),
        P(cx - half * 0.8, top + 10),
        P(cx - half * 0.3, top),
        P(cx + half * 0.5, top + 6),
        P(cx + half * 0.95, hy - (hy - top) * 0.55),
        P(cx + half * 1.25, hy + 4),
      ],
      color,
    );
    poly(
      g,
      [
        P(cx + half * 0.1, top + 4),
        P(cx + half * 0.5, top + 6),
        P(cx + half * 0.95, hy - (hy - top) * 0.55),
        P(cx + half * 1.25, hy + 4),
        P(cx + half * 0.3, hy + 4),
      ],
      dark,
    );
    g.fillStyle(dark, 0.6);
    for (let i = 1; i < 5; i++) {
      g.fillRect(cx - half * 0.9, top + ((hy - top) * i) / 5, half * 1.2, 1.5);
    }
    if (trees) {
      pine(g, cx - half * 0.3, top + 3, 0.34, 0x4f3626, 0x3f6b55);
      pine(g, cx + half * 0.3, top + 8, 0.26, 0x4f3626, 0x3f6b55);
    }
  };
  for (const [fx, ft, half] of [
    [0.34, 0.3, 16],
    [0.48, 0.42, 12],
    [0.62, 0.24, 18],
    [0.76, 0.46, 13],
  ]) {
    pillar(fx * w, hy * ft, half, 0xa3b4d2, false);
  }
  for (const [fx, ft, half] of [
    [0.1, 0.14, 30],
    [0.27, 0.4, 20],
    [0.7, 0.36, 22],
    [0.9, 0.1, 34],
  ]) {
    pillar(fx * w, hy * ft, half, 0x6b819f, true);
  }
  // 雲海
  const rnd = seeded(101);
  const seaTop = hy - Math.max(26, hy * 0.2);
  g.fillStyle(0xffffff, 0.85);
  g.fillRect(0, seaTop + 12, w, hy - seaTop);
  for (let i = 0; i < 34; i++) {
    g.fillStyle(i % 3 ? 0xffffff : 0xf1f4fb, 1);
    g.fillEllipse(rnd() * w, seaTop + 6 + rnd() * (hy - seaTop), 70 + rnd() * 70, 18 + rnd() * 12);
  }
  fog(p, 102, [seaTop - 4, seaTop + 10, hy - 6], 0xffffff, 0.75);
  birds(p, 103, 2, 0xffffff, 0x2a2a2a);
  const m = layer(p);
  // 懸崖頂的岩石地面
  ground(p, m, 0xd6d9e2, 0xb1b6c6);
  for (const s of onGround(p, 104, 26)) {
    m.fillStyle(0x8f9db8, 0.4);
    m.fillRect(s.x, s.y, 30 * s.s, 1.5);
    m.fillRect(s.x + 12 * s.s, s.y, 1.5, 7 * s.s);
  }
  for (const s of onGround(p, 105, 7, 0.2)) rock(m, s.x, s.y, s.s, 0x9aa7c0);
  for (const s of onGround(p, 106, 8, 0.1)) tuft(m, s.x, s.y, s.s, 0x7f9a86);
  // 棧道：木板鋪在懸崖邊，外側是繩欄
  m.fillStyle(0x9a7446, 1);
  m.fillRect(0, hy - 2, w, 12);
  m.fillStyle(0x7a5a34, 1);
  for (let x = 0; x < w; x += 18) m.fillRect(x, hy - 2, 1.5, 12);
  m.fillStyle(0x6b4f30, 1);
  m.fillRect(0, hy + 9, w, 2.5);
  const posts = 11;
  for (let i = 0; i <= posts; i++) {
    const x = (i / posts) * w;
    m.fillStyle(0x6b4f30, 1);
    m.fillRect(x - 2.5, hy - 22, 5, 22);
    m.fillStyle(0x8a6a44, 1);
    m.fillRect(x - 3.5, hy - 24, 7, 3);
    if (i < posts) {
      const next = ((i + 1) / posts) * w;
      line(m, sag(P(x, hy - 19), P(next, hy - 19), 5, 8), 1.6, 0xd9c49a);
      line(m, sag(P(x, hy - 10), P(next, hy - 10), 4, 8), 1.6, 0xd9c49a);
    }
  }
  // 迎客松：斜斜伸出去的樹幹，一層一層扁平的樹冠
  const leanPine = (x: number, y: number, s: number, dir: number) => {
    const tip = P(x + dir * 46 * s, y - 62 * s);
    poly(
      m,
      [P(x - 5 * s, y), P(x + 5 * s, y), P(tip.x + 2 * s, tip.y), P(tip.x - 2 * s, tip.y)],
      0x5a3d2a,
    );
    for (const [t, len] of [
      [0.45, 30],
      [0.7, 36],
      [1, 30],
    ]) {
      const bx = x + (tip.x - x) * t;
      const by = y + (tip.y - y) * t;
      m.fillStyle(0x2f5a4a, 1);
      m.fillEllipse(bx + dir * 8 * s, by - 3 * s, len * 1.5 * s, 12 * s);
      m.fillStyle(0x4a7f62, 1);
      m.fillEllipse(bx + dir * 6 * s, by - 6 * s, len * 1.1 * s, 7 * s);
    }
  };
  leanPine(w * 0.04, hy + 20, 1.15, 1);
  leanPine(w * 0.97, hy + 16, 0.95, -1);
}

/** 第十章 汪都：夜裡的都城，金頂大殿、宮牆、旗幟與一路的燈籠 */
function capital(p: Paint): void {
  const { w, h, hy } = p;
  const g = layer(p);
  sky(p, g, 0x110f2a, 0xa5612f, 0x3a2a55);
  stars(p, g, 111, 40);
  moon(g, w * 0.84, hy * 0.2, 17);
  // 遠處滿城的屋頂與燈火
  const far = mountains(p, g, 112, 'mesa', hy, hy * 0.24, 0x2c2238, 12);
  const rnd = seeded(113);
  for (const pt of far) {
    if (rnd() < 0.4) continue;
    g.fillStyle(0xffd56b, 0.85);
    g.fillRect(pt.x, Math.min(hy - 8, pt.y + 5 + rnd() * 14), 2.5, 3);
  }
  // 廣場：往大殿匯聚的石板線
  const cx = w * 0.5;
  g.fillGradientStyle(0x6a5444, 0x6a5444, 0x3a2c26, 0x3a2c26, 1);
  g.fillRect(0, hy + 2, w, h - hy);
  g.lineStyle(1.2, 0x2a1f1a, 0.5);
  for (let i = -8; i <= 8; i++) g.lineBetween(cx + i * 22, hy + 2, cx + i * 130, h);
  for (let i = 1; i <= 6; i++) {
    const y = hy + 2 + ((h - hy) * (i * i)) / 40;
    g.lineBetween(0, y, w, y);
  }
  const m = layer(p);
  // 宮牆與兩座角樓
  wall(m, 0, hy + 2, w, 34, 0x8a3a34);
  m.fillStyle(0xd9a441, 1);
  m.fillRect(0, hy - 34, w, 3);
  for (const fx of [0.12, 0.88]) {
    const cx = fx * w;
    m.fillStyle(0x6f2c2a, 1);
    m.fillRect(cx - 26, hy - 62, 52, 64);
    m.fillStyle(0xffd56b, 1);
    m.fillRect(cx - 9, hy - 54, 18, 14);
    m.fillStyle(0x6f2c2a, 1);
    m.fillRect(cx - 0.75, hy - 54, 1.5, 14);
    roof(m, cx, hy - 62, 76, 26, 0xc9922e, 0xffe08a);
    flag(m, cx + 30, hy - 60, 40, 0x3b2a1a, 0xd9342b);
  }
  // 大殿：石台、紅柱、兩層金頂
  m.fillStyle(0x9a8f86, 1);
  m.fillRect(cx - 120, hy - 12, 240, 14);
  m.fillStyle(0xb9aea4, 1);
  m.fillRect(cx - 120, hy - 12, 240, 3);
  m.fillStyle(0x7a2f2a, 1);
  m.fillRect(cx - 100, hy - 64, 200, 52);
  m.fillStyle(0xffd56b, 0.95);
  for (const o of [-74, -44, 30, 60]) m.fillRect(cx + o, hy - 54, 14, 30);
  m.fillStyle(0x3b1a18, 1);
  m.fillRoundedRect(cx - 15, hy - 52, 30, 40, { tl: 12, tr: 12, bl: 0, br: 0 });
  m.fillStyle(0xffd56b, 0.5);
  m.fillRoundedRect(cx - 11, hy - 48, 22, 36, { tl: 9, tr: 9, bl: 0, br: 0 });
  m.fillStyle(0xc0392b, 1);
  for (const o of [-98, -84, -24, 18, 78, 92]) m.fillRect(cx + o, hy - 64, 6, 52);
  roof(m, cx, hy - 64, 250, 34, 0xd9a441, 0xffe9a8);
  m.fillStyle(0x7a2f2a, 1);
  m.fillRect(cx - 72, hy - 108, 144, 14);
  m.fillStyle(0xffd56b, 0.9);
  for (let o = -62; o < 60; o += 20) m.fillRect(cx + o, hy - 105, 10, 8);
  roof(m, cx, hy - 108, 184, 30, 0xd9a441, 0xffe9a8);
  m.fillStyle(0xffe9a8, 1);
  m.fillCircle(cx, hy - 141, 4);
  // 石階
  for (let i = 0; i < 3; i++) {
    m.fillStyle(i % 2 ? 0xa59a90 : 0xb9aea4, 1);
    m.fillRect(cx - 34 - i * 6, hy + 2 + i * 5, 68 + i * 12, 5);
  }
  // 中間一條紅毯
  const carpet = layer(p);
  poly(
    carpet,
    [P(cx - 20, hy + 17), P(cx + 20, hy + 17), P(cx + 150, h), P(cx - 150, h)],
    0x8a2a28,
    0.75,
  );
  poly(
    carpet,
    [P(cx - 15, hy + 17), P(cx - 12, hy + 17), P(cx - 118, h), P(cx - 136, h)],
    0xd9a441,
    0.8,
  );
  poly(
    carpet,
    [P(cx + 12, hy + 17), P(cx + 15, hy + 17), P(cx + 136, h), P(cx + 118, h)],
    0xd9a441,
    0.8,
  );
  // 兩排燈柱
  const posts = layer(p);
  for (const [fx, fy, s] of [
    [0.3, 0.1, 0.8],
    [0.7, 0.1, 0.8],
    [0.2, 0.42, 1.15],
    [0.8, 0.42, 1.15],
  ]) {
    const x = fx * w;
    const y = hy + (h - hy) * fy;
    posts.fillStyle(0xffb347, 0.14);
    posts.fillEllipse(x, y + 2, 80 * s, 14 * s);
    posts.fillStyle(0x2a1f1a, 1);
    posts.fillRect(x - 2 * s, y - 52 * s, 4 * s, 54 * s);
    posts.fillRect(x - 12 * s, y - 52 * s, 24 * s, 3 * s);
    lantern(posts, x - 11 * s, y - 38 * s, 0.7 * s);
    lantern(posts, x + 11 * s, y - 38 * s, 0.7 * s);
  }
  drifting(p, 'rise', [0xffd56b, 0xffb347]);
}

/** 主城（劇情用）：白天的城門、城牆、旗子與通往城門的大路 */
function homeCity(p: Paint): void {
  const { w, h, hy } = p;
  const g = layer(p);
  sky(p, g, 0x8fcdf2, 0xfff1d6, 0xcbe7f5);
  glowDisc(g, w * 0.82, hy * 0.24, 22, 0xfff3c4, 0xffe9a8);
  mountains(p, g, 121, 'hills', hy, hy * 0.5, 0xb9d3c4, 3);
  mountains(p, g, 122, 'hills', hy, hy * 0.32, 0x9cc19a, 4);
  clouds(p, 123, 3);
  const m = layer(p);
  // 城牆後面露出來的屋頂
  const rnd = seeded(124);
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5 + (rnd() - 0.5) * 0.4) * (w / 9);
    if (Math.abs(x - w / 2) < 80) continue;
    roof(m, x, hy - 56 - rnd() * 10, 50 + rnd() * 16, 16, i % 2 ? 0x6f7f8f : 0x8a5a44);
  }
  wall(m, 0, hy + 2, w, 60, 0xb8a58a);
  // 城門樓
  const cx = w * 0.5;
  m.fillStyle(0xa8947a, 1);
  m.fillRect(cx - 62, hy - 78, 124, 80);
  m.fillStyle(0x8f7d66, 1);
  for (let bx = cx - 62; bx < cx + 62; bx += 22) m.fillRect(bx, hy - 87, 13, 10);
  m.fillStyle(0x4a3424, 1);
  m.fillRoundedRect(cx - 26, hy - 50, 52, 52, { tl: 26, tr: 26, bl: 0, br: 0 });
  m.fillStyle(0x7a5a3a, 1);
  m.fillRoundedRect(cx - 21, hy - 45, 20, 47, { tl: 20, tr: 0, bl: 0, br: 0 });
  m.fillRoundedRect(cx + 1, hy - 45, 20, 47, { tl: 0, tr: 20, bl: 0, br: 0 });
  m.fillStyle(0xd9a441, 1);
  for (const o of [-11, 11]) for (const dy of [-30, -18]) m.fillCircle(cx + o, hy + dy, 1.8);
  m.fillStyle(0x9a3a2e, 1);
  m.fillRect(cx - 46, hy - 112, 92, 26);
  m.fillStyle(0xfff6e8, 1);
  for (const o of [-34, -12, 10]) m.fillRect(cx + o, hy - 106, 14, 14);
  roof(m, cx, hy - 112, 124, 26, 0x4f6d8a, 0xdfe9f2);
  roof(m, cx, hy - 86, 150, 12, 0x4f6d8a, 0xdfe9f2);
  for (const fx of [0.18, 0.36, 0.64, 0.82]) flag(m, fx * w, hy - 58, 38, 0x5a3d2a, 0xd9542b);
  // 草地與大路
  ground(p, m, 0xc9dea0, 0xa9c67e);
  poly(m, [P(cx - 30, hy + 2), P(cx + 30, hy + 2), P(cx + 190, h), P(cx - 190, h)], 0xe3d0a8);
  m.fillStyle(0xc9b48a, 0.7);
  for (const s of onGround(p, 125, 30)) {
    const t = (s.y - hy) / (h - hy);
    if (Math.abs(s.x - cx) < 26 + t * 150) m.fillRect(s.x, s.y, 16 * s.s, 1.5);
  }
  for (const s of onGround(p, 126, 22)) {
    const t = (s.y - hy) / (h - hy);
    if (Math.abs(s.x - cx) > 44 + t * 170) tuft(m, s.x, s.y, s.s, 0x86ab62);
  }
  for (const s of onGround(p, 127, 10, 0.15)) {
    const t = (s.y - hy) / (h - hy);
    if (Math.abs(s.x - cx) > 50 + t * 170) flower(m, s.x, s.y, s.s, 0xfde2e7, 0xf2c14e);
  }
  roundTree(m, w * 0.05, hy + 26, 1.15, 0x7a4a2a, 0x4f8a4a, 0x6fae5e, 0x9fd07e);
  roundTree(m, w * 0.95, hy + 24, 1.1, 0x7a4a2a, 0x4f8a4a, 0x6fae5e, 0x9fd07e);
  birds(p, 128, 2, 0x5a4a3a);
  drifting(p, 'petal', [0xf7c6d0, 0xfde2e7]);
}

const PAINTERS: Record<SceneryTheme, (p: Paint) => void> = {
  slope,
  bamboo: bambooFerry,
  snow: snowRidge,
  lantern: lanternFair,
  peach: peachValley,
  desert: desertRoad,
  marsh: mistMarsh,
  volcano: flameRidge,
  coast: blueBay,
  cloud: cloudWalk,
  palace: capital,
  city: homeCity,
};

export const SCENERY_THEMES = Object.keys(PAINTERS) as SceneryTheme[];

/** 把某個場景畫進 p.box */
export function paintScenery(p: Paint, theme: SceneryTheme): void {
  PAINTERS[theme](p);
}

export type { G };
