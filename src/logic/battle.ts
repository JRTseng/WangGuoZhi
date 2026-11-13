import { calcPower } from './power';

/**
 * 戰鬥結算（純函式）：一次算出勝負與整份戰鬥紀錄，戰鬥畫面只負責照著播放。
 *
 * 勝負：有效戰力 = 隊伍總戰力 ×（1 + 技能加成）×（1 + 隨機浮動），
 *       有效戰力 ≥ 建議戰力 × WIN_THRESHOLD 就算贏。
 * 紀錄：先知道勝負，再排出一場「結果一致」的回合紀錄
 *       （輸的一方全倒，贏的一方至少留一隻）。
 * 補血（T017）：補血狗讓隊伍有效戰力多 10%，這是牠對勝負的真正影響；
 *       回合紀錄裡牠會幫血量偏低的隊友回血，畫面照著播。
 * 亂數只來自傳入的種子：同種子、同隊伍、同關卡 → 結果與紀錄完全相同。
 */

/** 隊伍人數下限、上限 */
export const BATTLE_TEAM_MIN = 1;
export const BATTLE_TEAM_MAX = 5;
/** 隨機浮動幅度：有效戰力在 ±15% 之間 */
export const BATTLE_ROLL_RANGE = 0.15;
/** 勝利門檻；0.97 搭配 ±15% 浮動，戰力剛好等於建議戰力時勝率約 60% */
export const WIN_THRESHOLD = 0.97;
/** 技能的固定小加成：每隻有技能的狗讓隊伍有效戰力 +2%（相剋之後再做） */
export const SKILL_BONUS_RATE = 0.02;
/** 補血狗的加成：每隻讓隊伍有效戰力 +10%（取代上面的 +2%） */
export const HEAL_BONUS_RATE = 0.1;
/** 補血量：被補的那隻最大血量的 25% */
export const HEAL_RATE = 0.25;
/** 隊友血量剩這個比例以下，補血狗才會出手補血 */
export const HEAL_TRIGGER = 0.6;
/** 敗北時拿到的獎勵比例 */
export const DEFEAT_REWARD_RATE = 0.3;

export type BattleSide = 'team' | 'enemy';

/** 參戰的狗：傳入攻防等級，不直接讀資料檔。攻防已含升級成長值，等級只是顯示用 */
export interface BattleDog {
  id: string;
  name: string;
  attack: number;
  defense: number;
  level: number;
  /** 有沒有技能（有的話給固定小加成） */
  hasSkill?: boolean;
  /** 補血狗：輪到牠時會幫受傷的隊友回血，並給隊伍較大的戰力加成 */
  heal?: boolean;
}

export interface BattleInput {
  team: readonly BattleDog[];
  /** 關卡建議戰力，敵方血量與攻擊由它推算 */
  recommendedPower: number;
  /** 敵方的名字，一個名字一隻（Boss 關通常只有一隻） */
  enemyNames: readonly string[];
  /** 亂數種子 */
  seed: number;
}

export interface BattleUnit {
  id: string;
  name: string;
  maxHp: number;
  /** 排出手傷害用的攻擊力 */
  attack: number;
  /** 是不是補血狗 */
  heal?: boolean;
}

/** 一次出手：攻擊，或補血（有 heal 欄位時是補血，target 是自己這一方的位置） */
export interface BattleEvent {
  /** 第幾回合（1 起算） */
  round: number;
  /** 出手的一方 */
  side: BattleSide;
  /** 出手者在自己那一方的位置 */
  attacker: number;
  /** 被打的在對面那一方的位置；補血時是被補的隊友在自己這一方的位置 */
  target: number;
  /** 傷害，0 代表被閃過 */
  damage: number;
  /** 被打的剩餘血量 */
  targetHp: number;
  /** 這一下有沒有把對方打倒 */
  defeated: boolean;
  /** 補血量；有這個欄位代表這次出手是補血（damage 為 0） */
  heal?: number;
}

