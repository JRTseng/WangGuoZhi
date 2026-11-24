import { BACKGROUNDS, type BackgroundData } from '../data/backgrounds';
import {
  DOGS,
  FACTIONS,
  FACTION_NAMES,
  factionOf,
  findDog,
  type DogData,
  type DogRarity,
  type Faction,
} from '../data/dogs';
import { ALL_GEARS, type GearData } from '../data/equipment';
import type { Resources } from '../data/resources';
import type { GameState } from '../state/gameState';
import { gearStarOf, ownedCount } from './equipment';
import { unlockedBackgrounds } from './progress';

/**
 * 圖鑑（T038）：把一個陣營的全部角色排出來，有的亮著、還沒有的暗著，
 * 收集到一定數量可以領一次獎勵。汪國、喵國各算各的。
 * 純函式，回傳新的狀態。
 */

/** 圖鑑的存檔：領過哪幾段收集獎勵（id 像 `dog-10`） */
export interface CodexState {
  claimed: string[];
}

/** 收集到幾隻有獎勵，以及送多少骨頭幣（暫定） */
export const CODEX_TIERS: readonly { target: number; bones: number }[] = [
  { target: 10, bones: 50 },
  { target: 20, bones: 100 },
  { target: 30, bones: 150 },
  { target: 40, bones: 200 },
  { target: 50, bones: 300 },
];

/** 稀有度由高到低（圖鑑的排列順序） */
export const CODEX_RARITIES: readonly DogRarity[] = ['SSR', 'SR', 'R', 'N'];

/**
 * 圖鑑的分頁（T043）：兩個陣營的角色之外，再加「裝備」與「背景」。
 * 每一頁各算各的收集數量、各有自己的收集獎勵。
 */
export type CodexPage = Faction | 'gear' | 'background';

export const CODEX_PAGES: readonly CodexPage[] = [...FACTIONS, 'gear', 'background'];

export const CODEX_PAGE_NAMES: Readonly<Record<CodexPage, string>> = {
  ...FACTION_NAMES,
  gear: '裝備',
  background: '背景',
};

/** 每一頁算的單位：角色是「隻」、裝備是「種」、背景是「張」 */
export const CODEX_PAGE_UNITS: Readonly<Record<CodexPage, string>> = {
  dog: '隻',
  cat: '隻',
  gear: '種',
  background: '張',
};

type Tier = { target: number; bones: number };

/** 裝備收集到幾種有獎勵（暫定）；最後一段就是全部收集 */
export const CODEX_GEAR_TIERS: readonly Tier[] = [
  { target: 10, bones: 50 },
  { target: 20, bones: 100 },
  { target: 35, bones: 150 },
  { target: 50, bones: 200 },
  { target: ALL_GEARS.length, bones: 300 },
];

/** 背景收集到幾張有獎勵（暫定）；最後一段就是全部收集 */
export const CODEX_BACKGROUND_TIERS: readonly Tier[] = [
  { target: 3, bones: 50 },
  { target: 6, bones: 100 },
  { target: 9, bones: 150 },
  { target: BACKGROUNDS.length, bones: 300 },
];

/** 這一頁的收集獎勵 */
export function codexTiers(page: CodexPage): readonly Tier[] {
  if (page === 'gear') return CODEX_GEAR_TIERS;
  if (page === 'background') return CODEX_BACKGROUND_TIERS;
  return CODEX_TIERS;
}

export const codexId = (page: CodexPage, target: number): string => `${page}-${target}`;

const ALL_IDS: ReadonlySet<string> = new Set(
  CODEX_PAGES.flatMap((p) => codexTiers(p).map((t) => codexId(p, t.target))),
);

/** 算各頁收集數量要看的欄位 */
type CollectFields = Pick<GameState, 'owned' | 'gear' | 'cleared' | 'redeemedCodes'>;
type CodexFields = CollectFields & Pick<GameState, 'codex'>;

export interface CodexEntry {
  dog: DogData;
  owned: boolean;
}

/** 這個陣營的全部角色：稀有度高的在前面，同稀有度照原本的順序 */
export function codexEntries(state: Pick<GameState, 'owned'>, faction: Faction): CodexEntry[] {
  const rank = (d: DogData) => CODEX_RARITIES.indexOf(d.rarity ?? 'N');
  const owned = new Set(state.owned);
  return DOGS.filter((d) => factionOf(d) === faction)
    .map((dog, i) => ({ dog, i }))
    .sort((a, b) => rank(a.dog) - rank(b.dog) || a.i - b.i)
    .map(({ dog }) => ({ dog, owned: owned.has(dog.id) }));
}

/** 這個陣營收集了幾隻、一共幾隻 */
export function codexCount(
  state: Pick<GameState, 'owned'>,
  faction: Faction,
): { owned: number; total: number } {
  const list = codexEntries(state, faction);
  return { owned: list.filter((e) => e.owned).length, total: list.length };
}

/** 各稀有度收集了幾隻、一共幾隻 */
export function codexRarityCounts(
  state: Pick<GameState, 'owned'>,
  faction: Faction,
): Record<DogRarity, { owned: number; total: number }> {
  const out = Object.fromEntries(CODEX_RARITIES.map((r) => [r, { owned: 0, total: 0 }])) as Record<
    DogRarity,
    { owned: number; total: number }
  >;
  for (const e of codexEntries(state, faction)) {
    const c = out[e.dog.rarity ?? 'N'];
    c.total += 1;
    if (e.owned) c.owned += 1;
  }
  return out;
}

