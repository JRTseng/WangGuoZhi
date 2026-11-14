import { describe, expect, it } from 'vitest';
import {
  BUFF_ROUNDS,
  DEFEAT_REWARD_RATE,
  EN_MAX,
  EN_PER_ACT,
  EN_PER_HIT,
  enPerActOf,
  FIRST_STRIKE_RATE,
  GUARD_TAKEN,
  HEAL_RATE,
  HEAL_TARGETS,
  HEAL_ULT_RATE,
  HP_PER_DEF,
  LUCKY_ULT_HITS,
  MAX_ROUNDS,
  MELEE_BACK_RATE,
  PIERCE_RATE,
  REAR_FRONT_TAKEN,
  ROW_MAX,
  TAUNT_TAKEN,
  autoUlt,
  battleDurationMs,
  battlePaceFromSearch,
  battleSeedFromSearch,
  battleTeamPower,
  createBattle,
  createRng,
  defaultRowOf,
  finishBattle,
  frontRowOf,
  mixSeed,
  nextActor,
  nextBattleSpeed,
  resolveBattle,
  scaleReward,
  stepBattle,
  stepDelayMs,
  winChance,
  type BattleAction,
  type BattleDog,
  type BattleInput,
  type BattleRole,
  type BattleState,
  type RowIndex,
  BOSS_SCALE,
  MOB_SCALE,
  type BattleEnemy,
} from './battle';

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

/** 打不死的血量：測攻擊範圍時讓狗撐得夠久 */
const TANK = { defense: 9000 };

const MOBS = ['野犬甲', '野犬乙', '野犬丙'];
const input = (team: BattleDog[], o: Partial<BattleInput> = {}): BattleInput => ({
  team,
  recommendedPower: battleTeamPower(team),
  enemyNames: MOBS,
  seed: 1,
  ...o,
});

/** 一路推到輪到指定的那一隻（我方第 index 隻）；途中都不放大絕招 */
function until(state: BattleState, side: 'team' | 'enemy', index: number): BattleState {
  let s = state;
  for (let i = 0; i < 200 && !s.over; i++) {
    const a = nextActor(s)!;
    if (a.side === side && a.index === index) return s;
    s = stepBattle(s, false).state;
  }
  throw new Error('輪不到這一隻');
}

/** 傷害在「基準 × 倍率」的 ±10% 浮動範圍內（四捨五入留 1 的誤差） */
function expectDamage(damage: number, base: number, rate = 1): void {
  expect(damage).toBeGreaterThanOrEqual(Math.floor(base * rate * 0.9) - 1);
  expect(damage).toBeLessThanOrEqual(Math.ceil(base * rate * 1.1) + 1);
}

