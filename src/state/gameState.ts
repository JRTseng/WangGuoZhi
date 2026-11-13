import { DOGS, STARTER_DOG_IDS } from '../data/dogs';
import type { ThemeId } from '../data/regions';
import { INITIAL_RESOURCES, type Resources } from '../data/resources';
import type { BattleDog } from '../logic/battle';
import { initialProgress, type DogExpGain } from '../logic/leveling';

/**
 * 遊戲狀態：純物件（只有數字、字串、陣列），可直接 JSON 序列化，整份存進存檔（T006）。
 * 加新欄位時，記得在 src/logic/save.ts 的 sanitizeState 補上檢查，否則讀檔時會被丟掉。
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
  /** 星數（T007）：1～5，升星提高攻防與等級上限；沒有這個欄位當成 1 星 */
  star?: number;
}

/** 一次出征的紀錄（T019 起出征當下就結算，沒有等待時間） */
export interface ExpeditionRecord {
  id: string;
  stageId: string;
  dogIds: string[];
  /** 出發當下隊伍的攻防等級（重播戰鬥用） */
  team: BattleDog[];
  /** 出征時間（毫秒時間戳） */
  at: number;
  /** 實際拿到的獎勵（敗北時只有一部分） */
  reward: Resources;
  /** 這一仗有沒有打贏 */
  win: boolean;
  /** 戰鬥亂數種子，可用來重播同一場戰鬥 */
  seed: number;
  /** 隊伍每隻狗這次拿到的經驗與升級成長（打輸只有一半經驗） */
  gains: DogExpGain[];
  /** 是不是自動出征打的 */
  auto?: boolean;
  /** 這一仗第一次通關送的狗狗 id（T017） */
  newDogId?: string;
}

/** 體力（T019）：只存數值與上次結算時間，要用時才依經過的時間補算 */
export interface StaminaState {
  value: number;
  /** 上次結算恢復的時間（毫秒時間戳） */
  updatedAt: number;
}

/** 每日額度（T019），每天 05:00 重置 */
export interface DailyState {
  /** 這份額度屬於哪一天（以 05:00 為界的日期字串） */
  day: string;
  /** 各關今天已出征幾次 */
  runs: Record<string, number>;
  /** 各關今天加購了幾次 */
  extraRuns: Record<string, number>;
  /** 今天買了幾次體力 */
  staminaBuys: number;
  /** 今天買了幾次出征次數（所有關卡合計） */
  runBuys: number;
}

/** 自動出征累積的結果摘要，玩家看過就清掉 */
export interface AutoSummary {
  runs: number;
  wins: number;
  reward: Resources;
  /** 各關打了幾場 */
  stages: Record<string, number>;
  /** 每隻狗累積拿到的經驗與升了幾級 */
  dogs: Record<string, { exp: number; levels: number }>;
}

/** 自動出征（T019） */
export interface AutoState {
  enabled: boolean;
  /** 上次處理到的時間；下次從這裡補算到現在 */
  lastAt: number;
  summary: AutoSummary | null;
}

/** 訓練場的一個寄宿位（T021）：放在裡面的狗隨時間慢慢拿經驗，離線也算 */
export interface BoardingSlot {
  dogId: string;
  /** 開始寄宿的時間（毫秒時間戳） */
  since: number;
  /** 上次結算經驗的時間 */
  at: number;
  /** 還沒湊滿 1 點經驗的零頭（單位：毫秒 × 每場經驗） */
  carry: number;
  /** 這次寄宿累積拿到的經驗與升了幾級（顯示用） */
  exp: number;
  levels: number;
}

/** 召募（抽卡，T007）的累計紀錄 */
export interface GachaState {
  /** 總共抽了幾次 */
  pulls: number;
  /** 連續幾抽沒出 SSR（保底用；抽到 SSR 歸零） */
  sinceSSR: number;
}

export type Quality = 'low' | 'medium' | 'high';

/** 帳號設定（語音／音樂／推播目前只記住開關，還沒有實際功能） */
export interface Settings {
  voice: boolean;
  music: boolean;
  push: boolean;
  quality: Quality;
  /** 略過戰鬥畫面：開啟後開戰直接看結算 */
  skipBattle: boolean;
  /** 戰鬥播放倍速，下次戰鬥沿用 */
  battleSpeed: 1 | 2 | 3 | 4;
}

export interface GameState {
  resources: Resources;
  /** 最近的出征紀錄（只留最後幾筆） */
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
  stamina: StaminaState;
  daily: DailyState;
  auto: AutoState;
  /** 訓練場寄宿中的狗（T021） */
  boarding: BoardingSlot[];
  /** 各隻狗的碎片（T007）：重複抽到就換碎片，升星時花掉；以狗狗 id 為鍵 */
  shards: Record<string, number>;
  /** 召募的累計紀錄（T007） */
  gacha: GachaState;
}

/** 體力上限；新遊戲從滿體力開始 */
export const STAMINA_MAX = 100;

export function createInitialState(now: number = Date.now()): GameState {
  return {
    resources: { ...INITIAL_RESOURCES },
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
    stamina: { value: STAMINA_MAX, updatedAt: now },
    // day 留空：第一次結算時會換成當天
    daily: { day: '', runs: {}, extraRuns: {}, staminaBuys: 0, runBuys: 0 },
    auto: { enabled: false, lastAt: now, summary: null },
    boarding: [],
    shards: {},
    gacha: { pulls: 0, sinceSSR: 0 },
  };
}
