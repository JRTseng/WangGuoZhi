import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../../config';
import type { Rect } from '../../logic/layout';
import { makeTapArea } from './hitArea';

/**
 * 圓角大按鈕（手機單手好按）。可改文字、啟用／停用、顏色。
 * 停用時仍會畫出來，但點了不觸發。
 */
export class Button extends Phaser.GameObjects.Container {
  readonly rect: Rect;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private enabled = true;
  private color: number = COLORS.button;

  constructor(scene: Phaser.Scene, rect: Rect, text: string, onTap: () => void, fontSize = 24) {
    super(scene, rect.x, rect.y);
    this.rect = rect;
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(rect.width / 2, rect.height / 2, text, {
        fontFamily: FONT_FAMILY,
        fontSize: `${fontSize}px`,
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    makeTapArea(this, rect.width, rect.height);
    this.on('pointerup', () => {
      if (this.enabled) onTap();
    });
    this.redraw();
    scene.add.existing(this);
  }

  get text(): string {
    return this.label.text;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setText(text: string): this {
    if (this.label.text !== text) this.label.setText(text);
    return this;
  }

  setEnabled(enabled: boolean): this {
    if (this.enabled !== enabled) {
      this.enabled = enabled;
      this.redraw();
    }
    return this;
  }

  setColor(color: number): this {
    if (this.color !== color) {
      this.color = color;
      this.redraw();
    }
    return this;
  }

  private redraw(): void {
    this.bg.clear();
    this.bg.fillStyle(this.enabled ? this.color : COLORS.buttonDisabled, 1);
    this.bg.fillRoundedRect(0, 0, this.rect.width, this.rect.height, 18);
    if (this.input) this.input.cursor = this.enabled ? 'pointer' : 'default';
  }
}