describe('亂數', () => {
  it('同種子同序列，不同種子不同', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect([c(), c(), c()]).not.toEqual(seqA);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('mixSeed 是 32 位元非負整數，輸入不同結果不同', () => {
    const s = mixSeed(1_800_000_000_000, 1);
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(2 ** 32);
    expect(mixSeed(1_800_000_000_000, 2)).not.toBe(s);
    expect(mixSeed(1_800_000_000_001, 1)).not.toBe(s);
  });
});

describe('開場', () => {
  it('血量 = 防禦 × HP_PER_DEF；站位照定位的預設，有指定就用指定的', () => {
    const s = createBattle(
      input([dog('a', '守護'), dog('b', '補給'), dog('c', '謀略'), dog('d', '突擊', { row: 2 })]),
    );
    expect(s.team.map((u) => u.maxHp)).toEqual([50, 50, 50, 50].map((d) => d * HP_PER_DEF));
    expect(s.team.map((u) => u.row)).toEqual([0, 1, 2, 2]);
    expect(s.hp.team).toEqual(s.team.map((u) => u.maxHp));
    expect(s.en.team).toEqual([0, 0, 0, 0]);
    expect((['守護', '突擊', '補給', '謀略', '幸運', '補血'] as const).map(defaultRowOf)).toEqual([
      0, 0, 1, 2, 2, 2,
    ]);
    expect(ROW_MAX).toBe(3);
  });

  it('野犬：前兩隻站前排、第三隻站中排，不會放大絕招；Boss 一隻站中排，會放', () => {
    const mobs = createBattle(input([dog('a')]));
    expect(mobs.enemies.map((u) => u.row)).toEqual([0, 0, 1]);
    expect(mobs.enemies.every((u) => u.role === '野犬' && !u.canUlt)).toBe(true);
    const boss = createBattle(input([dog('a')], { enemyNames: ['雷吼'], boss: true }));
    expect(boss.enemies).toHaveLength(1);
    expect(boss.enemies[0]).toMatchObject({ role: '頭目', row: 1, canUlt: true });
  });

  it('敵方由建議戰力推出：總血量與總攻擊不隨隻數改變（差在氣勢與強度倍率）', () => {
    const a = createBattle(input([dog('a')], { recommendedPower: 600 }));
    const total = a.enemies.reduce((n, u) => n + u.maxHp, 0);
    // 建議戰力攻防各半：總防禦 300 → 血量約 300 × HP_PER_DEF，再乘上氣勢（±12%）與倍率
    expect(total).toBeGreaterThan(300 * HP_PER_DEF * 0.85);
    expect(total).toBeLessThan(300 * HP_PER_DEF * 1.25);
    expect(a.enemies.reduce((n, u) => n + u.attack, 0)).toBe(300);
    expect(Math.abs(a.morale)).toBeLessThanOrEqual(0.12);
  });

  it('隊伍要 1 到 5 隻', () => {
    expect(() => createBattle(input([]))).toThrow();
    expect(() => createBattle(input(Array.from({ length: 6 }, (_, i) => dog(`d${i}`))))).toThrow();
  });
});

describe('關卡自己的敵人陣容（T018）', () => {
  const dog = { id: 'a', name: 'A', attack: 50, defense: 50, level: 1 };
  const input = (enemies: BattleEnemy[], scale?: number) => ({
    team: [dog],
    recommendedPower: 600,
    enemies,
    seed: 3,
    ...(scale ? { scale } : {}),
  });

  it('照陣容排：定位、站位、會不會放招都照給的；戰力照比重分', () => {
    const s = createBattle(
      input([
        { name: '盾', role: '守護', row: 0, weight: 1 },
        {
          name: '王',
          role: '頭目',
          row: 1,
          weight: 4,
          canUlt: true,
          look: { color: 1, accent: 2, big: true },
        },
        { name: '弓', role: '謀略', row: 2, weight: 1 },
      ]),
    );
    expect(s.enemies.map((u) => `${u.name}:${u.role}:${u.row}:${u.canUlt}`)).toEqual([
      '盾:守護:0:false',
      '王:頭目:1:true',
      '弓:謀略:2:false',
    ]);
    // 建議戰力 600 → 攻擊合計 300，照 1：4：1 分
    expect(s.enemies.map((u) => u.attack)).toEqual([50, 200, 50]);
    expect(s.enemies[1].maxHp / s.enemies[0].maxHp).toBeCloseTo(4, 1);
    expect(s.enemies[1].look?.big).toBe(true);
    expect(s.hp.enemy).toEqual(s.enemies.map((u) => u.maxHp));
  });

  it('強度倍率：有給就用給的，沒給照有沒有頭目', () => {
    const mob: BattleEnemy[] = [{ name: '卒', role: '野犬', row: 0 }];
    const boss: BattleEnemy[] = [{ name: '王', role: '頭目', row: 1, canUlt: true }];
    const might = (list: BattleEnemy[], scale?: number) => {
      const s = createBattle(input(list, scale));
      return s.enemies[0].might / (1 + s.morale);
    };
    expect(might(mob)).toBeCloseTo(MOB_SCALE);
    expect(might(boss)).toBeCloseTo(BOSS_SCALE);
    expect(might(mob, 1.5)).toBeCloseTo(1.5);
  });

  it('頭目站在小兵後面一樣打得到（傷害不打折）；敵方的先鋒在後面還是會打折', () => {
    const hitOf = (role: '頭目' | '突擊') => {
      // 前排一隻不會動手的靶子擋著，後面那隻出手
      let s = createBattle({
        team: [{ ...dog, defense: 5000 }],
        recommendedPower: 600,
        enemies: [
          { name: '前', role: '野犬', row: 0, weight: 1 },
          { name: '後', role, row: 1, weight: 1 },
        ],
        scale: 1,
        seed: 11,
      });
      const damages: number[] = [];
      while (!s.over && damages.length < 40) {
        const r = stepBattle(s, false);
        if (r.action.side === 'enemy' && r.action.actor === 1) {
          damages.push(r.action.hits[0].damage / s.enemies[1].might);
        }
        s = r.state;
        if (s.round > 20) break;
      }
      return damages.reduce((a, b) => a + b, 0) / damages.length;
    };
    const boss = hitOf('頭目');
    const raider = hitOf('突擊');
    expect(boss).toBeGreaterThan(150 * 0.85);
    // 先鋒第一下有加成，平均下來還是明顯比頭目低（打折 50%）
    expect(raider).toBeLessThan(boss * 0.7);
  });

  it('敵方的藥師會幫受傷的同伴回血', () => {
    const r = resolveBattle({
      team: [{ ...dog, attack: 120, defense: 400 }],
      recommendedPower: 600,
      enemies: [
        { name: '卒', role: '野犬', row: 0, weight: 2 },
        { name: '藥', role: '補血', row: 2, weight: 1, trait: 'smallHeal' },
      ],
      scale: 1,
      seed: 5,
    });
    expect(
      r.actions.some((a) => a.side === 'enemy' && a.kind === 'heal' && (a.hits[0].heal ?? 0) > 0),
    ).toBe(true);
  });
});

describe('一般攻擊只打得到最前面還有狗的那一排', () => {
  it('前排還有狗的時候，野犬不會打到中排、後排；前排全倒才輪到中排', () => {
    const team = [
      dog('f1', '守護', { hasSkill: false }),
      dog('f2', '守護', { hasSkill: false }),
      dog('m', '補給', { hasSkill: false }),
      dog('b', '補血', { hasSkill: false, attack: 10 }),
    ];
    let hitMid = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = createBattle(input(team, { seed, recommendedPower: 500 }));
      while (!s.over) {
        const front = frontRowOf(s, 'team');
        const r = stepBattle(s, false);
        if (r.action.side === 'enemy') {
          for (const h of r.action.hits) {
            expect(s.team[h.target].row).toBe(front);
            if (s.team[h.target].row > 0) hitMid++;
          }
        }
        s = r.state;
      }
    }
    // 打得夠久，前排倒了之後中後排也會被打到
    expect(hitMid).toBeGreaterThan(0);
  });

  it('守護、補給打最前排的一隻', () => {
    for (const role of ['守護', '補給'] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        const s = createBattle(input([dog('a', role)], { seed }));
        const { action } = stepBattle(s, false);
        expect(action.hits).toHaveLength(1);
        expect(s.enemies[action.hits[0].target].row).toBe(0);
        expectDamage(action.hits[0].damage, 50);
      }
    }
  });
});

