import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/gameState';
import { runExpedition } from './expedition';
import { dogStats } from './leveling';
import { findDog } from '../data/dogs';
import { deserialize, serialize } from './save';
import { HURT_MS, REST_MS, markWounds, sanitizeWounds, woundLevel } from './wounds';

const TEAM = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];

describe('受傷外觀', () => {
  it('打贏：出戰的狗休息一下；打輸：全部掛彩比較久；過了時間就恢復', () => {
    const win = { wounds: markWounds({ wounds: {} }, ['daer', 'abai'], true, 1000) };
    expect(woundLevel(win, 'daer', 1000)).toBe(1);
    expect(woundLevel(win, 'heixuan', 1000)).toBe(0);
    expect(woundLevel(win, 'daer', 1000 + REST_MS - 1)).toBe(1);
    expect(woundLevel(win, 'daer', 1000 + REST_MS)).toBe(0);
    const lose = { wounds: markWounds({ wounds: {} }, ['daer'], false, 1000) };
    expect(woundLevel(lose, 'daer', 1000 + HURT_MS - 1)).toBe(2);
    expect(woundLevel(lose, 'daer', 1000 + HURT_MS)).toBe(0);
    expect(woundLevel({}, 'daer', 0)).toBe(0);
  });

  it('掛彩中再打贏一場不會變輕；過期的會清掉', () => {
    const a = { wounds: markWounds({ wounds: {} }, ['daer', 'abai'], false, 0) };
    const b = { wounds: markWounds(a, ['daer'], true, 1000) };
    expect(b.wounds.daer).toEqual({ level: 2, until: HURT_MS });
    expect(b.wounds.abai).toEqual({ level: 2, until: HURT_MS });
    const c = { wounds: markWounds(b, ['heixuan'], true, HURT_MS + 5) };
    expect(Object.keys(c.wounds)).toEqual(['heixuan']);
  });

  it('出征會記下來，而且完全不影響攻防與戰力', () => {
    const s0 = createInitialState(0);
    const before = TEAM.map((id) => dogStats({ dogs: s0.dogs }, findDog(id)!));
    let sawWin = false;
    let sawLose = false;
    for (let seed = 1; seed <= 12; seed++) {
      // 第 1 關五隻上幾乎都贏；一隻去打第 1 關比較容易輸
      for (const team of [TEAM, ['abai']]) {
        const r = runExpedition(s0, 'luoyepo-1', team, 5000, { seed });
        if (!r.ok) throw new Error(r.error);
        for (const id of team) {
          expect(woundLevel(r.state, id, 5000)).toBe(r.record.win ? 1 : 2);
        }
        if (r.record.win) sawWin = true;
        else sawLose = true;
      }
    }
    expect(sawWin).toBe(true);
    expect(sawLose).toBe(true);
    // 同樣的養成進度，有沒有掛彩數字都一樣
    const hurt = { dogs: s0.dogs, wounds: markWounds(s0, TEAM, false, 0) };
    expect(TEAM.map((id) => dogStats(hurt, findDog(id)!))).toEqual(before);
  });

  it('存檔：存得回來；過期的、怪資料丟掉', () => {
    const s = {
      ...createInitialState(0),
      wounds: markWounds({ wounds: {} }, ['daer'], false, 100),
    };
    expect(deserialize(serialize(s, 200), 200).state.wounds).toEqual(s.wounds);
    expect(deserialize(serialize(s, 200), 100 + HURT_MS).state.wounds).toEqual({});
    expect(
      sanitizeWounds(
        {
          daer: { level: 2, until: 9e15 },
          abai: { level: 3, until: 500 },
          heixuan: { level: 1, until: 50 },
          stranger: { level: 1, until: 500 },
          changxu: 'x',
        },
        (id) => id !== 'stranger',
        100,
      ),
    ).toEqual({ daer: { level: 2, until: 100 + HURT_MS } });
    expect(sanitizeWounds(null, () => true, 0)).toEqual({});
  });
});
