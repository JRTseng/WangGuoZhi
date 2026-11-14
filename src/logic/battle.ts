import { calcPower } from './power';

/**
 * 戰鬥（T023，純函式）：三排陣型，一回合一回合真的打出來。
 *
 * - 雙方各有前排、中排、後排（row 0／1／2）。一般攻擊只打得到對方「最前面還有狗的那一排」，
 *   各定位另有自己的範圍（突擊穿透、謀略越排、幸運亂打、補血補隊友）。
 * - 每隻有血量、攻擊、防禦與 EN 值。EN 出手 +34～100（照稀有度，SSR 一次就滿）、被打 +20，滿 100 可以放大絕招，放完歸零。
 * - 模擬可以「一步一步往前推」：stepBattle(目前狀態, 這一步要不要放大絕招) → 下一個狀態。
 *   玩家手動放招時畫面一步一步推；全自動（略過、自動出征、估勝率）用 resolveBattle 一次算完。
 * - 亂數只來自種子，狀態裡帶著亂數的進度：同種子、同隊伍、同陣型、同關卡、同樣的放招時機，
 *   結果與紀錄完全相同。
 *
 * 數值都是暫定：傷害 = 攻擊力（±10% 浮動，再乘上各種加成），血量 = 防禦 × HP_PER_DEF。
 * 防禦不另外減傷，而是直接變成血量，這樣「戰力 = 攻擊 + 防禦」不管幾級、帶幾隻都一樣準：
 * 隊伍的總攻擊決定打多快，總防禦決定撐多久。
 * 敵方由關卡建議戰力推出（攻防各半），另有一個「敵方氣勢」的隨機浮動，
 * 讓戰力等於建議戰力、照定位排好時勝率大約六成。
 */

/** 隊伍人數下限、上限 */
export const BATTLE_TEAM_MIN = 1;
export const BATTLE_TEAM_MAX = 5;
/** 一排最多站幾隻 */
export const ROW_MAX = 3;
/** 敗北時拿到的獎勵比例 */
export const DEFEAT_REWARD_RATE = 0.3;

/** EN 值：滿了才能放大絕招。2026-11-14 Jimmy 同意調快（原本 25／15，新手第 1 關多半看不到大絕招） */
export const EN_MAX = 100;
/** 出手一次集多少：沒標稀有度的狗與頭目用這個 */
export const EN_PER_ACT = 40;
/**
 * 稀有度越高集得越快（Jimmy 2026-11-14）：SSR 出手一次就滿，下一次出手就能放；
 * SR 兩次；R 兩次再被打一下、或三次；N 三次。
 */
export const EN_PER_ACT_BY_RARITY: Readonly<Record<BattleRarity, number>> = {
  N: 34,
  R: 40,
  SR: 50,
  SSR: 100,
};
export const EN_PER_HIT = 20;

/** 補血量：被補的那隻最大血量的 25% */
export const HEAL_RATE = 0.25;
/** 「攻擊後補血」的狗（暖桶）每次攻擊後補血量比例最低的幾位隊友（含自己；沒受傷的不補） */
export const HEAL_TARGETS = 2;
/** 一般補血狗：有隊友血量低於這個比例才補，不然就攻擊 */
export const HEAL_BELOW = 0.6;
/** 補血大絕招：全隊各回這個比例 */
export const HEAL_ULT_RATE = 0.2;
/** 自動放招時，補血大絕招要等到有隊友血量低於這個比例才放 */
export const HEAL_ULT_BELOW = 0.7;

/** 穿透打到後面那幾隻的傷害比例 */
export const PIERCE_RATE = 0.6;
/** 突擊大絕招（前中後各一隻）的傷害倍率 */
export const PIERCE_ULT_RATE = 1.2;
/** 突擊第一次出手的傷害加成 */
export const FIRST_STRIKE_RATE = 1.3;
/** 守護：平常受到的傷害比例；嘲諷中改用另一個比例（不疊加） */
export const GUARD_TAKEN = 0.85;
export const TAUNT_TAKEN = 0.7;
/** 嘲諷、鼓舞持續到「放招那一回合的下 N 回合結束」 */
export const BUFF_ROUNDS = 1;
/** 鼓舞：全隊攻擊倍率 */
export const INSPIRE_RATE = 1.15;
/** 補給：同一排隊友受到的傷害比例（等於防禦 +10%） */
export const SUPPLY_TAKEN = 1 / 1.1;
/** 幸運：爆擊機率與倍率、被打時閃過的機率、大絕招連打幾次 */
export const CRIT_CHANCE = 0.25;
export const CRIT_RATE = 2;
export const DODGE_CHANCE = 0.15;
export const LUCKY_ULT_HITS = 3;
/**
 * 站位的影響（讓陣型排對排錯有差）：
 * - 近戰（守護、突擊，敵方的野犬、頭目）不在自己這邊最前面那一排時夠不太到，傷害打折；
 *   前面的隊友倒了、自己變成最前排，就恢復原本的傷害。
 * - 後衛（謀略、幸運、補血）被推到最前面那一排時沒人掩護，受到的傷害變多。
 */
export const MELEE_BACK_RATE = 0.5;
export const REAR_FRONT_TAKEN = 1.4;
/**
 * 專屬特性（T024）：同定位的狗多半共用一套打法，有特性的狗再多一點自己的東西。數值都是暫定。
 * - pierce3（流星）：一般攻擊就穿透三排；大絕招傷害更高
 * - command（松嶺）：大絕招「號令」多撐一回合，期間全隊受到的傷害也減少
 * - fortune（福球）：爆擊機率加倍，爆擊時再多打一下
 * - rescue（海晏）：不做單體補血；攻擊後給血量最低的隊友一層護盾，
 *   大絕招全隊回血並救起一隻倒下的隊友（一場一次），全隊受到整排、穿透攻擊的傷害減少
 * - slow（雙瞳）：大絕招打到的敵人慢一拍，到下一回合結束前傷害變少
 * - double（金鈴）：一般攻擊亂打兩次
 * - evasive（彩翼）：閃避機率加倍
 * - cheer（絨耳）：被牠補血的隊友，到下一回合結束前攻擊提高
 * - rowHeal（麥穗）：一次補同一排受傷的隊友
 * - shortTaunt（石墩）：嘲諷只到這一回合結束
 * - smallHeal（皺皺）：補血量比較少
 */
