import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../../config';
import type { GearData } from '../../data/equipment';
import type { UltPose } from '../../logic/ultPose';
import { breedArtOf } from './breedArt';
import { drawDogHead, drawEyes } from './dogArt';
import { drawBandage, drawBodyGear, drawHeadGearFront } from './gearArt';
import { PHOTO_HEAD_LIFT, PHOTO_HEAD_SIDE, photoArtOf } from './photoArt';
import { pixelize } from './pixelStage';

/** 主頁狗狗會輪流做的動作 */
export const DOG_ACTIONS = ['idle', 'wag', 'hop', 'look', 'sit', 'sleep'] as const;
export type DogAction = (typeof DOG_ACTIONS)[number] | 'lick';
/** 剛出征回來、掛彩的狗輪流做的動作：多半在舔傷口、坐著、打盹（T014） */
export const HURT_ACTIONS: readonly DogAction[] = ['lick', 'sit', 'lick', 'sleep', 'lick', 'idle'];

export interface DogLook {
  color: number;
  accent: number;
  fierce?: boolean;
  /** 身上穿的裝備（T014），會畫在身體與頭上 */
  gear?: readonly GearData[];
  /** 受傷外觀（T014）：1 貼 OK 繃；2 再加頭套 */
  hurt?: 0 | 1 | 2;
  /** 犬種（T025）：有照犬種畫好的就用那個犬種的體型、花紋與尾巴 */
  breed?: string;
  /**
   * 像素畫風（T025）：一格像素等於狗自己座標的幾點（畫面上想要的像素大小除以狗的縮放）。
   * 站在像素場景裡的狗要給，才會和背景同一種質感；不給就是平滑的線條（卡片、倉庫用）。
   */
  pixel?: number;
  /** 角色 id（T035）：這隻角色有圖檔就整隻用圖檔（正面站姿），動作用彈跳、搖晃、壓扁來做 */
  photo?: string;
}

/**
 * 全身佔位狗狗（側身站姿），原點在腳底中央。
 * 頭、尾巴、身體分開，可以各自動：呼吸、搖尾巴、跳、東張西望、坐下、打盹。
 * 以 setScale 調整大小（基準約 150 x 130）。
 */
