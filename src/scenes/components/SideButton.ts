import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../../config';
import type { Rect } from '../../logic/layout';
import { makeTapArea } from './hitArea';

export type SideIcon = 'battle' | 'team' | 'story' | 'background';

/**
 * 主頁右側的方形大按鈕：上面圖示、下面文字。可加紅點提示。
 */
export class SideButton extends Phaser.GameObjects.Container {
  readonly rect: Rect;
  private readonly dot: Phaser.GameObjects.Arc;

  constructor(
    scene: Phaser.Scene,
    rect: Rect,
    label: string,
    icon: SideIcon,
    color: number,
    onTap: () => void,
  ) {
    super(scene, rect.x, rect.y);
    this.rect = rect;
    const { width: w, height: h } = rect;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(3, 5, w, h, 18);
    g.fillStyle(color, 1);
    g.lineStyle(3, 0xfff6e8, 1);
    g.fillRoundedRect(0, 0, w, h, 18);
    g.strokeRoundedRect(0, 0, w, h, 18);

    const ic = scene.add.graphics();
    drawIcon(ic, icon, w / 2, h * 0.38, Math.min(w, h) * 0.22);

    const t = scene.add
      .text(w / 2, h * 0.8, label, {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.round(Math.min(w, h) * 0.22)}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: COLORS.ink,
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.dot = scene.add.circle(w - 6, 6, 8, 0xe0452b).setStrokeStyle(2, 0xffffff);
    this.dot.setVisible(false);
    this.add([g, ic, t, this.dot]);
    makeTapArea(this, w, h);
    this.on('pointerdown', () => this.setScale(0.96));
    this.on('pointerout', () => this.setScale(1));
    this.on('pointerup', () => {
      this.setScale(1);
      onTap();
    });
    scene.add.existing(this);
  }

  /** 右上角紅點（有新內容） */
  setDot(on: boolean): this {
    this.dot.setVisible(on);
    return this;
  }
}

function drawIcon(g: Phaser.GameObjects.Graphics, icon: SideIcon, x: number, y: number, s: number) {
  g.lineStyle(Math.max(3, s * 0.22), 0xffffff, 1);
  g.fillStyle(0xffffff, 1);
  switch (icon) {
    case 'battle': {
      // 交叉的兩把劍
      for (const d of [-1, 1]) {
        g.beginPath();
        g.moveTo(x - d * s, y - s);
        g.lineTo(x + d * s * 0.8, y + s * 0.8);
        g.strokePath();
        g.fillCircle(x + d * s * 0.9, y + s * 0.9, s * 0.2);
      }
      break;
    }
    case 'team':
      g.fillCircle(x, y - s * 0.35, s * 0.42);
      g.fillCircle(x - s * 0.85, y - s * 0.1, s * 0.34);
      g.fillCircle(x + s * 0.85, y - s * 0.1, s * 0.34);
      g.fillEllipse(x, y + s * 0.65, s * 1.4, s * 0.8);
      g.fillEllipse(x - s * 0.95, y + s * 0.65, s * 0.9, s * 0.6);
      g.fillEllipse(x + s * 0.95, y + s * 0.65, s * 0.9, s * 0.6);
      break;
    case 'story':
      // 打開的書
      g.fillRoundedRect(x - s * 1.1, y - s * 0.75, s * 1.05, s * 1.5, 3);
      g.fillRoundedRect(x + s * 0.05, y - s * 0.75, s * 1.05, s * 1.5, 3);
      break;
    case 'background':
      // 山與太陽
      g.fillTriangle(x - s, y + s * 0.7, x + s * 0.2, y + s * 0.7, x - s * 0.4, y - s * 0.5);
      g.fillTriangle(x - s * 0.2, y + s * 0.7, x + s, y + s * 0.7, x + s * 0.4, y - s * 0.1);
      g.fillCircle(x + s * 0.6, y - s * 0.65, s * 0.25);
      break;
  }
}
