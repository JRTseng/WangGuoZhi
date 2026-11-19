import Phaser from 'phaser';
import { COLORS } from './config';
import { musicForScene } from './logic/music';
import { shouldRotate, unrotatePoint } from './logic/orientation';
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
import { SigninScene } from './scenes/SigninScene';
import { CodexScene } from './scenes/CodexScene';
import { FactionScene } from './scenes/FactionScene';
import { TowerScene } from './scenes/TowerScene';
import { RatScene } from './scenes/RatScene';
import { HomeScene } from './scenes/HomeScene';
import { WarScene } from './scenes/WarScene';
import { RecruitScene } from './scenes/RecruitScene';
import { StoryScene } from './scenes/StoryScene';
import { TeamScene } from './scenes/TeamScene';
import { TrainingScene } from './scenes/TrainingScene';
import { initAudio, setMusic } from './scenes/components/audio';
import { initPwa } from './scenes/components/install';
import { canvasSizeFor, fitCamera, pickRenderScale } from './scenes/ui';
import { getState } from './state/store';

// 整個遊戲固定橫向（Jimmy 2026-11-14）：不管手機怎麼拿，遊戲尺寸都是橫式 844 x 390。
// 手機直拿的時候把整個畫面轉 90 度（Jimmy 2026-11-17：不要提示放橫，開著直向鎖定也能玩）。
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

// 手機 App 化（T012）：離線快取與「加到主畫面」
initPwa();

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
    SigninScene,
    CodexScene,
    TowerScene,
    RatScene,
    FactionScene,
    WarScene,
    HomeScene,
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
  syncRotation();
  game.scale.refresh();
}

// ---- 直拿時把畫面轉 90 度 ----
// index.html 用 html.wgz-rotated 把 #frame 轉過來；Phaser 量大小與算手指位置都是用
// getBoundingClientRect（轉過以後寬高會對調），所以這兩件事要自己來。
let rotated = false;
const touchDevice =
  navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches === true;

function syncRotation(): void {
  rotated = shouldRotate(window.innerWidth, window.innerHeight, touchDevice);
  document.documentElement.classList.toggle('wgz-rotated', rotated);
}

interface ScaleInternals {
  parent: HTMLElement | null;
  parentSize: Phaser.Structs.Size;
  canvas: HTMLCanvasElement;
  baseSize: Phaser.Structs.Size;
  getParentBounds: () => boolean;
  updateCenter: () => void;
  transformX: (pageX: number) => number;
  transformY: (pageY: number) => number;
}
interface InputInternals {
  transformPointer: (p: Phaser.Input.Pointer, pageX: number, pageY: number, move: boolean) => void;
}
{
  const scale = game.scale as unknown as ScaleInternals;
  const input = game.input as unknown as InputInternals;
  // 容器大小：用版面的寬高（不受旋轉影響）
  const originalBounds = scale.getParentBounds.bind(scale);
  let lastRotated = false;
  scale.getParentBounds = () => {
    const parent = scale.parent;
    if (!parent || (!rotated && !lastRotated)) return originalBounds();
    const flipped = lastRotated !== rotated;
    lastRotated = rotated;
    if (!rotated) return originalBounds() || flipped;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (scale.parentSize.width === w && scale.parentSize.height === h) return flipped;
    scale.parentSize.setSize(w, h);
    return true;
  };
  // 置中：Phaser 用轉過以後的外框算，寬高會對調；轉的時候改用版面的寬高
  const originalCenter = scale.updateCenter.bind(scale);
  scale.updateCenter = () => {
    if (!rotated) return originalCenter();
    const c = scale.canvas;
    c.style.marginLeft = `${Math.floor((scale.parentSize.width - c.offsetWidth) / 2)}px`;
    c.style.marginTop = `${Math.floor((scale.parentSize.height - c.offsetHeight) / 2)}px`;
  };
  // 手指位置：Phaser 是 x、y 分開算的，轉過以後遊戲的 x 要看螢幕的 y，所以先把整個點記下來
  const page = { x: 0, y: 0 };
  const originalPointer = input.transformPointer.bind(input);
  input.transformPointer = (pointer, pageX, pageY, move) => {
    page.x = pageX;
    page.y = pageY;
    originalPointer(pointer, pageX, pageY, move);
  };
  const toGame = (): { x: number; y: number } => {
    const local = unrotatePoint(
      page.x - window.scrollX,
      page.y - window.scrollY,
      window.innerWidth,
    );
    const c = scale.canvas;
    const k = scale.baseSize.width / Math.max(1, c.offsetWidth);
    return { x: (local.x - c.offsetLeft) * k, y: (local.y - c.offsetTop) * k };
  };
  const originalX = scale.transformX.bind(scale);
  const originalY = scale.transformY.bind(scale);
  scale.transformX = (pageX) => (rotated ? toGame().x : originalX(pageX));
  scale.transformY = (pageY) => (rotated ? toGame().y : originalY(pageY));
}
syncRotation();
game.events.once(Phaser.Core.Events.READY, () => onResize());

let timers: number[] = [];
function onResize(): void {
  for (const t of timers) window.clearTimeout(t);
  applyViewport();
  timers = [100, 300, 700].map((ms) => window.setTimeout(applyViewport, ms));
}
// 手機防誤觸（T008）：iPhone 兩指縮放、長按或右鍵跳出的選單都擋掉（輸入框除外）
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener('contextmenu', (e) => {
  const el = e.target as HTMLElement | null;
  if (el?.tagName !== 'INPUT' && el?.tagName !== 'TEXTAREA') e.preventDefault();
});

window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
window.visualViewport?.addEventListener('resize', onResize);
document.addEventListener('fullscreenchange', onResize);
