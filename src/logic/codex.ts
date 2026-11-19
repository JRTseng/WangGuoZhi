import {
  DOGS,
  FACTIONS,
  factionOf,
  type DogData,
  type DogRarity,
  type Faction,
} from '../data/dogs';
import type { Resources } from '../data/resources';
import type { GameState } from '../state/gameState';

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

export const codexId = (faction: Faction, target: number): string => `${faction}-${target}`;

const ALL_IDS: ReadonlySet<string> = new Set(
  FACTIONS.flatMap((f) => CODEX_TIERS.map((t) => codexId(f, t.target))),
);

type CodexFields = Pick<GameState, 'owned' | 'codex'>;

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

/** 這個陣營的收集獎勵，一段一段列出來 */
export function codexMilestones(state: CodexFields, faction: Faction): CodexMilestone[] {
  const { owned } = codexCount(state, faction);
  return CODEX_TIERS.map((t) => {
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

/** 有幾段獎勵可以領；沒指定陣營就是兩邊加起來（主頁紅點用） */
export function codexClaimable(state: CodexFields, faction?: Faction): number {
  const list = faction ? [faction] : FACTIONS;
  return list.reduce(
    (n, f) => n + codexMilestones(state, f).filter((m) => m.done && !m.claimed).length,
    0,
  );
}

/** 把這個陣營可以領的收集獎勵一次領完 */
export function claimCodex<S extends CodexFields & Pick<GameState, 'resources'>>(
  state: S,
  faction: Faction,
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
