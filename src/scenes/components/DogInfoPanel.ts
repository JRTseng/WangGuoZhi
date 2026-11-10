import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../../config';
import type { DogData } from '../../data/dogs';
import { calcPower } from '../../logic/power';

/**
 * 角色資訊面板：半透明遮罩 + 中央卡片。點任何地方關閉。
 */
export class DogInfoPanel extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, dog: DogData, onClose: () => void) {
    super(scene, 0, 0);

    const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.overlay, 0.45);
    shade.setOrigin(0, 0);
    shade.setInteractive();
    shade.on('pointerup', onClose);

    const pw = GAME_WIDTH - 48;
    const ph = 300;
    const px = 24;
    const py = (GAME_HEIGHT - ph) / 2;
    const box = scene.add.graphics();
    box.fillStyle(COLORS.card, 1);
    box.lineStyle(3, dog.color === 0xf7f4ee ? COLORS.cardBorder : dog.color, 1);
    box.fillRoundedRect(px, py, pw, ph, 18);
    box.strokeRoundedRect(px, py, pw, ph, 18);

    const power = calcPower(dog.baseAttack, dog.baseDefense, dog.level);
    const left = px + 24;
    const style = (size: number, color: string = COLORS.ink, bold = false) => ({
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      wordWrap: { width: pw - 48, useAdvancedWrap: true },
    });

    const lines: Phaser.GameObjects.Text[] = [
      scene.add.text(left, py + 24, `${dog.name}  Lv.${dog.level}`, style(30, COLORS.ink, true)),
      scene.add.text(left, py + 70, `${dog.breed}・${dog.role}`, style(16, COLORS.inkSoft)),
      scene.add.text(left, py + 104, `性格：${dog.personality}`, style(17)),
      scene.add.text(
        left,
        py + 138,
        `攻擊 ${dog.baseAttack}  防禦 ${dog.baseDefense}  戰力 ${power}`,
        style(17),
      ),
      scene.add.text(left, py + 184, `技能「${dog.skill.name}」`, style(20, '#b5651d', true)),
      scene.add.text(left, py + 216, dog.skill.description, style(17)),
      scene.add.text(px + pw / 2, py + ph - 30, '點一下關閉', style(14, COLORS.inkSoft)),
    ];
    lines[lines.length - 1].setOrigin(0.5, 0.5);

    this.add([shade, box, ...lines]);
    this.setDepth(100);
    scene.add.existing(this);
  }
}
