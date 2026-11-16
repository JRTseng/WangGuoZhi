import type { Rect } from './layout';

/**
 * 簽到畫面（T026）的排版，只做橫式（遊戲固定橫向）：
 * 上面一行說明，中間七張獎勵卡排成一列，下面左邊是累計天數、中間「簽到領取」、右邊是倒數。
 */
export interface SigninLayout {
  /** 說明文字（置中） */
  hint: { x: number; y: number };
  /** 七張獎勵卡，由左到右 */
  cards: Rect[];
  claim: Rect;
  /** 左下「累計簽到 N 天」 */
  total: { x: number; y: number };
  /** 右下倒數（靠右對齊） */
  countdown: { x: number; y: number };
}

const MARGIN = 12;
const GAP = 8;
const HINT_HEIGHT = 26;
const CLAIM_HEIGHT = 48;
const CLAIM_WIDTH = 220;

export function signinLayout(w: number, h: number, top = 56, count = 7): SigninLayout {
  const cardsTop = top + GAP + HINT_HEIGHT;
  const claimY = h - MARGIN - CLAIM_HEIGHT;
  const cardW = Math.floor((w - MARGIN * 2 - GAP * (count - 1)) / count);
  const cardH = claimY - GAP - cardsTop;
  const left = Math.floor((w - (cardW * count + GAP * (count - 1))) / 2);
  const cards: Rect[] = Array.from({ length: count }, (_, i) => ({
    x: left + i * (cardW + GAP),
    y: cardsTop,
    width: cardW,
    height: cardH,
  }));
  const mid = claimY + CLAIM_HEIGHT / 2;
  return {
    hint: { x: w / 2, y: top + GAP + HINT_HEIGHT / 2 },
    cards,
    claim: {
      x: Math.floor((w - CLAIM_WIDTH) / 2),
      y: claimY,
      width: CLAIM_WIDTH,
      height: CLAIM_HEIGHT,
    },
    total: { x: left, y: mid },
    countdown: { x: w - left, y: mid },
  };
}
