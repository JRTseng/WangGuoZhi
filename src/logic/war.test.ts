import { describe, expect, it } from 'vitest';
import { TOWER_FLOORS } from '../data/tower';
import { createInitialState } from '../state/gameState';
import { chooseFaction } from './faction';
import { runExpedition } from './expedition';
import { deserialize, serialize } from './save';
import { weekKey } from './tower';
import {
  WAR_GAP,
  WAR_MILESTONES,
  WAR_POINTS,
  WAR_RESULT_REWARD,
  addWarPoints,
  claimWarMilestones,
  claimWarResult,
  sanitizeWar,
  warAt,
  warClaimable,
  warFinals,
  warReady,
  warResult,
  warScores,
  weekProgress,
} from './war';

// 2026-11-16（一）12:00 UTC，時區當 UTC 算
const T0 = Date.UTC(2026, 10, 16, 12);
const O = { tzOffsetMin: 0 };
const DAY = 86_400_000;
const fresh = () => chooseFaction(createInitialState(T0), 'dog');

describe('陣營積分戰（T030）', () => {
  it('加積分：記在這一週、自己的陣營', () => {
    const s = addWarPoints(fresh(), 10, T0, O);
    expect(s.war).toMatchObject({ week: weekKey(T0, O), faction: 'dog', points: 10 });
    expect(addWarPoints(s, 15, T0 + DAY, O).war.points).toBe(25);
  });

  it('出征打贏 +10、打輸 +2', () => {
    const win = runExpedition(fresh(), 'luoyepo-1', ['daer', 'heixuan', 'changxu'], T0, {
      seed: 1,
    });
    if (!win.ok) throw new Error('應該可以出征');
    expect(win.record.win).toBe(true);
    expect(win.record.warPoints).toBe(WAR_POINTS.win);
    expect(win.state.war.points).toBe(WAR_POINTS.win);
    expect(TOWER_FLOORS).toBe(100);
  });

  it('兩邊的總分：每週固定、差距不超過上限，隨時間變多，玩家的積分加在自己這邊', () => {
    for (const week of ['2026-11-16', '2026-11-23', '2027-01-04']) {
      const f = warFinals(week);
      expect(warFinals(week)).toEqual(f);
      expect(Math.abs(f.dog - f.cat)).toBeLessThanOrEqual(WAR_GAP);
    }
    expect(weekProgress(T0, O)).toBeCloseTo(7 / 168, 3);
    const s = fresh();
    const early = warScores(s, T0, O);
    const late = warScores(s, T0 + 3 * DAY, O);
    expect(late.dog).toBeGreaterThan(early.dog);
    expect(late.cat).toBeGreaterThan(early.cat);
    const mine = warScores(addWarPoints(s, 500, T0, O), T0, O);
    expect(mine.dog).toBe(early.dog + 500);
    expect(mine.cat).toBe(early.cat);
    // 賺超過差距上限，一定領先
    expect(warScores(addWarPoints(s, WAR_GAP + 1, T0, O), T0, O).leader).toBe('dog');
  });

  it('個人積分獎勵：到門檻才能領，一次全領，不能重複領', () => {
    let s = addWarPoints(fresh(), 160, T0, O);
    expect(warClaimable(s, T0, O)).toEqual([0, 1]);
    expect(warReady(s, T0, O)).toBe(true);
    const before = s.resources;
    const c = claimWarMilestones(s, T0, O);
    s = c.state;
    expect(c.reward).toEqual({
      food: WAR_MILESTONES[0].reward.food + WAR_MILESTONES[1].reward.food,
      bones: WAR_MILESTONES[0].reward.bones + WAR_MILESTONES[1].reward.bones,
    });
    expect(s.resources.food).toBe(before.food + c.reward!.food);
    expect(claimWarMilestones(s, T0, O).reward).toBeNull();
    expect(warReady(s, T0, O)).toBe(false);
  });

  it('換週：積分歸零、上週有參加就有結果可以領，贏的獎勵比較多', () => {
    const s = addWarPoints(fresh(), WAR_GAP + 1, T0, O);
    const next = T0 + 7 * DAY;
    expect(warAt(s, next, O)).toMatchObject({ points: 0, claimed: [] });
    const r = warResult(s, next, O)!;
    expect(r).toMatchObject({ faction: 'dog', points: WAR_GAP + 1, win: true });
    expect(r.reward).toEqual(WAR_RESULT_REWARD.win);
    const c = claimWarResult(s, next, O);
    expect(c.state.resources.bones).toBe(s.resources.bones + WAR_RESULT_REWARD.win.bones);
    expect(warResult(c.state, next, O)).toBeNull();
    expect(claimWarResult(c.state, next, O).reward).toBeNull();
    // 沒參加的那一週沒有結果
    expect(warResult(fresh(), next, O)).toBeNull();
  });

  it('週中換陣營：這週的個人積分歸零', () => {
    const s = addWarPoints(fresh(), 200, T0, O);
    const cat = chooseFaction({ ...s, gacha: { pulls: 1, sinceSSR: 1 } }, 'cat');
    expect(warAt(cat, T0, O)).toMatchObject({ faction: 'cat', points: 0 });
  });

  it('存檔讀得回來；壞掉的欄位回到預設', () => {
    const s = addWarPoints(fresh(), 60, T0, O);
    expect(deserialize(serialize(s, T0), T0).state.war).toEqual(s.war);
    expect(
      sanitizeWar({ week: 'x', points: -3, claimed: [0, 0, 9, 'a'], result: { week: 1 } }),
    ).toEqual({
      week: '',
      faction: '',
      points: 0,
      claimed: [0],
      result: null,
    });
  });
});
