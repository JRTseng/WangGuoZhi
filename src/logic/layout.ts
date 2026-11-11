export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ListLayoutOptions {
  /** 區域左上角與寬高 */
  area: Rect;
  /** 卡片間距 */
  gap: number;
  /** 卡片高度上限 */
  maxCardHeight: number;
}

/**
 * 直式清單排版：count 張卡片由上往下排，寬度填滿區域，
 * 高度取「上限」與「平分區域」較小者，保證不超出區域。
 */
export function layoutList(count: number, opts: ListLayoutOptions): Rect[] {
  if (count <= 0) return [];
  const { area, gap, maxCardHeight } = opts;
  const fit = (area.height - gap * (count - 1)) / count;
  const h = Math.max(0, Math.min(maxCardHeight, fit));
  return Array.from({ length: count }, (_, i) => ({
    x: area.x,
    y: area.y + i * (h + gap),
    width: area.width,
    height: h,
  }));
}

/** 兩個矩形是否重疊（邊緣相接不算） */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** inner 是否完全在 outer 內 */
export function rectInside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export interface GridLayoutOptions {
  area: Rect;
  columns: number;
  gap: number;
  /** 格子高度上限 */
  maxCellHeight: number;
}

/** 格狀排版：由左到右、由上到下；高度取上限與平分區域較小者，保證不超出區域 */
export function layoutGrid(count: number, opts: GridLayoutOptions): Rect[] {
  if (count <= 0) return [];
  const { area, gap, maxCellHeight } = opts;
  const cols = Math.max(1, Math.floor(opts.columns));
  const rows = Math.ceil(count / cols);
  const w = Math.floor((area.width - gap * (cols - 1)) / cols);
  const h = Math.max(
    0,
    Math.floor(Math.min(maxCellHeight, (area.height - gap * (rows - 1)) / rows)),
  );
  return Array.from({ length: count }, (_, i) => ({
    x: area.x + (i % cols) * (w + gap),
    y: area.y + Math.floor(i / cols) * (h + gap),
    width: w,
    height: h,
  }));
}

export interface Point {
  x: number;
  y: number;
}

/**
 * 出征地圖的關卡節點位置（中心點），走一條彎曲的路。
 * - 直式：由下往上（拇指先碰到第 1 關），左右交錯
 * - 橫式：由左往右，上下交錯
 * 第一個與最後一個節點放在中線上。
 */
export function layoutPath(count: number, area: Rect, landscape: boolean): Point[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const edge = i === 0 || i === count - 1;
    const swing = edge ? 0 : i % 2 === 1 ? -1 : 1;
    if (landscape) {
      return {
        x: area.x + area.width * t,
        y: area.y + area.height / 2 + swing * area.height * 0.3,
      };
    }
    return {
      x: area.x + area.width / 2 + swing * area.width * 0.3,
      y: area.y + area.height * (1 - t),
    };
  });
}
