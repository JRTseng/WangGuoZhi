import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/**
 * 畫面要用幾倍的解析度畫（T008）。
 *
 * 遊戲的版面固定是 844 x 390，但手機螢幕一個點有 2～3 個實體像素；
 * 照 844 x 390 畫再放大，字和線條都會糊。所以畫布開成「版面 x 倍數」，鏡頭再放大同樣的倍數，
 * 版面座標完全不用改，畫出來就是手機螢幕原本的清晰度。
 *
 * 倍數跟著「遊戲畫質」設上限：低 1 倍（最省電）、中 2 倍、高 3 倍。
 */
export const RENDER_SCALE_CAP = { low: 1, medium: 2, high: 3 } as const;

export interface RenderScaleInput {
  /** window.devicePixelRatio */
  dpr: number;
  /** 視窗的寬高（CSS 像素），直拿橫拿都可以 */
  viewWidth: number;
  viewHeight: number;
  quality: keyof typeof RENDER_SCALE_CAP;
  /** 網址 ?res= 指定的倍數（測試用） */
  override?: number | null;
  /** 自動化測試（navigator.webdriver）：固定 1 倍，測試機沒有顯示卡，畫大張很慢 */
  automated?: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 取 0.5 的倍數，844 x 390 乘起來才會是整數 */
const snap = (v: number) => Math.round(v * 2) / 2;

export function renderScaleFor(i: RenderScaleInput): number {
  if (i.override != null && Number.isFinite(i.override)) return clamp(snap(i.override), 1, 4);
  if (i.automated) return 1;
  // 遊戲固定橫向：長邊當寬。畫面實際會被縮放成多大，就照那個大小的實體像素數來畫
  const long = Math.max(i.viewWidth, i.viewHeight);
  const short = Math.min(i.viewWidth, i.viewHeight);
  const fit = Math.min(long / GAME_HEIGHT, short / GAME_WIDTH);
  const wanted = (Number.isFinite(i.dpr) && i.dpr > 0 ? i.dpr : 1) * (fit > 0 ? fit : 1);
  return clamp(snap(wanted), 1, RENDER_SCALE_CAP[i.quality]);
}

/** 網址的 ?res=2 */
export function renderScaleFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get('res');
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 目前用的倍數。畫面（src/scenes/ui.ts 的 viewOf、文字、鏡頭）都讀這個值 */
export const renderScale = { value: 1 };

/** 背景烤成圖的倍數：最多 2 倍，再高很吃記憶體，背景也看不出差別 */
export function bakeScaleFor(scale: number): number {
  return clamp(scale, 1, 2);
}
