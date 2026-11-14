import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { LINEUP_SCALE } from '../data/lineupScale';
import { REGIONS, STAGE_LINEUPS, type StageData } from '../data/regions';
import { createInitialState } from '../state/gameState';
import { battleDogPower, resolveBattle, type BattleDog } from './battle';
import { battleInputOf, battleTeamOf } from './expedition';
import { initialProgress } from './leveling';

/**
 * 關卡數值驗收（T018）：每一關用自己的敵人陣容大量模擬。
 * 隊伍取四支常見隊伍的前幾隻（這一關能上陣幾隻就幾隻），攻防等比例調到戰力剛好等於建議戰力。
 *
 * 要重算 src/data/lineupScale.ts 時：把最下面那個 it.skip 改成 it 跑一次，照印出來的表貼回去。
 */
const state = createInitialState(0);
for (const d of DOGS) state.dogs[d.id] = initialProgress(d);

const TEAMS: Record<string, string[]> = {
  新手: ['heixuan', 'changxu', 'xiaosuan', 'daer', 'abai'],
  各定位一隻: ['tieya', 'jiying', 'xueling', 'shanlan', 'douding'],
  偏突擊: ['heixuan', 'modian', 'jiying', 'changgong', 'tieya'],
  偏謀略: ['xiaosuan', 'shuangyan', 'changxu', 'xueling', 'zhuifeng'],
};

function teamAt(ids: string[], power: number): BattleDog[] {
  const team = battleTeamOf(state, ids);
  const now = team.reduce((s, d) => s + battleDogPower(d), 0);
  return team.map((d) => ({
    ...d,
    attack: (d.attack * power) / now,
    defense: (d.defense * power) / now,
  }));
}

/** 四支隊伍打這一關的平均勝率；power 是隊伍戰力相對建議戰力的比例 */
function stageRate(s: StageData, n: number, power = 1, scale = s.scale): number {
  let sum = 0;
  for (const ids of Object.values(TEAMS)) {
    const team = teamAt(ids.slice(0, s.teamMax), s.recommendedPower * power);
    const input = battleInputOf({ stageId: s.id, team, seed: 0 });
    let wins = 0;
    for (let i = 0; i < n; i++) {
      if (resolveBattle({ ...input, scale, seed: i * 104729 + 7 }).win) wins++;
    }
    sum += wins / n;
  }
  return sum / Object.keys(TEAMS).length;
}

const STAGES = REGIONS.flatMap((r) => r.stages);

describe('每一關的勝率（大量模擬）', () => {
  it('每種陣容都有對過強度', () => {
    for (const s of STAGES) expect(LINEUP_SCALE[STAGE_LINEUPS[s.id]], s.id).toBeGreaterThan(0);
  });

  it('上陣隻數剛好、戰力等於建議戰力：每一關平均勝率在 45%～75% 之間', () => {
    for (const s of STAGES) {
      const r = stageRate(s, 60);
      expect(r, s.id).toBeGreaterThanOrEqual(0.45);
      expect(r, s.id).toBeLessThanOrEqual(0.75);
    }
  }, 60_000);

  it('戰力多三成多半會贏、少三成幾乎都輸', () => {
    for (const s of STAGES) {
      expect(stageRate(s, 30, 1.3), s.id).toBeGreaterThan(0.8);
      expect(stageRate(s, 30, 0.7), s.id).toBeLessThan(0.15);
    }
  }, 60_000);

  it.skip('重算 lineupScale（手動跑）', () => {
    const out: Record<string, number> = {};
    for (const s of STAGES) {
      const key = STAGE_LINEUPS[s.id];
      if (out[key] !== undefined) continue;
      let lo = 0.5;
      let hi = 2.5;
      for (let k = 0; k < 9; k++) {
        const mid = (lo + hi) / 2;
        if (stageRate(s, 200, 1, mid) > 0.6) lo = mid;
        else hi = mid;
      }
      out[key] = Math.round(((lo + hi) / 2) * 100) / 100;
    }
    console.info(
      Object.entries(out)
        .map(([k, v]) => `  '${k}': ${v},`)
        .join('\n'),
    );
  }, 900_000);
});
