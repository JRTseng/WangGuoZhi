import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../../config';
import type { DogData } from '../../data/dogs';
import type { Rect } from '../../logic/layout';
import { calcPower } from '../../logic/power';
import { makeTapArea } from './hitArea';

/**
 * 角色卡片：幾何佔位頭像 + 名字、犬種、等級、戰力。
 * 可重用（之後出征選角也用這個）。點擊時觸發 onSelect。
 */
export class DogCard extends Phaser.GameObjects.Container {
  readonly dog: DogData;
  readonly power: number;
  readonly rect: Rect;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly badge: Phaser.GameObjects.Text;
  private readonly check: Phaser.GameObjects.Graphics;
  private readonly powerLabel: Phaser.GameObjects.Text;
  private readonly powerText: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  /** 選角模式：右側顯示勾選圈，戰力往左移 */
  private selectable = false;

  constructor(scene: Phaser.Scene, dog: DogData, rect: Rect, onSelect: (dog: DogData) => void) {
    super(scene, rect.x, rect.y);
    this.dog = dog;
    this.rect = rect;
    this.power = calcPower(dog.baseAttack, dog.baseDefense, dog.level);

    const { width: w, height: h } = rect;

    const bg = scene.add.graphics();
    this.bg = bg;
    this.frame = scene.add.graphics();

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
    const sub = (this.sub = scene.add.text(tx, h / 2 + 4, `${dog.breed}・${dog.role}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: COLORS.inkSoft,
    }));
    sub.setOrigin(0, 0.5);
    const lv = scene.add.text(tx, h / 2 + 26, `Lv.${dog.level}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '15px',
      fontStyle: 'bold',
      color: COLORS.ink,
    });
    lv.setOrigin(0, 0.5);

    const powerLabel = (this.powerLabel = scene.add.text(w - 16, h / 2 - 12, '戰力', {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: COLORS.inkSoft,
    }));
    powerLabel.setOrigin(1, 0.5);
    const powerText = (this.powerText = scene.add.text(w - 16, h / 2 + 12, String(this.power), {
      fontFamily: FONT_FAMILY,
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#b5651d',
    }));
    powerText.setOrigin(1, 0.5);
    this.check = scene.add.graphics();

    // 狀態標籤（出征中／已選），預設隱藏
    this.badge = scene.add.text(w - 16, 8, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#8a6f55',
      padding: { x: 6, y: 2 },
    });
    this.badge.setOrigin(1, 0);
    this.badge.setVisible(false);

    this.add([bg, this.frame, head, name, sub, lv, powerLabel, powerText, this.check, this.badge]);
    this.setStatus({});
    makeTapArea(this, w, h);
    this.on('pointerup', () => onSelect(dog));

    scene.add.existing(this);
  }

  /** 開關選角模式：右側出現勾選圈，戰力往左讓位 */
  setSelectable(selectable: boolean): this {
    this.selectable = selectable;
    const x = this.rect.width - (selectable ? 64 : 16);
    this.powerLabel.setX(x);
    this.powerText.setX(x);
    // 選角模式寬度較窄，副標只留犬種，避免壓到戰力
    this.sub.setText(selectable ? this.dog.breed : `${this.dog.breed}・${this.dog.role}`);
    // 卡片太窄（橫式三欄）時不顯示犬種，避免壓到戰力
    this.sub.setVisible(!selectable || this.rect.width >= 300);
    return this;
  }

  /**
   * 顯示狀態：
   * - 出征中：變淡 + 「出征中」標籤
   * - 已選：底色變橘、粗橘框、右側實心勾勾（選角模式）或「✓ 已選」標籤
   * 只改外觀，不擋點擊；能不能選由呼叫端依 src/logic/ 判斷。
   */
  setStatus({ busy = false, selected = false }: { busy?: boolean; selected?: boolean }): this {
    const { width: w, height: h } = this.rect;
    this.bg.clear();
    this.bg.fillStyle(selected ? COLORS.cardSelected : COLORS.card, 1);
    this.bg.fillRoundedRect(0, 0, w, h, 14);
    this.frame.clear();
    this.frame.lineStyle(selected ? 5 : 2, selected ? COLORS.button : COLORS.cardBorder, 1);
    this.frame.strokeRoundedRect(0, 0, w, h, 14);
    this.setAlpha(busy ? 0.5 : 1);

    this.check.clear();
    if (this.selectable && !busy) {
      const cx = w - 30;
      const cy = h / 2;
      const r = 16;
      if (selected) {
        this.check.fillStyle(COLORS.button, 1);
        this.check.fillCircle(cx, cy, r);
        this.check.lineStyle(4, 0xffffff, 1);
        this.check.beginPath();
        this.check.moveTo(cx - 8, cy);
        this.check.lineTo(cx - 2, cy + 6);
        this.check.lineTo(cx + 8, cy - 6);
        this.check.strokePath();
      } else {
        this.check.lineStyle(3, COLORS.cardBorder, 1);
        this.check.strokeCircle(cx, cy, r);
      }
    }

    if (busy) {
      this.badge.setText('出征中').setBackgroundColor('#8a6f55').setVisible(true);
    } else if (selected && !this.selectable) {
      this.badge.setText('✓ 已選').setBackgroundColor('#b5651d').setVisible(true);
    } else {
      this.badge.setVisible(false);
    }
    return this;
  }
}
