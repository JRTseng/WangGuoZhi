import Phaser from 'phaser';
import { PIXEL_SIZE } from '../../logic/atmosphere';
import type { BattleSide } from '../../logic/battle';
import type { UltKind } from '../../logic/skillShow';
import { addText } from '../ui';
import type { GearData } from '../../data/equipment';
import type { UltPoseSpec } from '../../logic/ultPose';
import { DogSprite } from './DogSprite';

/** 場上的一個位置（頭的中心與半徑） */
export interface ShowPoint {
  x: number;
  y: number;
  r: number;
}

export interface UltimateShowOptions {
  /** 畫面寬高 */
  w: number;
  h: number;
  landscape: boolean;
  /** 上方標題列高度：演出只蓋住它下面的部分，速度按鈕照常可按 */
  top: number;
  side: BattleSide;
  kind: UltKind;
  /** 施放者的名字、招式名、台詞（台詞可以是空字串） */
  name: string;
  skill: string;
  line: string;
  /** 施放者的位置與外觀 */
  caster: ShowPoint & {
    color: number;
    accent: number;
    fierce: boolean;
    /** 專屬姿勢 */
    pose: UltPoseSpec;
    /** 身上穿的裝備：字卡上的狗照樣畫出來 */
    gear?: readonly GearData[];
  };
  /** 這一下實際打到（或補到）的對象 */
  target: ShowPoint;
  /** 施放者這一方、對面那一方還站著的角色 */
  allies: readonly ShowPoint[];
  foes: readonly ShowPoint[];
  /** 整段演出多久、其中喊招字卡多久（毫秒） */
  total: number;
  cutIn: number;
  /** 壓暗遮罩的深度；字卡與特效畫在它上面 */
  depth: number;
  /** 華麗版：多一些光芒、火花、碎片（低畫質時關掉，只留主要的特效） */
  rich?: boolean;
}

/** 字卡配色：我方深藍配金邊，敵方深紅配橘邊 */
const BAND = {
  team: { fill: 0x1d2b4f, edge: 0xf2c14e, text: '#fff3c4' },
  enemy: { fill: 0x4f1d1d, edge: 0xff8a5c, text: '#ffe1d6' },
} as const;
const GOLD = 0xffd75e;
const HEAL = 0x8df07a;

/**
 * 播一次大絕招演出（T017）：壓暗 → 斜的字卡滑進來（整隻狗擺專屬姿勢、招式名、台詞）→ 字卡滑走 →
 * 依種類播招式特效（單體、穿透、整排、補血、強化）。
 * 純裝飾：不決定任何結果，傷害數字與扣血由戰鬥畫面照紀錄處理。
 * 全部用 tween 加延遲排好時間，回傳產生的物件，戰鬥畫面在下一次出手或略過時負責清掉。
 */
