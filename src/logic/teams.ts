import type { GameState, TeamPreset } from '../state/gameState';
import { TEAM_SIZE, busyDogIds } from './expedition';
import { freezeCells } from './formation';

/** 可以存幾組隊伍（Jimmy 2026-11-14：「可以做五組最多切換」） */
export const TEAM_PRESETS = 5;
/** 隊伍分頁上的名字 */
export const TEAM_PRESET_NAMES = ['一隊', '二隊', '三隊', '四隊', '五隊'] as const;

export function emptyPresets(): TeamPreset[] {
  return Array.from({ length: TEAM_PRESETS }, () => ({ team: [], formation: {} }));
}

function pick(formation: Record<string, number>, ids: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) if (formation[id] !== undefined) out[id] = formation[id];
  return out;
}

/**
 * 切到第 index 組隊伍（0～4）。目前這組的成員與九宮格站位先存起來，再把那一組拿出來用：
 * state.team／state.formation 永遠是「現在這一組」，其他程式不用管有幾組。
 * 那一組裡已經不能上陣的狗（寄宿中、不再擁有）會拿掉；還沒排過的組是空的。
 */
export function switchTeam(state: GameState, index: number): GameState {
  if (!Number.isInteger(index) || index < 0 || index >= TEAM_PRESETS) return state;
  if (index === state.teamIndex) return state;
  const frozen = freezeCells(state, state.team);
  const teams = Array.from({ length: TEAM_PRESETS }, (_, i): TeamPreset => {
    if (i === state.teamIndex) {
      return { team: [...state.team], formation: pick(frozen.formation, state.team) };
    }
    return state.teams[i] ?? { team: [], formation: {} };
  });
  const next = teams[index];
  const busy = busyDogIds(state);
  const team = next.team
    .filter((id) => state.owned.includes(id) && !busy.has(id))
    .slice(0, TEAM_SIZE);
  return {
    ...state,
    teams,
    teamIndex: index,
    team,
    formation: { ...frozen.formation, ...pick(next.formation, team) },
  };
}

/** 每一組現在有幾隻（分頁上顯示用）；目前這組看 state.team */
export function presetSizes(state: GameState): number[] {
  return Array.from({ length: TEAM_PRESETS }, (_, i) =>
    i === state.teamIndex ? state.team.length : (state.teams[i]?.team.length ?? 0),
  );
}
