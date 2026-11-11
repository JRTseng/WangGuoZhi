import { STARTER_DOG_IDS } from '../data/dogs';
import type { ThemeId } from '../data/regions';
import { INITIAL_RESOURCES, type Resources } from '../data/resources';

/**
 * 遊戲狀態：純物件（只有數字、字串、陣列），可直接 JSON 序列化，給 T006 存檔用。
 * 所有變更都經由 src/logic/ 的純函式，回傳新的狀態，不直接改舊物件。
 */

/** 進行中的出征 */
export interface Expedition {
  id: string;
  stageId: string;
  /** 隊伍（狗狗 id，3 隻） */
  dogIds: string[];
  /** 開始時間（毫秒時間戳） */
  startedAt: number;
  /** 預計結束時間（毫秒時間戳） */
  endsAt: number;
}

/** 已收成的出征紀錄 */
export interface ExpeditionRecord {
  id: string;
  stageId: string;
  dogIds: string[];
  startedAt: number;
  endsAt: number;
  collectedAt: number;
  reward: Resources;
}

export type Quality = 'low' | 'medium' | 'high';

/** 帳號設定（目前只是介面，語音／音樂／推播還沒有實際功能） */
export interface Settings {
  voice: boolean;
  music: boolean;
  push: boolean;
  quality: Quality;
}

export interface GameState {
  resources: Resources;
  expeditions: Expedition[];
  history: ExpeditionRecord[];
  /** 下一個出征編號，用來產生不重複的 id */
  nextExpeditionNo: number;
  /** 擁有的狗狗 id */
  owned: string[];
  /** 組隊編排（最多 3 隻），出征選角時預設帶入 */
  team: string[];
  /** 主頁上顯示的狗狗 */
  lobbyDogId: string;
  /** 主頁背景 */
  backgroundId: ThemeId;
  /** 已通過的關卡 id（目前收成即視為通過，T004 之後改成打贏才算） */
  cleared: string[];
  /** 已看過的劇情 id */
  seenStories: string[];
  /** 已兌換的優惠碼（大寫） */
  redeemedCodes: string[];
  settings: Settings;
}

export function createInitialState(): GameState {
  return {
    resources: { ...INITIAL_RESOURCES },
    expeditions: [],
    history: [],
    nextExpeditionNo: 1,
    owned: [...STARTER_DOG_IDS],
    team: ['daer', 'heixuan', 'changxu'],
    lobbyDogId: 'daer',
    backgroundId: 'slope',
    cleared: [],
    seenStories: [],
    redeemedCodes: [],
    settings: { voice: true, music: true, push: false, quality: 'high' },
  };
}
