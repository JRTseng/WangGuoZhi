import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../state/gameState';
import { createRng } from './battle';
import { resultNotes, runExpedition } from './expedition';
import { expNeeded } from './leveling';
import { deserialize, serialize } from './save';
import { SNACKS, addSnacks, feedBlock, feedSnack, snackCount, snackDrop } from './snacks';
import { settle } from './stamina';

const NOW = Date.UTC(2026, 10, 15, 4, 0, 0);
const O = { tzOffsetMin: -480 };
const fresh = (): GameState => settle(createInitialState(NOW), NOW, O);
const TEAM = ['daer', 'heixuan', 'changxu', 'xiaosuan', 'abai'];

describe('零食掉落', () => {
  it('看章節掉不同的零食，頭目關掉 3 個', () => {
    expect(snackDrop(1, false)).toEqual({ id: 'small', amount: 1 });
    expect(snackDrop(3, true)).toEqual({ id: 'small', amount: 3 });
    expect(snackDrop(4, false)).toEqual({ id: 'mid', amount: 1 });
    expect(snackDrop(7, true)).toEqual({ id: 'mid', amount: 3 });
    expect(snackDrop(8, false)).toEqual({ id: 'big', amount: 1 });
    expect(snackDrop(10, true)).toEqual({ id: 'big', amount: 3 });
  });

  it('打贏就進背包並寫在結算訊息；打輸沒有', () => {
    const st = fresh();
    const win = runExpedition(st, 'luoyepo-1', TEAM, NOW, { ...O, seed: 7 });
    if (!win.ok || !win.record.win) throw new Error('這個種子應該要贏');
    expect(win.record.dropSnack).toEqual({ id: 'small', amount: 1 });
    expect(win.state.snacks).toEqual({ small: 1 });
    expect(resultNotes(st, win.state, win.record).join()).toContain('小肉乾 ×1');

    const open = { ...st, cleared: ['luoyepo-1'] };
    const lose = runExpedition(open, 'luoyepo-2', ['abai'], NOW, { ...O, seed: 7 });
    if (!lose.ok || lose.record.win) throw new Error('一隻打第 2 關應該要輸');
    expect(lose.record.dropSnack).toBeUndefined();
    expect(lose.state.snacks).toEqual({});
  });
});

describe('餵零食', () => {
  it('餵一個加經驗、扣一個；經驗滿了會升級', () => {
    const st = addSnacks(fresh(), 'small', 3);
    const before = st.dogs.abai;
    const r = feedSnack(st, 'abai', 'small', 1, createRng(1));
    expect(r.used).toBe(1);
    expect(snackCount(r.state, 'small')).toBe(2);
    expect(r.gain).toMatchObject({ dogId: 'abai', exp: 100, fromLevel: before.level });
    // 1 級升 2 級要 20 經驗，100 經驗會連升
    expect(expNeeded(1)).toBe(20);
    expect(r.state.dogs.abai.level).toBeGreaterThan(before.level);
    expect(r.gain!.toLevel).toBe(r.state.dogs.abai.level);
  });

  it('一次餵 10 個但只有 3 個：餵到沒有為止', () => {
    const st = addSnacks(fresh(), 'mid', 3);
    const r = feedSnack(st, 'daer', 'mid', 10, createRng(2));
    expect(r.used).toBe(3);
    expect(r.gain!.exp).toBe(1200);
    expect(snackCount(r.state, 'mid')).toBe(0);
    expect(feedBlock(r.state, 'daer', 'mid')).toBe('none-left');
    expect(feedSnack(r.state, 'daer', 'mid', 1, createRng(2)).state).toBe(r.state);
  });

  it('升到等級上限就停，剩下的零食不會浪費', () => {
    const base = addSnacks(fresh(), 'big', 10);
    // 1 星上限 60 級：從 59 級開始餵
    const st = { ...base, dogs: { ...base.dogs, daer: { ...base.dogs.daer, level: 59, exp: 0 } } };
    const need = expNeeded(59, 60);
    const r = feedSnack(st, 'daer', 'big', 10, createRng(3));
    expect(r.state.dogs.daer.level).toBe(60);
    expect(r.used).toBe(Math.ceil(need / SNACKS[2].exp));
    expect(snackCount(r.state, 'big')).toBe(10 - r.used);
    expect(feedBlock(r.state, 'daer', 'big')).toBe('maxed');
  });

  it('沒有的狗、認不得的零食不能餵', () => {
    const st = addSnacks(fresh(), 'small', 1);
    const notOwned = 'nuantong';
    expect(st.owned).not.toContain(notOwned);
    expect(feedBlock(st, notOwned, 'small')).toBe('not-owned');
    expect(feedBlock(st, 'daer', 'candy')).toBe('unknown');
    expect(feedSnack(st, notOwned, 'small', 1, createRng(1)).used).toBe(0);
  });
});

describe('存檔', () => {
  it('零食存得回來；舊存檔沒有就補成空的，怪東西丟掉', () => {
    const st = addSnacks(addSnacks(fresh(), 'small', 4), 'big', 2);
    expect(deserialize(serialize(st, NOW), NOW).state.snacks).toEqual({ small: 4, big: 2 });
    const file = JSON.parse(serialize(st, NOW));
    file.state.snacks = { small: 2.9, candy: 5, mid: -1 };
    expect(deserialize(JSON.stringify(file), NOW).state.snacks).toEqual({ small: 2 });
    delete file.state.snacks;
    expect(deserialize(JSON.stringify(file), NOW).state.snacks).toEqual({});
  });
});
