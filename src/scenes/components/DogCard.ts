import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../../config';
import type { DogData } from '../../data/dogs';
import type { Rect } from '../../logic/layout';
import { calcPower } from '../../logic/power';

/**
 * 角色卡片：幾何佔位頭像 + 名字、犬種、等級、戰力。
 * 可重用（之後出征選角也用這個）。點擊時觸發 onSelect。
 */
export class DogCard extends Phaser.GameObjects.Container {
  readonly dog: DogData;
  readonly power: number;
  readonly rect: Rect;

  constructor(scene: Phaser.Scene, dog: DogData, rect: Rect, onSelect: (dog: DogData) => void) {
    super(scene, rect.x, rect.y);
    this.dog = dog;
    this.rect = rect;
    this.power = calcPower(dog.baseAttack, dog.baseDefense, dog.level);

    const { width: w, height: h } = rect;

    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.card, 1);
    bg.lineStyle(2, COLORS.cardBorder, 1);
    bg.fillRoundedRect(0, 0, w, h, 14);
    bg.strokeRoundedRect(0, 0, w, h, 14);

    // 頭像：圓形頭 + 兩個三角耳，用顏色區分
    const r = Math.min(30, h / 2 - 10);
    const hx = 16 + r;
    const hy = h / 2;
    const head = scene.add.graphics();
    // 耳朵用主色 + 描邊，淺色狗（阿白）也看得清楚
    head.fillStyle(dog.color, 1);
    head.lineStyle(2, COLORS.inkHex, 1);
    for (const side of [-1, 1]) {
      const pts = [
        { x: hx + side * r * 0.95, y: hy - r * 0.15 },
        { x: hx + side * r * 0.8, y: hy - r * 1.2 },
        { x: hx + side * r * 0.15, y: hy - r * 0.85 },
      ];
      head.fillPoints(pts, true);
      head.strokePoints(pts, true);
    }
    head.fillStyle(dog.color, 1);
    head.lineStyle(2, COLORS.inkHex, 1);
    head.fillCircle(hx, hy, r);
    head.strokeCircle(hx, hy, r);
    head.fillStyle(dog.accent, 1);
    head.fillEllipse(hx, hy + r * 0.35, r * 0.9, r * 0.6);
    head.fillStyle(COLORS.inkHex, 1);
    head.fillCircle(hx - r * 0.35, hy - r * 0.15, 3);
    head.fillCircle(hx + r * 0.35, hy - r * 0.15, 3);
    head.fillCircle(hx, hy + r * 0.25, 3.5);

    const tx = hx + r + 16;
    const name = scene.add.text(tx, h / 2 - 22, dog.name, {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      fontStyle: 'bold',
      color: COLORS.ink,
    });
    name.setOrigin(0, 0.5);
    const sub = scene.add.text(tx, h / 2 + 4, `${dog.breed}・${dog.role}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: COLORS.inkSoft,
    });
    sub.setOrigin(0, 0.5);
    const lv = scene.add.text(tx, h / 2 + 26, `Lv.${dog.level}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '15px',
      fontStyle: 'bold',
      color: COLORS.ink,
    });
    lv.setOrigin(0, 0.5);

    const powerLabel = scene.add.text(w - 16, h / 2 - 12, '戰力', {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: COLORS.inkSoft,
    });
    powerLabel.setOrigin(1, 0.5);
    const powerText = scene.add.text(w - 16, h / 2 + 12, String(this.power), {
      fontFamily: FONT_FAMILY,
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#b5651d',
    });
    powerText.setOrigin(1, 0.5);

    this.add([bg, head, name, sub, lv, powerLabel, powerText]);
    this.setSize(w, h);
    // Container 的 hitArea 以左上角為原點
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    this.input!.cursor = 'pointer';
    this.on('pointerup', () => onSelect(dog));

    scene.add.existing(this);
  }
}
