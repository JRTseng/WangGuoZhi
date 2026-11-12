import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../../config';
import { findDog } from '../../data/dogs';
import { RESOURCE_LABELS, type Resources } from '../../data/resources';
import { formatAmount } from '../../logic/format';
import { formatGain, type DogExpGain } from '../../logic/leveling';
import { viewOf } from '../ui';
import { drawDogHead } from './dogArt';

const WIN_COLOR = { text: '#4f8a3c', border: COLORS.harvest };
const LOSE_COLOR = { text: '#b0413e', border: 0xb0413e };
const LEVEL_UP_COLOR = '#b5651d';

/** 經驗區每隻狗一列的高度：有升級的多一行成長值 */
const rowHeightOf = (g: DogExpGain): number => (g.toLevel > g.fromLevel ? 44 : 26);
const GAINS_HEAD = 34;

/**
 * 收成結算面板：勝／敗大字 + 獎勵 + 隊伍每隻狗的經驗與升級成長。
 * 半透明遮罩 + 中央卡片，點任何地方關閉。
 * 直式由上往下排；橫式高度不夠，經驗區放到右半邊。
 */
export class ResultPanel extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    stageName: string,
    reward: Resources,
    win: boolean,
    onClose: () => void,
    /** 額外訊息（例如解鎖下一關、新背景） */
    extra: string[] = [],
    /** 隊伍每隻狗拿到的經驗與升級結果 */
    gains: readonly DogExpGain[] = [],
  ) {
    super(scene, 0, 0);
    const { w: GAME_WIDTH, h: GAME_HEIGHT, landscape } = viewOf(scene);

    const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.overlay, 0.45);
    shade.setOrigin(0, 0);
    shade.setInteractive();
    shade.on('pointerup', onClose);

    const tone = win ? WIN_COLOR : LOSE_COLOR;
    const split = landscape && gains.length > 0;
    const gainsHeight = gains.length
      ? GAINS_HEAD + gains.reduce((s, g) => s + rowHeightOf(g), 0)
      : 0;
    const mainHeight = 240 + extra.length * 26;
    const pw = Math.min(GAME_WIDTH - 48, split ? 660 : 360);
    const ph = Math.min(
      GAME_HEIGHT - 24,
      split ? Math.max(mainHeight, gainsHeight + 60) : mainHeight + gainsHeight,
    );
    const px = (GAME_WIDTH - pw) / 2;
    const py = (GAME_HEIGHT - ph) / 2;
    const box = scene.add.graphics();
    box.fillStyle(COLORS.card, 1);
    box.lineStyle(3, tone.border, 1);
    box.fillRoundedRect(px, py, pw, ph, 18);
    box.strokeRoundedRect(px, py, pw, ph, 18);

    const mainW = split ? pw * 0.46 : pw;
    const cx = px + mainW / 2;
    const text = (
      x: number,
      y: number,
      s: string,
      size: number,
      color: string = COLORS.ink,
      bold = false,
    ) =>
      scene.add.text(x, y, s, {
        fontFamily: FONT_FAMILY,
        fontSize: `${size}px`,
        fontStyle: bold ? 'bold' : 'normal',
        color,
      });
    const center = (y: number, s: string, size: number, color?: string, bold = false) =>
      text(cx, y, s, size, color, bold).setOrigin(0.5);

    const keys = Object.keys(RESOURCE_LABELS) as (keyof Resources)[];
    const items: Phaser.GameObjects.GameObject[] = [
      center(py + 42, win ? '勝利！' : '敗北…', 34, tone.text, true),
      center(
        py + 90,
        win ? `${stageName} 大獲全勝` : `${stageName} 沒能打下來`,
        18,
        COLORS.inkSoft,
      ),
      ...keys.map((k, i) =>
        center(
          py + 132 + i * 30,
          `${RESOURCE_LABELS[k]} +${formatAmount(reward[k])}`,
          22,
          COLORS.ink,
          true,
        ),
      ),
      ...extra.map((e, i) =>
        center(py + 132 + keys.length * 30 + i * 26, e, 15, win ? '#b5651d' : tone.text, true),
      ),
      text(px + pw / 2, py + ph - 22, '點一下關閉', 14, COLORS.inkSoft).setOrigin(0.5),
    ];

    // ---- 經驗與升級 ----
    if (gains.length > 0) {
      const gx = split ? px + mainW + 8 : px + 24;
      const gw = split ? pw - mainW - 32 : pw - 48;
      let y = split ? py + 26 : py + 132 + keys.length * 30 + extra.length * 26 + 4;
      const line = scene.add.graphics();
      line.lineStyle(1, COLORS.cardBorder, 1);
      if (split) line.lineBetween(gx - 12, py + 20, gx - 12, py + ph - 40);
      else line.lineBetween(gx, y - 6, gx + gw, y - 6);
      items.push(line);

      const amount = Math.max(...gains.map((g) => g.exp));
      const title = win ? `每隻狗狗經驗 +${amount}` : `每隻狗狗經驗 +${amount}（打輸拿一半）`;
      items.push(text(gx, y + 4, title, 15, COLORS.inkSoft, true));
      y += GAINS_HEAD;

      for (const g of gains) {
        const d = findDog(g.dogId);
        const up = g.toLevel > g.fromLevel;
        const head = scene.add.graphics();
        if (d) drawDogHead(head, gx + 12, y + 12, 11, d.color, d.accent);
        items.push(head, text(gx + 30, y, d?.name ?? g.dogId, 16, COLORS.ink, true));
        const lv = up ? `Lv.${g.fromLevel} → Lv.${g.toLevel} 升級！` : `Lv.${g.toLevel}`;
        items.push(
          text(gx + gw, y + 1, lv, 15, up ? LEVEL_UP_COLOR : COLORS.inkSoft, up).setOrigin(1, 0),
        );
        if (up) items.push(text(gx + 30, y + 21, formatGain(g), 13, COLORS.inkSoft));
        y += rowHeightOf(g);
      }
    }

    this.add([shade, box, ...items]);
    this.setDepth(100);
    scene.add.existing(this);
  }
}
