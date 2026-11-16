import Phaser from 'phaser';
import {
  FAR_BLUR,
  MOTES_BY_QUALITY,
  NEAR_BLUR,
  PIXEL_REDRAW_MS,
  PIXEL_SIZE,
  moodAt,
  rayAngles,
  type DayTime,
  type Mood,
} from '../../logic/atmosphere';
import type { Rect } from '../../logic/layout';
import { bakeScaleFor, renderScale } from '../../logic/resolution';
import { seeded } from '../../logic/sceneryShapes';
import type { Quality } from '../../state/gameState';
import { TEX_GLOW, TEX_RAY, TEX_VIGNETTE, blurSheet, ensureLightTextures } from './pixelStage';
import { paintScenery, type SceneryTheme } from './sceneryArt';
import { bakeLayers, type Paint } from './sceneryKit';

export type { SceneryTheme };

/** 各畫質的飄落特效數量（低畫質關掉特效，雲、水、霧也都不動） */
export const PARTICLES_BY_QUALITY: Record<Quality, number> = { low: 0, medium: 10, high: 24 };

const ADD = Phaser.BlendModes.ADD;

/**
 * 會動的場景背景（T016：每個場景都是程式畫的原創圖，畫法在 sceneryArt.ts）。
 * 主頁、出征地圖、戰鬥、劇情情境圖都用這個。
 *
 * 像素立體光影（T025）：由後往前疊成
 *   1. 遠景（天空、遠山）：像素圖再模糊，像相機對焦在前面、後面失焦
 *   2. 中景：整個場景照小小的像素尺寸畫，再用最近點放大，一格一格的像素感；會動的東西也在裡面
 *   3. 時段色調、地平線的霧氣、光源的柔光、光束、飄在空中的光點
 *   4. 最前面失焦的草叢、四角的暗角
 * 模糊都是建立時算一次，之後每一格只是貼幾張圖；低畫質完全不動。
 */
