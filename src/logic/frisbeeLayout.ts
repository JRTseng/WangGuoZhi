import type { Rect } from './layout';

/**
 * 每日小遊戲「接飛盤」（T022）的排版，只做橫式（遊戲固定橫向）。
 * 場地：狗狗在地面左右跑，飛盤在上面飛；開始前的視窗左邊選狗、右邊看獎勵與「開始」。
 */
export interface FrisbeeLayout {
  /** 狗狗能跑的範圍（x、width）與飛盤飛的高度範圍（y 是最高點、y + height 是接的高度） */
  field: Rect;
  /** 狗狗腳底的高度 */
  groundY: number;
  dogScale: number;
  /** 上方的計分：文字位置（左上角）與一排小飛盤圖示的起點、間距 */
  score: { x: number; y: number };
  marks: { x: number; y: number; gap: number };
  /** 開始前的視窗 */
  panel: Rect;
  /** 視窗左邊的選狗格子 */
  cells: Rect[];
  /** 視窗右邊：狗狗站的位置、文字的中線與「開始」按鈕 */
  preview: { x: number; y: number; scale: number };
  paneX: number;
  start: Rect;
}

export const FRISBEE_PICK_COLUMNS = 10;
const MARGIN = 16;
const PANE_WIDTH = 270;

export function frisbeeLayout(w: number, h: number, count: number, top = 56): FrisbeeLayout {
  const groundY = h - 30;
  const dogScale = 0.55;
  const catchY = groundY - 62;
  const field: Rect = { x: 48, y: top + 34, width: w - 96, height: catchY - (top + 34) };

  const panel: Rect = { x: MARGIN, y: top + 10, width: w - MARGIN * 2, height: h - top - 20 };
  const gridWidth = panel.width - PANE_WIDTH - 28;
  const gridTop = panel.y + 62;
  const rows = Math.max(1, Math.ceil(Math.max(0, count) / FRISBEE_PICK_COLUMNS));
  const cell = Math.min(
    Math.floor(gridWidth / FRISBEE_PICK_COLUMNS),
    Math.floor((panel.y + panel.height - 10 - gridTop) / rows),
  );
  const cells: Rect[] = Array.from({ length: Math.max(0, count) }, (_, i) => ({
    x: panel.x + 14 + (i % FRISBEE_PICK_COLUMNS) * cell,
    y: gridTop + Math.floor(i / FRISBEE_PICK_COLUMNS) * cell,
    width: cell,
    height: cell,
  }));
  const paneLeft = panel.x + panel.width - PANE_WIDTH - 10;
  const paneX = paneLeft + PANE_WIDTH / 2;
  return {
    field,
    groundY,
    dogScale,
    score: { x: MARGIN, y: top + 8 },
    marks: { x: 132, y: top + 19, gap: 24 },
    panel,
    cells,
    preview: { x: paneX, y: panel.y + 150, scale: 0.72 },
    paneX,
    start: { x: paneLeft + 20, y: panel.y + panel.height - 58, width: PANE_WIDTH - 40, height: 46 },
  };
}

/** 場地寬度的比例（0～1）換成畫面 x */
export function fieldX(l: FrisbeeLayout, frac: number): number {
  return l.field.x + frac * l.field.width;
}

/** 畫面 x 換成場地寬度的比例（超出場地就貼邊） */
export function fieldFrac(l: FrisbeeLayout, x: number): number {
  return Math.min(1, Math.max(0, (x - l.field.x) / l.field.width));
}

/** 高度的比例（0 是接的高度、1 是最高）換成畫面 y */
export function fieldY(l: FrisbeeLayout, frac: number): number {
  return l.field.y + l.field.height * (1 - frac);
}