export type BattleTrait =
  | 'pierce3'
  | 'command'
  | 'fortune'
  | 'rescue'
  | 'slow'
  | 'double'
  | 'evasive'
  | 'cheer'
  | 'rowHeal'
  | 'shortTaunt'
  | 'smallHeal';

/** 流星大絕招的傷害倍率（一般突擊是 PIERCE_ULT_RATE） */
export const PIERCE3_ULT_RATE = 1.5;
/** 松嶺「號令」：期間全隊受到的傷害比例（等於防禦 +15%） */
export const RALLY_TAKEN = 1 / 1.15;
/** 福球的爆擊機率、彩翼的閃避機率 */
export const FORTUNE_CRIT_CHANCE = CRIT_CHANCE * 2;
export const EVASIVE_DODGE_CHANCE = DODGE_CHANCE * 2;
/** 海晏的護盾：擋掉下一次傷害的這個比例，擋一次就沒了 */
export const SHIELD_RATE = 0.3;
/** 海晏大絕招：全隊各回這個比例；救起來的隊友回到這個比例的血量；一場能救幾次 */
export const RESCUE_ULT_RATE = 0.15;
export const REVIVE_RATE = 0.3;
export const REVIVE_MAX = 1;
/** 海晏在場時，全隊受到整排、穿透攻擊的傷害比例 */
export const RESCUE_AREA_TAKEN = 0.9;
/** 雙瞳「慢一拍」：被打到的敵人傷害比例 */
export const SLOW_RATE = 0.7;
/** 絨耳「打氣」：被補的隊友攻擊倍率 */
export const CHEER_RATE = 1.1;
/** 麥穗一次補一排，每隻回這個比例；皺皺的補血量 */
export const ROW_HEAL_RATE = 0.2;
export const SMALL_HEAL_RATE = 0.15;

/** 每一下傷害的隨機浮動：±10% */
export const DAMAGE_SPREAD = 0.1;

/** 血量 = 防禦 × HP_PER_DEF */
export const HP_PER_DEF = 6;
/** 敵方強度的倍率（調勝率用）：野犬群、單獨一隻的頭目各一個 */
export const MOB_SCALE = 1.1;
export const BOSS_SCALE = 0.92;
/** 頭目大絕招（打最前面一整排）每一隻吃到的傷害比例 */
export const BOSS_ULT_RATE = 0.5;
/** 野犬的站位：前兩隻站前排，第三隻起站中排（T018 會換成每關自己的陣容） */
export const MOB_FRONT = 2;
/** 敵方氣勢：每一場敵方的血量與傷害在 ±這個比例之間浮動 */
export const MORALE_RANGE = 0.12;
/** 打到這麼多回合還沒分出勝負就算我方撤退（敗北） */
export const MAX_ROUNDS = 30;

export type BattleSide = 'team' | 'enemy';
/** 站哪一排：0 前排、1 中排、2 後排 */
export type RowIndex = 0 | 1 | 2;
export const ROW_NAMES: readonly string[] = ['前排', '中排', '後排'];

/** 戰鬥中的定位：六種狗狗定位，加上敵方的野犬（只會普通攻擊）與頭目（Boss） */
export type BattleRole = '突擊' | '守護' | '謀略' | '幸運' | '補給' | '補血' | '野犬' | '頭目';

/** 這個定位預設站哪一排：守護、突擊前排，補給中排，謀略、幸運、補血後排 */
export function defaultRowOf(role: BattleRole | undefined): RowIndex {
  if (role === '補給' || role === '頭目') return 1;
  if (role === '謀略' || role === '幸運' || role === '補血') return 2;
  return 0;
}

export type BattleRarity = 'N' | 'R' | 'SR' | 'SSR';

/** 參戰的狗：傳入攻防等級，不直接讀資料檔。攻防已含升級成長值，等級只是顯示用 */
export interface BattleDog {
  id: string;
  name: string;
  attack: number;
  defense: number;
  level: number;
  /** 有沒有技能（有的才會集 EN、放大絕招） */
  hasSkill?: boolean;
  /** 補血狗（舊紀錄只有這個欄位，沒有 role） */
  heal?: boolean;
  /** 定位；沒填的當成守護（補血狗當成補血） */
  role?: BattleRole;
  /** 站哪一排；沒填就照定位的預設 */
  row?: RowIndex;
  /** 站那一排的上、中、下哪一格（0／1／2）；只影響畫面位置，不影響勝負 */
  lane?: number;
  /** SSR：大絕招再強一級（守護嘲諷多一回合、謀略一次打兩排） */
  ssr?: boolean;
  /** 稀有度：決定出手一次集多少 EN；沒填的話 ssr 當 SSR，其餘用 EN_PER_ACT */
  rarity?: BattleRarity;
  /** 攻擊後補血（暖桶）：每次攻擊完接著補血量最低的兩位隊友，不是「補血或攻擊二選一」 */
  afterHeal?: boolean;
  /** 專屬特性（T024） */
  trait?: BattleTrait;
}

export interface BattleInput {
  team: readonly BattleDog[];
  /** 關卡建議戰力，敵方血量與攻擊由它推算 */
  recommendedPower: number;
  /** 敵方的名字，一個名字一隻 */
  enemyNames: readonly string[];
  /** Boss 關：敵方是頭目，站中排、會放大絕招；不是的話是站前排的野犬 */
  boss?: boolean;
  /** 亂數種子 */
  seed: number;
}

