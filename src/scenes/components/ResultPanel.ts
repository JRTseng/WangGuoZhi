import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../config';
import { RESOURCE_LABELS, type Resources } from '../../data/resources';
import { formatAmount } from '../../logic/format';

/** 收成結果面板：半透明遮罩 + 中央卡片，點任何地方關閉。 */
export class ResultPanel extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, stageName: string, reward: Resources, onClose: () => void) {
    super(scene, 0, 0);

    const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.overlay, 0.45);
    shade.setOrigin(0, 0);
    shade.setInteractive();
    shade.on('pointerup', onClose);

    const pw = GAME_WIDTH - 48;
    const ph = 240;
    const px = 24;
    const py = (GAME_HEIGHT - ph) / 2;
    const box = scene.add.graphics();
    box.fillStyle(COLORS.card, 1);
    box.lineStyle(3, COLORS.harvest, 1);
    box.fillRoundedRect(px, py, pw, ph, 18);
    box.strokeRoundedRect(px, py, pw, ph, 18);

    const cx = GAME_WIDTH / 2;
    const text = (y: number, s: string, size: number, color: string = COLORS.ink, bold = false) =>
      scene.add
        .text(cx, y, s, {
          fontFamily: FONT_FAMILY,
          fontSize: `${size}px`,
          fontStyle: bold ? 'bold' : 'normal',
          color,
        })
        .setOrigin(0.5);

    const keys = Object.keys(RESOURCE_LABELS) as (keyof Resources)[];
    const items = [
      text(py + 44, '收成！', 32, '#4f8a3c', true),
      text(py + 90, `${stageName} 平安歸來`, 18, COLORS.inkSoft),
      ...keys.map((k, i) =>
        text(
          py + 132 + i * 30,
          `${RESOURCE_LABELS[k]} +${formatAmount(reward[k])}`,
          22,
          COLORS.ink,
          true,
        ),
      ),
      text(py + ph - 26, '點一下關閉', 14, COLORS.inkSoft),
    ];

    this.add([shade, box, ...items]);
    this.setDepth(100);
    scene.add.existing(this);
  }
}
