import { STARTER_IDS, findDog, type Faction } from '../data/dogs';
import type { GameState } from '../state/gameState';
import { initialProgress } from './leveling';

/**
 * 陣營（T029，Jimmy 2026-11-17）：一開始選加入汪國（狗）或喵國（貓），兩邊召募到的角色不一樣。
 * 全部單機：陣營只記在自己的存檔裡。純函式，回傳新的狀態。
 *
 * - 還沒選（faction 是空字串）時當成汪國，遊戲照常能玩；主頁會帶去選陣營畫面。
 * - 剛開始的存檔（沒打過、沒抽過）選了之後，手上就是那個陣營的五隻；
 *   已經玩過的存檔換陣營，原本的夥伴全部留著，另外補上新陣營的五隻。
 * - 每週積分戰還沒做，現在可以隨時換；之後開戰了再限制。
 */

type FactionFields = Pick<
  GameState,
  | 'faction'
  | 'owned'
  | 'dogs'
  | 'team'
  | 'teams'
  | 'formation'
  | 'lobbyDogId'
  | 'history'
  | 'cleared'
  | 'gacha'
>;

/** 玩家的陣營；還沒選的當汪國 */
export function playerFaction(state: Pick<GameState, 'faction'>): Faction {
  return state.faction === 'cat' ? 'cat' : 'dog';
}

/** 還沒選過陣營 */
export function needFactionPick(state: Pick<GameState, 'faction'>): boolean {
  return state.faction !== 'dog' && state.faction !== 'cat';
}

/** 還沒開始玩：沒出征過、沒抽過 */
export function isFreshSave(state: Pick<GameState, 'history' | 'cleared' | 'gacha'>): boolean {
  return state.history.length === 0 && state.cleared.length === 0 && state.gacha.pulls === 0;
}

/** 選（或換）陣營 */
export function chooseFaction<S extends FactionFields>(state: S, faction: Faction): S {
  if (state.faction === faction) return state;
  const starters = STARTER_IDS[faction];
  if (isFreshSave(state)) {
    // 還沒開始玩：手上就是這個陣營的五隻
    return {
      ...state,
      faction,
      owned: [...starters],
      dogs: Object.fromEntries(starters.map((id) => [id, initialProgress(findDog(id)!)])),
      team: starters.slice(0, 3),
      teams: state.teams.map(() => ({ team: [], formation: {} })),
      formation: {},
      lobbyDogId: starters[0],
    };
  }
  const owned = [...state.owned];
  const dogs = { ...state.dogs };
  for (const id of starters) {
    if (owned.includes(id)) continue;
    owned.push(id);
    dogs[id] = dogs[id] ?? initialProgress(findDog(id)!);
  }
  return { ...state, faction, owned, dogs };
}

/** 存檔讀回來的陣營：不認得的當還沒選 */
export function sanitizeFaction(raw: unknown): GameState['faction'] {
  return raw === 'dog' || raw === 'cat' ? raw : '';
}

/**
 * 網址參數（測試用）：?faction=dog／cat 直接指定；?faction=0 不要自動帶去選陣營畫面。
 * 回傳 pick 是要指定的陣營（沒有就 null），popup 是要不要自動跳出。
 */
export function factionFromSearch(search: string): { pick: Faction | null; popup: boolean } {
  const v = new URLSearchParams(search).get('faction');
  if (v === 'dog' || v === 'cat') return { pick: v, popup: false };
  return { pick: null, popup: v !== '0' && v !== 'false' };
}