export class Scenery extends Phaser.GameObjects.Container {
  /** 這張場景裡有幾個會動的東西（低畫質是 0） */
  readonly moving: number;
  /** 這張場景用的時段 */
  readonly time: DayTime;
  /** 時段的色調（白色等於沒有）；站在場景裡的狗可以跟著染一點 */
  readonly tint: number;
  private readonly stack: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    area: Rect,
    theme: SceneryTheme,
    quality: Quality,
    /** 地平線位置（0 到 1，從上往下算） */
    horizon = 0.62,
    /** 時段（主頁跟著手機的時間；其他畫面用白天） */
    time: DayTime = 'day',
  ) {
    super(scene, area.x, area.y);
    this.time = time;
    // 所有圖層先疊在這裡面（低畫質最後會整疊壓成一張圖）
    const stack = (this.stack = scene.make.container({ x: 0, y: 0 }, false));
    // make.container 會把混色模式設成「一般」，裡面的加亮、相乘就不會生效；改回「照每個子物件自己的」
    stack.setBlendMode(Phaser.BlendModes.SKIP_CHECK);
    super.add(stack);
    ensureLightTextures(scene);
    const px = PIXEL_SIZE;
    const { width: w, height: h } = area;
    // 場景的東西都畫進這個容器；它不直接上畫面，而是每隔一小段時間整個畫進像素圖
    const world = scene.make.container({ x: 0, y: 0 }, false);
    const paint: Paint = {
      scene,
      box: world,
      w,
      h,
      hy: Math.round(h * horizon),
      live: quality !== 'low',
      count: PARTICLES_BY_QUALITY[quality],
      tweens: [],
      still: new Set(),
    };
    paintScenery(paint, theme);
    const mood = moodAt(theme, time);
    this.tint = mood.tint;

    // 1. 遠景失焦
    const far = bakeLayers(paint, px);
    if (far) stack.add(blurSheet(scene, far, FAR_BLUR).setScale(px));

    // 2. 像素中景
    const pw = Math.ceil(w / px);
    const ph = Math.ceil(h / px);
    const pix = scene.make.renderTexture({ x: 0, y: 0, width: pw, height: ph }, false);
    pix.setOrigin(0, 0).setScale(px);
    pix.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    world.setScale(1 / px);
    const redraw = () => {
      pix.clear();
      pix.draw(world, 0, 0);
    };
    redraw();
    stack.add(pix);

    // 3. 光影
    this.addLights(paint, mood, quality);

    // 4. 近景失焦與暗角
    this.addForeground(paint, mood, px);
    stack.add(
      scene.make
        .image({ x: 0, y: 0, key: TEX_VIGNETTE }, false)
        .setOrigin(0, 0)
        .setDisplaySize(w, h)
        .setAlpha(mood.vignette),
    );

    this.moving = paint.tweens.length;

    // 低畫質：什麼都不會動，整疊壓成一張圖，之後每一格只貼這一張（最省電）
    if (!paint.live) {
      const k = bakeScaleFor(renderScale.value);
      const flat = scene.make.renderTexture(
        { x: 0, y: 0, width: Math.ceil(w * k), height: Math.ceil(h * k) },
        false,
      );
      stack.setScale(k);
      flat.draw(stack, 0, 0);
      flat.setOrigin(0, 0).setScale(1 / k);
      stack.destroy();
      super.add(flat);
    }

    // 會動的場景：定時把整個場景重畫進像素圖
    let wait = 0;
    const onTick = (_t: number, delta: number) => {
      wait += delta;
      if (wait < PIXEL_REDRAW_MS) return;
      wait = 0;
      redraw();
    };
    if (paint.live) scene.events.on(Phaser.Scenes.Events.POST_UPDATE, onTick);

    // 場景收掉（例如主頁換背景）時把它開的動畫一起停掉
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, onTick);
      for (const t of paint.tweens) t.stop();
      world.destroy();
    });
    scene.add.existing(this);
  }

  private glow(x: number, y: number, w: number, h: number, color: number, alpha: number) {
    const img = this.scene.make
      .image({ x, y, key: TEX_GLOW }, false)
      .setDisplaySize(w, h)
      .setTint(color)
      .setAlpha(alpha)
      .setBlendMode(ADD);
    this.stack.add(img);
    return img;
  }

  private addLights(p: Paint, mood: Mood & { tint: number }, quality: Quality): void {
    const { scene, w, h, hy } = p;
    const play = (config: Phaser.Types.Tweens.TweenBuilderConfig, seekMs = 0) => {
      const t = scene.tweens.add(config);
      if (seekMs > 0) t.seek(seekMs);
      p.tweens.push(t);
    };
    // 時段色調：整張場景乘上一個顏色
    if (mood.tint !== 0xffffff) {
      this.stack.add(
        scene.make
          .image({ x: 0, y: 0, key: '__WHITE' }, false)
          .setOrigin(0, 0)
          .setDisplaySize(w, h)
          .setTint(mood.tint)
          .setBlendMode(Phaser.BlendModes.MULTIPLY),
      );
    }
    // 地平線的霧氣：遠的地方泛一層光，景才有深度
    this.glow(w / 2, hy, w * 1.7, h * 0.62, mood.haze, mood.hazeAlpha);

    // 光源的柔光
    const sx = (mood.sun?.x ?? 0.5) * w;
    const sy = mood.sun ? mood.sun.y * hy : -30;
    if (mood.sun) {
      const bloom = this.glow(sx, sy, 300, 300, mood.light, 0.5);
      if (p.live) {
        play({
          targets: bloom,
          alpha: { from: 0.5, to: 0.36 },
          duration: 3600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }

    // 光束：從光源往畫面中間灑下來，慢慢地明暗、微微擺動
    const rnd = seeded(Math.round(sx) * 7 + p.hy);
    rayAngles(mood.sun?.x ?? 0.35, mood.rays).forEach((angle, i) => {
      const len = h * 1.5 + rnd() * h * 0.3;
      const wide = 36 + rnd() * 54;
      const top = mood.rayAlpha * (0.55 + rnd() * 0.45);
      const ray = scene.make
        .image({ x: mood.sun ? sx : (0.2 + rnd() * 0.5) * w, y: sy, key: TEX_RAY }, false)
        .setOrigin(0.5, 0)
        .setDisplaySize(wide, len)
        .setAngle(angle)
        .setTint(mood.light)
        .setAlpha(top)
        .setBlendMode(ADD);
      this.stack.add(ray);
      if (!p.live) return;
      const duration = 4200 + rnd() * 3800;
      play(
        {
          targets: ray,
          alpha: { from: top, to: top * 0.35 },
          angle: { from: angle, to: angle + (i % 2 ? 2.2 : -2.2) },
          duration,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        },
        rnd() * duration,
      );
    });

    // 飄在空中的光點（灰塵、花粉、螢火蟲）
    for (let i = 0; i < MOTES_BY_QUALITY[quality]; i++) {
      const x = rnd() * w;
      const y = h * (0.12 + rnd() * 0.8);
      const size = 5 + rnd() * 9;
      const mote = this.glow(x, y, size, size, mood.mote, 0);
      const duration = 3800 + rnd() * 4200;
      play(
        {
          targets: mote,
          alpha: { from: 0, to: 0.55 + rnd() * 0.4 },
          x: { from: x, to: x + (rnd() - 0.5) * 46 },
          y: { from: y, to: y - 10 - rnd() * 26 },
          duration,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        },
        rnd() * duration,
      );
    }
  }

  /** 最前面失焦的草叢：畫面左下、右下兩個角落，離鏡頭太近所以是糊的 */
  private addForeground(p: Paint, mood: Mood, px: number): void {
    const { scene, w, h } = p;
    const g = scene.make.graphics({}, false);
    const rnd = seeded(p.hy * 13 + Math.round(w));
    for (const side of [0, 1]) {
      const n = 22;
      for (let i = 0; i < n; i++) {
        // 越靠畫面邊緣越高、越密
        const t = rnd() * rnd();
        const x = side === 0 ? t * w * 0.24 : w - t * w * 0.24;
        const tall = (1 - t) * (34 + rnd() * 46) + 8;
        const lean = (rnd() - 0.5) * 26 + (side === 0 ? 8 : -8);
        const half = 4 + rnd() * 5;
        g.fillStyle(mood.fore, 0.92);
        g.fillTriangle(x - half, h + 6, x + half, h + 6, x + lean, h - tall);
      }
      // 一團矮矮的葉叢
      for (let i = 0; i < 5; i++) {
        const t = rnd() * 0.16;
        const x = side === 0 ? t * w : w - t * w;
        g.fillStyle(mood.fore, 0.92);
        g.fillEllipse(x, h + 2, 40 + rnd() * 40, 22 + rnd() * 26);
      }
    }
    const sheet = scene.make.renderTexture(
      { x: 0, y: 0, width: Math.ceil(w / px), height: Math.ceil(h / px) },
      false,
    );
    g.setScale(1 / px);
    sheet.draw(g, 0, 0);
    g.destroy();
    const fore = blurSheet(scene, sheet, NEAR_BLUR).setScale(px);
    this.stack.add(fore);
    if (!p.live) return;
    p.tweens.push(
      scene.tweens.add({
        targets: fore,
        x: { from: -2, to: 3 },
        duration: 5200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    );
  }
}