describe('各定位的攻擊範圍', () => {
  it('突擊：穿透 1×2，最前排一隻，再穿到後面一排一隻（60% 傷害）；第一次出手 +30%', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createBattle(input([dog('a', '突擊', TANK)], { seed, recommendedPower: 3000 }));
      const first = stepBattle(s, false);
      expect(first.action.kind).toBe('attack');
      expect(first.action.hits).toHaveLength(2);
      expect(first.action.hits.map((h) => s.enemies[h.target].row)).toEqual([0, 1]);
      expectDamage(first.action.hits[0].damage, 50, FIRST_STRIKE_RATE);
      expectDamage(first.action.hits[1].damage, 50, FIRST_STRIKE_RATE * PIERCE_RATE);
      // 第二次出手沒有 +30%
      const again = stepBattle(until(first.state, 'team', 0), false).action;
      expectDamage(again.hits[0].damage, 50);
      expectDamage(again.hits[1].damage, 50, PIERCE_RATE);
    }
  });

  it('突擊大絕招：穿透 1×3，前中後每一排各打一隻', () => {
    const team = [dog('a', '突擊', TANK)];
    const s = createBattle(input(team, { recommendedPower: 3000 }));
    // 把第二隻野犬挪到後排，三排都有敵人
    s.enemies[1] = { ...s.enemies[1], row: 2 };
    s.en.team[0] = EN_MAX;
    const { action, state } = stepBattle(s, true);
    expect(action).toMatchObject({ ult: true, kind: 'pierce' });
    expect(action.hits.map((h) => s.enemies[h.target].row)).toEqual([0, 1, 2]);
    expect(state.en.team[0]).toBe(0);
  });

  it('謀略：越排，鎖定中後排血量最少的一隻；後面沒人才打前排', () => {
    const s = createBattle(input([dog('a', '謀略', TANK)], { recommendedPower: 3000 }));
    s.enemies[1] = { ...s.enemies[1], row: 2 };
    s.hp.enemy[1] = s.hp.enemy[2] - 50;
    const { action, state } = stepBattle(s, false);
    expect(action.hits).toHaveLength(1);
    expect(action.hits[0].target).toBe(1);
    // 中後排都倒了：只剩前排可以打
    const t = until(state, 'team', 0);
    t.hp.enemy[1] = 0;
    t.hp.enemy[2] = 0;
    expect(stepBattle(t, false).action.hits[0].target).toBe(0);
  });

  it('謀略大絕招：打敵方狗最多的那一排整排；SSR 一次打兩排', () => {
    const s = createBattle(input([dog('a', '謀略', TANK)], { recommendedPower: 3000 }));
    s.en.team[0] = EN_MAX;
    const { action } = stepBattle(s, true);
    expect(action).toMatchObject({ ult: true, kind: 'row' });
    expect(action.hits.map((h) => h.target).sort()).toEqual([0, 1]);

    const ssr = createBattle(
      input([dog('a', '謀略', { ssr: true, ...TANK })], { recommendedPower: 3000 }),
    );
    ssr.en.team[0] = EN_MAX;
    expect(
      stepBattle(ssr, true)
        .action.hits.map((h) => h.target)
        .sort(),
    ).toEqual([0, 1, 2]);
  });

  it('幸運：不分排亂打，會爆擊；大絕招連打 3 次；被打時有機會閃過', () => {
    const rows = new Set<number>();
    let crits = 0;
    let dodges = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = createBattle(input([dog('a', '幸運', TANK)], { seed, recommendedPower: 3000 }));
      const { action, state } = stepBattle(s, false);
      expect(action.hits).toHaveLength(1);
      rows.add(s.enemies[action.hits[0].target].row);
      if (action.hits[0].crit) crits++;
      const hit = stepBattle(state, false).action.hits[0];
      if (hit.dodged) {
        dodges++;
        expect(hit.damage).toBe(0);
      }
    }
    expect([...rows].sort()).toEqual([0, 1]);
    expect(crits).toBeGreaterThan(25);
    expect(crits).toBeLessThan(80);
    expect(dodges).toBeGreaterThan(10);
    expect(dodges).toBeLessThan(60);

    const s = createBattle(input([dog('a', '幸運', TANK)], { recommendedPower: 3000 }));
    s.en.team[0] = EN_MAX;
    const { action } = stepBattle(s, true);
    expect(action).toMatchObject({ ult: true, kind: 'single' });
    expect(action.hits).toHaveLength(LUCKY_ULT_HITS);
  });

  it('補血：有隊友血量低於六成就補他 25%，沒有才打最前排；大絕招全隊回血 20%', () => {
    const team = [dog('tank', '守護'), dog('heal', '補血')];
    const s = until(createBattle(input(team)), 'team', 1);
    s.hp.team[0] = s.team[0].maxHp;
    s.hp.team[1] = s.team[1].maxHp;
    expect(stepBattle(s, false).action.kind).toBe('attack');
    s.hp.team[0] = Math.floor(s.team[0].maxHp * 0.5);
    const r = stepBattle(s, false);
    expect(r.action.kind).toBe('heal');
    expect(r.action.hits).toEqual([
      {
        side: 'team',
        target: 0,
        damage: 0,
        heal: Math.round(s.team[0].maxHp * HEAL_RATE),
        targetHp: s.hp.team[0] + Math.round(s.team[0].maxHp * HEAL_RATE),
        defeated: false,
      },
    ]);
    s.hp.team[1] = 10;
    s.en.team[1] = EN_MAX;
    const ult = stepBattle(s, true).action;
    expect(ult).toMatchObject({ ult: true, kind: 'heal' });
    expect(ult.hits.map((h) => h.heal)).toEqual([
      Math.round(s.team[0].maxHp * HEAL_ULT_RATE),
      Math.round(s.team[1].maxHp * HEAL_ULT_RATE),
    ]);
  });

  it('暖桶（攻擊後補血）：先攻擊，再補血量比例最低的兩位，各 25% 且不超過上限', () => {
    const team = [
      dog('a', '守護'),
      dog('b', '突擊'),
      dog('c', '補給'),
      dog('n', '補血', { afterHeal: true }),
    ];
    const s = until(createBattle(input(team)), 'team', 3);
    s.hp.team = [100, 290, 150, s.team[3].maxHp];
    const { action, state } = stepBattle(s, false);
    expect(action.kind).toBe('attack');
    const attacks = action.hits.filter((h) => h.heal === undefined);
    const heals = action.hits.filter((h) => h.heal !== undefined);
    expect(attacks).toHaveLength(1);
    expect(attacks[0].side).toBe('enemy');
    expect(heals).toHaveLength(HEAL_TARGETS);
    expect(heals.map((h) => h.target)).toEqual([0, 2]);
    expect(heals.map((h) => h.heal)).toEqual([75, 75]);
    expect(state.hp.team.slice(0, 3)).toEqual([175, 290, 225]);
    // 快滿的只補到滿
    const t = until(state, 'team', 3);
    t.hp.team = [300, 290, 300, t.team[3].maxHp];
    const top = stepBattle(t, false).action.hits.filter((h) => h.heal !== undefined);
    expect(top).toHaveLength(1);
    expect(top[0]).toMatchObject({ target: 1, heal: 10, targetHp: 300 });
  });

  it('守護大絕招：嘲諷，敵方一般攻擊都打牠、牠受傷 -30%，持續到下一回合結束', () => {
    const team = [dog('g', '守護', { row: 2 }), dog('x', '突擊', { hasSkill: false })];
    const s = createBattle(input(team, { recommendedPower: 400 }));
    s.en.team[0] = EN_MAX;
    const r = stepBattle(s, true);
    expect(r.action).toMatchObject({ ult: true, kind: 'buff', buff: 'taunt' });
    // 嘲諷完接著照常攻擊
    expect(r.action.hits.length).toBeGreaterThan(0);
    expect(r.state.taunt.team[0]).toBe(1 + BUFF_ROUNDS);
    let t = r.state;
    const taken: number[] = [];
    while (!t.over && t.round <= 1 + BUFF_ROUNDS) {
      const step = stepBattle(t, false);
      if (step.action.side === 'enemy') {
        // 牠站後排、前排還有突擊，照理打不到；嘲諷中每一下都打牠
        expect(step.action.hits.map((h) => h.target)).toEqual([0]);
        taken.push(step.action.hits[0].damage);
      }
      t = step.state;
    }
    expect(taken.length).toBeGreaterThanOrEqual(3);
    // 嘲諷過了：回去打最前排
    while (!t.over && nextActor(t)!.side !== 'enemy') t = stepBattle(t, false).state;
    if (!t.over && t.hp.team[1] > 0) expect(stepBattle(t, false).action.hits[0].target).toBe(1);
    expect(TAUNT_TAKEN).toBe(0.7);
    expect(GUARD_TAKEN).toBe(0.85);
  });

  it('補給大絕招：鼓舞，全隊攻擊 +15% 到下一回合結束', () => {
    const team = [dog('s', '補給', TANK), dog('x', '守護', { hasSkill: false, ...TANK })];
    const s = createBattle(input(team, { recommendedPower: 3000 }));
    s.en.team[0] = EN_MAX;
    const r = stepBattle(s, true);
    expect(r.action).toMatchObject({ ult: true, kind: 'buff', buff: 'inspire' });
    expect(r.state.inspire.team).toBe(1 + BUFF_ROUNDS);
    const next = stepBattle(until(r.state, 'team', 1), false).action;
    expectDamage(next.hits[0].damage, 50 * 1.15);
  });

  it('頭目大絕招：打我方最前面一整排', () => {
    const team = [dog('a'), dog('b'), dog('c', '謀略')];
    const s = until(createBattle(input(team, { enemyNames: ['雷吼'], boss: true })), 'enemy', 0);
    s.en.enemy[0] = EN_MAX;
    const { action } = stepBattle(s, true);
    expect(action).toMatchObject({ side: 'enemy', ult: true, kind: 'row' });
    expect(action.hits.map((h) => h.target)).toEqual([0, 1]);
  });
});

