import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../../config';
import type { GearData } from '../../data/equipment';
import { drawDogHead, drawEyes } from './dogArt';
import { drawBodyGear, drawHeadGear } from './gearArt';

/** 主頁狗狗會輪流做的動作 */
export const DOG_ACTIONS = ['idle', 'wag', 'hop', 'look', 'sit', 'sleep'] as const;
export type DogAction = (typeof DOG_ACTIONS)[number];

export interface DogLook {
  color: number;
  accent: number;
  fierce?: boolean;
  /** 身上穿的裝備（T014），會畫在身體與頭上 */
  gear?: readonly GearData[];
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
  private readonly lids: Phaser.GameObjects.Graphics;
  private readonly zzz: Phaser.GameObjects.Text;
  private readonly shadow: Phaser.GameObjects.Ellipse;
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

    // 尾巴（以根部為原點旋轉）
    this.tail = scene.add.container(-52, -62);
    const tg = scene.add.graphics();
    tg.fillStyle(color, 1);
    tg.lineStyle(3, line, 1);
    tg.fillEllipse(-10, -16, 18, 40);
    tg.strokeEllipse(-10, -16, 18, 40);
    this.tail.add(tg);
    this.tail.setAngle(-20);

    const body = scene.add.graphics();
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

    // 裝備（T014）：衣服、褲子、鞋子、手套畫在身體上
    const bodyGear = scene.add.graphics();
    const gear = look.gear ?? [];
    drawBodyGear(bodyGear, gear);

    this.head = scene.add.container(46, -96);
    const headBack = scene.add.graphics();
    const headFront = scene.add.graphics();
    drawHeadGear(headBack, headFront, gear, 36);
    const hg = scene.add.graphics();
    drawDogHead(hg, 0, 0, 36, color, accent, { fierce: look.fierce });
    this.lids = scene.add.graphics();
    this.lids.fillStyle(color, 1);
    this.lids.fillCircle(-12.6, -5.4, 6);
    this.lids.fillCircle(12.6, -5.4, 6);
    drawEyes(this.lids, 0, 0, 36, true);
    this.lids.setVisible(false);
    this.head.add([headBack, hg, this.lids, headFront]);

    this.zzz = scene.add
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

    this.rig.add([this.tail, body, bodyGear, this.head, this.zzz]);

    // 穿著專屬裝備：身邊有幾顆閃閃的星星（SSR 金色、SR 紫色）
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
    this.add([this.shadow, this.rig]);
    scene.add.existing(this);
  }

  get action(): DogAction {
    return this.current;
  }

  /** 每隔 intervalMs 換下一個動作 */
  startCycle(intervalMs: number): this {
    this.play(DOG_ACTIONS[0]);
    // 用實際時間判斷，不用 Phaser 計時器：手機卡頓或掉幀時遊戲時間會變慢，動作會停太久
    let last = Date.now();
    this.cycle = () => {
      const now = Date.now();
      if (now - last < intervalMs) return;
      last = now;
      this.index = (this.index + 1) % DOG_ACTIONS.length;
      this.play(DOG_ACTIONS[this.index]);
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
    this.onActionChange?.(action);
    return this;
  }

  private reset(): void {
    for (const tw of this.tweensRunning) tw.stop();
    this.tweensRunning = [];
    this.rig.setScale(1).setPosition(0, 0);
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
