/** 資源數字加千分位，例：12000 → '12,000' */
export function formatAmount(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

/** 倒數顯示：未滿 1 小時為 mm:ss，否則 h:mm:ss。不足 1 秒進位，避免還沒到就顯示 00:00。 */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
