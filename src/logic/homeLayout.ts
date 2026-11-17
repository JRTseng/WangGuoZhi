import type { HomeSpot } from './home';
import type { Rect } from './layout';

/** 我的家（T033）的版面，純計算。固定橫式 844 x 390。 */
export const HOME_BAR = 56;

export interface HomeLayout {
  /** 牆腳／地平線的 y */
  horizon: number;
  /** 角色走動、家具擺放的範圍（腳踩的位置） */
  field: Rect;
  /** 標題列右邊的按鈕 */
  buttons: { style: Rect; furniture: Rect; residents: Rect; area: Rect };
}

export function homeLayout(w: number, h: number): HomeLayout {
  const horizon = HOME_BAR + 130;
  const bw = 72;
  const gap = 6;
  const by = 8;
  const bh = HOME_BAR - 16;
  const areaW = 92;
  const right = w - 8;
  const area: Rect = { x: right - areaW, y: by, width: areaW, height: bh };
  const at = (i: number): Rect => ({
    x: area.x - (i + 1) * (bw + gap),
    y: by,
    width: bw,
    height: bh,
  });
  return {
    horizon,
    field: { x: 64, y: horizon + 22, width: w - 128, height: h - 12 - (horizon + 22) },
    buttons: { area, residents: at(0), furniture: at(1), style: at(2) },
  };
}

/** 場地上的位置（0～1）換成畫面座標 */
export function xyOf(l: HomeLayout, spot: HomeSpot): { x: number; y: number } {
  return {
    x: Math.round(l.field.x + spot.x * l.field.width),
    y: Math.round(l.field.y + spot.y * l.field.height),
  };
}

/** 畫面座標換成場地上的位置（超出範圍就貼邊） */
export function spotOf(l: HomeLayout, x: number, y: number): HomeSpot {
  const c = (n: number): number => Math.min(1, Math.max(0, n));
  return { x: c((x - l.field.x) / l.field.width), y: c((y - l.field.y) / l.field.height) };
}

/** 彈出視窗裡的格子：標題下面、說明上面，cols x rows 排滿 */
export function homeModalGrid(box: Rect, cols: number, rows: number): Rect[] {
  const pad = 16;
  const top = box.y + 44;
  const bottom = box.y + box.height - 50;
  const gap = 6;
  const cw = (box.width - pad * 2 - gap * (cols - 1)) / cols;
  const ch = (bottom - top - gap * (rows - 1)) / rows;
  return Array.from({ length: cols * rows }, (_, i) => ({
    x: box.x + pad + (i % cols) * (cw + gap),
    y: top + Math.floor(i / cols) * (ch + gap),
    width: cw,
    height: ch,
  }));
}
