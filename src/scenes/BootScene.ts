import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../config';
import { formatVersion } from '../logic/version';

/** 開機畫面停留時間（毫秒） */
const BOOT_HOLD_MS = 800;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const GAME_WIDTH = this.scale.width;
    const GAME_HEIGHT = this.scale.height;
    const cx = GAME_WIDTH / 2;
    const version = formatVersion(__APP_VERSION__, __GIT_HASH__);

    this.add
      .text(cx, GAME_HEIGHT * 0.42, '汪國志', {
        fontFamily: FONT_FAMILY,
        fontSize: '64px',
        fontStyle: 'bold',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.42 + 64, '汪州風雲，即將開幕', {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: COLORS.inkSoft,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT - 24, version, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: COLORS.inkSoft,
      })
      .setOrigin(0.5, 1);

    window.__WGZ__ = {
      scene: 'BootScene',
      version,
      orientation: GAME_WIDTH > GAME_HEIGHT ? 'landscape' : 'portrait',
      size: { width: GAME_WIDTH, height: GAME_HEIGHT },
    };

    // 載入畫面停一下再進主畫面；網址加 ?stay=boot 可停在這裡（截圖用）
    const stay = new URLSearchParams(window.location.search).get('stay') === 'boot';
    if (!stay) this.time.delayedCall(BOOT_HOLD_MS, () => this.scene.start('LobbyScene'));
  }
}
