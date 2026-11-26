import type { HomeState } from '../logic/home';
import type { CodexState } from '../logic/codex';
import type { MallState } from '../logic/mall';
import type { BondState, BondUp } from '../logic/bond';
import type { MailState } from '../logic/mail';
import { DOGS, STARTER_DOG_IDS, type Faction } from '../data/dogs';
import type { GearSlot } from '../data/equipment';
import type { ThemeId } from '../data/regions';
import { INITIAL_RESOURCES, type Resources } from '../data/resources';
import type { BattleDog } from '../logic/battle';
import { initialProgress, type DogExpGain } from '../logic/leveling';
import { DEFAULT_TRAINING_SORT, type TrainingSortKey } from '../logic/trainingSort';

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
/** 打贏老鼠幫拿到的一樣寶物（T034） */
export type RatLoot =
  | { kind: 'food' | 'bones'; amount: number }
  | { kind: 'snack' | 'shards'; id: string; amount: number }
  | { kind: 'gear'; id: string };

/** 活動事件「刺青老鼠幫」（T034，規則見 src/logic/ratRaid.ts） */
export interface RatState {
  /** 這份次數是哪一個遊戲日的 */
  day: string;
  /** 今天打贏幾波 */
  wins: number;
  /** 累計打贏幾波 */
  total: number;
}

export interface ExpeditionRecord {
  /** 這一仗讓誰的好感度升級了（T042），沒有就不記 */
  bondUps?: BondUp[];
  /** 打贏老鼠幫拿到的寶物（T034） */
  loot?: RatLoot[];
  /** 這一仗送的爬塔限定裝備 id（登天塔） */
  towerGearId?: string;
  /** 這一仗幫陣營賺了幾分（T030） */
  warPoints?: number;
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
  /** 我方在整場第幾次出手時放了大絕招（T023；玩家手動放招才有，沒有代表自動放招） */
  ultTurns?: number[];
  /** 是不是自動出征打的 */
  auto?: boolean;
  /** 這一仗第一次通關送的狗狗 id（T017） */
  newDogId?: string;
  /** 這一仗掉的裝備 id（T014）；沒掉就沒有這個欄位 */
  dropGearId?: string;
  /** 這一仗拿到的城主經驗與升級結果 */
  lord?: { exp: number; fromLevel: number; toLevel: number; food: number; bones: number };
  /** 這一仗掉的經驗零食；打輸沒有 */
  dropSnack?: { id: string; amount: number };
  /** 第一次通關要送的狗已經先抽到了，改送的碎片 */
  giftShards?: { dogId: string; amount: number };
}

/**
 * 已經開戰、還沒打完的一仗（T023）：體力與次數在開戰時就扣了，
 * 戰鬥畫面打完才結算；中途關掉遊戲，下次開啟時用自動放招直接算完。
 */