describe('站位的影響', () => {
  it('近戰（守護、突擊）不在最前排時傷害打折；變成最前排就恢復', () => {
    const team = [
      dog('front', '補給', { row: 0, hasSkill: false, ...TANK }),
      dog('g', '守護', { row: 2, ...TANK }),
    ];
    const s = until(createBattle(input(team, { recommendedPower: 3000 })), 'team', 1);
    expectDamage(stepBattle(s, false).action.hits[0].damage, 50, MELEE_BACK_RATE);
    s.hp.team[0] = 0;
    expectDamage(stepBattle(s, false).action.hits[0].damage, 50);
  });

  it('後衛（謀略、幸運、補血）站在最前排時受到的傷害變多', () => {
    const plain = createBattle(input([dog('a', '補給')], { recommendedPower: 300, seed: 3 }));
    const rear = createBattle(
      input([dog('a', '謀略', { row: 0 })], { recommendedPower: 300, seed: 3 }),
    );
    const hit = (s: BattleState): number =>
      stepBattle(until(s, 'enemy', 0), false).action.hits[0].damage;
    const ratio = hit(rear) / hit(plain);
    expect(ratio).toBeGreaterThan(REAR_FRONT_TAKEN * 0.8);
    expect(ratio).toBeLessThan(REAR_FRONT_TAKEN * 1.25);
  });
});

