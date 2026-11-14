import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { DEFAULT_SKILL_LINES } from '../data/skillLines';
import { createInitialState } from '../state/gameState';
import {
  BUFF_ROUNDS,
  EN_MAX,
  HEAL_RATE,
  LUCKY_ULT_HITS,
  RESCUE_ULT_RATE,
  REVIVE_RATE,
  ROW_HEAL_RATE,
  SMALL_HEAL_RATE,
  autoUlt,
  battleTeamPower,
  createBattle,
  nextActor,
  resolveBattle,
  stepBattle,
  type BattleDog,
  type BattleInput,
  type BattleRole,
  type BattleState,
} from './battle';
import { battleDogOf } from './expedition';
import { initialProgress } from './leveling';
import { SKILL_LINE_MAX } from './skillShow';

/** 專屬特性（T024）：新狗各自的打法 */

const dog = (id: string, role: BattleRole = '守護', o: Partial<BattleDog> = {}): BattleDog => ({
  id,
  name: id,
  attack: 50,
  defense: 50,
  level: 1,
  hasSkill: true,
  role,
  ...o,
});
const TANK = { defense: 9000 };
const MOBS = ['野犬甲', '野犬乙', '野犬丙'];
const input = (team: BattleDog[], o: Partial<BattleInput> = {}): BattleInput => ({
  team,
  recommendedPower: battleTeamPower(team),
  enemyNames: MOBS,
  seed: 1,
  ...o,
});

function until(state: BattleState, side: 'team' | 'enemy', index: number): BattleState {
  let s = state;
  for (let i = 0; i < 200 && !s.over; i++) {
    const a = nextActor(s)!;
    if (a.side === side && a.index === index) return s;
    s = stepBattle(s, false).state;
  }
  throw new Error('輪不到這一隻');
}

/** 敵方三排各站一隻、打不死 */
function threeRows(s: BattleState): BattleState {
  s.enemies = s.enemies.map((u, i) => ({ ...u, row: i as 0 | 1 | 2, maxHp: 99999 }));
  s.hp.enemy = s.enemies.map(() => 99999);
  return s;
}

describe('資料', () => {
  it('T024 的 11 隻都有專屬特性與預設台詞，戰鬥資料會帶上特性', () => {
    const state = createInitialState(0);
    for (const d of DOGS) state.dogs[d.id] = initialProgress(d);
    const added = DOGS.filter((d) => d.trait);
    expect(added).toHaveLength(11);
    expect(new Set(added.map((d) => d.trait)).size).toBe(11);
    for (const d of added) {
      expect(battleDogOf(state, d.id)!.trait, d.name).toBe(d.trait);
    }
    for (const d of DOGS) {
      const line = DEFAULT_SKILL_LINES[d.id];
      expect(line, d.name).toBeTruthy();
      expect(Array.from(line).length, d.name).toBeLessThanOrEqual(SKILL_LINE_MAX);
    }
  });
});

describe('突擊・流星（pierce3）', () => {
  it('一般攻擊就穿透三排，一般突擊只穿兩排', () => {
    const rows = (trait?: BattleDog['trait']): number[] => {
      const s = threeRows(createBattle(input([dog('a', '突擊', { ...TANK, trait })])));
      return stepBattle(s, false).action.hits.map((h) => s.enemies[h.target].row);
    };
    expect(rows('pierce3')).toEqual([0, 1, 2]);
    expect(rows()).toEqual([0, 1]);
  });
});

describe('補給・松嶺（command）', () => {
  it('大絕招是號令：鼓舞多一回合，期間全隊受傷減少', () => {
    const make = (trait?: BattleDog['trait']): BattleState => {
      const s = createBattle(input([dog('a', '補給', { ...TANK, trait })]));
      s.en.team[0] = EN_MAX;
      return s;
    };
    const r = stepBattle(make('command'), true);
    expect(r.action).toMatchObject({ ult: true, kind: 'buff', buff: 'command' });
    expect(r.state.inspire.team).toBe(1 + BUFF_ROUNDS + 1);
    expect(r.state.rally.team).toBe(1 + BUFF_ROUNDS + 1);
    const plain = stepBattle(make(), true);
    expect(plain.action.buff).toBe('inspire');
    expect(plain.state.rally.team).toBe(0);
    // 同一個種子，敵人下一下打得比較不痛
    const hurt = (s: BattleState): number => stepBattle(s, false).action.hits[0].damage;
    expect(hurt(r.state)).toBeLessThan(hurt(plain.state));
  });
});

