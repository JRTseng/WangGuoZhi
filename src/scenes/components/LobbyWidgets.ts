import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../../config';
import type { Rect } from '../../logic/layout';
import { makeTapArea } from './hitArea';
import { drawLobbyIcon, drawPanel, drawPaw, type LobbyIcon } from './lobbyIcons';

/** 主頁 UI 共用配色：深棕半透明底 + 金邊 */
export const LOBBY = {
  panel: 0x3b2a1a,
  panelAlpha: 0.78,
  gold: 0xe0b25a,
  goldText: '#f5d38a',
  text: '#fff6e8',
  dot: 0xe0452b,
} as const;

function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  s: string,
  size: number,
  color: string = LOBBY.text,
) {
  return scene.add
    .text(x, y, s, {
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      stroke: COLORS.ink,
      strokeThickness: 3,
    })
    .setOrigin(0.5);
}

/** 可點的容器：按下縮一點，放開觸發 */
abstract class Tappable extends Phaser.GameObjects.Container {
  readonly rect: Rect;
  protected readonly dot: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, rect: Rect, onTap: () => void) {
    super(scene, rect.x, rect.y);
    this.rect = rect;
    this.dot = scene.add.circle(rect.width - 5, 5, 7, LOBBY.dot).setStrokeStyle(2, 0xffffff);
    this.dot.setVisible(false);
    makeTapArea(this, rect.width, rect.height);
    this.on('pointerdown', () => this.setScale(0.97));
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
    this.bringToTop(this.dot);
    return this;
  }
}

/** 角落小標籤（NEW、即將開放） */
function addTag(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  s: string,
) {
  const t = scene.add
    .text(x, y, s, {
      fontFamily: FONT_FAMILY,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#3b2a1a',
      backgroundColor: '#f5d38a',
      padding: { x: 4, y: 1 },
    })
    .setOrigin(1, 0);
  c.add(t);
}

/**
 * 左側功能選單的一格。
 * 寬版：圖示在左、文字在右的長條；精簡版（直式）：方塊內上圖示下文字。
 */
export class MenuItem extends Tappable {
  constructor(
    scene: Phaser.Scene,
    rect: Rect,
    text: string,
    icon: LobbyIcon,
    compact: boolean,
    onTap: () => void,
    tag?: string,
  ) {
    super(scene, rect, onTap);
    const { width: w, height: h } = rect;
    const g = scene.add.graphics();
    drawPanel(g, 0, 0, w, h, 14, LOBBY.panel, 0.85);
    const ic = scene.add.graphics();
    this.add([g, ic]);
    if (compact) {
      drawLobbyIcon(ic, icon, w / 2, h * 0.38, Math.min(w, h) * 0.2);
      this.add(label(scene, w / 2, h * 0.8, text, 13));
    } else {
      // 圖示放在金色圓章裡
      const r = Math.min(h * 0.32, 20);
      g.fillStyle(LOBBY.gold, 1);
      g.fillCircle(8 + r, h / 2, r);
      g.lineStyle(2, 0xfff6e8, 0.8);
      g.strokeCircle(8 + r, h / 2, r - 3);
      drawLobbyIcon(ic, icon, 8 + r, h / 2, r * 0.55, 0x5a3a1c);
      this.add(label(scene, 16 + r * 2, h / 2, text, 19).setOrigin(0, 0.5));
      // 右下小掌印
      drawPaw(g, w - 14, h - 12, 5, LOBBY.gold, 0.5);
    }
    if (tag) addTag(scene, this, w - 2, 2, tag);
    this.add(this.dot);
  }
}