export interface BattleUnit {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  defense: number;
  /** 傷害倍率（敵方的強度倍率與氣勢；我方是 1） */
  might: number;
  role: BattleRole;
  row: RowIndex;
  /** 九宮格的上、中、下（我方才有；只影響畫面位置） */
  lane?: number;
  /** 會不會集 EN、放大絕招 */
  canUlt: boolean;
  /** 出手一次集多少 EN */
  enPerAct: number;
  ssr: boolean;
  afterHeal: boolean;
  /** 是不是補血狗（畫面在名字前面加 ✚） */
  heal?: boolean;
  /** 專屬特性（T024） */
  trait?: BattleTrait;
}

/** 大絕招的種類（演出用）：單體連打、穿透、整排、補血、強化 */
export type ActionKind = 'attack' | 'single' | 'pierce' | 'row' | 'heal' | 'buff';

/** 一次出手裡打到（或補到）的一隻 */
export interface BattleHit {
  /** 被打（被補）的是哪一方的第幾隻 */
  side: BattleSide;
  target: number;
  /** 傷害，0 代表被閃過或這一下是補血 */
  damage: number;
  /** 補血量；有這個欄位代表這一下是補血 */
  heal?: number;
  /** 這一下之後的血量 */
  targetHp: number;
  defeated: boolean;
  dodged?: boolean;
  crit?: boolean;
  /** 這一下是給護盾（海晏）：heal 會是 0，血量不變 */
  shield?: boolean;
  /** 這一下傷害被護盾擋掉一部分 */
  shielded?: boolean;
  /** 這一下是把倒下的隊友救起來（海晏的大絕招） */
  revive?: boolean;
  /** 被打的那隻慢一拍（雙瞳的大絕招） */
  slowed?: boolean;
  /** 被補的那隻攻擊提高（絨耳） */
  cheer?: boolean;
}

/** 一次出手（一隻角色的一個回合）：可能打到好幾隻、後面接著補血 */
export interface BattleAction {
  /** 第幾回合（1 起算） */
  round: number;
  /** 整場第幾次出手（0 起算），記錄玩家在哪一次放招用 */
  turn: number;
  side: BattleSide;
  /** 出手者在自己那一方的位置 */
  actor: number;
  /** 是不是大絕招 */
  ult: boolean;
  kind: ActionKind;
  /** 這次放的強化（嘲諷／鼓舞／松嶺的號令） */
  buff?: 'taunt' | 'inspire' | 'command';
  hits: BattleHit[];
  /** 這次出手之後雙方每一隻的 EN 值（0～100） */
  en: { team: number[]; enemy: number[] };
}

/** 戰鬥進行到一半的狀態。只有數字與陣列，可以整份複製。 */
export interface BattleState {
  team: BattleUnit[];
  enemies: BattleUnit[];
  hp: { team: number[]; enemy: number[] };
  en: { team: number[]; enemy: number[] };
  /** 出手過幾次 */
  acts: { team: number[]; enemy: number[] };
  /** 嘲諷持續到第幾回合結束（0 代表沒有） */
  taunt: { team: number[]; enemy: number[] };
  /** 鼓舞持續到第幾回合結束 */
  inspire: { team: number; enemy: number };
  /** 號令（松嶺）：全隊減傷持續到第幾回合結束 */
  rally: { team: number; enemy: number };
  /** 身上有沒有護盾（1 有、0 沒有） */
  shield: { team: number[]; enemy: number[] };
  /** 慢一拍持續到第幾回合結束 */
  weak: { team: number[]; enemy: number[] };
  /** 打氣（攻擊提高）持續到第幾回合結束 */
  cheer: { team: number[]; enemy: number[] };
  /** 這一場已經救起幾隻倒下的隊友 */
  revived: { team: number; enemy: number };
  round: number;
  /** 這一回合輪到出手順序裡的第幾個 */
  cursor: number;
  /** 整場已經出手幾次 */
  turn: number;
  /** 亂數的進度 */
  rng: number;
  over: boolean;
  win: boolean;
  recommendedPower: number;
  teamPower: number;
  /** 這一場的敵方氣勢，介於 ±MORALE_RANGE */
  morale: number;
}

export interface BattleResult {
  win: boolean;
  /** 隊伍總戰力 */
  teamPower: number;
  recommendedPower: number;
  morale: number;
  team: BattleUnit[];
  enemies: BattleUnit[];
  actions: BattleAction[];
  /** 打了幾回合 */
  rounds: number;
  /** 我方在整場第幾次出手時放了大絕招（重播同一場用） */
  ultTurns: number[];
  /** 打完後雙方每一隻的剩餘血量 */
  finalHp: { team: number[]; enemies: number[] };
}

/** 可注入種子的亂數（mulberry32），回傳 0 到 1 之間 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 把幾個整數混成一個種子（出征開始時沒有另外給種子就用這個） */
export function mixSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    // 時間戳超過 32 位元，拆成高低兩段
    for (const n of [Math.floor(p / 4294967296), p]) {
      h ^= n >>> 0;
      h = Math.imul(h, 0x01000193) >>> 0;
      h ^= h >>> 15;
    }
  }
  return h >>> 0;
}

export function battleDogPower(dog: BattleDog): number {
  return calcPower(dog.attack, dog.defense);
}

export function battleTeamPower(team: readonly BattleDog[]): number {
  return team.reduce((sum, d) => sum + battleDogPower(d), 0);
}

/** 敗北時的獎勵：每項資源乘上比例後無條件捨去 */
export function scaleReward<T extends Record<string, number>>(reward: T, rate: number): T {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(reward)) out[k] = Math.floor(v * rate);
  return out as T;
}

/** 這隻狗出手一次集多少 EN（照稀有度） */
export function enPerActOf(d: Pick<BattleDog, 'rarity' | 'ssr'>): number {
  const rarity = d.rarity ?? (d.ssr ? 'SSR' : undefined);
  return rarity ? EN_PER_ACT_BY_RARITY[rarity] : EN_PER_ACT;
}

