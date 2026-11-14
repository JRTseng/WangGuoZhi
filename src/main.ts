import Phaser from 'phaser';
import { COLORS } from './config';
import { gameSizeFor } from './logic/orientation';
import { BattleScene } from './scenes/BattleScene';
import { BoardingScene } from './scenes/BoardingScene';
import { BootScene } from './scenes/BootScene';
import { CampaignScene } from './scenes/CampaignScene';
import { ExpeditionScene } from './scenes/ExpeditionScene';
import { GearScene } from './scenes/GearScene';
import { LobbyScene } from './scenes/LobbyScene';
import { RecruitScene } from './scenes/RecruitScene';
import { StoryScene } from './scenes/StoryScene';
import { TeamScene } from './scenes/TeamScene';
import { TrainingScene } from './scenes/TrainingScene';

// 整個遊戲固定橫向（Jimmy 2026-11-14）：不管手機怎麼拿，遊戲尺寸都是橫式 844 x 390。
// 直拿的時候由 index.html 的 #rotate 蓋一層「請把手機橫放」。
const size = gameSizeFor('landscape');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: size.width,
  height: size.height,
  backgroundColor: COLORS.background,
  // 優惠碼輸入框用 DOM 元素
  dom: { createContainer: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    LobbyScene,
    TeamScene,
    TrainingScene,
    BoardingScene,
    GearScene,
    RecruitScene,
    CampaignScene,
    ExpeditionScene,
    BattleScene,
    StoryScene,
  ],
});

/**
 * 視窗大小或方向改變時，請 Phaser 依目前容器大小重算縮放。
 *
 * iPhone Safari 轉向時，resize 事件常在版面還沒轉完就先觸發，
 * 當下量到的還是舊尺寸，畫布會被縮成舊方向的大小、之後不再更新（看起來變小回不去）。
 * 所以每次事件後再隔幾個時間點重量一次。
 */
function applyViewport(): void {
  game.scale.refresh();
}

let timers: number[] = [];
function onResize(): void {
  for (const t of timers) window.clearTimeout(t);
  applyViewport();
  timers = [100, 300, 700].map((ms) => window.setTimeout(applyViewport, ms));
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
window.visualViewport?.addEventListener('resize', onResize);