describe('幸運・福球、金鈴、彩翼', () => {
  const count = (trait: BattleDog['trait'] | undefined, f: (a: BattleState) => number): number => {
    let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      n += f(threeRows(createBattle(input([dog('a', '幸運', { ...TANK, trait })], { seed }))));
    }
    return n;
  };

  it('福球：爆擊機率加倍，爆擊時再多打一下（多打的不會再連）', () => {
    const crits = (s: BattleState): number => (stepBattle(s, false).action.hits[0].crit ? 1 : 0);
    expect(count('fortune', crits)).toBeGreaterThan(count(undefined, crits) * 1.5);
    for (let seed = 1; seed <= 100; seed++) {
      const s = threeRows(
        createBattle(input([dog('a', '幸運', { ...TANK, trait: 'fortune' })], { seed })),
      );
      const hits = stepBattle(s, false).action.hits;
      expect(hits).toHaveLength(hits[0].crit ? 2 : 1);
      s.en.team[0] = EN_MAX;
      const ult = stepBattle(s, true).action.hits;
      expect(ult.length).toBeGreaterThanOrEqual(LUCKY_ULT_HITS);
      expect(ult.length).toBeLessThanOrEqual(LUCKY_ULT_HITS * 2);
    }
  });

  it('金鈴：一般攻擊亂打兩次', () => {
    const s = threeRows(createBattle(input([dog('a', '幸運', { ...TANK, trait: 'double' })])));
    expect(stepBattle(s, false).action.hits).toHaveLength(2);
  });

  it('彩翼：比一般幸運狗更會閃', () => {
    const dodges = (trait?: BattleDog['trait']): number => {
      let n = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const s = until(
          createBattle(input([dog('a', '幸運', { ...TANK, trait })], { seed })),
          'enemy',
          0,
        );
        if (stepBattle(s, false).action.hits[0].dodged) n++;
      }
      return n;
    };
    expect(dodges('evasive')).toBeGreaterThan(dodges() * 1.5);
  });
});

describe('謀略・雙瞳（slow）', () => {
  it('大絕招打到的敵人慢一拍：到下一回合結束前傷害變少', () => {
    const run = (trait?: BattleDog['trait']) => {
      const s = createBattle(
        input([dog('a', '謀略', { ...TANK, trait })], { recommendedPower: 3000 }),
      );
      s.en.team[0] = EN_MAX;
      return stepBattle(s, true);
    };
    const slow = run('slow');
    const plain = run();
    expect(slow.action.hits.every((h) => h.slowed)).toBe(true);
    expect(plain.action.hits.some((h) => h.slowed)).toBe(false);
    const hit = slow.action.hits[0].target;
    expect(slow.state.weak.enemy[hit]).toBe(1 + BUFF_ROUNDS);
    // 被打到的那隻接著出手，傷害比沒被慢的少
    const dmg = (s: BattleState): number =>
      stepBattle(until(s, 'enemy', hit), false).action.hits[0].damage;
    expect(dmg(slow.state)).toBeLessThan(dmg(plain.state) * 0.85);
  });
});

describe('守護・石墩（shortTaunt）', () => {
  it('嘲諷只到這一回合結束', () => {
    const s = createBattle(input([dog('a', '守護', { ...TANK, trait: 'shortTaunt' })]));
    s.en.team[0] = EN_MAX;
    expect(stepBattle(s, true).state.taunt.team[0]).toBe(1);
  });
});

describe('補血・絨耳、麥穗、皺皺', () => {
  const setup = (trait: BattleDog['trait']): BattleState => {
    const team = [
      dog('a', '守護', { row: 0 }),
      dog('b', '突擊', { row: 0 }),
      dog('c', '補給', { row: 1 }),
      dog('h', '補血', { trait }),
    ];
    const s = until(createBattle(input(team)), 'team', 3);
    s.hp.team = [100, 150, 100, s.team[3].maxHp];
    return s;
  };

  it('絨耳：補血量最低的一隻，牠的攻擊提高到下一回合結束', () => {
    const s = setup('cheer');
    const r = stepBattle(s, false);
    expect(r.action.hits).toEqual([
      expect.objectContaining({ target: 0, heal: Math.round(300 * HEAL_RATE), cheer: true }),
    ]);
    expect(r.state.cheer.team[0]).toBe(s.round + BUFF_ROUNDS);
  });

  it('麥穗：同一排受傷的隊友一起補', () => {
    const r = stepBattle(setup('rowHeal'), false);
    expect(r.action.hits.map((h) => [h.target, h.heal])).toEqual([
      [0, Math.round(300 * ROW_HEAL_RATE)],
      [1, Math.round(300 * ROW_HEAL_RATE)],
    ]);
  });

  it('皺皺：補得比較少', () => {
    const r = stepBattle(setup('smallHeal'), false);
    expect(r.action.hits.map((h) => [h.target, h.heal])).toEqual([
      [0, Math.round(300 * SMALL_HEAL_RATE)],
    ]);
  });
});

