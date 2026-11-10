/** 資源數字加千分位，例：12000 → '12,000' */
export function formatAmount(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}
