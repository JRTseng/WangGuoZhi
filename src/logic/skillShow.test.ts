import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { BOSS_SKILLS, DEFAULT_SKILL_LINES } from '../data/skillLines';
import { REGIONS } from '../data/regions';
import { resolveBattle, type BattleDog, type BattleEvent } from './battle';
import {
  SKILL_LINE_MAX,
  ULT_CHARGE,
  ULT_CUTIN_RATIO,
  ULT_KINDS,
  cleanSkillLine,
  planShow,
  setSkillLine,
  skillLineOf,
  ultDelayMs,
  ultKindOfRole,
  type ShowCaster,
} from './skillShow';

const caster = (name: string, kind: ShowCaster['kind'] = 'single'): ShowCaster => ({
  name,
  skill: `${name}斬`,
  kind,
  line: '',
});

const attack = (side: 'team' | 'enemy', attacker: number, round = 1): BattleEvent => ({
  round,
  side,
  attacker,
  target: 0,
  damage: 5,
  targetHp: 10,
  defeated: false,
});
const heal = (attacker: number): BattleEvent => ({
  ...attack('team', attacker),
  damage: 0,
  heal: 8,
});

describe('ultKindOfRole', () => {
  it('六種定位各有對應的演出種類', () => {
    expect(ultKindOfRole('前排／突擊')).toBe('pierce');
    expect(ultKindOfRole('後排／謀略')).toBe('row');
    expect(ultKindOfRole('後排／補血')).toBe('heal');
    expect(ultKindOfRole('隊長／補給')).toBe('buff');
    expect(ultKindOfRole('前排／守護')).toBe('buff');
    expect(ultKindOfRole('後排／幸運')).toBe('single');
  });

  it('現有每隻狗都對得到，五種演出都有狗在用', () => {
    const kinds = new Set(DOGS.map((d) => ultKindOfRole(d.role)));
    expect([...kinds].sort()).toEqual([...ULT_KINDS].sort());
  });
});

describe('planShow', () => {
  it('每隻狗集滿 EN 後的下一次出手是大絕招，放完歸零', () => {
    const events = Array.from({ length: 7 }, (_, i) => attack('team', 0, i + 1));
    const show = planShow(events, { team: [caster('大耳')], enemy: [null] });
    expect(show).toHaveLength(events.length);
    expect(show.map((s) => !!s.ult)).toEqual([false, false, true, false, false, true, false]);
    expect(show.map((s) => s.en.team[0])).toEqual([1, 2, 0, 1, 2, 0, 1]);
    expect(show[2].ult).toMatchObject({ side: 'team', index: 0, name: '大耳', skill: '大耳斬' });
    expect(ULT_CHARGE).toBe(2);
  });

  it('各算各的；沒有技能的（野犬）不會放招、EN 一直是 0', () => {
    const events = [
      attack('team', 0),
      attack('enemy', 0),
      attack('team', 1),
      attack('team', 0),
      attack('enemy', 0),
      attack('team', 0),
      attack('enemy', 0),
      attack('team', 1),
      attack('team', 1),
    ];
    const show = planShow(events, { team: [caster('甲'), caster('乙')], enemy: [null] });
    expect(show.map((s) => s.ult?.name ?? null)).toEqual([
      null,
      null,
      null,
      null,
      null,
      '甲',
      null,
      null,
      '乙',
    ]);
    expect(show.every((s) => s.en.enemy[0] === 0)).toBe(true);
  });

  it('補血狗的大絕招只在補血那一下播；滿了先留著，攻擊照常', () => {
    const events = [attack('team', 0), attack('team', 0), attack('team', 0), heal(0), heal(0)];
    const show = planShow(events, { team: [caster('暖桶', 'heal')], enemy: [null] });
    expect(show.map((s) => s.ult?.kind ?? null)).toEqual([null, null, null, 'heal', null]);
    expect(show.map((s) => s.en.team[0])).toEqual([1, 2, 2, 0, 1]);
  });

  it('Boss 也會放招', () => {
    const events = [attack('enemy', 0), attack('enemy', 0), attack('enemy', 0)];
    const show = planShow(events, { team: [null], enemy: [caster('雷吼')] });
    expect(show[2].ult).toMatchObject({ side: 'enemy', index: 0 });
  });

  it('只是演出：不改戰鬥紀錄，同一場排出來的結果每次都一樣', () => {
    const team: BattleDog[] = [
      { id: 'a', name: '甲', attack: 50, defense: 40, level: 3, hasSkill: true },
      { id: 'b', name: '乙', attack: 40, defense: 50, level: 3, hasSkill: true },
      { id: 'c', name: '丙', attack: 30, defense: 50, level: 3, hasSkill: true, heal: true },
    ];
    const input = { team, recommendedPower: 260, enemyNames: ['野犬', '野犬', '野犬'], seed: 7 };
    const before = resolveBattle(input);
    const snapshot = JSON.stringify(before);
    const casters = {
      team: [caster('甲', 'pierce'), caster('乙', 'buff'), caster('丙', 'heal')],
      enemy: [null, null, null],
    };
    const a = planShow(before.events, casters);
    const b = planShow(resolveBattle(input).events, casters);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(a).toEqual(b);
    // 一場 3～5 回合，至少看得到一次大絕招
    expect(a.some((s) => s.ult)).toBe(true);
    for (const s of a) {
      for (const n of [...s.en.team, ...s.en.enemy]) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(ULT_CHARGE);
      }
    }
  });
});

