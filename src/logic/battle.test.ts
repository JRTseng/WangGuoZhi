import { describe, expect, it } from 'vitest';
import {
  BATTLE_ROLL_RANGE,
  HEAL_BONUS_RATE,
  HEAL_RATE,
  HEAL_TARGETS,
  SKILL_BONUS_RATE,
  skillBonusOf,
  DEFEAT_REWARD_RATE,
  battleDurationMs,
  battlePaceFromSearch,
  battleSeedFromSearch,
  battleTeamPower,
  createRng,
  mixSeed,
  nextBattleSpeed,
  resolveBattle,
  scaleReward,
  stepDelayMs,
  winChance,
  type BattleDog,
  type BattleInput,
  type BattleResult,
} from './battle';

const dog = (id: string, attack = 40, defense = 40, level = 1, hasSkill = false): BattleDog => ({
  id,
  name: id,
  attack,
  defense,
  level,
  hasSkill,
});
/** n 隻一樣的狗，每隻戰力 80 */
const teamOf = (n: number): BattleDog[] => Array.from({ length: n }, (_, i) => dog(`d${i + 1}`));
const input = (over: Partial<BattleInput> = {}): BattleInput => ({
  team: teamOf(3),
  recommendedPower: 240,
  enemyNames: ['野犬甲', '野犬乙', '野犬丙'],
  seed: 1,
  ...over,
});
const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 13);
const winRate = (over: Partial<BattleInput>): number =>
  SEEDS.filter((seed) => resolveBattle(input({ ...over, seed })).win).length / SEEDS.length;