describe('EN 值與大絕招', () => {
  it('稀有度越高集得越快：SSR 出手一次就滿，下一次出手就放', () => {
    expect(enPerActOf({ rarity: 'SSR' })).toBe(EN_MAX);
    expect(enPerActOf({ ssr: true })).toBe(EN_MAX);
    expect(enPerActOf({ rarity: 'SR' }) * 2).toBeGreaterThanOrEqual(EN_MAX);
    expect(enPerActOf({ rarity: 'R' }) * 2).toBeLessThan(EN_MAX);
    expect(enPerActOf({ rarity: 'R' }) * 3).toBeGreaterThanOrEqual(EN_MAX);
    expect(enPerActOf({ rarity: 'N' }) * 3).toBeGreaterThanOrEqual(EN_MAX);
    expect(enPerActOf({ rarity: 'N' })).toBeLessThan(enPerActOf({ rarity: 'R' }));
    expect(enPerActOf({})).toBe(EN_PER_ACT);

    let s = createBattle(
      input([dog('a', '守護', { rarity: 'SSR', ...TANK })], { recommendedPower: 3000 }),
    );
    const mine: boolean[] = [];
    for (let i = 0; i < 16 && mine.length < 2; i++) {
      const r = stepBattle(s, true);
      if (r.action.side === 'team') mine.push(r.action.ult);
      s = r.state;
    }
    expect(mine).toEqual([false, true]);
  });

  it('沒標稀有度的出手 +40、被打 +20，上限 100；沒有技能的不集氣', () => {
    const team = [dog('a', '守護'), dog('b', '補給', { hasSkill: false })];
    let s = createBattle(input(team, { recommendedPower: 300 }));
    const en = [0, 0];
    for (let i = 0; i < 12 && !s.over; i++) {
      const r = stepBattle(s, false);
      const a = r.action;
      if (a.side === 'team' && a.actor === 0) en[0] = Math.min(EN_MAX, en[0] + EN_PER_ACT);
      for (const h of a.hits) {
        if (h.side === 'team' && h.target === 0 && !h.dodged && !h.defeated) {
          en[0] = Math.min(EN_MAX, en[0] + EN_PER_HIT);
        }
      }
      expect(a.en.team).toEqual(en);
      expect(a.en.enemy).toEqual([0, 0, 0]);
      s = r.state;
    }
    expect(en[0]).toBeGreaterThan(0);
  });

  it('滿 100 才能放；要放才放，不放 EN 留著；放完歸零', () => {
    const s = createBattle(input([dog('a', '突擊', TANK)], { recommendedPower: 3000 }));
    // 還沒滿：說要放也只是一般攻擊
    s.en.team[0] = EN_MAX - 1;
    expect(nextActor(s)!.ultReady).toBe(false);
    expect(stepBattle(s, true).action.ult).toBe(false);
    s.en.team[0] = EN_MAX;
    expect(nextActor(s)!.ultReady).toBe(true);
    const hold = stepBattle(s, false);
    expect(hold.action.ult).toBe(false);
    expect(hold.action.en.team[0]).toBe(EN_MAX);
    const fire = stepBattle(s, true);
    expect(fire.action.ult).toBe(true);
    expect(fire.action.en.team[0]).toBe(0);
  });

  it('自動放招：EN 一滿、輪到就放；補血大絕招等有人受傷才放', () => {
    const r = resolveBattle(input([dog('a', '突擊'), dog('b', '謀略'), dog('c', '守護')]));
    const en = [0, 0, 0];
    let ults = 0;
    for (const a of r.actions) {
      if (a.side === 'team') {
        expect(a.ult).toBe(en[a.actor] >= EN_MAX);
        if (a.ult) ults++;
      }
      a.en.team.forEach((v, i) => (en[i] = v));
    }
    expect(ults).toBeGreaterThan(0);
    expect(r.ultTurns).toHaveLength(ults);

    const s = until(createBattle(input([dog('t'), dog('h', '補血')])), 'team', 1);
    s.en.team[1] = EN_MAX;
    s.hp.team = s.team.map((u) => u.maxHp);
    expect(autoUlt(s)).toBe(false);
    s.hp.team[0] = 10;
    expect(autoUlt(s)).toBe(true);
  });
});