export interface BattleResult {
  win: boolean;
  /** 隊伍總戰力（不含加成與浮動） */
  teamPower: number;
  recommendedPower: number;
  /** 技能加成比例，例如 0.06 */
  skillBonus: number;
  /** 這一場的隨機浮動，介於 ±BATTLE_ROLL_RANGE */
  roll: number;
  team: BattleUnit[];
  enemies: BattleUnit[];
  events: BattleEvent[];
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

export function skillBonusOf(team: readonly BattleDog[]): number {
  const healers = team.filter((d) => d.heal).length;
  const skilled = team.filter((d) => d.hasSkill && !d.heal).length;
  return skilled * SKILL_BONUS_RATE + healers * HEAL_BONUS_RATE;
}

/** 給定浮動值時是否獲勝（勝負的唯一規則） */
export function isWin(
  teamPower: number,
  recommendedPower: number,
  skillBonus: number,
  roll: number,
): boolean {
  return teamPower * (1 + skillBonus) * (1 + roll) >= recommendedPower * WIN_THRESHOLD;
}

/** 勝率（0 到 1），給畫面提示與測試用；和 isWin 是同一條規則 */
export function winChance(teamPower: number, recommendedPower: number, skillBonus = 0): number {
  const eff = teamPower * (1 + skillBonus);
  if (eff <= 0) return recommendedPower <= 0 ? 1 : 0;
  // 需要的浮動下限：roll >= need 才會贏；roll 在 ±RANGE 之間均勻分布
  const need = (recommendedPower * WIN_THRESHOLD) / eff - 1;
  const p = (BATTLE_ROLL_RANGE - need) / (BATTLE_ROLL_RANGE * 2);
  return Math.min(1, Math.max(0, p));
}

/** 敗北時的獎勵：每項資源乘上比例後無條件捨去 */
export function scaleReward<T extends Record<string, number>>(reward: T, rate: number): T {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(reward)) out[k] = Math.floor(v * rate);
  return out as T;
}

interface Fighter {
  hp: number;
  maxHp: number;
  attack: number;
  heal: boolean;
  /** 上一次出手是不是補血（不連續補，補一次打一次） */
  healedLast: boolean;
}

const toFighter = (u: BattleUnit): Fighter => ({
  hp: u.maxHp,
  maxHp: u.maxHp,
  attack: u.attack,
  heal: !!u.heal,
  healedLast: false,
});

