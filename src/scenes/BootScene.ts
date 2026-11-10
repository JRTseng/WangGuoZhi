import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { formatVersion } from '../logic/version';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const version = formatVersion(__APP_VERSION__, __GIT_HASH__);

    this.add
      .text(cx, GAME_HEIGHT * 0.42, '汪國志', {
        fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
        fontSize: '64px',
        fontStyle: 'bold',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.42 + 64, '汪州風雲，即將開幕', {
        fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
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

    window.__WGZ__ = { scene: 'BootScene', version };
  }
}
