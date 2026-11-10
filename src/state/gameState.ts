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

export interface GameState {
  resources: Resources;
  expeditions: Expedition[];
  history: ExpeditionRecord[];
  /** 下一個出征編號，用來產生不重複的 id */
  nextExpeditionNo: number;
}

export function createInitialState(): GameState {
  return {
    resources: { ...INITIAL_RESOURCES },
    expeditions: [],
    history: [],
    nextExpeditionNo: 1,
  };
}
