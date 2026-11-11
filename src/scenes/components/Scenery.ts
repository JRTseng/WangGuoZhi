import Phaser from 'phaser';
import type { ThemeId } from '../../data/regions';
import type { Rect } from '../../logic/layout';
import type { Quality } from '../../state/gameState';

export type SceneryTheme = ThemeId | 'city';

interface Palette {
  skyTop: number;
  skyBottom: number;
  far: number;
  near: number;
  ground: number;
  particle: number[];
  night?: boolean;
}

const PALETTES: Record<SceneryTheme, Palette> = {
  slope: {
    skyTop: 0x9fd3f0,
    skyBottom: 0xfbe6c4,
    far: 0xd9a066,
    near: 0xc77a3c,
    ground: 0xe8b872,
    particle: [0xd94f2b, 0xe8892c, 0xf2c14e],
  },
  bamboo: {
    skyTop: 0xcfe8d8,
    skyBottom: 0xf3f6ea,
    far: 0x9cc7a4,
    near: 0x6fa070,
    ground: 0xb7d39b,
    particle: [0x7fb069, 0xa7c957],
  },
  snow: {
    skyTop: 0x1f2b4a,
    skyBottom: 0x5a6f99,
    far: 0xbcc8dd,
    near: 0xe6edf7,
    ground: 0xf4f7fb,
    particle: [0xffffff],
    night: true,
  },
  lantern: {
    skyTop: 0x1b1033,
    skyBottom: 0x6b2d4f,
    far: 0x3a2347,
    near: 0x2c1b33,
    ground: 0x4a2f3d,
    particle: [0xffb347, 0xff7b54, 0xffd56b],
    night: true,
  },
  city: {
    skyTop: 0xa8d8f0,
    skyBottom: 0xfff1d6,
    far: 0xb9a07e,
    near: 0x8f6f4c,
    ground: 0xd9c19b,
    particle: [0xf7c6d0, 0xfde2e7],
  },
};

/** 各畫質的飄落特效數量（低畫質關掉特效、雲也不動） */
export const PARTICLES_BY_QUALITY: Record<Quality, number> = { low: 0, medium: 10, high: 24 };

/**
 * 會動的場景背景（程式畫的佔位圖）：天空漸層、遠山、近景裝飾、雲、飄落特效。
 * 主頁、出征地圖、劇情情境圖都用這個。
 */
