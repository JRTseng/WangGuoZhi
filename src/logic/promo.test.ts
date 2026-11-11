import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state/gameState';
import { redeemCode } from './promo';

describe('優惠碼', () => {
  it('兌換成功：加資源、記錄已用（不分大小寫、去空白）', () => {
    const r = redeemCode(createInitialState(), '  wangwang ');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.resources).toEqual({ food: 1200, bones: 150 });
    expect(r.state.redeemedCodes).toEqual(['WANGWANG']);
    expect(redeemCode(r.state, 'WANGWANG')).toEqual({ ok: false, error: 'used' });
  });
  it('空白與不存在的碼', () => {
    expect(redeemCode(createInitialState(), ' ')).toEqual({ ok: false, error: 'empty' });
    expect(redeemCode(createInitialState(), 'NOPE')).toEqual({ ok: false, error: 'invalid' });
  });
});
