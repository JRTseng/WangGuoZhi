import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/gameState';
import { runExpedition } from './expedition';
import {
  LORD_EXP_WIN,
  LORD_MAX_LEVEL,
  addLordExp,
  gainLordExp,
  lordExpNeeded,
  lordFromWins,
  lordNotes,
  lordReward,
  lordTitle,
  sanitizeLord,
} from './lord';
import { deserialize, serialize } from './save';

describe('城主等級', () => {
  it('升級要的經驗：等級 × 100，滿級 0', () => {
    expect(lordExpNeeded(1)).toBe(100);
    expect(lordExpNeeded(12)).toBe(1200);
    expect(lordExpNeeded(LORD_MAX_LEVEL)).toBe(0);
  });

  it('加經驗、可以連升好幾級，獎勵合計', () => {
    const a = gainLordExp({ level: 1, exp: 90 }, 20);
    expect(a.lord).toEqual({ level: 2, exp: 10 });
    expect(a.gain).toEqual({ exp: 20, fromLevel: 1, toLevel: 2, ...lordReward(2) });
    const b = gainLordExp({ level: 1, exp: 0 }, 300);
    expect(b.lord).toEqual({ level: 3, exp: 0 });
    expect(b.gain.food).toBe(lordReward(2).food + lordReward(3).food);
    const top = gainLordExp({ level: LORD_MAX_LEVEL, exp: 0 }, 999);
    expect(top.lord).toEqual({ level: LORD_MAX_LEVEL, exp: 0 });
    expect(top.gain.exp).toBe(0);
  });

  it('升級的獎勵進資源，沒升級不動', () => {
    const st = createInitialState();
    const same = addLordExp(st, 10);
    expect(same.state.resources).toEqual(st.resources);
    const up = addLordExp(st, 100);
    expect(up.state.lord.level).toBe(2);
    expect(up.state.resources.food).toBe(st.resources.food + 400);
    expect(up.state.resources.bones).toBe(st.resources.bones + 40);
    expect(lordNotes(up.gain)[0]).toContain('城主升到 Lv.2');
    expect(lordNotes(same.gain)).toEqual([]);
  });

  it('稱號每 10 級換一個', () => {
    expect(lordTitle(1)).toBe('小城主');
    expect(lordTitle(9)).toBe('小城主');
    expect(lordTitle(10)).toBe('縣令');
    expect(lordTitle(60)).toBe('汪王');
  });

  it('出征給城主經驗，寫進紀錄', () => {
    const st = createInitialState();
    const r = runExpedition(st, 'luoyepo-1', st.team, Date.now(), { seed: 7 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.record.lord?.exp).toBeGreaterThan(0);
    expect(r.state.lord.exp).toBe(r.record.lord!.exp);
  });

  it('讀檔：壞資料修正；舊存檔照勝場補算', () => {
    expect(sanitizeLord({ level: 999, exp: -5 }, 0)).toEqual({ level: LORD_MAX_LEVEL, exp: 0 });
    expect(sanitizeLord({ level: 2, exp: 5000 }, 0)).toEqual({ level: 2, exp: 199 });
    expect(sanitizeLord(undefined, 5)).toEqual(lordFromWins(5));
    expect(lordFromWins(5)).toEqual({ level: 2, exp: 0 });
    expect(lordFromWins(0)).toEqual({ level: 1, exp: 0 });
    expect(LORD_EXP_WIN).toBe(20);
    const st = { ...createInitialState(), lord: { level: 7, exp: 33 } };
    const back = deserialize(serialize(st, 1000), 1000);
    expect(back.state.lord).toEqual({ level: 7, exp: 33 });
  });
});