describe('結果可以重現', () => {
  const team = [
    dog('a', '守護'),
    dog('b', '突擊', { attack: 64, defense: 30 }),
    dog('c', '補給'),
    dog('d', '謀略', { attack: 60, defense: 36 }),
    dog('e', '幸運', { attack: 40, defense: 40 }),
  ];

  it('同種子、同隊伍、同陣型、同關卡 → 結果與紀錄完全相同；換種子或換陣型就不同', () => {
    const a = resolveBattle(input(team, { seed: 42 }));
    const b = resolveBattle(input(team, { seed: 42 }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = resolveBattle(input(team, { seed: 43 }));
    expect(JSON.stringify(c.actions)).not.toBe(JSON.stringify(a.actions));
    const moved = team.map((d, i) => (i === 0 ? { ...d, row: 2 as RowIndex } : d));
    const d = resolveBattle(input(moved, { seed: 42 }));
    expect(JSON.stringify(d.actions)).not.toBe(JSON.stringify(a.actions));
  });

  it('一步一步推和一次算完一樣（略過戰鬥、自動出征 = 自動放招打完）', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const whole = resolveBattle(input(team, { seed }));
      let s = createBattle(input(team, { seed }));
      const actions: BattleAction[] = [];
      // 前半場一步一步推，後半場按略過
      while (!s.over && actions.length < 12) {
        const r = stepBattle(s, autoUlt(s));
        actions.push(r.action);
        s = r.state;
      }
      const rest = finishBattle(s);
      expect([...actions, ...rest.actions]).toEqual(whole.actions);
      expect(rest.state.win).toBe(whole.win);
      expect(rest.state.hp).toEqual({ team: whole.finalHp.team, enemy: whole.finalHp.enemies });
    }
  });

  it('stepBattle 不改傳入的狀態；打完再推會丟錯', () => {
    const s = createBattle(input(team));
    const snapshot = JSON.stringify(s);
    stepBattle(s, true);
    finishBattle(s);
    expect(JSON.stringify(s)).toBe(snapshot);
    expect(() => stepBattle(finishBattle(s).state, false)).toThrow();
  });

  it('手動放招：同樣的放招時機重算，結果與紀錄完全相同；時機不同結果就可能不同', () => {
    for (const seed of [7, 8, 9]) {
      // 玩家的打法：EN 滿了先留著，第 4 回合起才放
      let s = createBattle(input(team, { seed }));
      const actions: BattleAction[] = [];
      while (!s.over) {
        const a = nextActor(s)!;
        const use = a.side === 'enemy' ? autoUlt(s) : a.ultReady && s.round >= 4;
        const r = stepBattle(s, use);
        actions.push(r.action);
        s = r.state;
      }
      const ultTurns = actions.filter((a) => a.side === 'team' && a.ult).map((a) => a.turn);
      const again = resolveBattle(input(team, { seed }), { ultTurns });
      expect(again.actions).toEqual(actions);
      expect(again.win).toBe(s.win);
      expect(again.ultTurns).toEqual(ultTurns);
      // 完全不放招也可以重算
      const never = resolveBattle(input(team, { seed }), { ultTurns: [] });
      expect(never.actions.some((a) => a.side === 'team' && a.ult)).toBe(false);
    }
  });

  it('紀錄前後一致：每一下的剩餘血量接得起來，輸的一方全倒', () => {
    for (const seed of [11, 12, 13, 14]) {
      const r = resolveBattle(input(team, { seed }));
      const hp = { team: r.team.map((u) => u.maxHp), enemy: r.enemies.map((u) => u.maxHp) };
      r.actions.forEach((a, i) => {
        expect(a.turn).toBe(i);
        expect(hp[a.side][a.actor]).toBeGreaterThan(0);
        for (const h of a.hits) {
          const before = hp[h.side][h.target];
          expect(before).toBeGreaterThan(0);
          expect(h.targetHp).toBe(before - h.damage + (h.heal ?? 0));
          expect(h.defeated).toBe(h.targetHp === 0);
          hp[h.side][h.target] = h.targetHp;
        }
      });
      expect(hp.team).toEqual(r.finalHp.team);
      expect(hp.enemy).toEqual(r.finalHp.enemies);
      const loser = r.win ? hp.enemy : hp.team;
      if (r.rounds < MAX_ROUNDS) expect(loser.every((v) => v === 0)).toBe(true);
      expect((r.win ? hp.team : hp.enemy).some((v) => v > 0)).toBe(true);
    }
  });

  it('打太久（30 回合）算我方撤退', () => {
    // 雙方都幾乎打不動
    const r = resolveBattle(
      input([dog('a', '守護', { attack: 1, defense: 500000, hasSkill: false })], {
        recommendedPower: 2000,
      }),
    );
    expect(r.rounds).toBe(MAX_ROUNDS);
    expect(r.win).toBe(false);
  });
});

