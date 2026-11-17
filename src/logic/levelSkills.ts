import { wt } from '../data/worldText';
import type { BattleRole } from './battle';

/**
 * 成長技能（2026-11-15 Jimmy：「狗狗隨著等級提升每 10 級多一個技能」）：
 * Lv.10、20、…、100 各學會一個被動技能，一共 10 個，照定位各有一套。
 * 等級上限跟著星數（1 星 60、每升一星 +10），所以後面幾個要升星才學得到。
 * 技能都是被動的小加成，學會之後一直有效；每個技能的說明由效果自動寫出來，不會和實際效果對不上。
 * 數值都是暫定。戰力數字（攻擊 + 防禦）不含這些加成。
 */

/** 每幾級學一個 */
export const SKILL_EVERY = 10;
/** 一共幾個（Lv.10～Lv.100） */
export const SKILL_COUNT = 10;

/**
 * 被動效果（都是加上去的量，沒寫就是 0）：
 * - atk：造成的傷害提高（0.05 = +5%）
 * - hp：血量上限提高
 * - guard：受到的傷害減少
 * - startEn：開場就有的 EN 值
 * - crit：每一下攻擊多這麼多爆擊機率（原本不會爆擊的定位也會）
 * - dodge：被打時多這麼多閃避機率
 * - heal：自己補血的量提高
 * - steal：攻擊後回復「造成傷害 × 這個比例」的血量
 * - opening：第 1 回合造成的傷害提高
 * - rage：自己血量低於 RAGE_BELOW 時造成的傷害提高
 * - enHit：被打時多集的 EN 值
 */
export interface Perks {
  atk?: number;
  hp?: number;
  guard?: number;
  startEn?: number;
  crit?: number;
  dodge?: number;
  heal?: number;
  steal?: number;
  opening?: number;
  rage?: number;
  enHit?: number;
}

/** rage 生效的血量比例 */
export const RAGE_BELOW = 0.3;

export interface LevelSkill {
  /** 幾級學會 */
  level: number;
  name: string;
  perks: Perks;
}

export type SkillRole = Exclude<BattleRole, '野犬' | '頭目'>;

type Ladder = readonly (readonly [string, Perks])[];

const LADDERS: Readonly<Record<SkillRole, Ladder>> = {
  突擊: [
    ['起跑衝刺', { opening: 0.15 }],
    ['利牙', { atk: 0.05 }],
    ['咬住不放', { steal: 0.08 }],
    ['熱身完畢', { startEn: 20 }],
    ['嗅出破綻', { crit: 0.08 }],
    ['厚實肉墊', { hp: 0.06 }],
    ['背水一戰', { rage: 0.2 }],
    ['連環撲咬', { atk: 0.06 }],
    ['越戰越勇', { enHit: 10 }],
    ['狼王血脈', { atk: 0.08, crit: 0.05 }],
  ],
  守護: [
    ['厚皮', { hp: 0.06 }],
    ['站穩腳步', { guard: 0.04 }],
    ['挨打集氣', { enHit: 10 }],
    ['護主心切', { startEn: 20 }],
    ['鐵壁', { hp: 0.08 }],
    ['反咬一口', { atk: 0.06 }],
    ['不動如山', { guard: 0.05 }],
    ['絕不退後', { rage: 0.2 }],
    ['舔舔傷口', { steal: 0.1 }],
    ['鎮國神犬', { hp: 0.1, guard: 0.05 }],
  ],
  謀略: [
    ['冷靜觀察', { startEn: 20 }],
    ['算準時機', { atk: 0.05 }],
    ['看穿弱點', { crit: 0.08 }],
    ['保持距離', { dodge: 0.06 }],
    ['先發制人', { opening: 0.15 }],
    ['深思熟慮', { atk: 0.06 }],
    ['錦囊妙計', { startEn: 20 }],
    ['沉著', { hp: 0.06 }],
    ['一擊必中', { crit: 0.08 }],
    ['神機妙算', { atk: 0.1, startEn: 10 }],
  ],
  幸運: [
    ['好運連連', { crit: 0.06 }],
    ['輕巧步伐', { dodge: 0.05 }],
    ['撿到骨頭', { steal: 0.08 }],
    ['鴻運當頭', { crit: 0.06 }],
    ['開場紅盤', { startEn: 20 }],
    ['滑不溜丟', { dodge: 0.05 }],
    ['手氣正旺', { atk: 0.06 }],
    ['逆轉運', { rage: 0.25 }],
    ['福星高照', { crit: 0.08 }],
    ['天選之犬', { crit: 0.08, dodge: 0.05 }],
  ],
  補給: [
    ['行前打氣', { startEn: 20 }],
    ['糧草充足', { hp: 0.06 }],
    ['後勤支援', { guard: 0.04 }],
    ['士氣高昂', { atk: 0.05 }],
    ['號角', { startEn: 20 }],
    ['耐操', { hp: 0.08 }],
    ['臨危不亂', { enHit: 10 }],
    ['精打細算', { atk: 0.06 }],
    ['穩住陣腳', { guard: 0.05 }],
    ['大總管', { hp: 0.08, atk: 0.08 }],
  ],
  補血: [
    ['暖暖的手', { heal: 0.1 }],
    ['身強體健', { hp: 0.06 }],
    ['隨時待命', { startEn: 20 }],
    ['妙手回春', { heal: 0.1 }],
    ['閃身', { dodge: 0.06 }],
    ['愛的鼓勵', { heal: 0.1 }],
    ['堅持到底', { guard: 0.05 }],
    ['蓄勢', { enHit: 10 }],
    ['仁心', { heal: 0.15 }],
    ['守護天使', { heal: 0.15, hp: 0.08 }],
  ],
};