export function playUltimate(
  scene: Phaser.Scene,
  o: UltimateShowOptions,
): Phaser.GameObjects.GameObject[] {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(x: T): T => {
    objs.push(x);
    return x;
  };
  const { w, h, top, depth } = o;
  const dir = o.side === 'team' ? 1 : -1;
  const c = o.cutIn;
  const fx = Math.max(1, o.total - c);
  const look = BAND[o.side];
  const tw = scene.tweens;
  const rich = o.rich !== false;

  // ---- 壓暗，施放者後面一圈光 ----
  const shade = keep(
    scene.add
      .rectangle(0, top, w, h - top, 0x000000, 1)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setAlpha(0),
  );
  tw.add({ targets: shade, alpha: 0.6, duration: c * 0.12 });
  tw.add({ targets: shade, alpha: 0, delay: c * 0.86, duration: c * 0.14 + fx * 0.4 });

  const aura = keep(
    scene.add.circle(o.caster.x, o.caster.y, o.caster.r * 1.55, GOLD, 0.4).setDepth(depth + 0.5),
  );
  aura.setScale(0.6);
  tw.add({
    targets: aura,
    scale: 1.25,
    duration: c * 0.25,
    yoyo: true,
    repeat: 1,
    ease: 'Sine.easeInOut',
  });
  tw.add({ targets: aura, alpha: 0, delay: c, duration: fx * 0.3 });

  // ---- 喊招字卡 ----
  const bandH = o.landscape ? 104 : 132;
  const cy = top + (h - top) * (o.landscape ? 0.46 : 0.42);
  const tilt = o.landscape ? 10 : 12;
  const band = keep(scene.add.container(-dir * w * 1.2, cy).setDepth(depth + 2));
  const g = scene.add.graphics();
  const corners = [
    { x: -30, y: -bandH / 2 + tilt },
    { x: w + 30, y: -bandH / 2 - tilt },
    { x: w + 30, y: bandH / 2 - tilt },
    { x: -30, y: bandH / 2 + tilt },
  ];
  g.fillStyle(look.fill, 0.94);
  g.fillPoints(corners, true);
  // 角色主色的細帶 + 上下亮邊
  g.fillStyle(o.caster.color, 0.55);
  g.fillPoints(
    [
      { x: -30, y: bandH / 2 + tilt - 14 },
      { x: w + 30, y: bandH / 2 - tilt - 14 },
      corners[2],
      corners[3],
    ],
    true,
  );
  g.lineStyle(4, look.edge, 1);
  g.lineBetween(corners[0].x, corners[0].y, corners[1].x, corners[1].y);
  g.lineBetween(corners[3].x, corners[3].y, corners[2].x, corners[2].y);
  band.add(g);

  // 速度線
  for (let i = 0; i < 6; i++) {
    const len = 70 + ((i * 53) % 90);
    const ly = -bandH / 2 + 18 + ((i * 37) % (bandH - 44));
    const startX = dir > 0 ? -len - i * 60 : w + len + i * 60;
    const streak = scene.add.rectangle(startX, ly, len, 3, 0xffffff, 0.28).setOrigin(0.5);
    band.add(streak);
    tw.add({
      targets: streak,
      x: startX + dir * (w + len * 2 + 360),
      duration: Math.max(60, c * 0.34),
      delay: (i * c) / 14,
      repeat: -1,
    });
  }

  // 整隻狗擺出自己的姿勢（穿著的裝備照樣畫出來），站在字卡下緣、頭會超出字卡上緣
  const headR = bandH * 0.36;
  const headX = dir > 0 ? w * 0.2 : w * 0.8;
  const glow = scene.add.graphics();
  glow.fillStyle(0xffffff, 0.16);
  glow.fillCircle(headX, -dir * tilt * 0.6 - bandH * 0.1, headR * 1.7);
  band.add(glow);
  // 狗狗背後轉動的放射光芒
  const rays = scene.add.graphics();
  rays.setPosition(headX, -dir * tilt * 0.6 - bandH * 0.08);
  const rayN = rich ? 12 : 8;
  for (let i = 0; i < rayN; i++) {
    const a0 = (i / rayN) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / rayN / 2.4;
    const len = bandH * (i % 2 === 0 ? 1.25 : 0.95);
    rays.fillStyle(i % 2 === 0 ? look.edge : 0xffffff, i % 2 === 0 ? 0.3 : 0.16);
    rays.fillTriangle(
      0,
      0,
      Math.cos(a0) * len,
      Math.sin(a0) * len,
      Math.cos(a1) * len,
      Math.sin(a1) * len,
    );
  }
  rays.setScale(0.2).setAlpha(0);
  band.add(rays);
  tw.add({
    targets: rays,
    scale: 1,
    alpha: 1,
    delay: c * 0.08,
    duration: c * 0.16,
    ease: 'Back.easeOut',
  });
  tw.add({ targets: rays, angle: dir * 120, duration: c, ease: 'Linear' });
  const size0 = (bandH / 104) * 0.92;
  const dog = new DogSprite(scene, headX, bandH * 0.46 - dir * tilt * 0.6, {
    color: o.caster.color,
    accent: o.caster.accent,
    fierce: o.caster.fierce,
    gear: o.caster.gear,
    pixel: PIXEL_SIZE / size0,
  });
  // 敵方面向左邊
  dog.setScale(dir * size0 * 0.5, size0 * 0.5);
  band.add(dog);
  tw.add({
    targets: dog,
    scaleX: dir * size0,
    scaleY: size0,
    delay: c * 0.06,
    duration: c * 0.14,
    ease: 'Back.easeOut',
  });
  dog.ultPose(o.caster.pose.pose, o.caster.pose.lean, c * 0.86);

  // 名字 + 招式名（越長字越小，一定放得進去）
  const textX = dir > 0 ? headX + headR * 2 + 18 : headX - headR * 2 - 18;
  const avail = (dir > 0 ? w - textX : textX) - 14;
  const shout = `${o.skill}！`;
  const size = Math.max(22, Math.min(o.landscape ? 44 : 46, Math.floor(avail / shout.length)));
  const ox = dir > 0 ? 0 : 1;
  const who = addText(scene, textX, -bandH * 0.3, o.name, 16, look.text, true)
    .setOrigin(ox, 0.5)
    .setStroke('#000000', 4)
    .setAlpha(0);
  const title = addText(
    scene,
    textX + (dir * (shout.length * size)) / 2,
    2,
    shout,
    size,
    '#ffffff',
    true,
  )
    .setOrigin(0.5)
    .setStroke('#3b2a1a', 8)
    .setShadow(0, 4, '#000000', 6, true, true)
    .setTint(0xffffff, 0xffffff, GOLD, GOLD)
    .setAlpha(0)
    .setScale(2.4);
  band.add([who, title]);
  tw.add({ targets: who, alpha: 1, delay: c * 0.14, duration: c * 0.1 });
  tw.add({
    targets: title,
    alpha: 1,
    scale: 1,
    delay: c * 0.18,
    duration: c * 0.16,
    ease: 'Back.easeOut',
  });

  // 台詞字幕：字卡下緣的一條深色底
  if (o.line) {
    const caption = addText(scene, w / 2, bandH / 2 + 26, `「${o.line}」`, 17, '#ffffff', true)
      .setOrigin(0.5)
      .setBackgroundColor('#000000d0')
      .setPadding(14, 6, 14, 6)
      .setAlpha(0);
    band.add(caption);
    tw.add({ targets: caption, alpha: 1, delay: c * 0.32, duration: c * 0.12 });
  }

  // 招式名落下後：字微微脈動，字卡上飄著亮點
  tw.add({
    targets: title,
    scale: 1.06,
    delay: c * 0.36,
    duration: c * 0.12,
    yoyo: true,
    repeat: 1,
    ease: 'Sine.easeInOut',
  });
  if (rich) {
    for (let i = 0; i < 10; i++) {
      const sx = ((i * 97) % 100) / 100;
      const sy = ((i * 53) % 100) / 100;
      const star = addText(
        scene,
        w * (0.3 + sx * 0.65),
        -bandH * 0.42 + sy * bandH * 0.84,
        '✦',
        10 + (i % 3) * 5,
        i % 2 ? '#ffffff' : look.text,
      )
        .setOrigin(0.5)
        .setAlpha(0);
      band.add(star);
      tw.add({
        targets: star,
        alpha: { from: 0, to: 0.9 },
        scale: { from: 0.4, to: 1.2 },
        angle: 90,
        delay: c * (0.2 + (i % 5) * 0.09),
        duration: c * 0.18,
        yoyo: true,
      });
    }
  }

  tw.add({ targets: band, x: 0, duration: c * 0.16, ease: 'Cubic.easeOut' });
  tw.add({
    targets: band,
    x: dir * w * 1.2,
    delay: c * 0.86,
    duration: c * 0.14,
    ease: 'Cubic.easeIn',
  });

  // 招式名落下時閃一下
  const flash = keep(
    scene.add
      .rectangle(0, top, w, h - top, 0xffffff, 1)
      .setOrigin(0, 0)
      .setDepth(depth + 3)
      .setAlpha(0),
  );
  tw.add({
    targets: flash,
    alpha: { from: 0.5, to: 0 },
    delay: c * 0.3,
    duration: c * 0.2,
  });

  // ---- 招式特效（字卡滑走後） ----
  const fxDepth = depth + 2;

  /** 尖刺星形的爆點 */
  const burst = (p: ShowPoint, size: number, color: number, delay: number): void => {
    const s = keep(scene.add.graphics().setDepth(fxDepth).setPosition(p.x, p.y));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const rad = i % 2 === 0 ? size : size * 0.42;
      const a = (i / 16) * Math.PI * 2;
      pts.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
    }
    s.fillStyle(color, 1);
    s.fillPoints(pts, true);
    s.fillStyle(0xffffff, 0.9);
    s.fillCircle(0, 0, size * 0.3);
    s.setScale(0.2).setAlpha(0);
    tw.add({
      targets: s,
      scale: 1.25,
      angle: 40,
      alpha: { from: 1, to: 0 },
      delay,
      duration: fx * 0.55,
      ease: 'Cubic.easeOut',
    });
  };

  /** 往外擴的圓圈 */
  const ring = (p: ShowPoint, radius: number, color: number, delay: number): void => {
    const s = keep(scene.add.graphics().setDepth(fxDepth).setPosition(p.x, p.y));
    s.lineStyle(5, color, 1);
    s.strokeCircle(0, 0, radius);
    s.setScale(0.25).setAlpha(0);
    tw.add({
      targets: s,
      scale: 1,
      alpha: { from: 1, to: 0 },
      delay,
      duration: fx * 0.6,
      ease: 'Cubic.easeOut',
    });
  };

  /** 往上飄的小圖形（補血的十字、強化的箭頭） */
  const rise = (p: ShowPoint, shape: 'plus' | 'arrow', color: number, delay: number): void => {
    for (let i = 0; i < 3; i++) {
      const s = keep(
        scene.add
          .graphics()
          .setDepth(fxDepth)
          .setPosition(p.x + (i - 1) * p.r * 0.7, p.y + p.r * 0.4),
      );
      const u = Math.max(5, p.r * 0.22);
      s.fillStyle(color, 1);
      if (shape === 'plus') {
        s.fillRect(-u * 0.35, -u, u * 0.7, u * 2);
        s.fillRect(-u, -u * 0.35, u * 2, u * 0.7);
      } else {
        s.fillTriangle(0, -u * 1.2, u, 0, -u, 0);
        s.fillRect(-u * 0.4, 0, u * 0.8, u);
      }
      s.setAlpha(0);
      tw.add({
        targets: s,
        y: s.y - p.r * 1.8,
        alpha: { from: 1, to: 0 },
        delay: delay + i * fx * 0.08,
        duration: fx * 0.6,
        ease: 'Quad.easeOut',
      });
    }
  };

  /** 從 a 往 b 的方向射出去的一道光（穿透）或一刀（單體） */
  const beam = (
    a: { x: number; y: number },
    angle: number,
    length: number,
    thick: number,
    color: number,
    delay: number,
  ): void => {
    const s = keep(
      scene.add
        .rectangle(a.x, a.y, length, thick, color, 1)
        .setOrigin(0, 0.5)
        .setRotation(angle)
        .setDepth(fxDepth)
        .setScale(0, 1)
        .setAlpha(0),
    );
    tw.add({ targets: s, scaleX: 1, alpha: 1, delay, duration: fx * 0.16, ease: 'Cubic.easeOut' });
    tw.add({ targets: s, scaleY: 0.05, alpha: 0, delay: delay + fx * 0.22, duration: fx * 0.4 });
  };

  /** 往四面八方噴出去的火花 */
  const sparks = (
    p: { x: number; y: number },
    n: number,
    reach: number,
    color: number,
    delay: number,
  ): void => {
    const count = rich ? n : Math.ceil(n / 2);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (i % 2) * 0.35;
      const far = reach * (0.55 + ((i * 37) % 50) / 100);
      const s = keep(
        scene.add
          .rectangle(p.x, p.y, 10 + (i % 3) * 4, 3, i % 3 === 0 ? 0xffffff : color, 1)
          .setRotation(a)
          .setDepth(fxDepth)
          .setAlpha(0),
      );
      tw.add({
        targets: s,
        x: p.x + Math.cos(a) * far,
        y: p.y + Math.sin(a) * far,
        scaleX: 0.2,
        alpha: { from: 1, to: 0 },
        delay,
        duration: fx * 0.5,
        ease: 'Cubic.easeOut',
      });
    }
  };

  /** 地面上往外擴的衝擊波（扁的橢圓） */
  const shock = (p: ShowPoint, radius: number, color: number, delay: number): void => {
    const s = keep(
      scene.add
        .graphics()
        .setDepth(fxDepth)
        .setPosition(p.x, p.y + p.r * 0.9),
    );
    s.lineStyle(6, color, 1);
    s.strokeEllipse(0, 0, radius * 2, radius * 0.6);
    s.lineStyle(2, 0xffffff, 0.9);
    s.strokeEllipse(0, 0, radius * 1.6, radius * 0.48);
    s.setScale(0.15).setAlpha(0);
    tw.add({
      targets: s,
      scale: 1,
      alpha: { from: 1, to: 0 },
      delay,
      duration: fx * 0.55,
      ease: 'Quad.easeOut',
    });
  };

  /** 從地面升起的光柱 */
  const pillar = (p: ShowPoint, color: number, delay: number): void => {
    const bottom = p.y + p.r;
    for (const [wd, a, col] of [
      [p.r * 2.0, 0.35, color],
      [p.r * 0.9, 0.7, 0xffffff],
    ] as const) {
      const s = keep(
        scene.add
          .rectangle(p.x, bottom, wd, bottom - top, col, a)
          .setOrigin(0.5, 1)
          .setDepth(fxDepth - 0.5)
          .setScale(1, 0)
          .setAlpha(0),
      );
      tw.add({ targets: s, scaleY: 1, alpha: 1, delay, duration: fx * 0.2, ease: 'Cubic.easeOut' });
      tw.add({ targets: s, scaleX: 0.1, alpha: 0, delay: delay + fx * 0.35, duration: fx * 0.4 });
    }
  };

  /** 腳下轉動的法陣 */
  const glyph = (p: ShowPoint, radius: number, color: number, delay: number): void => {
    const s = keep(
      scene.add
        .graphics()
        .setDepth(fxDepth - 0.5)
        .setPosition(p.x, p.y + p.r * 0.9),
    );
    s.lineStyle(3, color, 1);
    s.strokeCircle(0, 0, radius);
    s.strokeCircle(0, 0, radius * 0.7);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = ((i + 2) / 6) * Math.PI * 2;
      s.lineBetween(
        Math.cos(a) * radius,
        Math.sin(a) * radius,
        Math.cos(b) * radius,
        Math.sin(b) * radius,
      );
    }
    s.setScale(0.3, 0.1).setAlpha(0);
    tw.add({
      targets: s,
      scaleX: 1,
      scaleY: 0.34,
      alpha: 0.95,
      delay,
      duration: fx * 0.2,
      ease: 'Back.easeOut',
    });
    tw.add({ targets: s, angle: 160, delay, duration: fx * 0.9 });
    tw.add({ targets: s, alpha: 0, delay: delay + fx * 0.6, duration: fx * 0.3 });
  };

  /** 一道弧形的爪痕（三條平行的斜線） */
  const claw = (p: ShowPoint, angle: number, color: number, delay: number): void => {
    for (let i = -1; i <= 1; i++) {
      const ox = Math.cos(angle + Math.PI / 2) * i * p.r * 0.45;
      const oy = Math.sin(angle + Math.PI / 2) * i * p.r * 0.45;
      const len = p.r * (i === 0 ? 4.4 : 3.6);
      const s = keep(
        scene.add
          .rectangle(p.x + ox, p.y + oy, len, i === 0 ? 7 : 5, i === 0 ? 0xffffff : color, 1)
          .setRotation(angle)
          .setDepth(fxDepth)
          .setScale(0, 1)
          .setAlpha(0),
      );
      tw.add({
        targets: s,
        scaleX: 1,
        alpha: 1,
        delay: delay + (i + 1) * fx * 0.02,
        duration: fx * 0.1,
        ease: 'Cubic.easeOut',
      });
      tw.add({ targets: s, scaleY: 0.1, alpha: 0, delay: delay + fx * 0.18, duration: fx * 0.3 });
    }
  };

  /** 從天上掉下來砸在目標上的東西（箭、星星） */
  const drop = (p: ShowPoint, mark: string, color: string, delay: number, n: number): void => {
    const count = rich ? n : Math.ceil(n / 2);
    for (let i = 0; i < count; i++) {
      const ox = (i - (count - 1) / 2) * p.r * 0.7;
      const s = keep(
        addText(scene, p.x + ox - dir * 60, top - 20, mark, Math.max(18, p.r * 0.8), color, true)
          .setOrigin(0.5)
          .setStroke('#3b2a1a', 4)
          .setDepth(fxDepth)
          .setAlpha(0),
      );
      tw.add({
        targets: s,
        x: p.x + ox,
        y: p.y,
        alpha: { from: 1, to: 1 },
        delay: delay + i * fx * 0.05,
        duration: fx * 0.2,
        ease: 'Quad.easeIn',
      });
      tw.add({
        targets: s,
        alpha: 0,
        scale: 1.6,
        delay: delay + i * fx * 0.05 + fx * 0.2,
        duration: fx * 0.15,
      });
    }
  };

  /** 施放者出招前的蓄力：光往身上收 */
  const charge = (color: number): void => {
    const p = o.caster;
    for (let i = 0; i < (rich ? 3 : 1); i++) {
      const s = keep(scene.add.graphics().setDepth(fxDepth).setPosition(p.x, p.y));
      s.lineStyle(4, color, 1);
      s.strokeCircle(0, 0, p.r * 2.6);
      s.setAlpha(0);
      tw.add({
        targets: s,
        scale: { from: 1, to: 0.25 },
        alpha: { from: 0.9, to: 0 },
        delay: c * (0.5 + i * 0.12),
        duration: c * 0.3,
        ease: 'Cubic.easeIn',
      });
    }
  };

  /** 打下去那一瞬間整個畫面閃一下顏色 */
  const impact = (color: number, delay: number): void => {
    const s = keep(
      scene.add
        .rectangle(0, top, w, h - top, color, 1)
        .setOrigin(0, 0)
        .setDepth(fxDepth - 1)
        .setAlpha(0),
    );
    tw.add({ targets: s, alpha: { from: 0.45, to: 0 }, delay, duration: fx * 0.3 });
  };

  let shake = 0;
  const t = o.target;
  const hitAt = c + fx * 0.12;
  switch (o.kind) {
    case 'pierce': {
      // 突擊：蓄力 → 殘影衝過去 → 三道光貫穿 → 每個被穿過的敵人炸開
      const angle = Math.atan2(t.y - o.caster.y, t.x - o.caster.x);
      charge(0xfff2a8);
      for (let i = 0; i < (rich ? 4 : 2); i++) {
        const ghost = keep(
          scene.add
            .circle(o.caster.x, o.caster.y, o.caster.r * 0.9, o.caster.color, 0.5)
            .setDepth(fxDepth)
            .setAlpha(0),
        );
        tw.add({
          targets: ghost,
          x: t.x,
          y: t.y,
          alpha: { from: 0.6, to: 0 },
          delay: c + i * fx * 0.03,
          duration: fx * 0.16,
          ease: 'Cubic.easeIn',
        });
      }
      beam(o.caster, angle, w + h, 26, 0xffd75e, c + fx * 0.04);
      beam(o.caster, angle, w + h, 12, 0xfff2a8, c + fx * 0.06);
      beam(o.caster, angle, w + h, 4, 0xffffff, c + fx * 0.06);
      o.foes.forEach((p, i) => {
        const near = Math.abs(Math.atan2(p.y - o.caster.y, p.x - o.caster.x) - angle) < 0.35;
        if (p !== t && !near) return;
        burst(p, p.r * (p === t ? 2.1 : 1.5), GOLD, hitAt + i * fx * 0.03);
        sparks(p, 10, p.r * 3.2, 0xffd75e, hitAt + i * fx * 0.03);
      });
      if (!o.foes.includes(t)) burst(t, t.r * 2.1, GOLD, hitAt);
      claw(t, angle + 0.5, 0xfff2a8, hitAt + fx * 0.05);
      impact(0xfff2a8, hitAt);
      shake = 0.012;
      break;
    }
    case 'row': {
      // 謀略／頭目：敵方腳下浮出法陣 → 箭雨落下 → 光柱與衝擊波
      const purple = o.side === 'team' ? 0xb99cff : 0xff8a5c;
      const arrow = o.side === 'team' ? '➴' : '☄';
      o.foes.forEach((p, i) => {
        const delay = c + i * fx * 0.06;
        glyph(p, p.r * 1.8, purple, c - c * 0.12);
        drop(p, arrow, o.side === 'team' ? '#e6dcff' : '#ffd0b8', delay, 3);
        pillar(p, purple, delay + fx * 0.2);
        burst(p, p.r * (p === t ? 1.9 : 1.3), purple, delay + fx * 0.22);
        shock(p, p.r * 2.4, purple, delay + fx * 0.22);
        sparks(p, 8, p.r * 2.6, purple, delay + fx * 0.22);
      });
      if (!o.foes.includes(t)) burst(t, t.r * 1.9, purple, hitAt);
      impact(purple, c + fx * 0.22);
      shake = 0.01;
      break;
    }
    case 'heal': {
      // 補血：每個隊友腳下綠色法陣、柔和的光柱、愛心與十字往上飄
      for (const p of o.allies) {
        glyph(p, p.r * 1.6, HEAL, c - c * 0.1);
        pillar(p, HEAL, c);
        ring(p, p.r * 1.7, HEAL, c + fx * 0.05);
        rise(p, 'plus', HEAL, c + fx * 0.08);
        if (rich) {
          const heart = keep(
            addText(scene, p.x, p.y - p.r * 0.4, '♥', Math.max(16, p.r * 0.7), '#ff9bb5', true)
              .setOrigin(0.5)
              .setStroke('#ffffff', 3)
              .setDepth(fxDepth)
              .setAlpha(0),
          );
          tw.add({
            targets: heart,
            y: p.y - p.r * 2.4,
            alpha: { from: 1, to: 0 },
            scale: { from: 0.6, to: 1.3 },
            delay: c + fx * 0.15,
            duration: fx * 0.6,
            ease: 'Quad.easeOut',
          });
        }
      }
      impact(HEAL, c);
      break;
    }
    case 'buff': {
      // 守護／補給：施放者一圈圈氣勢往外擴，隊友腳下金色法陣、光柱與上升的箭頭
      charge(GOLD);
      ring(o.caster, o.caster.r * 3.2, GOLD, c);
      ring(o.caster, o.caster.r * 5, 0xffffff, c + fx * 0.08);
      shock(o.caster, o.caster.r * 4.5, GOLD, c);
      sparks(o.caster, 12, o.caster.r * 4, GOLD, c);
      for (const p of o.allies) {
        glyph(p, p.r * 1.5, GOLD, c + fx * 0.05);
        if (rich) pillar(p, GOLD, c + fx * 0.1);
        ring(p, p.r * 1.5, GOLD, c + fx * 0.12);
        rise(p, 'arrow', GOLD, c + fx * 0.12);
      }
      impact(GOLD, c);
      shake = 0.005;
      break;
    }
    default: {
      // 幸運（連打）：星星從天上砸下來，交叉的爪痕，火花四濺
      const color = o.side === 'team' ? GOLD : 0xff8a5c;
      drop(t, '★', o.side === 'team' ? '#ffd75e' : '#ff8a5c', c - fx * 0.05, 4);
      claw(t, 0.7, color, hitAt);
      claw(t, Math.PI - 0.7, color, hitAt + fx * 0.08);
      claw(t, Math.PI / 2, color, hitAt + fx * 0.16);
      burst(t, t.r * 2.2, color, hitAt + fx * 0.05);
      ring(t, t.r * 2.6, 0xffffff, hitAt + fx * 0.08);
      sparks(t, 14, t.r * 3.6, color, hitAt + fx * 0.05);
      impact(color, hitAt);
      shake = 0.011;
    }
  }
  if (shake > 0) {
    const amount = shake;
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      delay: c + fx * 0.1,
      duration: 1,
      onStart: () => scene.cameras.main.shake(Math.max(60, fx * 0.45), amount),
    });
  }
  return objs;
}
