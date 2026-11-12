import { REGIONS, type StageData } from '../data/regions';
import type { AutoSummary, ExpeditionRecord, GameState } from '../state/gameState';
import { TEAM_MIN, TEAM_SIZE, busyDogIds, runExpedition } from './expedition';
import { stageExp } from './leveling';
import {
  STAMINA_COST,
  msUntilStamina,
  nextResetAt,
  runsLeft,
  settle,
  type TimeOptions,
} from './stamina';

/**
 * 自動出征（T019）：打開後只要體力夠，就用目前的組隊編排去打
 * 「已通過、今天還有次數」的關卡裡經驗最高的那一關，不播戰鬥畫面，結果累積成一份摘要。
 * 全部是純函式；advanceAuto 從上次處理的時間一路模擬到現在，
 * 所以每 0.25 秒呼叫一次和離開很久後才呼叫一次，結果一樣。
 */

/** 一次補算最多模擬幾步，避免離開太久時卡住畫面 */
const MAX_STEPS = 2000;

/** 自動出征用的隊伍：組隊編排裡目前擁有、沒在寄宿的狗 */
export function autoTeamOf(state: GameState): string[] {
  const busy = busyDogIds(state);
  return state.team.filter((id) => state.owned.includes(id) && !busy.has(id)).slice(0, TEAM_SIZE);
}

/**
 * 自動出征現在會打哪一關：已通過、今天還有次數的關卡裡經驗最高的；
 * 經驗一樣高就選後面的關卡（獎勵比較多）。沒有就回傳 undefined。
 */
export function pickAutoStage(
  state: GameState,
  now: number,
  o?: TimeOptions,
): StageData | undefined {
  let best: StageData | undefined;
  for (const region of REGIONS) {
    for (const s of region.stages) {
      if (!state.cleared.includes(s.id) || runsLeft(state, s.id, now, o) <= 0) continue;
      if (!best || stageExp(s) >= stageExp(best)) best = s;
    }
  }
  return best;
}

/** 開或關自動出征。打開時從現在開始算，不會回頭補算關著的那段時間。 */
export function setAuto(state: GameState, enabled: boolean, now: number): GameState {
  if (state.auto.enabled === enabled) return state;
  return { ...state, auto: { ...state.auto, enabled, lastAt: now } };
}

/** 玩家看過摘要後清掉 */
export function clearAutoSummary(state: GameState): GameState {
  return state.auto.summary ? { ...state, auto: { ...state.auto, summary: null } } : state;
}

function addToSummary(prev: AutoSummary | null, r: ExpeditionRecord): AutoSummary {
  const s: AutoSummary = prev ?? {
    runs: 0,
    wins: 0,
    reward: { food: 0, bones: 0 },
    stages: {},
    dogs: {},
  };
  const dogs = { ...s.dogs };
  for (const g of r.gains) {
    const d = dogs[g.dogId] ?? { exp: 0, levels: 0 };
    dogs[g.dogId] = { exp: d.exp + g.exp, levels: d.levels + (g.toLevel - g.fromLevel) };
  }
  return {
    runs: s.runs + 1,
    wins: s.wins + (r.win ? 1 : 0),
    reward: { food: s.reward.food + r.reward.food, bones: s.reward.bones + r.reward.bones },
    stages: { ...s.stages, [r.stageId]: (s.stages[r.stageId] ?? 0) + 1 },
    dogs,
  };
}

/**
 * 把自動出征補算到 now。沒開就原樣回傳。
 * 從上次處理的時間開始：體力夠且有關卡可打就打一場；否則跳到「體力回到 20」或「每日重置」的時刻再看。
 */
export function advanceAuto(state: GameState, now: number, o?: TimeOptions): GameState {
  if (!state.auto.enabled) return state;
  const team = autoTeamOf(state);
  let s = state;
  // 體力已經結算到比較後面的時間（例如中間手動打過一場）就從那裡開始，避免重複恢復
  let t = Math.min(Math.max(state.auto.lastAt, state.stamina.updatedAt), now);
  if (team.length >= TEAM_MIN && state.cleared.length > 0) {
    for (let i = 0; i < MAX_STEPS; i++) {
      s = settle(s, t, o);
      const stage = pickAutoStage(s, t, o);
      if (stage && s.stamina.value >= STAMINA_COST) {
        const r = runExpedition(s, stage.id, team, t, { ...o, auto: true });
        if (!r.ok) break;
        s = {
          ...r.state,
          auto: { ...r.state.auto, summary: addToSummary(s.auto.summary, r.record) },
        };
        continue;
      }
      const next = stage ? t + msUntilStamina(s, STAMINA_COST, t, o) : nextResetAt(t, o);
      if (next > now || next <= t) break;
      t = next;
    }
  }
  s = settle(s, now, o);
  return s.auto.lastAt === now ? s : { ...s, auto: { ...s.auto, lastAt: now } };
}
