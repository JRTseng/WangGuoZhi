import Phaser from 'phaser';
import { COLORS } from './config';
import { gameSizeFor, orientationFor, type Orientation } from './logic/orientation';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { CampaignScene } from './scenes/CampaignScene';
import { ExpeditionScene } from './scenes/ExpeditionScene';
import { LobbyScene } from './scenes/LobbyScene';
import { StoryScene } from './scenes/StoryScene';
import { TeamScene } from './scenes/TeamScene';

const parent = document.getElementById('game')!;
const currentOrientation = (): Orientation =>
  orientationFor(
    parent.clientWidth || window.innerWidth,
    parent.clientHeight || window.innerHeight,
  );

let orientation = currentOrientation();
const size = gameSizeFor(orientation);

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
    CampaignScene,
    ExpeditionScene,
    BattleScene,
    StoryScene,
  ],
});

/**
 * 手機轉向：直放用 390 x 844、橫放用 844 x 390。
 * 方向改變時換遊戲尺寸，並用原本的參數重開目前的畫面，讓它照新方向重新排版。
 *
 * iPhone Safari 轉向時，resize 事件常在版面還沒轉完就先觸發，
 * 當下量到的還是舊尺寸，畫布會被縮成舊方向的大小、之後不再更新（看起來變小回不去）。
 * 所以每次事件後再隔幾個時間點重量一次，並且每次都請 Phaser 依目前容器大小重算縮放。
 */
function applyViewport(): void {
  const next = currentOrientation();
  if (next !== orientation) {
    orientation = next;
    const s = gameSizeFor(next);
    game.scale.setGameSize(s.width, s.height);
    for (const scene of game.scene.getScenes(true)) {
      scene.scene.restart(scene.sys.settings.data);
    }
  }
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
