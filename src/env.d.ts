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
  /** 收成結果面板顯示的獎勵，沒開為 null */
  result?: { food: number; bones: number } | null;
  /** 帳號與設定面板，沒開為 undefined */
  settings?: {
    values: { voice: boolean; music: boolean; push: boolean; quality: string };
    rects: Record<string, WgzRect>;
    input: WgzRect;
    message: string;
  };

  /** 組隊畫面 */
  team?: {
    slots: ({ id: string | null } & WgzRect)[];
    dogs: ({ id: string; owned: boolean; inTeam: boolean; busy: boolean } & WgzRect)[];
    panel: string | null;
    panelButtons: { team?: WgzRect; lobby?: WgzRect } | null;
    lobbyDogId: string;
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
