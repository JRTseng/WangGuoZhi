import Phaser from 'phaser';
import type { BattleSide } from '../../logic/battle';
import type { UltKind } from '../../logic/skillShow';
import { addText } from '../ui';
import { drawDogHead } from './dogArt';

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
  caster: ShowPoint & { color: number; accent: number; fierce: boolean };
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
}

/** 字卡配色：我方深藍配金邊，敵方深紅配橘邊 */
const BAND = {
  team: { fill: 0x1d2b4f, edge: 0xf2c14e, text: '#fff3c4' },
  enemy: { fill: 0x4f1d1d, edge: 0xff8a5c, text: '#ffe1d6' },
} as const;
const GOLD = 0xffd75e;
const HEAL = 0x8df07a;

/**
 * 播一次大絕招演出（T017）：壓暗 → 斜的字卡滑進來（大頭、招式名、台詞）→ 字卡滑走 →
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

  // 大頭
  const headR = bandH * 0.36;
  const headX = dir > 0 ? w * 0.2 : w * 0.8;
  const head = scene.add.container(headX, -dir * tilt * 0.6);
  const hg = scene.add.graphics();
  hg.fillStyle(0xffffff, 0.16);
  hg.fillCircle(0, 0, headR * 1.3);
  drawDogHead(hg, 0, headR * 0.08, headR, o.caster.color, o.caster.accent, {
    fierce: o.caster.fierce,
  });
  head.add(hg);
  head.setScale(0.5);
  band.add(head);
  tw.add({
    targets: head,
    scale: 1,
    delay: c * 0.1,
    duration: c * 0.18,
    ease: 'Back.easeOut',
  });

  // 名字 + 招式名（越長字越小，一定放得進去）
  const textX = dir > 0 ? headX + headR + 18 : headX - headR - 18;
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

  let shake = 0;
  const t = o.target;
  switch (o.kind) {
    case 'pierce': {
      const angle = Math.atan2(t.y - o.caster.y, t.x - o.caster.x);
      beam(o.caster, angle, w + h, 16, 0xfff2a8, c);
      beam(o.caster, angle, w + h, 5, 0xffffff, c);
      burst(t, t.r * 1.9, GOLD, c + fx * 0.1);
      shake = 0.009;
      break;
    }
    case 'row': {
      o.foes.forEach((p, i) => {
        const delay = c + i * fx * 0.09;
        beam({ x: p.x, y: top }, Math.PI / 2, p.y - top, 9, 0xd9c8ff, delay);
        burst(p, p.r * (p === t ? 1.9 : 1.2), 0xb99cff, delay + fx * 0.12);
      });
      if (!o.foes.includes(t)) burst(t, t.r * 1.9, 0xb99cff, c + fx * 0.12);
      shake = 0.007;
      break;
    }
    case 'heal': {
      for (const p of o.allies) {
        ring(p, p.r * 1.7, HEAL, c);
        rise(p, 'plus', HEAL, c + fx * 0.05);
      }
      break;
    }
    case 'buff': {
      ring(o.caster, o.caster.r * 3.2, GOLD, c);
      for (const p of o.allies) {
        ring(p, p.r * 1.5, GOLD, c + fx * 0.1);
        rise(p, 'arrow', GOLD, c + fx * 0.1);
      }
      break;
    }
    default: {
      beam({ x: t.x - t.r * 2, y: t.y - t.r * 1.4 }, 0.6, t.r * 4.6, 6, 0xffffff, c);
      beam(
        { x: t.x + t.r * 2, y: t.y - t.r * 1.4 },
        Math.PI - 0.6,
        t.r * 4.6,
        6,
        0xffffff,
        c + fx * 0.08,
      );
      burst(t, t.r * 2.2, o.side === 'team' ? GOLD : 0xff8a5c, c + fx * 0.1);
      shake = 0.009;
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
