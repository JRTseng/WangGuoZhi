import type Phaser from 'phaser';
import { battleSeedFromSearch } from '../../logic/battle';
import { beginExpedition } from '../../logic/expedition';
import { nextStagePlan, type NextStagePlan } from '../../logic/nextStage';
import { getState, setState, tick, timeOptions } from '../../state/store';

/** 剛打完的那一關與隊伍；之後要接著打下一關時用 */
export interface NextFrom {
  stageId: string;
  team: string[];
}

/** 現在能不能直接打下一關（結算面板要不要畫「下一關」按鈕） */
export function planNext(from: NextFrom): NextStagePlan | null {
  return nextStagePlan(getState(), from.stageId, from.team, Date.now(), timeOptions());
}

/** 「下一關」按鈕上的字 */
export function nextLabel(plan: NextStagePlan): string {
  return plan.benched > 0 ? `下一關（上 ${plan.team.length} 隻）▶` : '下一關 ▶';
}

/**
 * 直接開打下一關：扣體力與次數（有開限制的話），進戰鬥畫面。
 * 設定開了「略過戰鬥畫面」就進去後馬上算完看結算。開不了戰回傳 false（呼叫端自己決定回哪裡）。
 */
export function startNext(scene: Phaser.Scene, from: NextFrom): boolean {
  const state = tick();
  const now = Date.now();
  const plan = nextStagePlan(state, from.stageId, from.team, now, timeOptions());
  if (!plan) return false;
  const b = beginExpedition(state, plan.stage.id, plan.team, now, {
    ...timeOptions(),
    seed: battleSeedFromSearch(window.location.search) ?? Math.floor(Math.random() * 0x100000000),
  });
  if (!b.ok) return false;
  setState(b.state);
  scene.scene.start('BattleScene', {
    chapter: plan.chapter,
    instant: b.state.settings.skipBattle,
  });
  return true;
}