describe('ultDelayMs', () => {
  it('倍速越高越短；測試模式很短；字卡佔一部分', () => {
    expect(ultDelayMs(1)).toBe(1500);
    expect(ultDelayMs(2)).toBe(750);
    expect(ultDelayMs(4)).toBeLessThan(ultDelayMs(3));
    expect(ultDelayMs(9)).toBe(ultDelayMs(4));
    expect(ultDelayMs(1, 'fast')).toBeLessThanOrEqual(50);
    expect(ultDelayMs(1, 'slow')).toBeGreaterThan(ultDelayMs(1));
    expect(ULT_CUTIN_RATIO).toBeGreaterThan(0.4);
    expect(ULT_CUTIN_RATIO).toBeLessThan(0.8);
  });
});

describe('台詞', () => {
  it('cleanSkillLine：去頭尾空白與換行，超過字數截掉，表情符號不切半', () => {
    expect(cleanSkillLine('  衝啊！  ')).toBe('衝啊！');
    expect(cleanSkillLine('第一行\n第二行\t尾')).toBe('第一行 第二行 尾');
    expect(cleanSkillLine('\u0000 ')).toBe('');
    expect(Array.from(cleanSkillLine('汪'.repeat(40)))).toHaveLength(SKILL_LINE_MAX);
    const emoji = cleanSkillLine('🐶'.repeat(20));
    expect(Array.from(emoji)).toHaveLength(SKILL_LINE_MAX);
    expect(emoji).toBe('🐶'.repeat(SKILL_LINE_MAX));
  });

  it('skillLineOf：玩家填的優先，沒有用預設，都沒有是空字串', () => {
    const defaults = { daer: '預設' };
    expect(skillLineOf({ daer: '自己填的' }, defaults, 'daer')).toBe('自己填的');
    expect(skillLineOf({}, defaults, 'daer')).toBe('預設');
    expect(skillLineOf({}, defaults, 'nobody')).toBe('');
  });

  it('setSkillLine：只能改擁有的狗；空白恢復預設；沒變回傳原狀態', () => {
    const st = { owned: ['daer'], skillLines: {} as Record<string, string>, other: 1 };
    const a = setSkillLine(st, 'daer', ' 看我的！\n');
    expect(a).not.toBe(st);
    expect(a.skillLines).toEqual({ daer: '看我的！' });
    expect(a.other).toBe(1);
    expect(st.skillLines).toEqual({});
    expect(setSkillLine(a, 'daer', '看我的！')).toBe(a);
    expect(setSkillLine(a, 'heixuan', '沒這隻')).toBe(a);
    const b = setSkillLine(a, 'daer', '   ');
    expect(b.skillLines).toEqual({});
    expect(setSkillLine(st, 'daer', '')).toBe(st);
  });

  it('每隻狗都有預設台詞而且不超過字數；每個 Boss 都有招式', () => {
    for (const d of DOGS) {
      const line = DEFAULT_SKILL_LINES[d.id];
      expect(line, d.name).toBeTruthy();
      expect(cleanSkillLine(line), d.name).toBe(line);
    }
    for (const r of REGIONS) {
      for (const s of r.stages) {
        if (!s.boss) continue;
        expect(BOSS_SKILLS[s.boss.name]?.name, s.boss.name).toBeTruthy();
      }
    }
  });
});