const isSkillRole = (role: string | undefined): role is SkillRole =>
  !!role && Object.prototype.hasOwnProperty.call(LADDERS, role);

/** 這個定位的 10 個成長技能（照學會的等級排）；敵方的定位沒有 */
export function levelSkillsOf(role: string | undefined): LevelSkill[] {
  if (!isSkillRole(role)) return [];
  return LADDERS[role].map(([name, perks], i) => ({
    level: (i + 1) * SKILL_EVERY,
    name: wt(name),
    perks,
  }));
}

/** 這個等級已經學會的技能 */
export function learnedSkills(role: string | undefined, level: number): LevelSkill[] {
  return levelSkillsOf(role).filter((s) => s.level <= level);
}

/** 從 from 級升到 to 級之間新學會的技能（不含 from、含 to） */
export function newSkills(role: string | undefined, from: number, to: number): LevelSkill[] {
  return levelSkillsOf(role).filter((s) => s.level > from && s.level <= to);
}

const KEYS: readonly (keyof Perks)[] = [
  'atk',
  'hp',
  'guard',
  'startEn',
  'crit',
  'dodge',
  'heal',
  'steal',
  'opening',
  'rage',
  'enHit',
];

/** 把幾組效果加起來（只留不是 0 的） */
export function sumPerks(list: readonly Perks[]): Perks {
  const out: Perks = {};
  for (const k of KEYS) {
    const v = list.reduce((s, p) => s + (p[k] ?? 0), 0);
    // 避免 0.05 + 0.06 這種小數誤差
    if (v) out[k] = Math.round(v * 1000) / 1000;
  }
  return out;
}

/** 這個定位、這個等級的被動效果合計；還沒學會任何技能回傳 undefined */
export function perksOf(role: string | undefined, level: number): Perks | undefined {
  const learned = learnedSkills(role, level);
  return learned.length ? sumPerks(learned.map((s) => s.perks)) : undefined;
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;

const TEXT: Readonly<Record<keyof Perks, (v: number) => string>> = {
  atk: (v) => `傷害 +${pct(v)}`,
  hp: (v) => `血量 +${pct(v)}`,
  guard: (v) => `受到的傷害 -${pct(v)}`,
  startEn: (v) => `開場 EN +${v}`,
  crit: (v) => `爆擊機率 +${pct(v)}`,
  dodge: (v) => `閃避機率 +${pct(v)}`,
  heal: (v) => `補血量 +${pct(v)}`,
  steal: (v) => `攻擊後回復傷害的 ${pct(v)}`,
  opening: (v) => `第 1 回合傷害 +${pct(v)}`,
  rage: (v) => `血量低於 ${pct(RAGE_BELOW)} 時傷害 +${pct(v)}`,
  enHit: (v) => `被打時 EN 多 +${v}`,
};

/** 效果的說明文字，例如「傷害 +8%、爆擊機率 +5%」 */
export function perkText(perks: Perks): string {
  return KEYS.filter((k) => perks[k])
    .map((k) => TEXT[k](perks[k]!))
    .join('、');
}

/** 下一個還沒學會的技能；全部學完回傳 undefined */
export function nextSkill(role: string | undefined, level: number): LevelSkill | undefined {
  return levelSkillsOf(role).find((s) => s.level > level);
}
