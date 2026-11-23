import { describe, expect, it } from 'vitest';
import { DOGS } from '../data/dogs';
import { REGIONS } from '../data/regions';
import { createInitialState } from '../state/gameState';
import {
  BOND,
  BOND_MAX_LEVEL,
  BOND_NEED,
  battleBond,
  bondLevel,
  bondReward,
  bondText,
  bondUpNote,
  bondUpText,
  bondView,
  canPet,
  gainBond,
  petDog,
  petLine,
  sanitizeBond,
} from './bond';
import { runExpedition } from './expedition';
import { sanitizeState } from './save';

const NOW = Date.UTC(2026, 10, 24, 4, 0, 0); // 台北中午
const DAY = 24 * 60 * 60 * 1000;
const fresh = () => createInitialState(NOW);

describe('好感度（T042）', () => {
  it('門檻一級比一級高，最高 10 級', () => {
    expect(BOND_MAX_LEVEL).toBe(10);
    expect(BOND_NEED[0]).toBe(0);
    for (let i = 1; i < BOND_NEED.length; i += 1) {
      expect(BOND_NEED[i]).toBeGreaterThan(BOND_NEED[i - 1]);
    }
    expect(bondLevel(0)).toBe(0);
    expect(bondLevel(9)).toBe(0);
    expect(bondLevel(10)).toBe(1);
    expect(bondLevel(659)).toBe(9);
    expect(bondLevel(660)).toBe(10);
    expect(bondLevel(99999)).toBe(10);
  });

  it('每一級都有禮物，碎片是那個角色自己的', () => {
    for (let lv = 1; lv <= BOND_MAX_LEVEL; lv += 1) {
      expect(bondReward('daer', lv).length, `第 ${lv} 級`).toBeGreaterThan(0);
    }
    expect(bondReward('daer', 0)).toEqual([]);
    expect(bondReward('daer', 11)).toEqual([]);
    expect(bondReward('daer', 3)).toEqual([{ kind: 'shards', id: 'daer', amount: 2 }]);
  });

  it('摸摸：每個角色一天一次，摸到升級禮物直接入袋', () => {
    const s0 = fresh();
    const id = s0.owned[0];
    expect(canPet(s0, id, NOW)).toBe(true);
    const r1 = petDog(s0, id, NOW);
    expect(r1.gained).toBe(BOND.pet);
    expect(r1.ups).toEqual([{ dogId: id, level: 1, gifts: [{ kind: 'food', amount: 100 }] }]);
    expect(r1.state.resources.food).toBe(s0.resources.food + 100);
    expect(bondView(r1.state, id)).toMatchObject({ level: 1, points: 10, into: 0, need: 20 });
    // 今天再摸不會再加
    expect(canPet(r1.state, id, NOW + 1000)).toBe(false);
    const r2 = petDog(r1.state, id, NOW + 1000);
    expect(r2.gained).toBe(0);
    expect(r2.state).toBe(r1.state);
    // 別的角色今天還可以摸
    const other = s0.owned[1];
    expect(petDog(r1.state, other, NOW).gained).toBe(BOND.pet);
    // 隔天又可以
    const r3 = petDog(r1.state, id, NOW + DAY);
    expect(r3.gained).toBe(BOND.pet);
    expect(r3.state.bond.petted).toEqual([id]);
    expect(bondView(r3.state, id).points).toBe(20);
  });

  it('沒擁有的角色不能摸、也不會加好感度', () => {
    const s0 = fresh();
    const stranger = DOGS.find((d) => !s0.owned.includes(d.id))!.id;
    expect(canPet(s0, stranger, NOW)).toBe(false);
    expect(petDog(s0, stranger, NOW).state).toBe(s0);
    expect(gainBond(s0, [stranger, 'nobody'], 50).state.bond.points).toEqual({});
  });

  it('一次跨好幾級，每一級的禮物都送；滿級後不再累積', () => {
    const s0 = fresh();
    const id = s0.owned[0];
    const r = gainBond(s0, [id], 60);
    expect(r.ups.map((u) => u.level)).toEqual([1, 2, 3]);
    expect(r.state.resources.food).toBe(s0.resources.food + 100);
    expect(r.state.resources.bones).toBe(s0.resources.bones + 10);
    expect(r.state.shards[id] ?? 0).toBe((s0.shards[id] ?? 0) + 2);
    expect(bondUpText(r.ups)).toContain('♥3');
    expect(bondUpText(r.ups)).toContain('碎片 ×2');
    expect(bondUpNote(r.ups)).toBe(`好感度升級：${DOGS.find((d) => d.id === id)!.name} ♥3`);
    const two = gainBond(s0, s0.owned.slice(0, 2), 10).ups;
    expect(bondUpNote(two)).toMatch(/ ♥1 等 2 隻$/);
    expect(bondUpText([])).toBe('');
    expect(bondUpNote([])).toBe('');

    const full = gainBond(s0, [id], 99999);
    expect(full.ups).toHaveLength(BOND_MAX_LEVEL);
    const v = bondView(full.state, id);
    expect(v).toMatchObject({ level: 10, points: 660, max: true, need: 0, next: [] });
    expect(bondText(v)).toContain('滿');
    expect(canPet(full.state, id, NOW)).toBe(false);
    expect(gainBond(full.state, [id], 10).state).toBe(full.state);
  });

  it('資料視窗的那一行寫得出等級、進度與下一級的禮物', () => {
    const s = gainBond(fresh(), ['daer'], 45).state;
    expect(bondText(bondView(s, 'daer'))).toBe('♥2（15／30）下一級送 大耳碎片 ×2');
  });

  it('一起出征：打贏每隻 +3、打輸 +1，同一隻不重複算', () => {
    const s0 = fresh();
    const [a, b] = s0.owned;
    const win = battleBond(s0, [a, b, a], true).state;
    expect(win.bond.points).toEqual({ [a]: BOND.win, [b]: BOND.win });
    const lose = battleBond(s0, [a], false).state;
    expect(lose.bond.points).toEqual({ [a]: BOND.lose });
  });

  it('真的打一仗：上陣的角色好感度增加，升級會記在出征紀錄上', () => {
    let s = fresh();
    const team = s.owned.slice(0, 3);
    // 差一點就升級
    s = gainBond(s, team, 9).state;
    const r = runExpedition(s, REGIONS[0].stages[0].id, team, NOW, { seed: 7 });
    if (!r.ok) throw new Error(r.error);
    for (const id of team) {
      expect(r.state.bond.points[id]).toBe(9 + (r.record.win ? BOND.win : BOND.lose));
    }
    expect(r.record.bondUps?.map((u) => u.dogId).sort()).toEqual([...team].sort());
    expect(r.record.bondUps?.every((u) => u.level === 1)).toBe(true);
  });

  it('被摸的時候說的話：三個階段不一樣，喜歡的東西會出現在裡面', () => {
    const low = new Set([0, 1, 2, 3, 4].map((i) => petLine(0, i, '烤地瓜')));
    const high = new Set([0, 1, 2, 3, 4].map((i) => petLine(9, i, '烤地瓜')));
    expect(low.size).toBe(4);
    expect(high.size).toBe(5);
    expect([...low].some((l) => high.has(l))).toBe(false);
    expect([...low].some((l) => l.includes('烤地瓜'))).toBe(false);
    expect([...high].some((l) => l.includes('烤地瓜'))).toBe(true);
    expect(petLine(5, -3)).toBeTruthy();
    // 泡泡放得下
    for (const lv of [0, 5, 9]) {
      for (let i = 0; i < 6; i += 1) {
        expect(petLine(lv, i, '一二三四五六七八九十一二三四五六七八').length).toBeLessThanOrEqual(
          30,
        );
      }
    }
  });

  it('讀檔：舊存檔沒有好感度就從 0 開始；壞掉的值會被整理掉', () => {
    expect(sanitizeBond(undefined)).toEqual({ points: {}, day: '', petted: [] });
    expect(
      sanitizeBond({
        points: { daer: 45.7, nobody: 10, abai: -3, heixuan: 'x', changxu: 99999 },
        day: 20261124,
        petted: ['daer', 'daer', 'nobody', 5],
      }),
    ).toEqual({ points: { daer: 45, changxu: 660 }, day: '', petted: ['daer'] });

    const s = petDog(fresh(), 'daer', NOW).state;
    const loaded = sanitizeState(JSON.parse(JSON.stringify(s)), NOW);
    expect(loaded.bond).toEqual(s.bond);
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete old.bond;
    expect(sanitizeState(old, NOW).bond).toEqual({ points: {}, day: '', petted: [] });
  });
});