export interface PendingBattle {
  stageId: string;
  dogIds: string[];
  /** 開戰當下隊伍的攻防、定位與站位 */
  team: BattleDog[];
  seed: number;
  /** 開戰時間（毫秒時間戳） */
  at: number;
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
  /** 掉了哪些裝備、各幾件（T014）；沒掉過就沒有這個欄位 */
  gear?: Record<string, number>;
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

/** 每日任務會數的事情（T011）：出征、打贏、特訓、召募 */
export type DailyCounter = 'battle' | 'win' | 'drill' | 'pull';

/** 每週任務（T045）會數的事情：每日那四種，加上摸摸角色、每日任務做完的天數 */
export type WeeklyCounter = DailyCounter | 'pet' | 'days';

/** 這一週的每週任務（T045）：week 是那一週星期一的遊戲日，換週時清空 */
export interface WeeklyQuestState {
  week: string;
  counts: Partial<Record<WeeklyCounter, number>>;
  claimed: string[];
}

/**
 * 任務（T011）。主線與成就的進度都從別的欄位算出來（通關紀錄、擁有的狗……），
 * 這裡只記「領過哪些獎勵」、累計打贏幾場，還有今天的每日任務。
 */
export interface QuestState {
  /** 已領獎的主線與成就任務 id */
  claimed: string[];
  /** 累計打贏幾場 */
  wins: number;
  /** 今天的每日任務：各種事情做了幾次、領過哪些；換日時（05:00）清空 */
  daily: { counts: Partial<Record<DailyCounter, number>>; claimed: string[] };
  /** 這一週的每週任務（T045）；每週一 05:00 清空 */
  weekly: WeeklyQuestState;
}

/** 城主等級與經驗（規則見 src/logic/lord.ts） */
export interface LordState {
  level: number;
  exp: number;
}

/** 訓練場每日小遊戲「接飛盤」（T022，規則見 src/logic/frisbee.ts） */
export interface FrisbeeState {
  /** 上次拿到獎勵是哪一天（以 05:00 為界的日期字串）；和今天一樣就是今天玩過了 */
  day: string;
  /** 一場最多接到幾個 */
  best: number;
}

/** 七日簽到（T026，規則見 src/logic/signin.ts） */
export interface SigninState {
  /** 上次簽到是哪一天（以 05:00 為界的日期字串）；和今天一樣就是今天簽過了 */
  day: string;
  /** 累計簽到幾天（只拿來顯示） */
  count: number;
  /** 這一輪已經連續簽了幾格（0～7）；隔天沒來就斷掉，從第 1 天重來 */
  streak: number;
  /** 第 7 天要哪隻 SSR 狗的碎片（狗的 id）；空字串是還沒選 */
  pick: string;
  /** 哪一天已經自動跳出過簽到畫面（每天第一次進主頁才跳） */
  shown: string;
}

/** 登天塔（規則見 src/logic/tower.ts） */
export interface TowerState {
  /** 這份進度是哪一週的（那一週星期一的日期）；換週就重置 */
  week: string;
  /** 這週爬到第幾層 */
  floor: number;
  /** 上週爬到第幾層（一鍵通關用） */
  last: number;
  /** 歷來最高第幾層 */
  best: number;
  /** 已經送過限定裝備的層 */
  gear: number[];
}

/** 陣營積分戰（T030）：這週自己的積分與上週等著領的結果 */
export interface WarState {
  /** 積分算在哪一週（那週星期一的遊戲日）；空字串是還沒開始 */
  week: string;
  /** 這些積分是幫哪個陣營賺的；週中換陣營就歸零 */
  faction: Faction | '';
  points: number;
  /** 這週領過的個人積分獎勵（WAR_MILESTONES 的索引） */
  claimed: number[];
  /** 上週的結果，領了就清掉 */
  result: { week: string; faction: Faction; points: number } | null;
}

export type Quality = 'low' | 'medium' | 'high';

/** 帳號設定（語音／推播目前只記住開關，還沒有實際功能；音樂與音效見 T016） */
export interface Settings {
  voice: boolean;
  /** 背景音樂 */
  music: boolean;
  /** 音效（點按、攻擊、勝利等） */
  sfx: boolean;
  push: boolean;
  quality: Quality;
  /** 戰鬥特效：關掉後大絕招不播喊招字卡與招式特效，打起來比較快也比較省電 */
  effects: boolean;
  /** 略過戰鬥畫面：開啟後開戰直接看結算 */
  skipBattle: boolean;
  /** 戰鬥播放倍速，下次戰鬥沿用 */
  battleSpeed: 1 | 2 | 3 | 4;
  /** 戰鬥中自動放大絕招（T023）：關掉後要自己點 EN 滿的狗才會放 */
  autoUlt: boolean;
  /** 結算「下一關」旁邊的「自動」：打贏後自己接著打下一關，直到打輸、沒體力或沒有下一關 */
  autoNext: boolean;
  /** 訓練場上次選的排序條件，下次進去沿用 */
  trainingSort: TrainingSortKey;
}

/** 一組存起來的隊伍：成員與牠們在九宮格的站位 */
export interface TeamPreset {
  team: string[];
  formation: Record<string, number>;
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
  /** 現在用的是第幾組隊伍（0～4）；team／formation 就是這一組（見 src/logic/teams.ts） */
  teamIndex: number;
  /** 五組隊伍；第 teamIndex 格在切走時才寫回，平常以 team／formation 為準 */
  teams: TeamPreset[];
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
  /** 玩家替狗狗填的大絕招台詞（T017），以狗狗 id 為鍵；沒填的用預設台詞 */
  skillLines: Record<string, string>;
  /**
   * 陣型（T023）：每隻狗想站哪裡，以狗狗 id 為鍵；沒記的照定位預設。
   * 0～2 只記排（0 前、1 中、2 後）；3～11 是九宮格的格子（見 src/logic/formation.ts）
   */
  formation: Record<string, number>;
  /** 已經開戰、還沒打完的一仗（T023）；沒有為 null */
  pending: PendingBattle | null;
  /** 裝備（T014）：每種裝備擁有幾件，以裝備 id 為鍵 */
  gear: Record<string, number>;
  /** 每隻狗每個部位穿哪一件裝備，以狗狗 id 為鍵（規則見 src/logic/equipment.ts） */
  equipped: Record<string, Partial<Record<GearSlot, string>>>;
  /** 裝備星等（T036）：每種裝備升到幾星，以裝備 id 為鍵，沒記的是 0 星（規則見 src/logic/gearStar.ts） */
  gearStars: Record<string, number>;
  /** 受傷外觀（T014）：哪些狗剛出征回來或掛彩、到什麼時候為止；純外觀（見 src/logic/wounds.ts） */
  wounds: Record<string, { until: number; level: 1 | 2 }>;
  /** 經驗零食：每種有幾個，以零食 id 為鍵（見 src/logic/snacks.ts） */
  snacks: Record<string, number>;
  /** 城主等級與經驗 */
  lord: LordState;
  /** 任務（T011）：領過的獎勵、累計勝場與今天的每日任務（規則見 src/logic/quests.ts） */
  quests: QuestState;
  /** 我的家（T033）：住哪幾隻、擺了哪些家具（規則見 src/logic/home.ts） */
  home: HomeState;
  /** 訓練場每日小遊戲（T022）：今天玩過沒、最佳紀錄 */
  frisbee: FrisbeeState;
  /** 七日簽到（T026）：上次簽到的日期與累計天數 */
  signin: SigninState;
  /** 登天塔：這週與上週的進度 */
  tower: TowerState;
  rats: RatState;
  /** 陣營（T029）：汪國 dog／喵國 cat；空字串是還沒選（當汪國） */
  faction: Faction | '';
  /** 陣營積分戰（T030） */
  war: WarState;
  /** 圖鑑（T038）：領過哪幾段收集獎勵（規則見 src/logic/codex.ts） */
  codex: CodexState;
  /** 商城（T039）：今天每一格買了幾次（規則見 src/logic/mall.ts） */
  mall: MallState;
  /** 信箱（T040）：哪幾封信看過、領過、刪掉（規則見 src/logic/mail.ts） */
  mail: MailState;
  /** 好感度（T042）：每個角色累積多少、今天摸過誰（規則見 src/logic/bond.ts） */
  bond: BondState;
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
    teamIndex: 0,
    teams: Array.from({ length: 5 }, () => ({ team: [], formation: {} })),
    lobbyDogId: 'daer',
    backgroundId: 'slope',
    cleared: [],
    seenStories: [],
    redeemedCodes: [],
    settings: {
      voice: true,
      music: true,
      sfx: true,
      push: false,
      quality: 'high',
      effects: true,
      skipBattle: false,
      battleSpeed: 1,
      autoUlt: true,
      autoNext: false,
      trainingSort: DEFAULT_TRAINING_SORT,
    },
    stamina: { value: STAMINA_MAX, updatedAt: now },
    // day 留空：第一次結算時會換成當天
    daily: { day: '', runs: {}, extraRuns: {}, staminaBuys: 0, runBuys: 0 },
    auto: { enabled: false, lastAt: now, summary: null },
    boarding: [],
    shards: {},
    gacha: { pulls: 0, sinceSSR: 0 },
    skillLines: {},
    formation: {},
    pending: null,
    gear: {},
    equipped: {},
    gearStars: {},
    wounds: {},
    snacks: {},
    quests: {
      claimed: [],
      wins: 0,
      daily: { counts: {}, claimed: [] },
      weekly: { week: '', counts: {}, claimed: [] },
    },
    lord: { level: 1, exp: 0 },
    frisbee: { day: '', best: 0 },
    signin: { day: '', count: 0, streak: 0, pick: '', shown: '' },
    tower: { week: '', floor: 0, last: 0, best: 0, gear: [] },
    rats: { day: '', wins: 0, total: 0 },
    faction: '',
    war: { week: '', faction: '', points: 0, claimed: [], result: null },
    home: { residents: null, placed: null, area: 'indoor', style: 'meadow' },
    codex: { claimed: [] },
    mall: { day: '', bought: [] },
    mail: { read: [], claimed: [], deleted: [] },
    bond: { points: {}, day: '', petted: [], gifted: {} },
  };
}
