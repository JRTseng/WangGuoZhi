import { describe, expect, it } from 'vitest';
import { createBattle, resolveBattle, EN_MAX, hpOf, type BattleDog } from './battle';
import { battleDogOf, resultNotes } from './expedition';
import {
  SKILL_COUNT,
  learnedSkills,
  levelSkillsOf,
  newSkills,
  nextSkill,
  perkText,
  perksOf,
  sumPerks,
} from './levelSkills';
import { createInitialState } from '../state/gameState';

const ROLES = ['突擊', '守護', '謀略', '幸運', '補給', '補血'] as const;

describe('成長技能：每 10 級學一個', () => {
  it('六種定位各有 10 個，Lv.10、20、…、100 各一個，名字不重複、都有效果', () => {
    for (const role of ROLES) {
      const list = levelSkillsOf(role);
      expect(list).toHaveLength(SKILL_COUNT);
      expect(list.map((s) => s.level)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
      expect(new Set(list.map((s) => s.name)).size).toBe(SKILL_COUNT);
      for (const s of list) expect(perkText(s.perks)).not.toBe('');
    }
    expect(levelSkillsOf('野犬')).toEqual([]);
    expect(levelSkillsOf(undefined)).toEqual([]);
  });

  it('照等級算學會幾個、剛升級學到哪些、下一個是哪個', () => {
    expect(learnedSkills('突擊', 9)).toHaveLength(0);
    expect(learnedSkills('突擊', 10)).toHaveLength(1);
    expect(learnedSkills('突擊', 59)).toHaveLength(5);
    expect(learnedSkills('突擊', 100)).toHaveLength(10);
    expect(newSkills('守護', 9, 10).map((s) => s.name)).toEqual(['厚皮']);
    expect(newSkills('守護', 10, 19)).toEqual([]);
    expect(newSkills('守護', 8, 31)).toHaveLength(3);
    expect(nextSkill('守護', 10)?.level).toBe(20);
    expect(nextSkill('守護', 100)).toBeUndefined();
  });

  it('效果加總與說明文字', () => {
    expect(perksOf('突擊', 9)).toBeUndefined();
    expect(perksOf('突擊', 20)).toEqual({ atk: 0.05, opening: 0.15 });
    expect(sumPerks([{ atk: 0.05 }, { atk: 0.06, crit: 0.08 }])).toEqual({ atk: 0.11, crit: 0.08 });
    expect(perkText({ atk: 0.08, crit: 0.05 })).toBe('傷害 +8%、爆擊機率 +5%');
    expect(perkText({ startEn: 20 })).toBe('開場 EN +20');
  });
});

const dog = (over: Partial<BattleDog> = {}): BattleDog => ({
  id: 'a',
  name: '甲',
  attack: 60,
  defense: 60,
  level: 1,
  hasSkill: true,
  role: '守護',
  ...over,
});

describe('成長技能在戰鬥裡的效果', () => {
  it('血量與開場 EN', () => {
    const s = createBattle({
      team: [dog({ perks: { hp: 0.1, startEn: 20 } })],
      recommendedPower: 100,
      seed: 1,
    });
    expect(s.team[0].maxHp).toBe(Math.round(hpOf(60) * 1.1));
    expect(s.en.team[0]).toBe(20);
    const full = createBattle({
      team: [dog({ perks: { startEn: 500 } })],
      recommendedPower: 100,
      seed: 1,
    });
    expect(full.en.team[0]).toBe(EN_MAX);
  });

  it('沒有技能的隊伍，結果和以前一模一樣（不多抽亂數）', () => {
    const input = { team: [dog(), dog({ id: 'b', role: '幸運' })], recommendedPower: 240, seed: 9 };
    const a = resolveBattle(input);
    const b = resolveBattle({ ...input, team: input.team.map((d) => ({ ...d, perks: {} })) });
    expect(b.actions).toEqual(a.actions);
  });

  it('傷害加成打得比較痛、減傷撐得比較久', () => {
    const sum = (perks: BattleDog['perks']): { dealt: number; taken: number } => {
      let dealt = 0;
      let taken = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const r = resolveBattle({
          team: [dog({ perks, hasSkill: false })],
          recommendedPower: 400,
          seed,
        });
        const first = r.actions.filter((x) => x.round === 1);
        dealt += first
          .filter((x) => x.side === 'team')
          .reduce((n, x) => n + x.hits.reduce((m, h) => m + h.damage, 0), 0);
        taken += first
          .filter((x) => x.side === 'enemy')
          .reduce((n, x) => n + x.hits.reduce((m, h) => m + h.damage, 0), 0);
      }
      return { dealt, taken };
    };
    const base = sum(undefined);
    expect(sum({ atk: 0.2 }).dealt).toBeGreaterThan(base.dealt * 1.1);
    expect(sum({ opening: 0.2 }).dealt).toBeGreaterThan(base.dealt * 1.1);
    expect(sum({ guard: 0.2 }).taken).toBeLessThan(base.taken * 0.9);
  });

  it('攻擊後回血、爆擊、閃避、補血量都會出現', () => {
    const run = (perks: BattleDog['perks'], role: BattleDog['role'] = '守護') =>
      Array.from({ length: 30 }, (_, i) =>
        resolveBattle({
          team: [dog({ perks, role }), dog({ id: 'b', name: '乙', perks, role })],
          recommendedPower: 260,
          seed: i + 1,
        }),
      ).flatMap((r) => r.actions);
    const steal = run({ steal: 0.5 });
    expect(
      steal.some((a) => a.side === 'team' && a.hits.some((h) => h.heal && h.target === a.actor)),
    ).toBe(true);
    const teamHits = (list: typeof steal) =>
      list.filter((a) => a.side === 'team').flatMap((a) => a.hits);
    const foeHits = (list: typeof steal) =>
      list.filter((a) => a.side === 'enemy').flatMap((a) => a.hits);
    expect(teamHits(run(undefined)).some((h) => h.crit)).toBe(false);
    expect(teamHits(run({ crit: 0.5 })).some((h) => h.crit)).toBe(true);
    expect(foeHits(run(undefined)).some((h) => h.dodged)).toBe(false);
    expect(foeHits(run({ dodge: 0.5 })).some((h) => h.dodged)).toBe(true);
    const heals = (list: typeof steal) =>
      Math.max(0, ...teamHits(list).map((h) => (h.side === 'team' ? (h.heal ?? 0) : 0)));
    expect(heals(run({ heal: 1 }, '補血'))).toBeGreaterThan(heals(run(undefined, '補血')));
  });
});

describe('接到狗狗資料與結算', () => {
  it('10 級以上的狗出征時帶著技能效果，9 級以下沒有', () => {
    const st = createInitialState();
    const id = st.owned[0];
    expect(battleDogOf(st, id)?.perks).toBeUndefined();
    const up = { ...st, dogs: { ...st.dogs, [id]: { ...st.dogs[id], level: 20 } } };
    const perks = battleDogOf(up, id)?.perks;
    expect(perks && Object.keys(perks).length).toBeGreaterThan(0);
  });

  it('升過 10 級門檻，結算會說學會哪個技能', () => {
    const st = createInitialState();
    const id = st.owned[0];
    const zero = { fixed: 0, bonus: 0 };
    const notes = resultNotes(st, st, {
      stageId: 'luoyepo-1',
      team: [],
      seed: 1,
      win: true,
      reward: {},
      gains: [{ dogId: id, exp: 10, fromLevel: 9, toLevel: 10, attack: zero, defense: zero }],
    } as never);
    expect(notes.join()).toContain('學會技能「');
  });
});