export class Scenery extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    area: Rect,
    theme: SceneryTheme,
    quality: Quality,
    /** 地平線位置（0 到 1，從上往下算） */
    horizon = 0.62,
  ) {
    super(scene, area.x, area.y);
    const p = PALETTES[theme];
    const { width: w, height: h } = area;
    const hy = h * horizon;

    const g = scene.add.graphics();
    g.fillGradientStyle(p.skyTop, p.skyTop, p.skyBottom, p.skyBottom, 1);
    g.fillRect(0, 0, w, hy + 4);

    // 太陽／月亮
    if (p.night) {
      g.fillStyle(0xfff6d8, 1);
      g.fillCircle(w * 0.78, h * 0.13, Math.min(w, h) * 0.06);
      g.fillStyle(0xffffff, 0.8);
      for (let i = 0; i < 24; i++) {
        g.fillCircle((((i * 97) % 100) / 100) * w, (((i * 53) % 100) / 100) * hy * 0.7, 1.5);
      }
    } else {
      g.fillStyle(0xfff3c4, 0.9);
      g.fillCircle(w * 0.8, h * 0.12, Math.min(w, h) * 0.07);
    }

    // 遠山
    g.fillStyle(p.far, 1);
    for (let i = -1; i < 5; i++) {
      const cx = (i + 0.5) * (w / 4);
      g.fillEllipse(cx, hy, w * 0.45, h * (theme === 'snow' ? 0.34 : 0.2));
    }
    if (theme === 'snow') {
      // 雪山尖
      g.fillStyle(0xffffff, 1);
      for (let i = 0; i < 4; i++) {
        const cx = (i + 0.5) * (w / 4);
        g.fillTriangle(
          cx - w * 0.06,
          hy - h * 0.12,
          cx + w * 0.06,
          hy - h * 0.12,
          cx,
          hy - h * 0.19,
        );
      }
    }
    // 近景丘陵與地面
    g.fillStyle(p.near, 1);
    g.fillEllipse(w * 0.2, hy + h * 0.02, w * 0.9, h * 0.12);
    g.fillEllipse(w * 0.85, hy + h * 0.03, w * 0.8, h * 0.1);
    g.fillStyle(p.ground, 1);
    g.fillRect(0, hy, w, h - hy);

    this.add(g);
    this.drawDecor(scene, theme, w, h, hy);
    if (quality !== 'low') this.addClouds(scene, w, h, p.night ? 0.25 : 0.85);
    this.addParticles(scene, theme, w, hy, PARTICLES_BY_QUALITY[quality], p.particle);
    scene.add.existing(this);
  }

  private drawDecor(scene: Phaser.Scene, theme: SceneryTheme, w: number, h: number, hy: number) {
    const g = scene.add.graphics();
    const trees = [0.08, 0.26, 0.74, 0.93];
    if (theme === 'slope') {
      for (const tx of trees) {
        const x = tx * w;
        g.fillStyle(0x7a4a2a, 1);
        g.fillRect(x - 4, hy - 30, 8, 40);
        g.fillStyle(0xd9542b, 1);
        g.fillCircle(x, hy - 46, 26);
        g.fillStyle(0xe8892c, 1);
        g.fillCircle(x - 14, hy - 34, 16);
        g.fillCircle(x + 14, hy - 36, 17);
      }
    } else if (theme === 'bamboo') {
      for (let i = 0; i < 12; i++) {
        const x = (((i * 37) % 100) / 100) * w;
        const top = hy - h * (0.25 + ((i * 13) % 10) / 40);
        g.fillStyle(i % 2 ? 0x5e8f5a : 0x76a86b, 1);
        g.fillRect(x - 4, top, 8, hy - top + 10);
        g.fillStyle(0x4b7347, 1);
        for (let y = top + 20; y < hy; y += 34) g.fillRect(x - 5, y, 10, 3);
      }
    } else if (theme === 'snow') {
      for (const tx of trees) {
        const x = tx * w;
        g.fillStyle(0x2f5a4a, 1);
        g.fillTriangle(x - 22, hy + 6, x + 22, hy + 6, x, hy - 50);
        g.fillStyle(0xffffff, 1);
        g.fillTriangle(x - 10, hy - 26, x + 10, hy - 26, x, hy - 50);
      }
    } else if (theme === 'lantern') {
      // 燈籠串
      g.lineStyle(2, 0x2a1a12, 1);
      g.beginPath();
      g.moveTo(0, h * 0.16);
      g.lineTo(w, h * 0.22);
      g.strokePath();
      for (let i = 0; i < 7; i++) {
        const x = ((i + 0.5) / 7) * w;
        const y = h * 0.16 + (h * 0.06 * (i + 0.5)) / 7 + 14;
        g.fillStyle(0xffb347, 0.35);
        g.fillCircle(x, y, 22);
        g.fillStyle(0xe0452b, 1);
        g.fillEllipse(x, y, 22, 28);
        g.fillStyle(0xffd56b, 1);
        g.fillRect(x - 6, y - 16, 12, 4);
      }
      // 遠處屋頂
      g.fillStyle(0x24152b, 1);
      for (const tx of [0.15, 0.5, 0.85]) {
        g.fillRect(tx * w - 34, hy - 30, 68, 34);
        g.fillTriangle(tx * w - 46, hy - 28, tx * w + 46, hy - 28, tx * w, hy - 58);
        g.fillStyle(0xffd56b, 0.8);
        g.fillRect(tx * w - 8, hy - 20, 16, 12);
        g.fillStyle(0x24152b, 1);
      }
    } else if (theme === 'city') {
      // 城牆與城門
      g.fillStyle(0x9b7a55, 1);
      g.fillRect(0, hy - 70, w, 74);
      g.fillStyle(0x7d5f40, 1);
      for (let x = 0; x < w; x += 28) g.fillRect(x, hy - 84, 16, 16);
      g.fillStyle(0x4a3424, 1);
      g.fillRoundedRect(w / 2 - 34, hy - 56, 68, 60, { tl: 30, tr: 30, bl: 0, br: 0 });
      g.fillStyle(0xb5651d, 1);
      g.fillRect(w / 2 - 50, hy - 112, 100, 30);
      g.fillTriangle(w / 2 - 66, hy - 110, w / 2 + 66, hy - 110, w / 2, hy - 140);
    }
    this.add(g);
  }

  private addClouds(scene: Phaser.Scene, w: number, h: number, alpha: number) {
    for (let i = 0; i < 3; i++) {
      const c = scene.add.graphics();
      c.fillStyle(0xffffff, alpha);
      c.fillEllipse(0, 0, 90, 30);
      c.fillEllipse(-26, -6, 50, 30);
      c.fillEllipse(24, -10, 56, 34);
      c.setPosition((((i * 41) % 100) / 100) * w, h * (0.06 + i * 0.07));
      this.add(c);
      scene.tweens
        .add({ targets: c, x: { from: -80, to: w + 80 }, duration: 38_000 + i * 9_000, repeat: -1 })
        .seek(8_000 + i * 12_000);
    }
  }

  private addParticles(
    scene: Phaser.Scene,
    theme: SceneryTheme,
    w: number,
    hy: number,
    count: number,
    colors: number[],
  ) {
    const rising = theme === 'lantern';
    for (let i = 0; i < count; i++) {
      const g = scene.add.graphics();
      g.fillStyle(colors[i % colors.length], rising ? 0.9 : 1);
      if (theme === 'snow') g.fillCircle(0, 0, 2 + (i % 3));
      else if (rising) g.fillEllipse(0, 0, 8, 11);
      else g.fillEllipse(0, 0, 12, 6);
      const x = Phaser.Math.Between(0, w);
      g.setPosition(x, rising ? hy : -10);
      this.add(g);
      const duration = Phaser.Math.Between(5000, 9000);
      scene.tweens
        .add({
          targets: g,
          y: rising ? -20 : hy + 40,
          x: x + Phaser.Math.Between(-60, 60),
          angle: rising ? 0 : 360,
          duration,
          repeat: -1,
        })
        .seek(Phaser.Math.Between(0, duration - 1));
    }
  }
}