/** 右上的圓形小圖示 + 下方文字（召募／商城／獎勵／信箱） */
export class RoundShortcut extends Tappable {
  constructor(
    scene: Phaser.Scene,
    rect: Rect,
    text: string,
    icon: LobbyIcon,
    color: number,
    onTap: () => void,
  ) {
    super(scene, rect, onTap);
    const { width: w, height: h } = rect;
    const g = scene.add.graphics();
    if (h < 50) {
      // 太小就只畫圖示方塊（橫式的信箱）
      drawPanel(g, 0, 0, w, h, 10, LOBBY.panel, 0.85);
      drawLobbyIcon(g, icon, w / 2, h / 2, Math.min(w, h) * 0.3);
      this.add(g);
      this.dot.setPosition(w - 4, 4);
      this.add(this.dot);
      return;
    }
    const r = Math.min(w, h - 16) / 2 - 2;
    g.fillStyle(0x000000, 0.25);
    g.fillCircle(w / 2 + 1, r + 4, r);
    g.fillStyle(color, 1);
    g.fillCircle(w / 2, r + 2, r);
    // 高光
    g.fillStyle(0xffffff, 0.18);
    g.fillEllipse(w / 2, r * 0.6, r * 1.3, r * 0.7);
    g.lineStyle(3, LOBBY.gold, 1);
    g.strokeCircle(w / 2, r + 2, r);
    g.lineStyle(1.5, 0xffffff, 0.5);
    g.strokeCircle(w / 2, r + 2, r - 4);
    drawLobbyIcon(g, icon, w / 2, r + 2, r * 0.48);
    this.add([g, label(scene, w / 2, h - 7, text, 13)]);
    this.dot.setPosition(w / 2 + r * 0.75, 6);
    this.add(this.dot);
  }
}

export interface CardOptions {
  title: string;
  icon: LobbyIcon;
  /** 底色（漸層由這個色往深） */
  color: number;
  /** 左下的副標（例如「第 1 章 落葉坡」） */
  subtitle?: string;
  /** 右下的小字（例如「進行中」） */
  corner?: string;
  /** 右上角標籤（例如「即將開放」） */
  tag?: string;
  /** 卡片實際要畫的外框（比可點範圍大時用，例如出征卡含狀態條） */
  frame?: Rect;
  /** 右側裝飾，傳入畫筆與卡片寬高 */
  decorate?: (g: Phaser.GameObjects.Graphics, w: number, h: number) => void;
}

/** 右側（直式為下方）的大卡片：故事章節、出征、活動等 */
export class LobbyCard extends Tappable {
  private readonly subtitleText: Phaser.GameObjects.Text | null;

  constructor(scene: Phaser.Scene, rect: Rect, opts: CardOptions, onTap: () => void) {
    super(scene, rect, onTap);
    const frame = opts.frame ?? rect;
    const fx = frame.x - rect.x;
    const fy = frame.y - rect.y;
    const { width: w, height: h } = frame;
    const g = scene.add.graphics();
    drawPanel(g, fx, fy, w, h, 16, opts.color);
    opts.decorate?.(g, w, h);
    // 左下角一串小掌印
    for (let i = 0; i < 3; i++)
      drawPaw(g, fx + w * 0.42 + i * 16, fy + 14 + (i % 2) * 8, 5, 0xffffff, 0.16);
    const small = h < 70 || w < 120;
    const ic = scene.add.graphics();
    const iy = fy + (small ? 18 : 22);
    drawLobbyIcon(ic, opts.icon, fx + 20, iy, small ? 9 : 11);
    this.add([g, ic, label(scene, fx + 36, iy, opts.title, small ? 16 : 20).setOrigin(0, 0.5)]);

    this.subtitleText =
      opts.subtitle !== undefined
        ? label(
            scene,
            fx + 12,
            rect.height - 10,
            opts.subtitle,
            small ? 12 : 14,
            LOBBY.goldText,
          ).setOrigin(0, 1)
        : null;
    if (this.subtitleText) this.add(this.subtitleText);
    if (opts.corner)
      this.add(label(scene, fx + w - 10, rect.height - 10, opts.corner, 12).setOrigin(1, 1));
    if (opts.tag) {
      if (small || w < 160) addTag(scene, this, fx + w - 6, rect.height - 24, opts.tag);
      else addTag(scene, this, fx + w - 4, fy + 4, opts.tag);
    }
    this.add(this.dot);
    this.dot.setPosition(fx + w - 5, fy + 5);
  }

  setSubtitle(s: string): this {
    if (this.subtitleText && this.subtitleText.text !== s) this.subtitleText.setText(s);
    return this;
  }
}