export class DogSprite extends Phaser.GameObjects.Container {
  private readonly rig: Phaser.GameObjects.Container;
  private readonly head: Phaser.GameObjects.Container;
  private readonly tail: Phaser.GameObjects.Container;
  private readonly lids: Phaser.GameObjects.Graphics | Phaser.GameObjects.RenderTexture;
  private readonly zzz: Phaser.GameObjects.Text;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  /** 像素畫風時身上各部位的像素圖（染光線顏色用） */
  private readonly pixParts: Phaser.GameObjects.RenderTexture[] = [];
  /** 圖檔角色的那張圖（沒有圖檔的是 null） */
  private readonly photo: Phaser.GameObjects.Image | null = null;
  private tweensRunning: Phaser.Tweens.Tween[] = [];
  private cycle: (() => void) | null = null;
  private current: DogAction = 'idle';
  private index = 0;
  onActionChange: ((a: DogAction) => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, look: DogLook) {
    super(scene, x, y);
    const { color, accent } = look;
    const line = COLORS.inkHex;

    this.shadow = scene.add.ellipse(0, 0, 130, 22, 0x000000, 0.18);
    this.rig = scene.add.container(0, 0);

    const photo = photoArtOf(look.photo);
    if (photo) {
      // 圖檔角色：整隻是一張圖，不拍成像素（要看的就是圖本身）；頭、尾巴不能分開動
      const H = photo.height;
      const W = H * photo.aspect;
      this.shadow.setSize(W * 1.05, 20).setOrigin(0.5);
      this.photo = scene.add.image(0, 0, `${photo.key}-body`).setOrigin(0.5, 1);
      this.photo.setDisplaySize(W, H);
      // 頭飾與 OK 繃照臉的位置畫上去；衣服褲子鞋子手套是照側身畫的，對不上正面站姿，先不畫
      const r = (photo.face.half * 2 * H) / PHOTO_HEAD_SIDE;
      const fx = photo.face.x * H - W / 2;
      const fy = photo.face.y * H - H + r * PHOTO_HEAD_LIFT;
      const og = scene.add.graphics();
      const worn = look.gear ?? [];
      const wound = look.hurt ?? 0;
      drawHeadGearFront(og, worn, r, fx, fy);
      if (wound > 0) {
        drawBandage(og, fx - r * 0.42, fy - r * 0.5, r * 0.62, -0.5);
        drawBandage(og, W * 0.1, -H * 0.3, 22, 0.5);
      }
      if (wound === 2) drawBandage(og, fx + r * 0.58, fy + r * 0.42, r * 0.5, 0.6);
      this.head = scene.add.container(46, -96);
      this.tail = scene.add.container(-52, -62);
      this.lids = scene.add.graphics().setVisible(false);
      this.zzz = this.makeZzz(scene);
      this.rig.add([this.photo, og, this.zzz]);
      this.addSparkles(scene, worn);
      this.add([this.shadow, this.rig]);
      scene.add.existing(this);
      return;
    }

    // 尾巴（以根部為原點旋轉）
    const art = breedArtOf(look.breed);
    this.tail = scene.add.container(art?.tailAt?.x ?? -52, art?.tailAt?.y ?? -62);
    const tg = scene.add.graphics();
    const pal = { main: color, under: accent };
    if (art) {
      art.tail(tg, pal);
    } else {
      tg.fillStyle(color, 1);
      tg.lineStyle(3, line, 1);
      tg.fillEllipse(-10, -16, 18, 40);
      tg.strokeEllipse(-10, -16, 18, 40);
    }
    this.tail.add(tg);
    this.tail.setAngle(-20);

    const body = scene.add.graphics();
    if (art) {
      art.body(body, pal);
    } else {
      body.fillStyle(color, 1);
      body.lineStyle(3, line, 1);
      // 後腳、前腳
      for (const lx of [-40, -22, 22, 40]) {
        body.fillRoundedRect(lx - 8, -36, 16, 36, 6);
        body.strokeRoundedRect(lx - 8, -36, 16, 36, 6);
      }
      body.fillEllipse(0, -56, 120, 58);
      body.strokeEllipse(0, -56, 120, 58);
      body.fillStyle(accent, 1);
      body.fillEllipse(18, -44, 56, 26);

      // 腳掌的毛色（T014 美化）
      body.fillStyle(accent, 1);
      for (const lx of [-40, -22, 22, 40]) body.fillRoundedRect(lx - 6.5, -11, 13, 9.5, 4);
    }

    // 裝備（T014）：衣服、褲子、鞋子、手套畫在身體上
    const bodyGear = scene.add.graphics();
    const gear = look.gear ?? [];
    const hurt = look.hurt ?? 0;
    drawBodyGear(bodyGear, gear);
    // 受傷外觀：身上貼 OK 繃
    if (hurt > 0) drawBandage(bodyGear, -14, -66, 26, 0.5);
    if (hurt === 2) drawBandage(bodyGear, 30, -22, 20, -0.4);

    this.head = scene.add.container(46, -96);
    const hg = scene.add.graphics();
    drawDogHead(hg, 0, 0, 36, color, accent, {
      fierce: look.fierce,
      gear,
      hurt,
      breed: look.breed,
    });
    // 頭飾畫在頭上之後，閉眼的眼皮要蓋在最上面
    this.lids = scene.add.graphics();
    if (art) {
      // 眼皮：用那個犬種眼睛周圍的毛色蓋住張開的眼睛，再畫閉起來的弧線
      const e = art.eye;
      this.lids.fillStyle(e.lid(pal), 1);
      this.lids.fillCircle(-e.dx * 36, e.dy * 36, e.r * 36 + 2);
      this.lids.fillCircle(e.dx * 36, e.dy * 36, e.r * 36 + 2);
      this.lids.lineStyle(2.6, COLORS.inkHex, 1);
      for (const side of [-1, 1]) {
        this.lids.beginPath();
        this.lids.arc(side * e.dx * 36, e.dy * 36 - 1, 3.8, 0.15 * Math.PI, 0.85 * Math.PI);
        this.lids.strokePath();
      }
    } else {
      this.lids.fillStyle(color, 1);
      this.lids.fillCircle(-12.6, -5.4, 6);
      this.lids.fillCircle(12.6, -5.4, 6);
      drawEyes(this.lids, 0, 0, 36, true);
    }
    this.lids.setVisible(false);
    this.head.add([hg, this.lids]);

    // 像素畫風：尾巴、身體、裝備、頭、眼皮各自拍成像素圖，一樣可以分開動
    const bodyPix: Phaser.GameObjects.RenderTexture[] = [];
    if (look.pixel) {
      const px = look.pixel;
      this.tail.add(pixelize(scene, tg, { x: -44, y: -68, width: 92, height: 88 }, px));
      const wide = { x: -96, y: -124, width: 192, height: 134 };
      bodyPix.push(pixelize(scene, body, wide, px), pixelize(scene, bodyGear, wide, px));
      const around = { x: -76, y: -92, width: 152, height: 164 };
      const lids = this.lids as Phaser.GameObjects.Graphics;
      this.head.add(pixelize(scene, hg, around, px));
      this.lids = pixelize(scene, lids, { x: -24, y: -16, width: 48, height: 24 }, px);
      this.lids.setVisible(false);
      this.head.add(this.lids);
      this.pixParts.push(
        ...bodyPix,
        ...(this.tail.list as Phaser.GameObjects.RenderTexture[]).slice(1),
        ...(this.head.list as Phaser.GameObjects.RenderTexture[]).slice(2),
      );
    }

    this.zzz = this.makeZzz(scene);

    this.rig.add([this.tail, body, bodyGear, ...bodyPix, this.head, this.zzz]);
    this.addSparkles(scene, gear);
    this.add([this.shadow, this.rig]);
    scene.add.existing(this);
  }

