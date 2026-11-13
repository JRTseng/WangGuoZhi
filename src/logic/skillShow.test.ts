import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { BOSS_SKILLS, DEFAULT_SKILL_LINES } from '../data/skillLines';
import { REGIONS } from '../data/regions';
import {
  SKILL_LINE_MAX,
  ULT_CUTIN_RATIO,
  ULT_KINDS,
  cleanSkillLine,
  setSkillLine,
  skillLineOf,
  ultDelayMs,
  ultKindOfRole,
} from './skillShow';

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
