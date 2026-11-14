import type { DogRarity } from '../data/dogs';
import {
  GEARS,
  GEAR_SLOTS,
  GEAR_SLOT_LABEL,
  findGear,
  type GearData,
  type GearSlot,
} from '../data/equipment';
import type { GameState } from '../state/gameState';

/**
 * 裝備（T014）：穿、脫、換、算加成、出征掉落。全部是純函式，亂數由外面傳入。
 *
 * 狀態裡記兩樣東西：
 * - gear：每種裝備擁有幾件（以裝備 id 為鍵）
 * - equipped：每隻狗每個部位穿哪一件（以狗狗 id 為鍵）
 * 同一種裝備被幾隻狗穿著，不會超過擁有的件數，所以同一件不會同時在兩隻狗身上。
 */

export type DogGear = Partial<Record<GearSlot, string>>;
type HasGear = Pick<GameState, 'gear' | 'equipped'>;

/** 出征打贏掉 1 件裝備的機率（Jimmy 2026-11-12） */
export const DROP_RATE = 0.3;

/** 一隻狗身上的裝備（照部位順序） */
export function gearOf(state: { equipped?: GameState['equipped'] }, dogId: string): GearData[] {
  const worn = state.equipped?.[dogId];
  if (!worn) return [];
  const out: GearData[] = [];
  for (const slot of GEAR_SLOTS) {
    const g = findGear(worn[slot] ?? '');
    if (g && g.slot === slot) out.push(g);
  }
  return out;
}

/** 一隻狗身上的裝備加成合計 */
export function gearBonus(
  state: { equipped?: GameState['equipped'] },
  dogId: string,
): { attack: number; defense: number } {
  let attack = 0;
  let defense = 0;
  for (const g of gearOf(state, dogId)) {
    attack += g.attack;
    defense += g.defense;
  }
  return { attack, defense };
}

/** 這種裝備擁有幾件 */
export function ownedCount(state: Pick<GameState, 'gear'>, gearId: string): number {
  return Math.max(0, Math.floor(state.gear[gearId] ?? 0));
}

/** 穿著這種裝備的狗（照狀態裡的順序） */
export function wearersOf(state: Pick<GameState, 'equipped'>, gearId: string): string[] {
  const slot = findGear(gearId)?.slot;
  if (!slot) return [];
  return Object.keys(state.equipped).filter((id) => state.equipped[id][slot] === gearId);
}

/** 還沒被穿走的有幾件 */
export function spareCount(state: HasGear, gearId: string): number {
  return Math.max(0, ownedCount(state, gearId) - wearersOf(state, gearId).length);
}

/** 擁有的裝備種類，照部位、稀有度高的在前；slot 有給就只列那個部位 */
export function ownedGears(state: Pick<GameState, 'gear'>, slot?: GearSlot): GearData[] {
  const rank: Record<DogRarity, number> = { SSR: 0, SR: 1, R: 2, N: 3 };
  return GEARS.filter((g) => ownedCount(state, g.id) > 0 && (!slot || g.slot === slot))
    .map((g, i) => ({ g, i }))
    .sort(
      (a, b) =>
        GEAR_SLOTS.indexOf(a.g.slot) - GEAR_SLOTS.indexOf(b.g.slot) ||
        rank[a.g.rarity] - rank[b.g.rarity] ||
        a.i - b.i,
    )
    .map((x) => x.g);
}

/** 總共擁有幾件裝備 */
export function totalGear(state: Pick<GameState, 'gear'>): number {
  return GEARS.reduce((s, g) => s + ownedCount(state, g.id), 0);
}

/** 拿到裝備 */
export function addGear<S extends Pick<GameState, 'gear'>>(state: S, gearId: string, n = 1): S {
  if (!findGear(gearId) || n <= 0) return state;
  return { ...state, gear: { ...state.gear, [gearId]: ownedCount(state, gearId) + Math.floor(n) } };
}

export type EquipError = 'gear-not-found' | 'dog-not-owned' | 'no-gear';
export type EquipResult =
  | { ok: true; state: GameState; /** 這一件原本穿在哪隻狗身上（從牠身上換過來） */ from?: string }
  | { ok: false; error: EquipError };

function setSlot(
  equipped: GameState['equipped'],
  dogId: string,
  slot: GearSlot,
  gearId: string | null,
): GameState['equipped'] {
  const worn: DogGear = { ...(equipped[dogId] ?? {}) };
  if (gearId) worn[slot] = gearId;
  else delete worn[slot];
  const next = { ...equipped };
  if (Object.keys(worn).length > 0) next[dogId] = worn;
  else delete next[dogId];
  return next;
}

/**
 * 穿上一件裝備。這個部位原本穿的會自動換下來放回倉庫。
 * 沒有多的、都被別的狗穿走時，從第一隻穿著的狗身上換過來（回傳 from）。
 */
export function equip(state: GameState, dogId: string, gearId: string): EquipResult {
  const g = findGear(gearId);
  if (!g) return { ok: false, error: 'gear-not-found' };
  if (!state.owned.includes(dogId)) return { ok: false, error: 'dog-not-owned' };
  if (ownedCount(state, gearId) <= 0) return { ok: false, error: 'no-gear' };
  if (state.equipped[dogId]?.[g.slot] === gearId) return { ok: true, state };
  let equipped = state.equipped;
  let from: string | undefined;
  if (spareCount(state, gearId) <= 0) {
    from = wearersOf(state, gearId).find((id) => id !== dogId);
    if (!from) return { ok: false, error: 'no-gear' };
    equipped = setSlot(equipped, from, g.slot, null);
  }
  equipped = setSlot(equipped, dogId, g.slot, gearId);
  return { ok: true, state: { ...state, equipped }, ...(from ? { from } : {}) };
}