describe('勝負與勝率', () => {
  const team = [
    dog('a', '守護'),
    dog('b', '突擊'),
    dog('c', '補給'),
    dog('d', '謀略'),
    dog('e', '幸運'),
  ];
  const power = battleTeamPower(team);

  it('戰力遠高於建議必勝、遠低於必敗', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(resolveBattle(input(team, { seed, recommendedPower: power * 0.5 })).win).toBe(true);
      expect(resolveBattle(input(team, { seed, recommendedPower: power * 2 })).win).toBe(false);
    }
  });

  it('winChance 用同一套規則模擬；戰力越高勝率越高；同樣的輸入數字不會跳', () => {
    const at = (k: number): number =>
      winChance({ team, recommendedPower: Math.round(power / k), enemyNames: MOBS });
    const list = [0.7, 0.9, 1, 1.1, 1.4].map(at);
    for (let i = 1; i < list.length; i++) expect(list[i]).toBeGreaterThanOrEqual(list[i - 1]);
    expect(list[0]).toBeLessThan(0.05);
    expect(list[4]).toBeGreaterThan(0.95);
    expect(list[2]).toBeGreaterThan(0.3);
    expect(list[2]).toBeLessThan(0.9);
    expect(at(1)).toBe(list[2]);
    expect(winChance({ team: [], recommendedPower: 100, enemyNames: MOBS })).toBe(0);
  });
});

