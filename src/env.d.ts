/// <reference types="vite/client" />

/** build 時由 vite.config.ts 注入 */
declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;

/** 給 Playwright 判斷遊戲狀態用，不影響遊戲邏輯。座標為遊戲座標（直式 390 x 844、橫式 844 x 390）。 */
interface WgzDebugState {
  scene: string;
  version: string;
  orientation?: 'portrait' | 'landscape';
  /** 目前遊戲尺寸，測試用來把遊戲座標換成頁面座標 */
  size?: { width: number; height: number };
  resources?: { food: number; bones: number };
  backButton?: WgzRect;

  /** 主頁 */
  lobby?: {
    dogId: string;
    dogAction: string;
    background: string;
    buttons: Record<
      | 'account'
      | 'mail'
      | 'recruit'
      | 'shop'
      | 'reward'
      | 'team'
      | 'quest'
      | 'bag'
      | 'background'
      | 'expedition'
      | 'story'
      | 'event'
      | 'train',
      WgzRect
    >;
  };
  /** 主頁下方的出征狀態按鈕 */
  status?: { label: string; enabled: boolean } & WgzRect;
  /** 主頁顯示中的出征，沒有為 null */
  expedition?: {
    id: string;
    stageId: string;
    dogIds: string[];
    remainingMs: number;
    complete: boolean;
  } | null;
  /** 收成結算面板顯示的獎勵與勝負，沒開為 null */
  result?: { food: number; bones: number; win: boolean } | null;
  /** 結算面板上每隻狗的經驗與升級（T005），沒開為 null */
  growth?:
    | {
        dogId: string;
        exp: number;
        fromLevel: number;
        toLevel: number;
        attack: { fixed: number; bonus: number };
        defense: { fixed: number; bonus: number };
      }[]
    | null;
  /** 訓練場（TrainingScene） */
  training?: {
    list: WgzRect;
    scrollY: number;
    scrollMax: number;
    rows: ({
      id: string;
      level: number;
      exp: number;
      expNeed: number;
      attack: number;
      defense: number;
      power: number;
    } & WgzRect)[];
  };
  /** 戰鬥畫面（BattleScene） */
  battle?: {
    stageId: string;
    win: boolean;
    /** playing：播放中；result：已顯示結算 */
    phase: 'playing' | 'result';
    /** 目前倍速 1～4 */
    speed: number;
    /** 每一次出手播多久（毫秒，已含倍速） */
    stepMs: number;
    /** 已播完幾次出手／總共幾次 */
    index: number;
    total: number;
    round: number;
    skipped: boolean;
    skipButton: WgzRect;
    speedButton: WgzRect;
    team: { id: string; hp: number; maxHp: number; x: number; y: number; r: number }[];
    enemies: { id: string; hp: number; maxHp: number; x: number; y: number; r: number }[];
  };
  /** 帳號與設定面板，沒開為 undefined */
  settings?: {
    values: {
      voice: boolean;
      music: boolean;
      push: boolean;
      quality: string;
      skipBattle: boolean;
      battleSpeed: number;
    };
    rects: Record<string, WgzRect>;
    input: WgzRect;
    message: string;
  };

  /** 組隊畫面 */
  team?: {
    slots: ({ id: string | null } & WgzRect)[];
    /** 目前列出的狗（已篩選、排序） */
    dogs: ({
      id: string;
      owned: boolean;
      inTeam: boolean;
      busy: boolean;
      visible: boolean;
    } & WgzRect)[];
    /** 擁有幾隻 */
    owned: number;
    panel: string | null;
    /** 資訊面板上顯示的等級與經驗（沒開為 null） */
    panelStats?: { level: number; exp: number; expNeed: number; power: number } | null;
    panelButtons: { team?: WgzRect; lobby?: WgzRect } | null;
    lobbyDogId: string;
  };

  /** 選狗元件（組隊編排與出征選狗共用，T015） */
  picker?: {
    filter: { role: string; status: string };
    sort: string;
    roleChips: ({ key: string } & WgzRect)[];
    statusChips: ({ key: string } & WgzRect)[];
    sortChip: WgzRect;
    autoButton: WgzRect;
    slots: ({ id: string | null } & WgzRect)[];
    /** 卡片格可見範圍 */
    grid: WgzRect;
    /** 目前列出的狗（已篩選、排序），座標已扣掉捲動量 */
    cells: ({
      id: string;
      owned: boolean;
      busy: boolean;
      selected: boolean;
      visible: boolean;
    } & WgzRect)[];
    scrollY: number;
    scrollMax: number;
  };

  /** 出征地圖 */
  map?: {
    chapter: number;
    chapters: ({ id: string; unlocked: boolean } & WgzRect)[];
    nodes: ({ id: string; state: 'locked' | 'open' | 'cleared'; boss: boolean } & WgzRect)[];
    stagePanel: { stageId: string; go: WgzRect } | null;
  };

  /** 出征選隊伍（ExpeditionScene） */
  expeditionPanel?: {
    step: 'team';
    stageId: string;
    stages: never[];
    teamCards: ({ id: string; busy: boolean; selected: boolean } & WgzRect)[];
    confirmButton: ({ label: string; enabled: boolean } & WgzRect) | null;
  };

  /** 劇情 */
  story?: {
    mode: 'list' | 'play';
    items: ({ id: string; unlocked: boolean } & WgzRect)[];
    playing: string | null;
    line: number;
    total: number;
    skip?: WgzRect;
  };
}

interface WgzRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Window {
  __WGZ__?: WgzDebugState;
}