  private makeZzz(scene: Phaser.Scene): Phaser.GameObjects.Text {
    return scene.add
      .text(70, -150, 'Z z z', {
        fontFamily: FONT_FAMILY,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#3b2a1a',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setVisible(false);
  }

  /** 穿著專屬裝備：身邊有幾顆閃閃的星星（SSR 金色、SR 紫色） */
  private addSparkles(scene: Phaser.Scene, gear: readonly GearData[]): void {
    const special = gear.find((x) => x.exclusive);
    if (special) {
      const tint = special.rarity === 'SSR' ? '#f4c430' : '#c39bd3';
      [
        [-66, -112, 20],
        [84, -62, 16],
        [-18, -150, 14],
      ].forEach(([sx, sy, size], i) => {
        const star = scene.add
          .text(sx, sy, '✦', {
            fontFamily: FONT_FAMILY,
            fontSize: `${size}px`,
            color: tint,
            stroke: '#ffffff',
            strokeThickness: 3,
          })
          .setOrigin(0.5);
        this.rig.add(star);
        scene.tweens.add({
          targets: star,
          alpha: 0.15,
          scale: 0.6,
          duration: 700,
          delay: i * 260,
          yoyo: true,
          repeat: -1,
        });
      });
    }
  }

  /** 讓狗跟著場景的光線染一點顏色（黃昏偏橘、夜晚偏藍）；只有像素畫風的狗有用 */
  setLight(color: number): this {
    for (const part of this.pixParts) part.setTint(color);
    this.photo?.setTint(color);
    return this;
  }

  get action(): DogAction {
    return this.current;
  }

  /** 每隔 intervalMs 換下一個動作；actions 沒給就是平常那一輪 */
  startCycle(intervalMs: number, actions: readonly DogAction[] = DOG_ACTIONS): this {
    this.play(actions[0]);
    // 用實際時間判斷，不用 Phaser 計時器：手機卡頓或掉幀時遊戲時間會變慢，動作會停太久
    let last = Date.now();
    this.cycle = () => {
      const now = Date.now();
      if (now - last < intervalMs) return;
      last = now;
      this.index = (this.index + 1) % actions.length;
      this.play(actions[this.index]);
    };
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.cycle);
    return this;
  }

  play(action: DogAction): this {
    this.reset();
    this.current = action;
    const t = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) =>
      this.tweensRunning.push(this.scene.tweens.add(cfg));

    switch (action) {
      case 'idle':
        t({ targets: this.rig, scaleY: 1.03, duration: 700, yoyo: true, repeat: -1 });
        t({ targets: this.tail, angle: -5, duration: 900, yoyo: true, repeat: -1 });
        break;
      case 'wag':
        t({
          targets: this.tail,
          angle: { from: -45, to: 15 },
          duration: 140,
          yoyo: true,
          repeat: -1,
        });
        t({ targets: this.head, angle: 8, duration: 400, yoyo: true, repeat: -1 });
        break;
      case 'hop':
        t({
          targets: this.rig,
          y: -36,
          duration: 260,
          yoyo: true,
          repeat: -1,
          repeatDelay: 220,
          ease: 'Quad.easeOut',
        });
        t({
          targets: this.shadow,
          scaleX: 0.7,
          duration: 260,
          yoyo: true,
          repeat: -1,
          repeatDelay: 220,
          ease: 'Quad.easeOut',
        });
        t({ targets: this.tail, angle: 10, duration: 160, yoyo: true, repeat: -1 });
        break;
      case 'look':
        t({
          targets: this.head,
          angle: { from: -14, to: 14 },
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;
      case 'sit':
        this.rig.setScale(1.04, 0.86);
        this.head.y = -90;
        t({
          targets: this.tail,
          angle: { from: -30, to: 0 },
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
        t({ targets: this.head, angle: -10, duration: 1000, yoyo: true, repeat: -1 });
        break;
      case 'lick':
        // 舔傷口：坐下來，低頭一下一下地舔前腳
        this.rig.setScale(1.04, 0.88);
        this.head.setPosition(50, -78);
        t({
          targets: this.head,
          angle: { from: 18, to: 34 },
          y: -70,
          duration: 380,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        t({ targets: this.tail, angle: -8, duration: 900, yoyo: true, repeat: -1 });
        break;
      case 'sleep':
        this.rig.setScale(1.06, 0.8);
        this.head.y = -82;
        this.head.setAngle(12);
        this.lids.setVisible(true);
        this.zzz.setVisible(true).setAlpha(0);
        t({ targets: this.rig, scaleY: 0.83, duration: 1200, yoyo: true, repeat: -1 });
        t({ targets: this.zzz, alpha: 1, y: -170, duration: 1400, repeat: -1 });
        break;
    }
    if (this.photo) {
      // 圖檔角色的頭和尾巴不能分開動，改成整隻搖一搖
      const sway = (from: number, to: number, duration: number) =>
        t({
          targets: this.rig,
          angle: { from, to },
          duration,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      if (action === 'wag') sway(-5, 5, 260);
      else if (action === 'look') sway(-7, 7, 800);
      else if (action === 'sit') sway(-3, 3, 1000);
      else if (action === 'lick') sway(4, 10, 380);
    }
    this.onActionChange?.(action);
    return this;
  }

  /**
   * 大絕招的專屬姿勢（見 src/logic/ultPose.ts）：ms 是整段擺姿勢的時間，
   * 前面約四分之一是預備動作，後面是定格加一點小動作。lean 是這隻狗自己的傾斜角度。
   */
  ultPose(pose: UltPose, lean: number, ms: number): this {
    this.reset();
    const t = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) =>
      this.tweensRunning.push(this.scene.tweens.add(cfg));
    const { rig, head, tail, shadow } = this;
    const wind = Math.max(1, ms * 0.25);
    const rest = Math.max(1, ms - wind);
    const beat = Math.max(40, ms * 0.09);
    rig.setAngle(lean * 0.4);
    switch (pose) {
      case 'pounce':
        rig.setScale(1.08, 0.82).setX(-26);
        t({
          targets: rig,
          scaleX: 1,
          scaleY: 1,
          x: 30,
          y: -34,
          angle: -18 + lean,
          duration: wind,
          ease: 'Back.easeOut',
        });
        t({
          targets: rig,
          y: -22,
          duration: beat * 2,
          delay: wind,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        t({ targets: shadow, scaleX: 0.7, duration: wind });
        tail.setAngle(25);
        head.setAngle(10);
        break;
      case 'howl':
        t({ targets: head, angle: -40 + lean, y: -104, duration: wind, ease: 'Back.easeOut' });
        t({ targets: rig, scaleY: 1.06, duration: beat * 2, delay: wind, yoyo: true, repeat: -1 });
        t({ targets: tail, angle: { from: -50, to: -30 }, duration: beat, yoyo: true, repeat: -1 });
        break;
      case 'rear':
        t({
          targets: rig,
          angle: -40 + lean,
          y: -10,
          x: -10,
          duration: wind,
          ease: 'Back.easeOut',
        });
        t({ targets: head, angle: 24, duration: wind });
        t({ targets: rig, y: -18, duration: beat * 1.5, delay: wind, yoyo: true, repeat: -1 });
        tail.setAngle(-55);
        break;
      case 'crouch':
        t({
          targets: rig,
          scaleX: 1.1,
          scaleY: 0.76,
          angle: 6 + lean,
          duration: wind,
          ease: 'Quad.easeOut',
        });
        t({ targets: head, y: -78, angle: 12, duration: wind });
        t({
          targets: rig,
          x: { from: -3, to: 3 },
          duration: Math.max(30, beat * 0.3),
          delay: wind,
          yoyo: true,
          repeat: -1,
        });
        t({
          targets: tail,
          angle: { from: -45, to: 10 },
          duration: beat * 0.8,
          yoyo: true,
          repeat: -1,
        });
        break;
      case 'spin':
        t({
          targets: rig,
          y: -44,
          duration: ms * 0.3,
          yoyo: true,
          hold: ms * 0.2,
          ease: 'Quad.easeOut',
        });
        t({ targets: rig, angle: -360 + lean, duration: ms * 0.6, ease: 'Cubic.easeOut' });
        t({ targets: shadow, scaleX: 0.6, duration: ms * 0.3, yoyo: true, hold: ms * 0.2 });
        t({ targets: tail, angle: 30, duration: beat, yoyo: true, repeat: -1 });
        break;
      case 'guard':
        t({ targets: rig, scaleX: 1.14, scaleY: 1.1, duration: wind, ease: 'Back.easeOut' });
        t({ targets: head, angle: -10 + lean, duration: wind });
        t({
          targets: rig,
          y: -8,
          duration: beat,
          delay: wind,
          yoyo: true,
          repeat: 2,
          repeatDelay: rest * 0.2,
          ease: 'Quad.easeIn',
        });
        tail.setAngle(-60);
        break;
      case 'leap':
        rig.setScale(1.06, 0.84);
        t({
          targets: rig,
          scaleX: 1,
          scaleY: 1,
          y: -64,
          angle: 14 + lean,
          duration: wind,
          ease: 'Cubic.easeOut',
        });
        t({
          targets: rig,
          y: -54,
          duration: beat * 2,
          delay: wind,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        t({ targets: shadow, scaleX: 0.5, duration: wind });
        t({ targets: tail, angle: 20, duration: beat, yoyo: true, repeat: -1 });
        break;
      case 'tailwhip':
        t({ targets: rig, scaleX: -1, duration: wind * 0.6, ease: 'Sine.easeInOut' });
        t({ targets: rig, angle: 8 + lean, duration: wind });
        t({
          targets: tail,
          angle: { from: -70, to: 40 },
          duration: beat * 0.7,
          yoyo: true,
          repeat: -1,
        });
        t({ targets: head, angle: -16, duration: beat * 2, delay: wind, yoyo: true, repeat: -1 });
        break;
      case 'paw':
        t({
          targets: rig,
          scaleX: 1.04,
          scaleY: 0.86,
          angle: -12 + lean,
          duration: wind,
          ease: 'Back.easeOut',
        });
        head.setY(-90);
        t({
          targets: head,
          angle: { from: -14, to: 14 },
          duration: beat * 1.2,
          delay: wind * 0.5,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        t({ targets: tail, angle: { from: -40, to: 10 }, duration: beat, yoyo: true, repeat: -1 });
        break;
      case 'roll':
        rig.setX(-40);
        t({ targets: rig, x: 34, angle: 360 + lean, duration: ms * 0.55, ease: 'Cubic.easeOut' });
        t({
          targets: rig,
          y: -22,
          duration: ms * 0.14,
          yoyo: true,
          repeat: 1,
          ease: 'Quad.easeOut',
        });
        t({ targets: tail, angle: 25, duration: beat, delay: ms * 0.55, yoyo: true, repeat: -1 });
        break;
      case 'dash':
        rig.setX(-90).setScale(1.3, 0.88);
        t({
          targets: rig,
          x: 24,
          scaleX: 1.08,
          scaleY: 0.96,
          angle: -8 + lean,
          duration: wind,
          ease: 'Cubic.easeOut',
        });
        t({ targets: rig, x: 34, duration: beat * 0.5, delay: wind, yoyo: true, repeat: -1 });
        tail.setAngle(-80);
        head.setAngle(8);
        break;
      case 'snooze':
        rig.setScale(1.06, 0.8);
        head.setY(-82).setAngle(12);
        this.lids.setVisible(true);
        this.zzz.setVisible(true);
        t({ targets: this.zzz, y: -176, alpha: { from: 1, to: 0 }, duration: ms * 0.45 });
        // 驚醒：睜眼、彈起來
        this.tweensRunning.push(
          this.scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 1,
            delay: ms * 0.45,
            onComplete: () => {
              if (!this.active) return;
              this.lids.setVisible(false);
              this.zzz.setVisible(false);
            },
          }),
        );
        t({
          targets: rig,
          scaleX: 1,
          scaleY: 1,
          y: -30,
          duration: ms * 0.12,
          delay: ms * 0.45,
          yoyo: true,
          ease: 'Quad.easeOut',
        });
        t({ targets: head, y: -100, angle: -14 + lean, duration: ms * 0.12, delay: ms * 0.45 });
        t({ targets: tail, angle: 20, duration: beat, delay: ms * 0.5, yoyo: true, repeat: -1 });
        break;
    }
    if (this.photo && (pose === 'howl' || pose === 'paw')) {
      // 這兩個姿勢原本只動頭，圖檔角色改成整隻往後仰再晃
      t({
        targets: rig,
        angle: { from: -12 + lean, to: 6 + lean },
        duration: beat * 1.6,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    return this;
  }

  private reset(): void {
    for (const tw of this.tweensRunning) tw.stop();
    this.tweensRunning = [];
    this.rig.setScale(1).setPosition(0, 0).setAngle(0);
    this.shadow.setScale(1);
    this.head.setAngle(0).setPosition(46, -96);
    this.tail.setAngle(-20);
    this.lids.setVisible(false);
    this.zzz.setVisible(false).setPosition(70, -150);
  }

  override destroy(fromScene?: boolean): void {
    if (this.cycle) this.scene?.events.off(Phaser.Scenes.Events.UPDATE, this.cycle);
    this.cycle = null;
    for (const tw of this.tweensRunning) tw.stop();
    super.destroy(fromScene);
  }
}
