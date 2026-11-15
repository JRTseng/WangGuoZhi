/**
 * 全螢幕（T008）：手機瀏覽器的網址列很佔位置，進全螢幕後遊戲畫面可以用滿整個螢幕。
 * Android 的 Chrome 可以；iPhone 的 Safari 不支援，按鈕就不會出現（之後做成 App 才有全螢幕，見 T012）。
 * 一定要在玩家點按的當下呼叫，瀏覽器才會放行。
 */

type OrientationLock = { lock?: (o: string) => Promise<void>; unlock?: () => void };

export function fullscreenAvailable(): boolean {
  return (
    document.fullscreenEnabled === true &&
    typeof document.documentElement.requestFullscreen === 'function'
  );
}

export function isFullscreen(): boolean {
  return !!document.fullscreenElement;
}

/** 進入或離開全螢幕；進去以後試著把方向鎖成橫向（不支援就算了） */
export async function toggleFullscreen(): Promise<boolean> {
  const orientation = screen.orientation as unknown as OrientationLock | undefined;
  try {
    if (isFullscreen()) {
      orientation?.unlock?.();
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      await orientation?.lock?.('landscape').catch(() => undefined);
    }
  } catch {
    // 瀏覽器不給（例如不是點按當下）就維持原狀
  }
  return isFullscreen();
}
