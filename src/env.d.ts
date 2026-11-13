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
  /** 存檔狀態（T006）：這次是新遊戲／讀檔成功／壞檔重置，以及最後一次存檔有沒有成功 */
  save?: { load: 'new' | 'ok' | 'reset'; saveOk: boolean };

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
  /** 主頁出征卡底部的體力條（點了補體力） */
  status?: { label: string; enabled: boolean } & WgzRect;
  /** 目前體力（T019） */
  stamina?: { value: number; max: number };
  /** 主頁的自動出征：勾選框、累積了幾場還沒看、提示條（沒有結果為 null） */
  auto?: { enabled: boolean; runs: number; toggle: WgzRect; banner: WgzRect | null };
  /** 自動出征結果摘要視窗，沒開為 null */
  autoSummary?: {
    runs: number;
    wins: number;
    food: number;
    bones: number;
    stages: Record<string, number>;
  } | null;
  /** 補體力／加購次數的小視窗，沒開為 null */
  shop?: {
    kind: 'stamina' | 'runs';
    enabled: boolean;
    message: string;
    /** 今天還能買幾次 */
    left: number;
    ok: WgzRect;
    cancel: WgzRect;
  } | null;
  /** 陣型面板（T023），沒開為 null */
  formation?: {
    /** 隊伍裡每隻狗站第幾排（0 前、1 中、2 後）與那一格的位置 */
    dogs: ({ id: string; row: number; selected: boolean } & WgzRect)[];
    /** 三排各自的點擊範圍，索引就是第幾排 */
    rows: WgzRect[];
    selected: string | null;
    message: string;
    reset: WgzRect;
    close: WgzRect;
  } | null;
  /** 結算面板顯示的獎勵與勝負，沒開為 null */
  result?: { food: number; bones: number; win: boolean; newDogId?: string } | null;
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
    /** 改台詞的打字視窗是不是開著（T017） */
    lineEditor: boolean;
    /** 右上角進板凳寄宿的按鈕（T021）：幾隻在寄宿／幾個位子 */
    boardingButton: { count: number; slots: number } & WgzRect;
    list: WgzRect;
    /** 目前的排序條件，以及說明列右邊的排序按鈕 */
    sort: 'rarity' | 'level' | 'power' | 'star' | 'role';
    sortChip: WgzRect;
    scrollY: number;
    scrollMax: number;
    /** 目前糧草 */
    food: number;
    rows: ({
      id: string;
      /** 是不是在寄宿（T021） */
      boarding: boolean;
      level: number;
      exp: number;
      expNeed: number;
      attack: number;
      defense: number;
      power: number;
      /** 特訓按鈕（T020）：位置、已練次數、下一次花費、能不能按 */
      drill: {
        attack: { count: number; cost: number; enabled: boolean } & WgzRect;
        defense: { count: number; cost: number; enabled: boolean } & WgzRect;
      };
      /** 升星按鈕（T007）：目前幾星、手上碎片、升下一星要幾個、能不能按 */
      star: { star: number; shards: number; cost: number; enabled: boolean } & WgzRect;
      /** 等級上限（看星數） */
      levelCap: number;
      /** 招式台詞那一條（T017）：點了可以改；line 是目前會喊的台詞，custom 代表是玩家自己填的 */
      skillLine: { skill: string; line: string; custom: boolean } & WgzRect;
    } & WgzRect)[];
  };
  /** 召募畫面（T007） */
  recruit?: {
    buttons: { one: WgzRect; ten: WgzRect };
    /** 總共抽了幾次 */
    pulls: number;
    /** 再幾抽內必出 SSR */
    toPity: number;
    /** 已擁有幾隻／全部幾隻 */
    owned: number;
    total: number;
    /** 結果卡片還在一張一張跳出來 */
    revealing: boolean;
    /** 這次抽到的狗（照順序）與卡片位置 */
    results: ({
      dogId: string;
      rarity: 'N' | 'R' | 'SR' | 'SSR';
      isNew: boolean;
      shards: number;
    } & WgzRect)[];
  };
  /** 板凳寄宿畫面（T021） */
  boarding?: {
    /** 已開放幾個寄宿位 */
    open: number;
    /** 每小時大約拿多少經驗 */
    perHour: number;
    slots: ({
      state: 'dog' | 'empty' | 'locked';
      id?: string;
      /** 這次寄宿累積的經驗與升了幾級 */
      exp?: number;
      levels?: number;
      level?: number;
      /** 「接回」按鈕 */
      button?: WgzRect;
    } & WgzRect)[];
    list: WgzRect;
    scrollY: number;
    scrollMax: number;
    /** 還沒寄宿的狗：不能放的原因（可以放為 null）與「寄宿」按鈕 */
    rows: ({ id: string; level: number; block: string | null; button: WgzRect } & WgzRect)[];
  };
  /** 戰鬥畫面（BattleScene） */
  battle?: {
    stageId: string;
    /** 打完才知道勝負（T023 起一步一步打），還在打的時候是 null */
    win: boolean | null;
    /** playing：播放中；result：已顯示結算 */
    phase: 'playing' | 'result';
    /** 已經播過幾次補血（T017） */
    heals: number;
    /** 目前倍速 1～4 */
    speed: number;
    /** 每一次出手播多久（毫秒，已含倍速） */
    stepMs: number;
    /** 已播完幾次出手／總共幾次 */
    index: number;
    total: number;
    /** 大絕招演出（T017）：已經播了幾次／整場會播幾次，以及正在播的那一招（沒有為 null） */
    ults: number;
    ultTotal: number;
    ult: { id: string; side: string; skill: string; line: string; kind: string } | null;
    /** EN 值滿是多少（100） */
    enMax: number;
    /** 自動放招有沒有打勾，以及那顆勾選框的位置 */
    autoUlt: boolean;
    autoButton: WgzRect;
    /** 最後一次送給語音包掛點的提示 id（還沒有語音包，不會真的出聲） */
    voiceCue: string | null;
    round: number;
    skipped: boolean;
    skipButton: WgzRect;
    speedButton: WgzRect;
    /** en：目前的 EN 值（0～100），不會放大絕招的（野犬）為 null */
    team: WgzBattleUnit[];
    enemies: WgzBattleUnit[];
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
      autoUlt: boolean;
      trainingSort: string;
    };
    rects: Record<string, WgzRect>;
    input: WgzRect;
    message: string;
    /** 「重新開始」已按過一次，等第二次確認 */
    resetArmed: boolean;
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
    panelStats?: {
      level: number;
      exp: number;
      expNeed: number;
      power: number;
      star: number;
    } | null;
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
    formationButton: WgzRect;
    /** 隊伍每一隻站第幾排（0 前、1 中、2 後），和 slots 一一對應 */
    rows: number[];
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
    /** 體力不夠／次數用完時出現的「補體力／加次數」 */
    buyButton: ({ kind: 'stamina' | 'runs' } & WgzRect) | null;
    /** 這一關今天還剩幾次 */
    runsLeft: number;
    /** 選隊伍畫面顯示的勝率（0～1，模擬出來的） */
    winChance?: number;
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

interface WgzBattleUnit {
  id: string;
  hp: number;
  maxHp: number;
  en: number | null;
  /** 站第幾排（0 前、1 中、2 後）；armed：玩家點了「輪到牠就放大絕招」 */
  row: number;
  armed: boolean;
  x: number;
  y: number;
  r: number;
}