/** 照紀錄重播一次，回傳最後的血量，順便檢查每一筆紀錄合不合理 */
function replay(r: BattleResult): { team: number[]; enemies: number[] } {
  const hp = { team: r.team.map((u) => u.maxHp), enemies: r.enemies.map((u) => u.maxHp) };
  let round = 1;
  for (const e of r.events) {
    const mine = e.side === 'team' ? hp.team : hp.enemies;
    const foes = e.side === 'team' ? hp.enemies : hp.team;
    expect(e.round).toBeGreaterThanOrEqual(round);
    round = e.round;
    expect(mine[e.attacker], '倒下的不能出手').toBeGreaterThan(0);
    expect(foes[e.target], '不能打已經倒下的').toBeGreaterThan(0);
    expect(e.damage).toBeGreaterThanOrEqual(0);
    foes[e.target] -= e.damage;
    expect(foes[e.target]).toBe(e.targetHp);
    expect(e.targetHp).toBeGreaterThanOrEqual(0);
    expect(e.defeated).toBe(e.targetHp === 0 && e.damage > 0);
  }
  return hp;
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

describe('resolveBattle 勝負', () => {
  it('同種子、同隊伍、同關卡 → 結果與紀錄完全相同', () => {
    for (const seed of [0, 1, 99, 123456789]) {
      expect(resolveBattle(input({ seed }))).toEqual(resolveBattle(input({ seed })));
    }
    const logs = new Set(
      SEEDS.slice(0, 20).map((seed) => JSON.stringify(resolveBattle(input({ seed })).events)),
    );
    expect(logs.size).toBeGreaterThan(1);
  });

  it('支援 1 到 5 隻，0 隻或 6 隻會丟錯', () => {
    for (let n = 1; n <= 5; n++) {
      const r = resolveBattle(input({ team: teamOf(n) }));
      expect(r.team).toHaveLength(n);
      expect(r.teamPower).toBe(80 * n);
    }
    expect(() => resolveBattle(input({ team: [] }))).toThrow();
    expect(() => resolveBattle(input({ team: teamOf(6) }))).toThrow();
  });

  it('戰力遠高於建議必勝、遠低於必敗', () => {
    expect(winRate({ recommendedPower: 240 / 1.2 })).toBe(1);
    expect(winRate({ recommendedPower: 100 })).toBe(1);
    expect(winRate({ recommendedPower: 240 / 0.8 })).toBe(0);
    expect(winRate({ recommendedPower: 2000 })).toBe(0);
  });

  it('勝率隨戰力差單調變化；戰力等於建議時約 60%', () => {
    const recs = [400, 300, 270, 250, 240, 230, 215, 200, 150];
    const rates = recs.map((recommendedPower) => winRate({ recommendedPower }));
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    expect(rates[4]).toBeGreaterThan(0.5);
    expect(rates[4]).toBeLessThan(0.7);
    // 同一個種子：打得贏比較難的，就一定打得贏比較簡單的
    for (const seed of SEEDS.slice(0, 50)) {
      const wins = recs.map(
        (recommendedPower) => resolveBattle(input({ recommendedPower, seed })).win,
      );
      for (let i = 1; i < wins.length; i++) if (wins[i - 1]) expect(wins[i]).toBe(true);
    }
  });

  it('winChance 與實際規則一致', () => {
    expect(winChance(240, 240)).toBeCloseTo(0.6, 5);
    expect(winChance(240, 100)).toBe(1);
    expect(winChance(240, 1000)).toBe(0);
    expect(winChance(0, 100)).toBe(0);
    expect(winRate({ recommendedPower: 250 })).toBeCloseTo(winChance(240, 250), 1);
  });

  it('技能給固定小加成：每隻 +2%，讓勝率變高', () => {
    const skilled = teamOf(3).map((d) => ({ ...d, hasSkill: true }));
    const r = resolveBattle(input({ team: skilled }));
    expect(r.skillBonus).toBeCloseTo(0.06);
    expect(battleTeamPower(skilled)).toBe(240);
    expect(winRate({ team: skilled, recommendedPower: 255 })).toBeGreaterThan(
      winRate({ recommendedPower: 255 }),
    );
    expect(Math.abs(r.roll)).toBeLessThanOrEqual(BATTLE_ROLL_RANGE);
  });
});

describe('resolveBattle 戰鬥紀錄', () => {
  const cases: Partial<BattleInput>[] = [];
  for (const n of [1, 2, 3, 4, 5]) {
    for (const recommendedPower of [40, 150, 80 * n, 80 * n + 20, 600, 3000]) {
      for (const enemyNames of [['頭目'], ['甲', '乙', '丙']]) {
        cases.push({ team: teamOf(n), recommendedPower, enemyNames });
      }
    }
  }

  it('紀錄可以照著重播，最後的存活狀態與勝負一致', () => {
    let wins = 0;
    let losses = 0;
    for (const c of cases) {
      for (const seed of SEEDS.slice(0, 25)) {
        const r = resolveBattle(input({ ...c, seed }));
        const hp = replay(r);
        expect(hp).toEqual(r.finalHp);
        const teamAlive = hp.team.some((h) => h > 0);
        const enemyAlive = hp.enemies.some((h) => h > 0);
        expect(teamAlive).toBe(r.win);
        expect(enemyAlive).toBe(!r.win);
        if (r.win) wins++;
        else losses++;
      }
    }
    expect(wins).toBeGreaterThan(100);
    expect(losses).toBeGreaterThan(100);
  });

  it('長度適中：至少幾次出手，最多 60 次，最後一下一定打倒人', () => {
    for (const c of cases) {
      for (const seed of SEEDS.slice(0, 10)) {
        const { events } = resolveBattle(input({ ...c, seed }));
        expect(events.length).toBeGreaterThanOrEqual(2);
        expect(events.length).toBeLessThanOrEqual(60);
        expect(events[events.length - 1].defeated).toBe(true);
      }
    }
  });

  it('Boss 關只有一隻敵人，血量由建議戰力推算', () => {
    const r = resolveBattle(input({ enemyNames: ['雷吼'], recommendedPower: 480 }));
    expect(r.enemies).toEqual([{ id: 'enemy-1', name: '雷吼', maxHp: 960, attack: 240 }]);
    expect(r.team[0].maxHp).toBe(160);
  });
});

describe('獎勵與播放節奏', () => {
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

describe('補血狗（T017）', () => {
  const healer = (id = 'h'): BattleDog => ({ ...dog(id, 30, 50, 1, true), heal: true });
  const withHealer = (over: Partial<BattleInput> = {}): BattleInput =>
    input({ team: [dog('a'), dog('b'), healer()], ...over });

  it('補血狗給隊伍 +10% 戰力，取代一般技能的 +2%', () => {
    expect(skillBonusOf([healer()])).toBeCloseTo(HEAL_BONUS_RATE);
    expect(skillBonusOf([healer(), dog('a', 40, 40, 1, true)])).toBeCloseTo(
      HEAL_BONUS_RATE + SKILL_BONUS_RATE,
    );
    // 同樣的隊伍，有補血的勝率比較高
    const plain = input({ team: [dog('a'), dog('b'), dog('h', 30, 50, 1, true)] });
    expect(winRate(withHealer())).toBeGreaterThan(winRate(plain));
  });

  it('補血紀錄合理：補血狗每次攻擊後，接著補血量比例最低的兩位受傷隊友，各補 25% 且不超過上限', () => {
    let heals = 0;
    for (const seed of SEEDS) {
      for (const recommendedPower of [200, 260, 400]) {
        const r = resolveBattle(withHealer({ seed, recommendedPower }));
        const hp = { team: r.team.map((u) => u.maxHp), enemy: r.enemies.map((u) => u.maxHp) };
        const ratio = (i: number) => hp.team[i] / r.team[i].maxHp;
        /** 這一輪補血（同一次攻擊後面）已經補了誰 */
        let healed: number[] = [];
        r.events.forEach((e, k) => {
          if (e.heal === undefined) {
            expect(e.follow).toBeUndefined();
            const foes = e.side === 'team' ? hp.enemy : hp.team;
            foes[e.target] -= e.damage;
            expect(foes[e.target]).toBe(e.targetHp);
            healed = [];
            return;
          }
          heals++;
          // 補血一定接在補血狗自己的攻擊（或同一輪的上一下補血）後面
          expect(e.follow).toBe(true);
          expect(e.side).toBe('team');
          expect(r.team[e.attacker].heal).toBe(true);
          expect(hp.team[e.attacker]).toBeGreaterThan(0);
          const prev = r.events[k - 1];
          expect(prev.side).toBe('team');
          expect(prev.attacker).toBe(e.attacker);
          expect(prev.round).toBe(e.round);
          expect(healed).not.toContain(e.target);
          expect(healed.length).toBeLessThan(HEAL_TARGETS);
          const max = r.team[e.target].maxHp;
          const before = hp.team[e.target];
          expect(before).toBeGreaterThan(0);
          expect(before).toBeLessThan(max);
          // 補的是還沒補過的人裡面血量比例最低的
          for (let i = 0; i < hp.team.length; i++) {
            if (i === e.target || healed.includes(i) || hp.team[i] <= 0) continue;
            if (hp.team[i] < r.team[i].maxHp) {
              expect(ratio(e.target)).toBeLessThanOrEqual(ratio(i));
            }
          }
          expect(e.heal).toBe(Math.min(max - before, Math.round(max * HEAL_RATE)));
          expect(e.heal).toBeGreaterThan(0);
          expect(e.damage).toBe(0);
          expect(e.defeated).toBe(false);
          hp.team[e.target] += e.heal;
          expect(hp.team[e.target]).toBe(e.targetHp);
          healed.push(e.target);
        });
        expect(hp.team).toEqual(r.finalHp.team);
        expect(hp.enemy).toEqual(r.finalHp.enemies);
        // 勝負與結尾的規則不變
        const loser = r.win ? r.finalHp.enemies : r.finalHp.team;
        const winner = r.win ? r.finalHp.team : r.finalHp.enemies;
        expect(loser.every((x) => x === 0)).toBe(true);
        expect(winner.some((x) => x > 0)).toBe(true);
        expect(r.events.length).toBeLessThanOrEqual(80);
      }
    }
    expect(heals).toBeGreaterThan(50);
    // 目前敵人都集中打最前面那一隻，同時有兩位受傷的情況很少；T023 改成真的打之後才常見
    expect(HEAL_TARGETS).toBe(2);
  });

  it('補血不影響勝負：同隊伍同種子，有沒有標成補血狗只差那 10% 戰力加成', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const r = resolveBattle(withHealer({ seed, recommendedPower: 260 }));
      expect(r.win).toBe(r.teamPower * (1 + r.skillBonus) * (1 + r.roll) >= 260 * 0.97);
    }
  });

  it('只有補血狗一隻也打得完；同種子結果一樣', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const a = resolveBattle(input({ team: [healer()], recommendedPower: 80, seed }));
      const b = resolveBattle(input({ team: [healer()], recommendedPower: 80, seed }));
      expect(a).toEqual(b);
      expect(a.events[a.events.length - 1].defeated).toBe(true);
    }
  });

  it('沒有補血狗的隊伍不會出現補血', () => {
    for (const seed of SEEDS.slice(0, 50))
      expect(resolveBattle(input({ seed })).events.every((e) => e.heal === undefined)).toBe(true);
  });

  it('測試模式可以用 &seed= 指定戰鬥種子；平常不行', () => {
    expect(battleSeedFromSearch('?fast=1&seed=7')).toBe(7);
    expect(battleSeedFromSearch('?fast=1&battle=slow&seed=0')).toBe(0);
    expect(battleSeedFromSearch('?seed=7')).toBeNull();
    expect(battleSeedFromSearch('?fast=1')).toBeNull();
    expect(battleSeedFromSearch('?fast=1&seed=abc')).toBeNull();
    expect(battleSeedFromSearch('?fast=1&seed=-3')).toBeNull();
  });
});