export function resolveBattle(input: BattleInput): BattleResult {
  if (input.team.length < BATTLE_TEAM_MIN || input.team.length > BATTLE_TEAM_MAX) {
    throw new Error(`隊伍要 ${BATTLE_TEAM_MIN} 到 ${BATTLE_TEAM_MAX} 隻`);
  }
  const rng = createRng(input.seed);
  const recommendedPower = Math.max(0, input.recommendedPower);
  const teamPower = battleTeamPower(input.team);
  const skillBonus = skillBonusOf(input.team);
  const roll = (rng() * 2 - 1) * BATTLE_ROLL_RANGE;
  const win = isWin(teamPower, recommendedPower, skillBonus, roll);

  // ---- 雙方單位：血量、攻擊都由戰力推出來，數值只影響畫面上的數字 ----
  const team: BattleUnit[] = input.team.map((d) => ({
    id: d.id,
    name: d.name,
    maxHp: Math.max(10, battleDogPower(d) * 2),
    attack: Math.max(1, d.attack),
    ...(d.heal ? { heal: true } : {}),
  }));
  const names = input.enemyNames.length ? input.enemyNames : ['敵軍'];
  const enemyHp = Math.max(10, Math.round((recommendedPower * 2) / names.length));
  const enemies: BattleUnit[] = names.map((name, i) => ({
    id: `enemy-${i + 1}`,
    name,
    maxHp: enemyHp,
    attack: Math.max(1, Math.round(recommendedPower / names.length / 2)),
  }));

  // ---- 排回合紀錄：輸的一方全倒；贏的一方依實力差距損血，但至少留一隻 ----
  const strengthTeam = teamPower * (1 + skillBonus) * (1 + roll);
  const strengthEnemy = recommendedPower * WIN_THRESHOLD;
  const winnerSide: BattleSide = win ? 'team' : 'enemy';
  const [sw, sl] = win ? [strengthTeam, strengthEnemy] : [strengthEnemy, strengthTeam];
  const closeness = sw > 0 ? Math.min(1, sl / sw) : 0;
  const hp = {
    team: team.map(toFighter),
    enemy: enemies.map(toFighter),
  };
  const other = (s: BattleSide): BattleSide => (s === 'team' ? 'enemy' : 'team');
  const winners = hp[winnerSide];
  const losers = hp[other(winnerSide)];
  const total = (list: Fighter[]) => list.reduce((s, f) => s + f.hp, 0);
  const alive = (list: Fighter[]) => list.filter((f) => f.hp > 0).length;
  const avgAttack = (list: Fighter[]) =>
    list.reduce((s, f) => s + f.attack, 0) / Math.max(1, list.length);

  const winnerTotal = total(winners);
  /** 贏家總共會被打掉多少血（越接近越慘烈），一定留至少 1 滴 */
  let lossBudget = Math.min(
    winnerTotal - 1,
    Math.round(winnerTotal * Math.min(0.92, 0.08 + 0.84 * closeness ** 1.5)),
  );
  const rounds = 3 + Math.floor(rng() * 3); // 預計 3 到 5 回合
  const events: BattleEvent[] = [];
  const MAX_EVENTS = 80;

  for (let round = 1; alive(losers) > 0 && events.length < MAX_EVENTS; round++) {
    const roundsLeft = Math.max(0, rounds - round);
    const order: { side: BattleSide; index: number }[] = [];
    const n = Math.max(hp.team.length, hp.enemy.length);
    for (let i = 0; i < n; i++) {
      if (i < hp.team.length) order.push({ side: 'team', index: i });
      if (i < hp.enemy.length) order.push({ side: 'enemy', index: i });
    }
    for (let k = 0; k < order.length && alive(losers) > 0; k++) {
      const { side, index } = order[k];
      const me = hp[side][index];
      if (me.hp <= 0) continue;
      const foes = hp[other(side)];
      const target = foes.findIndex((f) => f.hp > 0);
      if (target < 0) break;
      const mates = hp[side];
      // 補血狗：有隊友（含自己）血量偏低就補血，這次不攻擊。
      // 不連續補；到了預計的最後一回合也不補，讓戰鬥收得了尾。
      if (me.heal && !me.healedLast && roundsLeft > 0) {
        let weakest = -1;
        mates.forEach((f, i) => {
          if (f.hp <= 0 || f.hp / f.maxHp > HEAL_TRIGGER) return;
          if (weakest < 0 || f.hp / f.maxHp < mates[weakest].hp / mates[weakest].maxHp) weakest = i;
        });
        if (weakest >= 0) {
          const mate = mates[weakest];
          const amount = Math.min(mate.maxHp - mate.hp, Math.round(mate.maxHp * HEAL_RATE));
          mate.hp += amount;
          me.healedLast = true;
          events.push({
            round,
            side,
            attacker: index,
            target: weakest,
            damage: 0,
            targetHp: mate.hp,
            defeated: false,
            heal: amount,
          });
          continue;
        }
      }
      me.healedLast = false;
      // 這一方到預計結束前大約還有幾次出手
      const laterThisRound = order
        .slice(k + 1)
        .filter((o) => o.side === side && mates[o.index].hp > 0).length;
      const hitsLeft = 1 + laterThisRound + roundsLeft * alive(mates);
      const weight = (me.attack / avgAttack(mates.filter((f) => f.hp > 0))) * (0.8 + rng() * 0.4);

      let damage: number;
      if (side === winnerSide) {
        const share = total(foes) / hitsLeft;
        damage = Math.max(1, Math.round(share * weight));
        // 已經到預計的最後一回合：每一下都打倒一隻，把戰鬥收尾
        if (roundsLeft === 0) damage = foes[target].hp;
      } else {
        const share = lossBudget / hitsLeft;
        damage = Math.min(lossBudget, Math.round(share * weight));
      }
      damage = Math.min(damage, foes[target].hp);
      if (side !== winnerSide) lossBudget -= damage;
      foes[target].hp -= damage;
      events.push({
        round,
        side,
        attacker: index,
        target,
        damage,
        targetHp: foes[target].hp,
        defeated: damage > 0 && foes[target].hp === 0,
      });
    }
  }
  // 保險：真的排不完（理論上不會）就讓還站著的輸家直接倒下
  const lastRound = events.length ? events[events.length - 1].round : 1;
  losers.forEach((f, i) => {
    if (f.hp <= 0) return;
    const attacker = Math.max(
      0,
      winners.findIndex((x) => x.hp > 0),
    );
    events.push({
      round: lastRound,
      side: winnerSide,
      attacker,
      target: i,
      damage: f.hp,
      targetHp: 0,
      defeated: true,
    });
    f.hp = 0;
  });

  return {
    win,
    teamPower,
    recommendedPower,
    skillBonus,
    roll,
    team,
    enemies,
    events,
    finalHp: { team: hp.team.map((f) => f.hp), enemies: hp.enemy.map((f) => f.hp) },
  };
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
