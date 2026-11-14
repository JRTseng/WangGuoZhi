import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { createInitialState } from '../state/gameState';
import { battleDogPower, resolveBattle, type BattleDog, type RowIndex } from './battle';
import { battleTeamOf } from './expedition';
import { initialProgress } from './leveling';

/**
 * 數值驗收（T023）：用真的狗狗資料大量模擬。
 * 把隊伍的攻防等比例調到「戰力剛好等於建議戰力」，看勝率落在哪裡。
 */
const state = createInitialState(0);
for (const d of DOGS) state.dogs[d.id] = initialProgress(d);

const POWER = 600;
const N = 300;

/** 照定位排好（自動編隊的站位）、戰力調到 power 的隊伍；rows 有給就故意改站位 */
function teamAt(ids: string[], power: number, rows?: RowIndex[]): BattleDog[] {
  const team = battleTeamOf(state, ids).map((d, i) => (rows ? { ...d, row: rows[i] } : d));
  const now = team.reduce((s, d) => s + battleDogPower(d), 0);
  return team.map((d) => ({
    ...d,
    attack: (d.attack * power) / now,
    defense: (d.defense * power) / now,
  }));
}

function winRate(team: BattleDog[], boss = false, recommendedPower = POWER): number {
  let wins = 0;
  for (let i = 0; i < N; i++) {
    const r = resolveBattle({
      team,
      recommendedPower,
      enemyNames: boss ? ['頭目'] : ['野犬甲', '野犬乙', '野犬丙'],
      boss,
      seed: i * 7919 + 13,
    });
    if (r.win) wins++;
  }
  return wins / N;
}

/** 幾支常見的五隻隊伍：新手五隻、各定位一隻、偏突擊、偏謀略 */
const TEAMS: Record<string, string[]> = {
  新手五隻: ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'],
  各定位一隻: ['tieya', 'jiying', 'shanlan', 'xueling', 'douding'],
  偏突擊: ['heixuan', 'modian', 'jiying', 'changgong', 'tieya'],
  偏謀略: ['xiaosuan', 'shuangyan', 'zhuifeng', 'xueling', 'changxu'],
};

describe('戰鬥數值（大量模擬）', () => {
  it('戰力等於建議戰力、照定位排好：打野犬的平均勝率在 55%～65% 之間', () => {
    const rates = Object.values(TEAMS).map((ids) => winRate(teamAt(ids, POWER)));
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    expect(avg).toBeGreaterThanOrEqual(0.55);
    expect(avg).toBeLessThanOrEqual(0.65);
    // 隊伍組成不同會有高有低（有 SSR 的放招快，比較強），但沒有哪一支穩贏或穩輸
    for (const r of rates) {
      expect(r).toBeGreaterThan(0.25);
      expect(r).toBeLessThan(0.9);
    }
  });

  it('戰力多一成幾乎都贏、少兩成幾乎都輸', () => {
    for (const ids of Object.values(TEAMS)) {
      expect(winRate(teamAt(ids, POWER * 1.25))).toBeGreaterThan(0.95);
      expect(winRate(teamAt(ids, POWER * 0.8))).toBeLessThan(0.1);
    }
  });

  it('Boss 關：戰力等於建議戰力時，均衡的隊伍勝率也在五到八成', () => {
    for (const name of ['新手五隻', '各定位一隻']) {
      const r = winRate(teamAt(TEAMS[name], POWER), true);
      expect(r).toBeGreaterThan(0.5);
      expect(r).toBeLessThan(0.85);
    }
  });

  it('同一隊故意排錯（守護放後排、後衛放前排）勝率明顯比照定位排低', () => {
    // 各定位一隻：鐵牙（守護）、疾影（突擊）、山嵐（補給）丟到後排，雪綾（謀略）、豆丁（幸運）頂前排
    const ids = TEAMS['各定位一隻'];
    const good = winRate(teamAt(ids, POWER));
    const bad = winRate(teamAt(ids, POWER, [2, 2, 2, 0, 0]));
    expect(good - bad).toBeGreaterThan(0.12);
    // 帶三隻 SSR 的隊伍（熊嶽、雪綾、暖桶）：SSR 出手一次就能放大絕招（2026-11-14），
    // 同戰力下很強，排錯也多半會贏；至少排錯不會比較好
    const healer = ['xiongyue', 'heixuan', 'daer', 'xueling', 'nuantong'];
    const ok = winRate(teamAt(healer, POWER));
    const wrong = winRate(teamAt(healer, POWER, [2, 0, 1, 2, 0]));
    expect(ok).toBeGreaterThanOrEqual(wrong);
    // 打 Boss 也一樣
    expect(
      winRate(teamAt(ids, POWER), true) - winRate(teamAt(ids, POWER, [2, 2, 2, 0, 0]), true),
    ).toBeGreaterThan(0.25);
  });

  it('新手隊伍的實際戰力：第 1 關穩贏；只派阿白一隻穩輸', () => {
    const starters = battleTeamOf(state, ['daer', 'heixuan', 'changxu']);
    expect(winRate(starters, false, 150)).toBe(1);
    expect(winRate(battleTeamOf(state, ['abai']), false, 150)).toBeLessThan(0.02);
  });
});
