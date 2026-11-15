import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../../config';
import { findDog } from '../../data/dogs';
import { RESOURCE_LABELS, type Resources } from '../../data/resources';
import { formatAmount } from '../../logic/format';
import { formatGain, type DogExpGain } from '../../logic/leveling';
import type { Rect } from '../../logic/layout';
import { viewOf } from '../ui';
import { playSfx } from './audio';
import { Button } from './Button';
import { drawDogHead } from './dogArt';
import { makeTapArea } from './hitArea';
import { AUTO_NEXT_DELAY_MS, autoNextSeconds, nextHint } from '../../logic/nextStage';

const WIN_COLOR = { text: '#4f8a3c', border: COLORS.harvest };
const LOSE_COLOR = { text: '#b0413e', border: 0xb0413e };
const LEVEL_UP_COLOR = '#b5651d';

/** 經驗區每隻狗一列的高度：有升級的多一行成長值 */
const rowHeightOf = (g: DogExpGain): number => (g.toLevel > g.fromLevel ? 44 : 26);
const GAINS_HEAD = 34;

/**
 * 收成結算面板：勝／敗大字 + 獎勵 + 隊伍每隻狗的經驗與升級成長。
 * 半透明遮罩 + 中央卡片，點任何地方關閉。
 * 有給 next 的話，下方多一顆「下一關」按鈕：按它直接挑戰下一關，點其他地方照舊關閉。
 * 直式由上往下排；橫式高度不夠，經驗區放到右半邊。
 */
