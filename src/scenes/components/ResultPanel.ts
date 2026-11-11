import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../../config';
import { RESOURCE_LABELS, type Resources } from '../../data/resources';
import { formatAmount } from '../../logic/format';
import { viewOf } from '../ui';

/** 收成結果面板：半透明遮罩 + 中央卡片，點任何地方關閉。 */
export class ResultPanel extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    stageName: string,
    reward: Resources,
    onClose: () => void,
    /** 額外訊息（例如解鎖下一關、新背景） */
    extra: string[] = [],
  ) {
    super(scene, 0, 0);
    const { w: GAME_WIDTH, h: GAME_HEIGHT } = viewOf(scene);

    const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.overlay, 0.45);
    shade.setOrigin(0, 0);
    shade.setInteractive();
    shade.on('pointerup', onClose);

    const pw = Math.min(GAME_WIDTH - 48, 360);
    const ph = Math.min(GAME_HEIGHT - 24, 240 + extra.length * 26);
    const px = (GAME_WIDTH - pw) / 2;
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
      text(py + 40, '收成！', 32, '#4f8a3c', true),
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
      ...extra.map((e, i) => text(py + 132 + keys.length * 30 + i * 26, e, 15, '#b5651d', true)),
      text(py + ph - 22, '點一下關閉', 14, COLORS.inkSoft),
    ];

    this.add([shade, box, ...items]);
    this.setDepth(100);
    scene.add.existing(this);
  }
}