describe('補血・海晏（rescue）', () => {
  const team = (): BattleDog[] => [
    dog('a', '守護'),
    dog('b', '突擊'),
    dog('h', '補血', { trait: 'rescue', ssr: true, rarity: 'SSR' }),
  ];

  it('一般出手不補血：攻擊，再給血量比例最低、還沒有護盾的隊友一層護盾', () => {
    const s = until(createBattle(input(team())), 'team', 2);
    s.hp.team = [100, 200, s.team[2].maxHp];
    s.shield.team = [0, 0, 0];
    const r = stepBattle(s, false);
    expect(r.action.kind).toBe('attack');
    expect(r.action.hits).toHaveLength(2);
    expect(r.action.hits[0].side).toBe('enemy');
    expect(r.action.hits[1]).toMatchObject({ side: 'team', target: 0, shield: true, heal: 0 });
    expect(r.state.hp.team[0]).toBe(100);
    expect(r.state.shield.team).toEqual([1, 0, 0]);
    // 下一次給第二低的
    const t = until(r.state, 'team', 2);
    t.hp.team = [100, 200, t.team[2].maxHp];
    t.shield.team = [1, 0, 0];
    expect(stepBattle(t, false).action.hits[1]).toMatchObject({ target: 1, shield: true });
  });

  it('護盾擋掉下一次傷害的三成，擋一次就沒了', () => {
    const hit = (shield: number) => {
      const s = until(createBattle(input([dog('a', '守護', TANK)])), 'enemy', 0);
      s.shield.team[0] = shield;
      return stepBattle(s, false);
    };
    const a = hit(1);
    const b = hit(0);
    expect(a.action.hits[0].shielded).toBe(true);
    expect(b.action.hits[0].shielded).toBeUndefined();
    const ratio = a.action.hits[0].damage / b.action.hits[0].damage;
    expect(ratio).toBeGreaterThan(0.68);
    expect(ratio).toBeLessThan(0.72);
    expect(a.state.shield.team[0]).toBe(0);
  });

  it('大絕招：全隊回血 15%，救起一隻倒下的隊友（30% 血），一場只救一次', () => {
    const s = until(createBattle(input(team())), 'team', 2);
    s.hp.team = [0, 100, s.team[2].maxHp];
    s.en.team[2] = EN_MAX;
    expect(autoUlt(s)).toBe(true);
    const r = stepBattle(s, true);
    expect(r.action).toMatchObject({ ult: true, kind: 'heal' });
    expect(r.action.hits).toEqual([
      expect.objectContaining({ target: 1, heal: Math.round(300 * RESCUE_ULT_RATE) }),
      expect.objectContaining({
        target: 0,
        heal: Math.round(300 * REVIVE_RATE),
        targetHp: Math.round(300 * REVIVE_RATE),
        revive: true,
      }),
    ]);
    expect(r.state.revived.team).toBe(1);
    // 救起來的隊友之後照常出手
    expect(until(r.state, 'team', 0).hp.team[0]).toBeGreaterThan(0);
    // 第二次不再救
    const t = until(r.state, 'team', 2);
    t.hp.team = [0, 300, t.team[2].maxHp];
    t.en.team[2] = EN_MAX;
    expect(autoUlt(t)).toBe(false);
    expect(stepBattle(t, true).action.hits.some((h) => h.revive)).toBe(false);
  });

  it('被動：全隊受到整排攻擊（頭目大絕招）的傷害減少一成', () => {
    const dmg = (trait?: BattleDog['trait']): number => {
      const t = [dog('a', '守護', TANK), dog('h', '補血', { ...TANK, trait, afterHeal: !trait })];
      const s = until(createBattle(input(t, { boss: true, enemyNames: ['頭目'] })), 'enemy', 0);
      s.en.enemy[0] = EN_MAX;
      s.shield.team = [0, 0];
      const a = stepBattle(s, true).action;
      expect(a.ult).toBe(true);
      return a.hits[0].damage;
    };
    const ratio = dmg('rescue') / dmg();
    expect(ratio).toBeGreaterThan(0.88);
    expect(ratio).toBeLessThan(0.92);
  });

  it('同種子重播結果相同（含護盾與救援）', () => {
    const i = input(team(), { recommendedPower: 400, seed: 99 });
    expect(resolveBattle(i)).toEqual(resolveBattle(i));
  });
});