export interface CodexMilestone {
  id: string;
  target: number;
  reward: Resources;
  /** 收集數量到了 */
  done: boolean;
  claimed: boolean;
}

// ---- 裝備與背景（T043） ----

export interface CodexGearEntry {
  gear: GearData;
  owned: boolean;
  /** 現在有幾件 */
  count: number;
  /** 升到幾星 */
  star: number;
}

/** 全部的裝備：稀有度高的在前面，同稀有度照原本的順序（一般 → 專屬 → 爬塔飾品） */
export function codexGearEntries(state: Pick<GameState, 'gear' | 'gearStars'>): CodexGearEntry[] {
  const rank = (g: GearData) => CODEX_RARITIES.indexOf(g.rarity);
  return ALL_GEARS.map((gear, i) => ({ gear, i }))
    .sort((a, b) => rank(a.gear) - rank(b.gear) || a.i - b.i)
    .map(({ gear }) => {
      const count = ownedCount(state, gear.id);
      return { gear, owned: count > 0, count, star: gearStarOf(state, gear.id) };
    });
}

/** 這件裝備怎麼拿到，給還沒有的人看 */
export function gearSource(g: Pick<GearData, 'exclusive' | 'tower'>): string {
  if (g.exclusive) return `拿到「${findDog(g.exclusive)?.name ?? '？'}」就送`;
  if (g.tower) return `登天塔第 ${g.tower} 層第一次通關`;
  return '關卡打贏有機會掉，商城偶爾也會賣';
}

export interface CodexBackgroundEntry {
  background: BackgroundData;
  owned: boolean;
  /** 主頁現在用的就是這一張 */
  current: boolean;
}

/** 全部的主頁背景，照原本的順序（跟著章節） */
export function codexBackgroundEntries(
  state: Pick<GameState, 'cleared' | 'redeemedCodes' | 'backgroundId'>,
): CodexBackgroundEntry[] {
  const owned = new Set(unlockedBackgrounds(state));
  return BACKGROUNDS.map((background) => ({
    background,
    owned: owned.has(background.id),
    current: background.id === state.backgroundId,
  }));
}

/** 這一頁收集了多少、一共多少 */
export function codexPageCount(
  state: CollectFields,
  page: CodexPage,
): { owned: number; total: number } {
  if (page === 'gear') {
    return {
      owned: ALL_GEARS.filter((g) => ownedCount(state, g.id) > 0).length,
      total: ALL_GEARS.length,
    };
  }
  if (page === 'background') {
    return { owned: unlockedBackgrounds(state).length, total: BACKGROUNDS.length };
  }
  return codexCount(state, page);
}

/** 這一頁的收集獎勵，一段一段列出來 */
export function codexMilestones(state: CodexFields, faction: CodexPage): CodexMilestone[] {
  const { owned } = codexPageCount(state, faction);
  return codexTiers(faction).map((t) => {
    const id = codexId(faction, t.target);
    return {
      id,
      target: t.target,
      reward: { food: 0, bones: t.bones },
      done: owned >= t.target,
      claimed: state.codex.claimed.includes(id),
    };
  });
}

/** 有幾段獎勵可以領；沒指定哪一頁就是全部加起來（主頁紅點用） */
export function codexClaimable(state: CodexFields, faction?: CodexPage): number {
  const list = faction ? [faction] : CODEX_PAGES;
  return list.reduce(
    (n, f) => n + codexMilestones(state, f).filter((m) => m.done && !m.claimed).length,
    0,
  );
}

/** 把這一頁可以領的收集獎勵一次領完 */
export function claimCodex<S extends CodexFields & Pick<GameState, 'resources'>>(
  state: S,
  faction: CodexPage,
): { state: S; reward: Resources; count: number } {
  const ready = codexMilestones(state, faction).filter((m) => m.done && !m.claimed);
  const reward: Resources = { food: 0, bones: 0 };
  for (const m of ready) {
    reward.food += m.reward.food;
    reward.bones += m.reward.bones;
  }
  if (ready.length === 0) return { state, reward, count: 0 };
  return {
    state: {
      ...state,
      resources: {
        ...state.resources,
        food: state.resources.food + reward.food,
        bones: state.resources.bones + reward.bones,
      },
      codex: { claimed: [...state.codex.claimed, ...ready.map((m) => m.id)] },
    },
    reward,
    count: ready.length,
  };
}

/** 讀檔時整理圖鑑欄位：認不得的 id 丟掉、不重複。舊存檔沒有這個欄位就是都還沒領 */
export function sanitizeCodex(raw: unknown): CodexState {
  const list =
    typeof raw === 'object' && raw !== null ? (raw as { claimed?: unknown }).claimed : null;
  if (!Array.isArray(list)) return { claimed: [] };
  const claimed: string[] = [];
  for (const id of list) {
    if (typeof id === 'string' && ALL_IDS.has(id) && !claimed.includes(id)) claimed.push(id);
  }
  return { claimed };
}