describe('獎勵與播放節奏', () => {
  it('測試模式可以用 &seed= 指定戰鬥種子', () => {
    expect(battleSeedFromSearch('?fast=1&seed=5')).toBe(5);
    expect(battleSeedFromSearch('?seed=5')).toBeNull();
    expect(battleSeedFromSearch('?fast=1&seed=abc')).toBeNull();
    expect(battleSeedFromSearch('?fast=1')).toBeNull();
  });

  it('敗北獎勵 30%，無條件捨去', () => {
    expect(DEFEAT_REWARD_RATE).toBe(0.3);
    expect(scaleReward({ food: 120, bones: 5 }, DEFEAT_REWARD_RATE)).toEqual({
      food: 36,
      bones: 1,
    });
  });

  it('速度按鈕依序切換 ×1 → ×2 → ×3 → ×4 → ×1', () => {
    expect([1, 2, 3, 4].map(nextBattleSpeed)).toEqual([2, 3, 4, 1]);
    expect(nextBattleSpeed(99)).toBe(1);
  });

  it('1 倍速 10 秒內播完，倍速越高越快；測試模式 1 秒內', () => {
    for (const n of [2, 10, 24, 40, 60]) {
      if (n <= 40) expect(battleDurationMs(n, 1)).toBeLessThanOrEqual(10_000);
      const d = [1, 2, 3, 4].map((s) => battleDurationMs(n, s));
      for (let i = 1; i < d.length; i++) expect(d[i]).toBeLessThan(d[i - 1]);
      expect(d[3]).toBeLessThanOrEqual(Math.ceil(d[0] / 4) + n);
      expect(battleDurationMs(n, 1, 'fast')).toBeLessThanOrEqual(1000);
    }
    expect(stepDelayMs(24, 2)).toBe(Math.round(stepDelayMs(24, 1) / 2));
  });

  it('?fast=1 加速戰鬥畫面；&battle=slow 放慢 4 倍、&battle=normal 一般節奏', () => {
    expect(battlePaceFromSearch('')).toBe('normal');
    expect(battlePaceFromSearch('?battle=slow')).toBe('normal');
    expect(battlePaceFromSearch('?fast=1')).toBe('fast');
    expect(battlePaceFromSearch('?fast=1&battle=normal')).toBe('normal');
    expect(battlePaceFromSearch('?fast=1&battle=slow')).toBe('slow');
    expect(stepDelayMs(24, 1, 'slow')).toBe(stepDelayMs(24, 1) * 4);
  });
});
