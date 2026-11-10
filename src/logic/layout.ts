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