/** 由防禦推出血量 */
export function hpOf(defense: number): number {
  return Math.max(10, Math.round(defense * HP_PER_DEF));
}

const MELEE: readonly BattleRole[] = ['守護', '突擊', '野犬', '頭目'];
const REAR: readonly BattleRole[] = ['謀略', '幸運', '補血'];

const other = (s: BattleSide): BattleSide => (s === 'team' ? 'enemy' : 'team');
const unitsOf = (s: BattleState, side: BattleSide): BattleUnit[] =>
  side === 'team' ? s.team : s.enemies;

/** 狀態裡的亂數往前一步 */
function rand(s: BattleState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 這一回合的出手順序：我方第 1 隻、敵方第 1 隻、我方第 2 隻…（照隊伍順序穿插） */
function orderOf(s: BattleState): { side: BattleSide; index: number }[] {
  const order: { side: BattleSide; index: number }[] = [];
  const n = Math.max(s.team.length, s.enemies.length);
  for (let i = 0; i < n; i++) {
    if (i < s.team.length) order.push({ side: 'team', index: i });
    if (i < s.enemies.length) order.push({ side: 'enemy', index: i });
  }
  return order;
}

/** 把游標移到下一隻還站著的；有一方全倒或回合用完就結束 */
function settleCursor(s: BattleState): void {
  const order = orderOf(s);
  for (;;) {
    if (s.hp.team.every((h) => h <= 0)) {
      s.over = true;
      s.win = false;
      return;
    }
    if (s.hp.enemy.every((h) => h <= 0)) {
      s.over = true;
      s.win = true;
      return;
    }
    if (s.cursor >= order.length) {
      s.cursor = 0;
      s.round++;
      if (s.round > MAX_ROUNDS) {
        s.round = MAX_ROUNDS;
        s.over = true;
        s.win = false;
        return;
      }
      continue;
    }
    const o = order[s.cursor];
    if (s.hp[o.side][o.index] > 0) return;
    s.cursor++;
  }
}

/** 開一場戰鬥：排好雙方單位，回傳「輪到第一隻出手」的狀態 */
export function createBattle(input: BattleInput): BattleState {
  if (input.team.length < BATTLE_TEAM_MIN || input.team.length > BATTLE_TEAM_MAX) {
    throw new Error(`隊伍要 ${BATTLE_TEAM_MIN} 到 ${BATTLE_TEAM_MAX} 隻`);
  }
  const recommendedPower = Math.max(0, input.recommendedPower);
  const team: BattleUnit[] = input.team.map((d) => {
    const role: BattleRole = d.role ?? (d.heal ? '補血' : '守護');
    const attack = Math.max(1, d.attack);
    const defense = Math.max(1, d.defense);
    return {
      id: d.id,
      name: d.name,
      maxHp: hpOf(defense),
      attack,
      defense,
      might: 1,
      role,
      row: d.row ?? defaultRowOf(role),
      ...(d.lane === 0 || d.lane === 1 || d.lane === 2 ? { lane: d.lane } : {}),
      canUlt: !!d.hasSkill,
      enPerAct: enPerActOf(d),
      ssr: !!d.ssr,
      afterHeal: !!d.afterHeal,
      ...(role === '補血' ? { heal: true } : {}),
      ...(d.trait ? { trait: d.trait } : {}),
    };
  });

  const s: BattleState = {
    team,
    enemies: [],
    hp: { team: team.map((u) => u.maxHp), enemy: [] },
    en: { team: team.map(() => 0), enemy: [] },
    acts: { team: team.map(() => 0), enemy: [] },
    taunt: { team: team.map(() => 0), enemy: [] },
    inspire: { team: 0, enemy: 0 },
    rally: { team: 0, enemy: 0 },
    shield: { team: team.map(() => 0), enemy: [] },
    weak: { team: team.map(() => 0), enemy: [] },
    cheer: { team: team.map(() => 0), enemy: [] },
    revived: { team: 0, enemy: 0 },
    round: 1,
    cursor: 0,
    turn: 0,
    rng: input.seed >>> 0,
    over: false,
    win: false,
    recommendedPower,
    teamPower: battleTeamPower(input.team),
    morale: 0,
  };
  // 敵方氣勢：這一場敵方的血量與傷害一起浮動
  s.morale = (rand(s) * 2 - 1) * MORALE_RANGE;
  const strength = (1 + s.morale) * (input.boss ? BOSS_SCALE : MOB_SCALE);

  // 敵方：建議戰力攻防各半，平分給每一隻；總血量與每回合總傷害不隨隻數改變
  const names = input.enemyNames.length ? input.enemyNames : ['敵軍'];
  const stat = Math.max(1, recommendedPower / 2 / names.length);
  const role: BattleRole = input.boss ? '頭目' : '野犬';
  s.enemies = names.map((name, i) => ({
    id: `enemy-${i + 1}`,
    name,
    maxHp: Math.max(10, Math.round(stat * HP_PER_DEF * strength)),
    attack: Math.max(1, Math.round(stat)),
    defense: Math.max(1, Math.round(stat)),
    might: strength,
    role,
    row: input.boss || i < MOB_FRONT ? defaultRowOf(role) : 1,
    canUlt: !!input.boss,
    enPerAct: EN_PER_ACT,
    ssr: false,
    afterHeal: false,
  }));
  s.hp.enemy = s.enemies.map((u) => u.maxHp);
  s.en.enemy = s.enemies.map(() => 0);
  s.acts.enemy = s.enemies.map(() => 0);
  s.taunt.enemy = s.enemies.map(() => 0);
  s.shield.enemy = s.enemies.map(() => 0);
  s.weak.enemy = s.enemies.map(() => 0);
  s.cheer.enemy = s.enemies.map(() => 0);
  settleCursor(s);
  return s;
}

export function cloneBattle(s: BattleState): BattleState {
  return {
    ...s,
    hp: { team: [...s.hp.team], enemy: [...s.hp.enemy] },
    en: { team: [...s.en.team], enemy: [...s.en.enemy] },
    acts: { team: [...s.acts.team], enemy: [...s.acts.enemy] },
    taunt: { team: [...s.taunt.team], enemy: [...s.taunt.enemy] },
    inspire: { ...s.inspire },
    rally: { ...s.rally },
    shield: { team: [...s.shield.team], enemy: [...s.shield.enemy] },
    weak: { team: [...s.weak.team], enemy: [...s.weak.enemy] },
    cheer: { team: [...s.cheer.team], enemy: [...s.cheer.enemy] },
    revived: { ...s.revived },
  };
}

/** 現在輪到誰出手；戰鬥結束了回傳 null */
export function nextActor(
  s: BattleState,
): { side: BattleSide; index: number; ultReady: boolean } | null {
  if (s.over) return null;
  const o = orderOf(s)[s.cursor];
  const u = unitsOf(s, o.side)[o.index];
  return { ...o, ultReady: u.canUlt && s.en[o.side][o.index] >= EN_MAX };
}

/** 自動放招時，現在輪到的這一隻要不要放大絕招：EN 滿了就放；補血大絕招等有人受傷才放 */
export function autoUlt(s: BattleState): boolean {
  const a = nextActor(s);
  if (!a || !a.ultReady) return false;
  const u = unitsOf(s, a.side)[a.index];
  if (u.role !== '補血') return true;
  const mates = unitsOf(s, a.side);
  // 海晏：有隊友倒下、還沒救過，就放
  if (u.trait === 'rescue' && s.revived[a.side] < REVIVE_MAX && s.hp[a.side].some((h) => h <= 0)) {
    return true;
  }
  return mates.some((m, i) => s.hp[a.side][i] > 0 && s.hp[a.side][i] < m.maxHp * HEAL_ULT_BELOW);
}

// ---- 選目標 ----

/** 某一方還站著的位置 */
function aliveOf(s: BattleState, side: BattleSide): number[] {
  return s.hp[side].flatMap((h, i) => (h > 0 ? [i] : []));
}

/** 某一方「最前面還有狗的那一排」是第幾排；全倒回傳 -1 */
export function frontRowOf(s: BattleState, side: BattleSide): number {
  const units = unitsOf(s, side);
  const rows = aliveOf(s, side).map((i) => units[i].row);
  return rows.length ? Math.min(...rows) : -1;
}

function inRow(s: BattleState, side: BattleSide, row: number): number[] {
  const units = unitsOf(s, side);
  return aliveOf(s, side).filter((i) => units[i].row === row);
}

function pick(s: BattleState, list: readonly number[]): number {
  return list[Math.min(list.length - 1, Math.floor(rand(s) * list.length))];
}

/** 正在嘲諷的那一隻（一般攻擊都得打牠）；沒有回傳 -1 */
function taunterOf(s: BattleState, side: BattleSide): number {
  return aliveOf(s, side).find((i) => s.taunt[side][i] >= s.round) ?? -1;
}

/** 血量最少的一隻（一樣少取位置前面的） */
function weakest(s: BattleState, side: BattleSide, list: readonly number[]): number {
  return [...list].sort((a, b) => s.hp[side][a] - s.hp[side][b] || a - b)[0];
}

// ---- 出手 ----

/** 打一下：算傷害、扣血、被打的集 EN */
function strike(
  s: BattleState,
  side: BattleSide,
  actor: number,
  target: number,
  rate: number,
  opts: { crit?: boolean; area?: boolean } = {},
): BattleHit {
  const foe = other(side);
  const a = unitsOf(s, side)[actor];
  const t = unitsOf(s, foe)[target];
  const dodge = t.trait === 'evasive' ? EVASIVE_DODGE_CHANCE : DODGE_CHANCE;
  if (t.role === '幸運' && rand(s) < dodge) {
    return {
      side: foe,
      target,
      damage: 0,
      targetHp: s.hp[foe][target],
      defeated: false,
      dodged: true,
    };
  }
  const critChance = a.trait === 'fortune' ? FORTUNE_CRIT_CHANCE : CRIT_CHANCE;
  const crit = !!opts.crit && rand(s) < critChance;
  const attack =
    a.attack *
    (s.inspire[side] >= s.round ? INSPIRE_RATE : 1) *
    (s.cheer[side][actor] >= s.round ? CHEER_RATE : 1) *
    (s.weak[side][actor] >= s.round ? SLOW_RATE : 1);
  // 海晏在場：整排、穿透攻擊打得比較不痛
  const sheltered =
    !!opts.area && unitsOf(s, foe).some((m, i) => m.trait === 'rescue' && s.hp[foe][i] > 0);
  const shielded = s.shield[foe][target] > 0;
  // 補給的被動：同一排有（別隻）補給站著，受到的傷害減少
  const supplied = unitsOf(s, foe).some(
    (m, i) => i !== target && m.role === '補給' && m.row === t.row && s.hp[foe][i] > 0,
  );
  // 站位：近戰不在最前排打折；後衛站在最前排比較痛
  const reach = MELEE.includes(a.role) && a.row !== frontRowOf(s, side) ? MELEE_BACK_RATE : 1;
  const exposed = REAR.includes(t.role) && t.row === frontRowOf(s, foe) ? REAR_FRONT_TAKEN : 1;
  let dmg =
    attack *
    reach *
    exposed *
    (supplied ? SUPPLY_TAKEN : 1) *
    a.might *
    rate *
    (crit ? CRIT_RATE : 1) *
    (1 - DAMAGE_SPREAD + rand(s) * DAMAGE_SPREAD * 2);
  if (s.taunt[foe][target] >= s.round) dmg *= TAUNT_TAKEN;
  else if (t.role === '守護') dmg *= GUARD_TAKEN;
  if (s.rally[foe] >= s.round) dmg *= RALLY_TAKEN;
  if (sheltered) dmg *= RESCUE_AREA_TAKEN;
  if (shielded) {
    dmg *= 1 - SHIELD_RATE;
    s.shield[foe][target] = 0;
  }
  const damage = Math.min(s.hp[foe][target], Math.max(1, Math.round(dmg)));
  s.hp[foe][target] -= damage;
  const defeated = s.hp[foe][target] <= 0;
  if (!defeated && t.canUlt) s.en[foe][target] = Math.min(EN_MAX, s.en[foe][target] + EN_PER_HIT);
  if (defeated) s.en[foe][target] = 0;
  return {
    side: foe,
    target,
    damage,
    targetHp: s.hp[foe][target],
    defeated,
    ...(crit ? { crit: true } : {}),
    ...(shielded ? { shielded: true } : {}),
  };
}

/** 幸運的亂打：隨機一隻、會爆擊；福球爆擊時再多打一下（多打的那一下不會再連） */
function luckyStrike(s: BattleState, side: BattleSide, actor: number, target: number): BattleHit[] {
  const foe = other(side);
  const hits = [strike(s, side, actor, target, 1, { crit: true })];
  if (unitsOf(s, side)[actor].trait === 'fortune' && hits[0].crit) {
    const list = aliveOf(s, foe);
    if (list.length) hits.push(strike(s, side, actor, pick(s, list), 1, { crit: true }));
  }
  return hits;
}

/** 補一下：回復最大血量的某個比例；沒受傷回傳 null */
function mend(s: BattleState, side: BattleSide, target: number, rate: number): BattleHit | null {
  const u = unitsOf(s, side)[target];
  const hp = s.hp[side][target];
  if (hp <= 0 || hp >= u.maxHp) return null;
  const amount = Math.min(u.maxHp - hp, Math.max(1, Math.round(u.maxHp * rate)));
  s.hp[side][target] += amount;
  return { side, target, damage: 0, heal: amount, targetHp: s.hp[side][target], defeated: false };
}

/** 受傷的隊友，血量比例低的排前面 */
function hurtMates(s: BattleState, side: BattleSide): number[] {
  const units = unitsOf(s, side);
  const ratio = (i: number): number => s.hp[side][i] / units[i].maxHp;
  return aliveOf(s, side)
    .filter((i) => s.hp[side][i] < units[i].maxHp)
    .sort((a, b) => ratio(a) - ratio(b) || a - b);
}

/** 一般攻擊打最前排的一隻：有人嘲諷就打牠，不然最前排隨機一隻 */
function frontTarget(s: BattleState, foe: BattleSide): number {
  const taunter = taunterOf(s, foe);
  return taunter >= 0 ? taunter : pick(s, inRow(s, foe, frontRowOf(s, foe)));
}

/** 一般攻擊（依定位） */
function normalAttack(s: BattleState, side: BattleSide, actor: number): BattleHit[] {
  const foe = other(side);
  const u = unitsOf(s, side)[actor];
  const foes = unitsOf(s, foe);
  const first = s.acts[side][actor] === 0;
  const hits: BattleHit[] = [];
  const taunter = taunterOf(s, foe);
  if (u.role === '突擊') {
    // 穿透 1×2：最前排一隻，再穿到牠後面最近一排的一隻
    const rate = first ? FIRST_STRIKE_RATE : 1;
    const t = frontTarget(s, foe);
    const rows = [1, 2]
      .map((d) => inRow(s, foe, foes[t].row + d))
      .filter((list) => list.length > 0)
      // 流星：後面每一排都穿到
      .slice(0, u.trait === 'pierce3' ? 2 : 1);
    hits.push(strike(s, side, actor, t, rate, { area: true }));
    for (const list of rows) {
      hits.push(strike(s, side, actor, pick(s, list), rate * PIERCE_RATE, { area: true }));
    }
  } else if (u.role === '謀略') {
    // 越排：鎖定中後排（最前排後面的）血量最少的一隻；後面沒人就打剩下裡血最少的
    const front = frontRowOf(s, foe);
    const back = aliveOf(s, foe).filter((i) => foes[i].row > front);
    const t = taunter >= 0 ? taunter : weakest(s, foe, back.length ? back : aliveOf(s, foe));
    hits.push(strike(s, side, actor, t, 1));
  } else if (u.role === '幸運') {
    // 亂打：不分排隨機一隻，有機率爆擊；金鈴打兩次
    for (let n = 0; n < (u.trait === 'double' ? 2 : 1); n++) {
      const list = aliveOf(s, foe);
      if (!list.length) break;
      const tn = taunterOf(s, foe);
      hits.push(...luckyStrike(s, side, actor, tn >= 0 ? tn : pick(s, list)));
    }
  } else {
    hits.push(strike(s, side, actor, frontTarget(s, foe), 1));
  }
  return hits;
}

/** 輪到的這一隻出手一次（會改動 s）。useUlt 只有在 EN 滿的時候才有用。 */
function act(s: BattleState, useUlt: boolean): BattleAction {
  const { side, index: actor, ultReady } = nextActor(s)!;
  const foe = other(side);
  const u = unitsOf(s, side)[actor];
  const ult = ultReady && useUlt;
  const hits: BattleHit[] = [];
  let kind: ActionKind = 'attack';
  let buff: BattleAction['buff'];

  if (ult) {
    s.en[side][actor] = 0;
    if (u.role === '突擊') {
      // 穿透 1×3：前中後各一隻
      kind = 'pierce';
      for (const row of [0, 1, 2]) {
        const list = inRow(s, foe, row);
        const rate = u.trait === 'pierce3' ? PIERCE3_ULT_RATE : PIERCE_ULT_RATE;
        if (list.length) hits.push(strike(s, side, actor, pick(s, list), rate, { area: true }));
      }
    } else if (u.role === '謀略' || u.role === '頭目') {
      // 整排：謀略打狗最多的一排（SSR 打兩排）；頭目打最前面那一排
      kind = 'row';
      const rows =
        u.role === '頭目'
          ? [frontRowOf(s, foe)]
          : [0, 1, 2]
              .map((row) => ({ row, n: inRow(s, foe, row).length }))
              .filter((r) => r.n > 0)
              .sort((a, b) => b.n - a.n || a.row - b.row)
              .slice(0, u.ssr ? 2 : 1)
              .map((r) => r.row);
      for (const row of rows) {
        for (const t of inRow(s, foe, row)) {
          const h = strike(s, side, actor, t, u.role === '頭目' ? BOSS_ULT_RATE : 1, {
            area: true,
          });
          // 雙瞳：被打到的慢一拍
          if (u.trait === 'slow' && !h.dodged && !h.defeated) {
            s.weak[foe][t] = s.round + BUFF_ROUNDS;
            h.slowed = true;
          }
          hits.push(h);
        }
      }
    } else if (u.role === '幸運') {
      // 連打：每次都隨機挑一隻
      kind = 'single';
      for (let i = 0; i < LUCKY_ULT_HITS; i++) {
        const list = aliveOf(s, foe);
        if (!list.length) break;
        hits.push(...luckyStrike(s, side, actor, pick(s, list)));
      }
    } else if (u.role === '補血') {
      // 全隊回血
      kind = 'heal';
      const rescue = u.trait === 'rescue';
      for (const i of aliveOf(s, side)) {
        const h = mend(s, side, i, rescue ? RESCUE_ULT_RATE : HEAL_ULT_RATE);
        if (h) hits.push(h);
      }
      // 海晏：救起一隻倒下的隊友（隊伍順序最前面的），一場一次
      const fallen = s.hp[side].findIndex((h) => h <= 0);
      if (rescue && fallen >= 0 && s.revived[side] < REVIVE_MAX) {
        const amount = Math.max(1, Math.round(unitsOf(s, side)[fallen].maxHp * REVIVE_RATE));
        s.hp[side][fallen] = amount;
        s.revived[side]++;
        hits.push({
          side,
          target: fallen,
          damage: 0,
          heal: amount,
          targetHp: amount,
          defeated: false,
          revive: true,
        });
      }
    } else {
      // 守護嘲諷、補給鼓舞：放完接著照常攻擊
      kind = 'buff';
      if (u.role === '守護') {
        buff = 'taunt';
        s.taunt[side][actor] =
          u.trait === 'shortTaunt' ? s.round : s.round + BUFF_ROUNDS + (u.ssr ? 1 : 0);
      } else if (u.trait === 'command') {
        buff = 'command';
        s.inspire[side] = s.round + BUFF_ROUNDS + 1;
        s.rally[side] = s.round + BUFF_ROUNDS + 1;
      } else {
        buff = 'inspire';
        s.inspire[side] = s.round + BUFF_ROUNDS;
      }
      hits.push(...normalAttack(s, side, actor));
    }
  } else {
    if (u.canUlt) s.en[side][actor] = Math.min(EN_MAX, s.en[side][actor] + u.enPerAct);
    const hurt = hurtMates(s, side);
    if (u.role === '補血' && !u.afterHeal && u.trait !== 'rescue' && hurt.length) {
      const units = unitsOf(s, side);
      const low = hurt.find((i) => s.hp[side][i] < units[i].maxHp * HEAL_BELOW);
      if (low !== undefined) {
        kind = 'heal';
        if (u.trait === 'rowHeal') {
          // 麥穗：同一排受傷的都補
          for (const i of hurt.filter((m) => units[m].row === units[low].row)) {
            hits.push(mend(s, side, i, ROW_HEAL_RATE)!);
          }
        } else {
          const h = mend(s, side, low, u.trait === 'smallHeal' ? SMALL_HEAL_RATE : HEAL_RATE)!;
          // 絨耳：被補的隊友攻擊提高
          if (u.trait === 'cheer') {
            s.cheer[side][low] = s.round + BUFF_ROUNDS;
            h.cheer = true;
          }
          hits.push(h);
        }
      }
    }
    if (kind === 'attack') {
      hits.push(...normalAttack(s, side, actor));
      // 攻擊後補血（暖桶）：對面還有人站著才補
      if (u.afterHeal && aliveOf(s, foe).length > 0) {
        for (const i of hurtMates(s, side).slice(0, HEAL_TARGETS)) {
          const h = mend(s, side, i, HEAL_RATE);
          if (h) hits.push(h);
        }
      }
      // 海晏：攻擊後給血量比例最低、身上還沒有護盾的隊友一層護盾
      if (u.trait === 'rescue' && aliveOf(s, foe).length > 0) {
        const units = unitsOf(s, side);
        const ratio = (i: number): number => s.hp[side][i] / units[i].maxHp;
        const t = aliveOf(s, side)
          .filter((i) => s.shield[side][i] === 0)
          .sort((a, b) => ratio(a) - ratio(b) || a - b)[0];
        if (t !== undefined) {
          s.shield[side][t] = 1;
          hits.push({
            side,
            target: t,
            damage: 0,
            heal: 0,
            targetHp: s.hp[side][t],
            defeated: false,
            shield: true,
          });
        }
      }
    }
  }
  s.acts[side][actor]++;
  const action: BattleAction = {
    round: s.round,
    turn: s.turn,
    side,
    actor,
    ult,
    kind,
    ...(buff ? { buff } : {}),
    hits,
    en: { team: [...s.en.team], enemy: [...s.en.enemy] },
  };
  s.turn++;
  s.cursor++;
  settleCursor(s);
  return action;
}

/**
 * 往前推一步：輪到的那一隻出手一次。useUlt 是「這一步要不要放大絕招」（EN 沒滿就當成沒有）。
 * 不改傳入的狀態，回傳新的狀態與這次出手的紀錄；戰鬥已經結束就丟出錯誤。
 */
export function stepBattle(
  state: BattleState,
  useUlt: boolean,
): { state: BattleState; action: BattleAction } {
  if (state.over) throw new Error('戰鬥已經結束');
  const s = cloneBattle(state);
  const action = act(s, useUlt);
  return { state: s, action };
}

/** 我方什麼時候放大絕招：沒給就是自動放招（EN 一滿、輪到就放） */
export interface UltPolicy {
  /** 我方只在整場第這幾次出手時放大絕招（玩家手動放招的紀錄） */
  ultTurns?: readonly number[];
}

/** 從某個狀態用自動放招（或指定的放招時機）一路打到結束；不改傳入的狀態 */
export function finishBattle(
  state: BattleState,
  policy: UltPolicy = {},
): { state: BattleState; actions: BattleAction[] } {
  const s = cloneBattle(state);
  const actions: BattleAction[] = [];
  const turns = policy.ultTurns ? new Set(policy.ultTurns) : null;
  while (!s.over) {
    const a = nextActor(s)!;
    const use = a.side === 'team' && turns ? turns.has(s.turn) : autoUlt(s);
    actions.push(act(s, use));
  }
  return { state: s, actions };
}

/** 把狀態與整場紀錄整理成結果 */
export function battleResultOf(state: BattleState, actions: BattleAction[]): BattleResult {
  return {
    win: state.over && state.win,
    teamPower: state.teamPower,
    recommendedPower: state.recommendedPower,
    morale: state.morale,
    team: state.team,
    enemies: state.enemies,
    actions,
    rounds: state.round,
    ultTurns: actions.filter((a) => a.side === 'team' && a.ult).map((a) => a.turn),
    finalHp: { team: [...state.hp.team], enemies: [...state.hp.enemy] },
  };
}

/** 一次算完整場（略過戰鬥、自動出征、重播紀錄用） */
export function resolveBattle(input: BattleInput, policy: UltPolicy = {}): BattleResult {
  const r = finishBattle(createBattle(input), policy);
  return battleResultOf(r.state, r.actions);
}

/** 估勝率要模擬幾場 */
export const WIN_CHANCE_SAMPLES = 200;
const WIN_CHANCE_SALT = 0x51ab;

/**
 * 勝率（0 到 1）：用同一套規則、自動放招，換不同種子模擬很多場算出來。
 * 種子是固定的，所以同一支隊伍打同一關，顯示的數字不會跳來跳去。
 */
export function winChance(input: Omit<BattleInput, 'seed'>, samples = WIN_CHANCE_SAMPLES): number {
  if (input.team.length < BATTLE_TEAM_MIN || input.team.length > BATTLE_TEAM_MAX) return 0;
  let wins = 0;
  for (let i = 0; i < samples; i++) {
    const s = createBattle({ ...input, seed: mixSeed(WIN_CHANCE_SALT, i) });
    while (!s.over) act(s, autoUlt(s));
    if (s.win) wins++;
  }
  return wins / Math.max(1, samples);
}

// ---- 播放節奏（畫面用，放這裡方便測試） ----

export type BattleSpeed = 1 | 2 | 3 | 4;
export const BATTLE_SPEEDS: readonly BattleSpeed[] = [1, 2, 3, 4];

/** 速度按鈕：×1 → ×2 → ×3 → ×4 → ×1 */
export function nextBattleSpeed(speed: number): BattleSpeed {
  const i = BATTLE_SPEEDS.indexOf(speed as BattleSpeed);
  return BATTLE_SPEEDS[(i + 1) % BATTLE_SPEEDS.length];
}

/** 1 倍速時整場戰鬥大約播多久（毫秒） */
export const BATTLE_TARGET_MS = 9000;
/** 測試模式（?fast=1）整場大約播多久 */
export const BATTLE_FAST_MS = 800;
const STEP_MIN_MS = 220;
const STEP_MAX_MS = 700;

/**
 * 播放節奏：normal 一般；fast 測試模式（?fast=1）約 1 秒播完；
 * slow 給自動測試用（?fast=1&battle=slow），放慢 4 倍，機器再慢也來得及按速度與略過。
 */
export type BattlePace = 'normal' | 'fast' | 'slow';
const SLOW_FACTOR = 4;

/** 每一次出手播多久（毫秒）。倍速只影響快慢，不影響結果。 */
export function stepDelayMs(
  eventCount: number,
  speed: number,
  pace: BattlePace = 'normal',
): number {
  const n = Math.max(1, eventCount);
  if (pace === 'fast') return Math.max(1, Math.floor(BATTLE_FAST_MS / n));
  const base = Math.min(STEP_MAX_MS, Math.max(STEP_MIN_MS, BATTLE_TARGET_MS / n));
  return Math.round((base * (pace === 'slow' ? SLOW_FACTOR : 1)) / Math.min(4, Math.max(1, speed)));
}

/** 整場播放時間（毫秒） */
export function battleDurationMs(
  eventCount: number,
  speed: number,
  pace: BattlePace = 'normal',
): number {
  return stepDelayMs(eventCount, speed, pace) * Math.max(0, eventCount);
}

/**
 * 依網址參數決定戰鬥畫面的節奏：?fast=1 時加速；
 * 再加 &battle=slow 則放慢（出征時間照樣加速），&battle=normal 則用一般節奏。
 */
export function battlePaceFromSearch(search: string): BattlePace {
  const q = new URLSearchParams(search);
  const fast = q.get('fast');
  if (fast !== '1' && fast !== 'true') return 'normal';
  const b = q.get('battle');
  return b === 'slow' || b === 'normal' ? b : 'fast';
}

/**
 * 測試模式（?fast=1）可以用 &seed=數字 指定戰鬥的亂數種子，讓自動測試每次看到同一場戰鬥；
 * 沒指定、不是測試模式或不是非負整數就回傳 null（正常用隨機種子）。
 */
export function battleSeedFromSearch(search: string): number | null {
  const q = new URLSearchParams(search);
  const fast = q.get('fast');
  if (fast !== '1' && fast !== 'true') return null;
  const raw = q.get('seed');
  if (raw === null || !/^\d{1,10}$/.test(raw)) return null;
  return Number(raw) >>> 0;
}