export class ResultPanel extends Phaser.GameObjects.Container {
  /** 「下一關」按鈕的位置（沒有按鈕為 null；測試用） */
  readonly nextRect: Rect | null = null;
  /** 「自動」勾選框的位置（沒有為 null；測試用） */
  readonly autoRect: Rect | null = null;
  /** 「自動」現在有沒有勾 */
  autoOn = false;
  /** 自動下一關倒數剩幾秒；沒在倒數為 null */
  autoSeconds: number | null = null;

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
    /** 「下一關」按鈕（打贏而且下一關可以打才給） */
    next?: {
      label: string;
      onTap: () => void;
      /** 旁邊的「自動」勾選框：目前有沒有勾，以及勾／取消時要做的事（存進設定） */
      auto?: { on: boolean; onToggle: (on: boolean) => void };
    },
  ) {
    super(scene, 0, 0);
    const { w: GAME_WIDTH, h: GAME_HEIGHT, landscape } = viewOf(scene);
    playSfx(win ? 'win' : 'lose');

    const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.overlay, 0.45);
    shade.setOrigin(0, 0);
    shade.setInteractive();
    shade.on('pointerup', onClose);

    const tone = win ? WIN_COLOR : LOSE_COLOR;
    const split = landscape && gains.length > 0;
    const gainsHeight = gains.length
      ? GAINS_HEAD + gains.reduce((s, g) => s + rowHeightOf(g), 0)
      : 0;
    const NEXT_HEIGHT = 40;
    const mainHeight = 240 + extra.length * 26 + (next ? NEXT_HEIGHT + 8 : 0);
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
    // 訊息很多（第一次打倒頭目：過關、裝備、零食、新夥伴、背景……）而且畫面不夠高：
    // 資源併成一行、訊息字小一點排密一點，才不會壓到下面的按鈕
    const tight = mainHeight > ph;
    const resTop = py + 132;
    const extraTop = tight ? resTop + 28 : resTop + keys.length * 30;
    const extraStep = tight ? 18 : 26;
    const items: Phaser.GameObjects.GameObject[] = [
      center(py + 42, win ? '勝利！' : '敗北…', 34, tone.text, true),
      center(
        py + 90,
        win ? `${stageName} 大獲全勝` : `${stageName} 沒能打下來`,
        18,
        COLORS.inkSoft,
      ),
      ...(tight
        ? [
            center(
              resTop,
              keys.map((k) => `${RESOURCE_LABELS[k]} +${formatAmount(reward[k])}`).join('\u3000'),
              19,
              COLORS.ink,
              true,
            ),
          ]
        : keys.map((k, i) =>
            center(
              resTop + i * 30,
              `${RESOURCE_LABELS[k]} +${formatAmount(reward[k])}`,
              22,
              COLORS.ink,
              true,
            ),
          )),
      ...extra.map((e, i) =>
        center(extraTop + i * extraStep, e, tight ? 13 : 15, win ? '#b5651d' : tone.text, true),
      ),
    ];
    const hint = text(
      px + pw / 2,
      py + ph - 22,
      next ? nextHint() : '點一下關閉',
      14,
      COLORS.inkSoft,
    ).setOrigin(0.5);
    items.push(hint);
    if (next) {
      const AUTO_WIDTH = 78;
      const total = Math.min(next.auto ? 290 : 220, mainW - 24);
      const bw = next.auto ? total - AUTO_WIDTH - 8 : total;
      const by = py + ph - 40 - NEXT_HEIGHT;
      this.nextRect = { x: cx - total / 2, y: by, width: bw, height: NEXT_HEIGHT };
      const button = new Button(scene, this.nextRect, next.label, next.onTap, 20);
      button.setColor(COLORS.harvest);
      items.push(button);

      if (next.auto) {
        const auto = next.auto;
        const r = (this.autoRect = {
          x: this.nextRect.x + bw + 8,
          y: by,
          width: AUTO_WIDTH,
          height: NEXT_HEIGHT,
        });
        const box = scene.add.graphics();
        const c = scene.add.container(r.x, r.y, [
          box,
          text(34, r.height / 2, '自動', 17, COLORS.ink, true).setOrigin(0, 0.5),
        ]);
        makeTapArea(c, r.width, r.height);
        let timer: Phaser.Time.TimerEvent | null = null;
        const apply = (on: boolean) => {
          this.autoOn = on;
          box.clear();
          box.fillStyle(0xfff6e8, 1);
          box.lineStyle(2, COLORS.cardBorder, 1);
          box.fillRoundedRect(0, 0, r.width, r.height, 12);
          box.strokeRoundedRect(0, 0, r.width, r.height, 12);
          const cy = r.height / 2;
          box.fillStyle(on ? COLORS.harvest : 0xffffff, 1);
          box.lineStyle(2, on ? COLORS.harvest : COLORS.inkHex, 1);
          box.fillRoundedRect(8, cy - 10, 20, 20, 5);
          box.strokeRoundedRect(8, cy - 10, 20, 20, 5);
          if (on) {
            box.lineStyle(3, 0xffffff, 1);
            box.beginPath();
            box.moveTo(12, cy);
            box.lineTo(17, cy + 5);
            box.lineTo(24, cy - 6);
            box.strokePath();
          }
          // 勾著：倒數幾秒後自己按「下一關」，每秒更新剩幾秒；取消就停。
          // 用真實時間算（無頭瀏覽器或切到背景時 Phaser 的時鐘會變慢）
          timer?.remove();
          timer = null;
          this.autoSeconds = null;
          const debug = (seconds: number | null) => {
            const d = window.__WGZ__?.nextAuto;
            if (d) Object.assign(d, { on, seconds });
          };
          debug(null);
          if (!on) {
            hint.setText(nextHint()).setColor(COLORS.inkSoft).setFontStyle('normal');
            return;
          }
          const deadline = Date.now() + AUTO_NEXT_DELAY_MS;
          const tickDown = () => {
            const left = autoNextSeconds(deadline, Date.now());
            this.autoSeconds = left;
            debug(left);
            hint.setText(nextHint(left)).setColor('#b5651d').setFontStyle('bold');
            if (left <= 0) {
              timer?.remove();
              timer = null;
              next.onTap();
            }
          };
          tickDown();
          timer = scene.time.addEvent({ delay: 100, loop: true, callback: tickDown });
        };
        c.on('pointerup', () => {
          playSfx('tap');
          auto.onToggle(!this.autoOn);
          apply(!this.autoOn);
        });
        apply(auto.on);
        items.push(c);
      }
    }

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
        // 打輸：出戰的狗全部掛彩（T014，純外觀）
        if (d) drawDogHead(head, gx + 12, y + 12, 11, d.color, d.accent, { hurt: win ? 0 : 2 });
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
