import type { BattleEvent, BattlePace, BattleSide } from './battle';

/**
 * 技能／大絕招演出（T017）的規則，全部是純函式。
 *
 * 只管「畫面怎麼播」，不碰勝負：戰鬥紀錄照舊由 battle.ts 算好，
 * 這裡只是從紀錄裡挑出哪幾次出手要播成大絕招，以及每隻狗的 EN 條顯示到哪。
 * 真正的 EN 值（出手 +25、被打 +15、玩家點狗放招）與技能效果在 T023 才做，
 * 到時候把 planShow 換成讀真正的紀錄即可，動畫（UltimateShow）照樣沿用。
 */

/** 大絕招的演出種類，對應 T023 規格裡的出手種類 */
export type UltKind = 'single' | 'pierce' | 'row' | 'heal' | 'buff';

export const ULT_KINDS: readonly UltKind[] = ['single', 'pierce', 'row', 'heal', 'buff'];

/** 依定位決定大絕招的演出種類（定位字串例如「前排／突擊」） */
export function ultKindOfRole(role: string): UltKind {
  if (role.includes('突擊')) return 'pierce';
  if (role.includes('謀略')) return 'row';
  if (role.includes('補血')) return 'heal';
  if (role.includes('補給') || role.includes('守護')) return 'buff';
  return 'single';
}

/** 出手幾次把 EN 條集滿；集滿後的下一次出手播成大絕招（所以是每隻狗的第 3 次出手） */
export const ULT_CHARGE = 2;

/** 一隻會放大絕招的角色（沒有技能的敵人小兵傳 null） */
export interface ShowCaster {
  /** 角色名字 */
  name: string;
  /** 招式名，動畫中會喊出來 */
  skill: string;
  kind: UltKind;
  /** 喊招時底下那句台詞（玩家自己填的，或預設的），可以是空字串 */
  line: string;
}

export interface ShowUlt extends ShowCaster {
  side: BattleSide;
  /** 施放者在自己那一方的位置 */
  index: number;
}

/** 對應一次出手：這一下是不是大絕招，以及播完後雙方每一隻的 EN 格數（0～ULT_CHARGE） */
export interface ShowStep {
  ult: ShowUlt | null;
  en: { team: number[]; enemy: number[] };
}

export interface ShowCasters {
  team: readonly (ShowCaster | null)[];
  enemy: readonly (ShowCaster | null)[];
}

/**
 * 把戰鬥紀錄排成演出：回傳的陣列和 events 一一對應。
 * 規則：每次出手 EN +1 格，滿了之後的下一次出手播成大絕招並歸零。
 * 補血狗是「攻擊後接著補血」（紀錄裡補血那幾下標了 follow，不算另一次出手、不集氣）：
 * 牠的大絕招播在 EN 已滿的那一回、攻擊後的第一下補血；那一回沒人需要補就留著等下次。
 */
export function planShow(events: readonly BattleEvent[], casters: ShowCasters): ShowStep[] {
  const en = {
    team: casters.team.map(() => 0),
    enemy: casters.enemy.map(() => 0),
  };
  /** 補血狗這一回出手時 EN 已滿：等牠接下來的第一下補血播大絕招 */
  const ready = new Set<string>();
  return events.map((e) => {
    const caster = casters[e.side][e.attacker] ?? null;
    let ult: ShowUlt | null = null;
    if (caster) {
      const key = `${e.side}-${e.attacker}`;
      const isHeal = e.heal !== undefined;
      const full = en[e.side][e.attacker] >= ULT_CHARGE;
      const fire = (): void => {
        ult = { ...caster, kind: isHeal ? 'heal' : caster.kind, side: e.side, index: e.attacker };
        en[e.side][e.attacker] = 0;
        ready.delete(key);
      };
      if (e.follow) {
        if (isHeal && ready.has(key)) fire();
      } else {
        ready.delete(key);
        if (!full) en[e.side][e.attacker] += 1;
        else if (caster.kind === 'heal' && !isHeal) ready.add(key);
        else fire();
      }
    }
    return { ult, en: { team: [...en.team], enemy: [...en.enemy] } };
  });
}

// ---- 播放節奏 ----

/** 1 倍速時一次大絕招演出播多久（毫秒） */
export const ULT_BASE_MS = 1500;
/** 測試模式（?fast=1）一次大絕招播多久 */
export const ULT_FAST_MS = 40;
/** 演出裡「喊招字卡」佔的比例，剩下的是招式打出去的特效 */
export const ULT_CUTIN_RATIO = 0.62;

/** 一次大絕招演出播多久（毫秒，已含倍速）。倍速只影響快慢，不影響結果。 */
export function ultDelayMs(speed: number, pace: BattlePace = 'normal'): number {
  if (pace === 'fast') return ULT_FAST_MS;
  // slow 是給自動測試用的節奏，大絕招放慢 2 倍就夠看清楚
  const base = ULT_BASE_MS * (pace === 'slow' ? 2 : 1);
  return Math.round(base / Math.min(4, Math.max(1, speed)));
}

// ---- 玩家自己填的台詞 ----

/** 台詞最多幾個字 */
export const SKILL_LINE_MAX = 16;

/** 整理玩家輸入的台詞：去掉換行與控制字元、頭尾空白，超過字數就截掉 */
export function cleanSkillLine(raw: string): string {
  // 換行、控制字元（含 U+2028／U+2029）都當成空白
  const flat = Array.from(raw, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f || code === 0x2028 || code === 0x2029 ? ' ' : ch;
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  // 用 Array.from 以「字」為單位截，表情符號不會被切一半
  return Array.from(flat).slice(0, SKILL_LINE_MAX).join('').trim();
}

interface LineState {
  owned: readonly string[];
  skillLines: Record<string, string>;
}

/** 這隻狗放招時要喊的台詞：玩家填的優先，沒有就用預設（都沒有回傳空字串） */
export function skillLineOf(
  lines: Readonly<Record<string, string>>,
  defaults: Readonly<Record<string, string>>,
  dogId: string,
): string {
  return lines[dogId] || defaults[dogId] || '';
}

/**
 * 設定某隻狗的台詞，回傳新狀態。空字串（或只有空白）代表恢復預設。
 * 沒擁有的狗不能改；內容沒變就回傳原狀態。
 */
export function setSkillLine<T extends LineState>(state: T, dogId: string, raw: string): T {
  if (!state.owned.includes(dogId)) return state;
  const line = cleanSkillLine(raw);
  if ((state.skillLines[dogId] ?? '') === line) return state;
  const skillLines = { ...state.skillLines };
  if (line) skillLines[dogId] = line;
  else delete skillLines[dogId];
  return { ...state, skillLines };
}
