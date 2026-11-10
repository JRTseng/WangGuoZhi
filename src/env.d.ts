/// <reference types="vite/client" />

/** build 時由 vite.config.ts 注入 */
declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;

/** 給 Playwright 判斷遊戲狀態用，不影響遊戲邏輯。座標為遊戲座標（390 x 844）。 */
interface WgzDebugState {
  scene: string;
  version: string;
  resources?: { food: number; bones: number };
  cards?: {
    id: string;
    name: string;
    power: number;
    /** 出征中 */
    busy?: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  /** 目前開啟資訊面板的角色 id，沒開為 null */
  panel?: string | null;
  expeditionButton?: {
    label: string;
    enabled?: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** 主畫面顯示中的出征，沒有為 null */
  expedition?: {
    id: string;
    stageId: string;
    dogIds: string[];
    remainingMs: number;
    complete: boolean;
  } | null;
  /** 收成結果面板顯示的獎勵，沒開為 null */
  result?: { food: number; bones: number } | null;
  backButton?: WgzRect;
  /** 出征面板（ExpeditionScene） */
  expeditionPanel?: {
    step: 'stage' | 'team';
    stages: ({ id: string; name: string } & WgzRect)[];
    teamCards: ({ id: string; busy: boolean; selected: boolean } & WgzRect)[];
    confirmButton: ({ label: string; enabled: boolean } & WgzRect) | null;
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
