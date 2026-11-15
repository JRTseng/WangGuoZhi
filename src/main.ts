import Phaser from 'phaser';
import { COLORS } from './config';
import { musicForScene } from './logic/music';
import { renderScale } from './logic/resolution';
import { limits, limitsFromSearch } from './logic/stamina';
import { BattleScene } from './scenes/BattleScene';
import { BoardingScene } from './scenes/BoardingScene';
import { BootScene } from './scenes/BootScene';
import { CampaignScene } from './scenes/CampaignScene';
import { ExpeditionScene } from './scenes/ExpeditionScene';
import { FrisbeeScene } from './scenes/FrisbeeScene';
import { GearScene } from './scenes/GearScene';
import { LobbyScene } from './scenes/LobbyScene';
import { QuestScene } from './scenes/QuestScene';
import { RecruitScene } from './scenes/RecruitScene';
import { StoryScene } from './scenes/StoryScene';
import { TeamScene } from './scenes/TeamScene';
import { TrainingScene } from './scenes/TrainingScene';
import { initAudio, setMusic } from './scenes/components/audio';
import { canvasSizeFor, fitCamera, pickRenderScale } from './scenes/ui';
import { getState } from './state/store';

// 整個遊戲固定橫向（Jimmy 2026-11-14）：不管手機怎麼拿，遊戲尺寸都是橫式 844 x 390。
// 直拿的時候由 index.html 的 #rotate 蓋一層「請把手機橫放」。
//
// 畫布照手機的實體像素開（T008）：版面仍是 844 x 390，鏡頭放大同樣倍數，字和線條才不會糊。
renderScale.value = pickRenderScale(getState().settings.quality);
const size = canvasSizeFor(renderScale.value);

// 文字預設照 1 倍畫再放大會糊：所有 add.text 都改成照目前的解析度倍數畫
// （register() 遇到已經有的名字不會蓋掉，所以直接換掉原本的）
function addCrispText(
  this: Phaser.GameObjects.GameObjectFactory,
  x: number,
  y: number,
  text: string | string[],
  style?: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  const t = new Phaser.GameObjects.Text(this.scene, x, y, text, {
    resolution: renderScale.value,
    ...style,
  });
  this.displayList.add(t);
  return t;
}
(Phaser.GameObjects.GameObjectFactory.prototype as unknown as { text: unknown }).text =
  addCrispText;

// 體力與每日次數目前先放開（見 src/logic/stamina.ts 的 LIMITS_DEFAULT）；網址加 ?limits=1 可以打開
Object.assign(limits, limitsFromSearch(window.location.search));

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
    FrisbeeScene,
    GearScene,
    QuestScene,
    RecruitScene,
    CampaignScene,
    ExpeditionScene,
    BattleScene,
    StoryScene,
  ],
});

// 畫面測試用：檢查各畫面的按鈕大小與字體（T008）
window.__WGZ_GAME__ = game;

// 音樂（T016）：每個畫面一開始就決定要播哪一首，各畫面不用自己管
initAudio();
game.events.once(Phaser.Core.Events.READY, () => {
  for (const s of game.scene.scenes) {
    s.events.on(Phaser.Scenes.Events.CREATE, () => setMusic(musicForScene(s.scene.key)));
    // 每個場景開始時把鏡頭放大成解析度倍數（T008）；已經開始的開機畫面補做一次
    s.events.on(Phaser.Scenes.Events.START, () => fitCamera(s));
    fitCamera(s);
  }
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
