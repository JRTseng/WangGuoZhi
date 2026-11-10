/** 一般模式下 1 分鐘的毫秒數 */
export const MINUTE_MS = 60_000;
/** 測試模式（網址加 ?fast=1）下「1 分鐘」只算 1 秒，讓 Playwright 能完整走過一次出征 */
export const FAST_MINUTE_MS = 1_000;

/** 依網址參數決定「遊戲中的 1 分鐘」是幾毫秒 */
export function minuteMsFromSearch(search: string): number {
  const fast = new URLSearchParams(search).get('fast');
  return fast === '1' || fast === 'true' ? FAST_MINUTE_MS : MINUTE_MS;
}
