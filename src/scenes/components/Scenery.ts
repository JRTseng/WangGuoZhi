import Phaser from 'phaser';
import type { Rect } from '../../logic/layout';
import type { Quality } from '../../state/gameState';
import { paintScenery, type SceneryTheme } from './sceneryArt';
import type { Paint } from './sceneryKit';

export type { SceneryTheme };

/** 各畫質的飄落特效數量（低畫質關掉特效，雲、水、霧也都不動） */
export const PARTICLES_BY_QUALITY: Record<Quality, number> = { low: 0, medium: 10, high: 24 };

/**
 * 會動的場景背景（T016：每個場景都是程式畫的原創圖，畫法在 sceneryArt.ts）。
 * 主頁、出征地圖、戰鬥、劇情情境圖都用這個。
 */
export class Scenery extends Phaser.GameObjects.Container {
  /** 這張場景裡有幾個會動的東西（低畫質是 0） */
  readonly moving: number;

  constructor(
    scene: Phaser.Scene,
    area: Rect,
    theme: SceneryTheme,
    quality: Quality,
    /** 地平線位置（0 到 1，從上往下算） */
    horizon = 0.62,
  ) {
    super(scene, area.x, area.y);
    const paint: Paint = {
      scene,
      box: this,
      w: area.width,
      h: area.height,
      hy: Math.round(area.height * horizon),
      live: quality !== 'low',
      count: PARTICLES_BY_QUALITY[quality],
      tweens: [],
    };
    paintScenery(paint, theme);
    this.moving = paint.tweens.length;
    // 場景收掉（例如主頁換背景）時把它開的動畫一起停掉
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      for (const t of paint.tweens) t.stop();
    });
    scene.add.existing(this);
  }
}
