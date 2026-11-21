import type { Rect } from './layout';

/**
 * 信箱畫面（T040）的排版，只做橫式（遊戲固定橫向）：
 * 左邊是信的清單（一頁五封，底下換頁），右邊是打開的那封信：
 * 寄件人與標題、內文、附件，最下面一排按鈕（領取附件、刪除｜全部領取、清掉看過的）。
 */
export interface MailLayout {
  /** 清單的每一列 */
  rows: Rect[];
  prev: Rect;
  next: Rect;
  /** 「1 / 3」頁碼的中心 */
  page: { x: number; y: number };
  /** 右邊那封信的外框 */
  pane: Rect;
  /** 信的文字從哪裡開始、最寬多少 */
  text: { x: number; y: number; width: number };
  /** 附件那一塊（在按鈕上面） */
  gifts: Rect;
  claim: Rect;
  remove: Rect;
  claimAll: Rect;
  clean: Rect;
}

export const MAIL_ROWS = 5;

const MARGIN = 12;
const GAP = 8;
const ROW_GAP = 6;
const LIST_WIDTH = 280;
const BUTTON_HEIGHT = 44;
const PAD = 12;
const GIFT_HEIGHT = 50;

export function mailLayout(w: number, h: number, top = 56): MailLayout {
  const y0 = top + GAP;
  const pagerY = h - MARGIN - BUTTON_HEIGHT;
  const rowH = Math.floor((pagerY - GAP - y0 - ROW_GAP * (MAIL_ROWS - 1)) / MAIL_ROWS);
  const rows: Rect[] = Array.from({ length: MAIL_ROWS }, (_, i) => ({
    x: MARGIN,
    y: y0 + i * (rowH + ROW_GAP),
    width: LIST_WIDTH,
    height: rowH,
  }));
  const arrow = 64;
  const prev: Rect = { x: MARGIN, y: pagerY, width: arrow, height: BUTTON_HEIGHT };
  const next: Rect = {
    x: MARGIN + LIST_WIDTH - arrow,
    y: pagerY,
    width: arrow,
    height: BUTTON_HEIGHT,
  };

  const pane: Rect = {
    x: MARGIN + LIST_WIDTH + GAP + 2,
    y: y0,
    width: w - MARGIN - (MARGIN + LIST_WIDTH + GAP + 2),
    height: h - MARGIN - y0,
  };
  const by = pane.y + pane.height - PAD - BUTTON_HEIGHT;
  const inner = pane.width - PAD * 2;
  const claimW = Math.floor(inner * 0.3);
  const removeW = Math.floor(inner * 0.15);
  const sideW = Math.floor((inner - claimW - removeW - GAP * 3) / 2);
  const claim: Rect = { x: pane.x + PAD, y: by, width: claimW, height: BUTTON_HEIGHT };
  const remove: Rect = { x: claim.x + claimW + GAP, y: by, width: removeW, height: BUTTON_HEIGHT };
  const clean: Rect = {
    x: pane.x + pane.width - PAD - sideW,
    y: by,
    width: sideW,
    height: BUTTON_HEIGHT,
  };
  const claimAll: Rect = { x: clean.x - GAP - sideW, y: by, width: sideW, height: BUTTON_HEIGHT };
  return {
    rows,
    prev,
    next,
    page: { x: MARGIN + LIST_WIDTH / 2, y: pagerY + BUTTON_HEIGHT / 2 },
    pane,
    text: { x: pane.x + PAD + 2, y: pane.y + PAD, width: inner - 4 },
    gifts: { x: pane.x + PAD, y: by - GAP - GIFT_HEIGHT, width: inner, height: GIFT_HEIGHT },
    claim,
    remove,
    claimAll,
    clean,
  };
}

/** 清單有幾頁（至少 1 頁） */
export function mailPages(count: number): number {
  return Math.max(1, Math.ceil(count / MAIL_ROWS));
}
