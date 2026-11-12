import { DOGS, STARTER_DOG_IDS } from '../data/dogs';
import type { ThemeId } from '../data/regions';
import { INITIAL_RESOURCES, type Resources } from '../data/resources';
import type { BattleDog } from '../logic/battle';
import { initialProgress, type DogExpGain } from '../logic/leveling';

/**
 * 遊戲狀態：純物件（只有數字、字串、陣列），可直接 JSON 序列化，給 T006 存檔用。
 * 所有變更都經由 src/logic/ 的純函式，回傳新的狀態，不直接改舊物件。
 */

/**
 * 一隻狗的養成進度（T005）。攻防 = 資料檔的基礎值 + 這裡的成長值。
 * 隨機加成在升級當下就寫進來，存檔讀檔或重開都不會重抽。
 */
export interface DogProgress {
  level: number;
  /** 目前這一級已累積的經驗 */
  exp: number;
  /** 升級累積的攻擊成長（固定 + 隨機） */
  growthAttack: number;
  growthDefense: number;
  /** 其中隨機加成的累積，用來把運氣限制在平均 ±4 內 */
  bonusAttack: number;
  bonusDefense: number;
  /** 抽過幾次隨機加成 */
  rolls: number;
  /** 訓練場特訓的次數（T020），每次該屬性永久 +1；沒有這個欄位當成 0 */
  drillAttack?: number;
  drillDefense?: number;
}

/** 進行中的出征 */
export interface Expedition {
  id: string;
  stageId: string;
  /** 隊伍（狗狗 id，1 到 5 隻） */
  dogIds: string[];
  /** 出發當下隊伍的攻防等級；戰鬥用這份算，之後升級也不會改變這一仗的結果與重播 */
  team: BattleDog[];
  /** 開始時間（毫秒時間戳） */
  startedAt: number;
  /** 預計結束時間（毫秒時間戳） */
  endsAt: number;
  /** 戰鬥亂數種子：出征開始時就決定，重開頁面、略過與否結果都一樣，不能重抽 */
  seed: number;
}

/** 已收成的出征紀錄 */
export interface ExpeditionRecord {
  id: string;
  stageId: string;
  dogIds: string[];
  /** 出發當下隊伍的攻防等級（重播戰鬥用） */
  team: BattleDog[];
  startedAt: number;
  endsAt: number;
  collectedAt: number;
  /** 實際拿到的獎勵（敗北時只有一部分） */
  reward: Resources;
  /** 這一仗有沒有打贏 */
  win: boolean;
  /** 戰鬥亂數種子，可用來重播同一場戰鬥 */
  seed: number;
  /** 隊伍每隻狗這次拿到的經驗與升級成長（打輸只有一半經驗） */
  gains: DogExpGain[];
}

export type Quality = 'low' | 'medium' | 'high';

/** 帳號設定（語音／音樂／推播目前只記住開關，還沒有實際功能） */
export interface Settings {
  voice: boolean;
  music: boolean;
  push: boolean;
  quality: Quality;
  /** 略過戰鬥畫面：開啟後收成直接看結算 */
  skipBattle: boolean;
  /** 戰鬥播放倍速，下次戰鬥沿用 */
  battleSpeed: 1 | 2 | 3 | 4;
}

export interface GameState {
  resources: Resources;
  expeditions: Expedition[];
  history: ExpeditionRecord[];
  /** 下一個出征編號，用來產生不重複的 id */
  nextExpeditionNo: number;
  /** 擁有的狗狗 id */
  owned: string[];
  /** 每隻狗的養成進度（等級、經驗、成長值），以狗狗 id 為鍵 */
  dogs: Record<string, DogProgress>;
  /** 組隊編排（最多 5 隻），出征選角時預設帶入 */
  team: string[];
  /** 主頁上顯示的狗狗 */
  lobbyDogId: string;
  /** 主頁背景 */
  backgroundId: ThemeId;
  /** 已通過的關卡 id（打贏才算通過） */
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
    dogs: Object.fromEntries(
      DOGS.filter((d) => STARTER_DOG_IDS.includes(d.id)).map((d) => [d.id, initialProgress(d)]),
    ),
    team: ['daer', 'heixuan', 'changxu'],
    lobbyDogId: 'daer',
    backgroundId: 'slope',
    cleared: [],
    seenStories: [],
    redeemedCodes: [],
    settings: {
      voice: true,
      music: true,
      push: false,
      quality: 'high',
      skipBattle: false,
      battleSpeed: 1,
    },
  };
}
