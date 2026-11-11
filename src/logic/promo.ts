import { PROMO_CODES, type PromoCode } from '../data/backgrounds';
import type { GameState } from '../state/gameState';

export type RedeemResult =
  | { ok: true; state: GameState; promo: PromoCode }
  | { ok: false; error: 'empty' | 'invalid' | 'used' };

/** 兌換優惠碼：去頭尾空白、不分大小寫；每組碼只能用一次 */
export function redeemCode(state: GameState, input: string): RedeemResult {
  const code = input.trim().toUpperCase();
  if (!code) return { ok: false, error: 'empty' };
  const promo = PROMO_CODES.find((p) => p.code === code);
  if (!promo) return { ok: false, error: 'invalid' };
  if (state.redeemedCodes.includes(code)) return { ok: false, error: 'used' };
  return {
    ok: true,
    promo,
    state: {
      ...state,
      resources: {
        food: state.resources.food + promo.reward.food,
        bones: state.resources.bones + promo.reward.bones,
      },
      redeemedCodes: [...state.redeemedCodes, code],
    },
  };
}

export const REDEEM_ERROR_TEXT: Record<'empty' | 'invalid' | 'used', string> = {
  empty: '請先輸入優惠碼',
  invalid: '找不到這組優惠碼',
  used: '這組優惠碼已經用過了',
};
