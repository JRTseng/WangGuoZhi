import { ROW_MAX } from './battle';
import type { Rect } from './layout';

/**
 * 陣型面板的排版（T023）。三排畫成三直行，由左到右是「後排、中排、前排」，
 * 和戰鬥畫面我方的站法一樣（前排在右邊，面對敵人）。每一行由上而下最多 ROW_MAX 格。
 */
export interface FormationLayout {
  /** 三排各自的範圍，索引就是第幾排（0 前、1 中、2 後） */
  rows: Rect[];
  /** 每一排裡的格子：slots[row][i] */
  slots: Rect[][];
  /** 每一排標題（前排／中排／後排）的中心點 */
  labels: { x: number; y: number }[];
  reset: Rect;
  close: Rect;
}

const PAD = 16;
const GAP = 8;
const LABEL_H = 30;

/** box 是彈出框卡片的範圍 */
export function formationLayout(box: Rect): FormationLayout {
  const top = box.y + 84;
  const buttonH = 50;
  const buttonY = box.y + box.height - PAD - buttonH;
  const colH = buttonY - 12 - top;
  const colW = Math.floor((box.width - PAD * 2 - GAP * 2) / 3);
  const slotGap = 6;
  const slotH = Math.floor((colH - LABEL_H - slotGap * (ROW_MAX - 1) - 8) / ROW_MAX);
  const rows: Rect[] = [];
  const slots: Rect[][] = [];
  const labels: { x: number; y: number }[] = [];
  for (let row = 0; row < 3; row++) {
    // 前排（0）在最右邊
    const x = box.x + PAD + (2 - row) * (colW + GAP);
    rows[row] = { x, y: top, width: colW, height: colH };
    labels[row] = { x: x + colW / 2, y: top + LABEL_H / 2 };
    slots[row] = Array.from({ length: ROW_MAX }, (_, i) => ({
      x: x + 6,
      y: top + LABEL_H + i * (slotH + slotGap),
      width: colW - 12,
      height: slotH,
    }));
  }
  const bw = Math.floor((box.width - PAD * 2 - 12) / 2);
  return {
    rows,
    slots,
    labels,
    reset: { x: box.x + PAD, y: buttonY, width: bw, height: buttonH },
    close: { x: box.x + PAD + bw + 12, y: buttonY, width: bw, height: buttonH },
  };
}

/** 陣型面板卡片的大小：直式高一點，橫式受高度限制 */
export function formationPanelSize(w: number, h: number): { width: number; height: number } {
  return { width: Math.min(380, w - 32), height: Math.min(470, h - 24) };
}