/** 把一個部位的裝備脫下來放回倉庫；本來就沒穿則不變 */
export function unequip(state: GameState, dogId: string, slot: GearSlot): GameState {
  if (!state.equipped[dogId]?.[slot]) return state;
  return { ...state, equipped: setSlot(state.equipped, dogId, slot, null) };
}

const total = (g: GearData): number => g.attack + g.defense;

/**
 * 一鍵穿上：每個部位從「身上那件＋倉庫裡沒人穿的」挑加成最高的。
 * 不會去搶別的狗身上的；一樣好就維持身上那件。
 */
export function equipBest(state: GameState, dogId: string): GameState {
  if (!state.owned.includes(dogId)) return state;
  let s = state;
  for (const slot of GEAR_SLOTS) {
    const current = findGear(s.equipped[dogId]?.[slot] ?? '');
    let best = current;
    for (const g of GEARS) {
      if (g.slot !== slot || spareCount(s, g.id) <= 0) continue;
      if (!best || total(g) > total(best)) best = g;
    }
    if (best && best !== current) {
      const r = equip(s, dogId, best.id);
      if (r.ok) s = r.state;
    }
  }
  return s;
}

// ---- 掉落 ----

/**
 * 掉落的稀有度比重：章節越後面越容易出好的，Boss 關的 SR／SSR 加倍。
 * 第 1 章 N 70／R 25／SR 5；第 10 章 N 20／R 43／SR 32／SSR 8（暫定）。
 */
export function dropWeights(chapter: number, boss: boolean): Record<DogRarity, number> {
  const c = Math.min(10, Math.max(1, Math.floor(chapter))) - 1;
  const k = boss ? 2 : 1;
  return {
    N: Math.max(20, 70 - 6 * c),
    R: 25 + 2 * c,
    SR: (5 + 3 * c) * k,
    SSR: Math.max(boss ? 1 : 0, c - 1) * k,
  };
}

/**
 * 抽這一仗掉什麼：DROP_RATE 的機率掉 1 件，先照比重抽稀有度，再從那個稀有度裡平均抽一件。
 * 沒掉回傳 null。rng 回傳 0～1（不含 1）。
 */
export function rollDrop(chapter: number, boss: boolean, rng: () => number): GearData | null {
  if (rng() >= DROP_RATE) return null;
  const w = dropWeights(chapter, boss);
  const order: DogRarity[] = ['N', 'R', 'SR', 'SSR'];
  const sum = order.reduce((s, r) => s + w[r], 0);
  let x = rng() * sum;
  let rarity: DogRarity = 'N';
  for (const r of order) {
    if (x < w[r]) {
      rarity = r;
      break;
    }
    x -= w[r];
  }
  const pool = GEARS.filter((g) => g.rarity === rarity);
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

// ---- 顯示用 ----

/** 「攻 +4」「防 +2」「攻 +1 防 +3」 */
export function gearBonusLabel(g: Pick<GearData, 'attack' | 'defense'>): string {
  return [g.attack > 0 ? `攻 +${g.attack}` : '', g.defense > 0 ? `防 +${g.defense}` : '']
    .filter(Boolean)
    .join(' ');
}

/** 結算用的一行字：獲得裝備「毛衣無縫」（R・衣服） */
export function dropNote(g: GearData): string {
  return `獲得裝備「${g.name}」（${g.rarity}・${GEAR_SLOT_LABEL[g.slot]}）`;
}

// ---- 讀檔時的整理 ----

/**
 * 把讀進來的裝備資料整理成合法的：只留認得的裝備與擁有的狗、部位要對，
 * 同一種裝備穿著的狗不能比擁有的件數多（多的照順序脫掉）。
 */
export function sanitizeGear(
  rawGear: unknown,
  rawEquipped: unknown,
  isOwned: (dogId: string) => boolean,
): HasGear {
  const gear: Record<string, number> = {};
  if (typeof rawGear === 'object' && rawGear !== null && !Array.isArray(rawGear)) {
    for (const [id, n] of Object.entries(rawGear)) {
      if (findGear(id) && typeof n === 'number' && Number.isFinite(n) && n >= 1) {
        gear[id] = Math.floor(n);
      }
    }
  }
  const equipped: GameState['equipped'] = {};
  const used: Record<string, number> = {};
  if (typeof rawEquipped === 'object' && rawEquipped !== null && !Array.isArray(rawEquipped)) {
    for (const [dogId, worn] of Object.entries(rawEquipped)) {
      if (!isOwned(dogId) || typeof worn !== 'object' || worn === null) continue;
      const out: DogGear = {};
      for (const slot of GEAR_SLOTS) {
        const id: unknown = (worn as Record<string, unknown>)[slot];
        if (typeof id !== 'string') continue;
        const g = findGear(id);
        if (!g || g.slot !== slot || (used[id] ?? 0) >= (gear[id] ?? 0)) continue;
        used[id] = (used[id] ?? 0) + 1;
        out[slot] = id;
      }
      if (Object.keys(out).length > 0) equipped[dogId] = out;
    }
  }
  return { gear, equipped };
}
