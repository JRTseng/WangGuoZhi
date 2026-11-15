/**
 * 加到主畫面（T012）：註冊離線快取，並記住瀏覽器給的「可以安裝」通知，讓設定面板的按鈕用。
 * 判斷規則在 src/logic/pwa.ts，這裡只負責跟瀏覽器打交道。
 */
import {
  installModeFor,
  isIos,
  shouldRegisterServiceWorker,
  type InstallMode,
} from '../../logic/pwa';

/** Android Chrome 的安裝通知（還不是標準，TypeScript 沒有內建型別） */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let promptEvent: InstallPromptEvent | null = null;
let installedNow = false;

/** 遊戲一開就呼叫一次：註冊離線快取、開始聽安裝通知 */
export function initPwa(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    // 不要讓瀏覽器自己跳橫幅，改由設定面板的按鈕觸發
    e.preventDefault();
    promptEvent = e as InstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    promptEvent = null;
    installedNow = true;
  });

  const register = shouldRegisterServiceWorker({
    prod: import.meta.env.PROD,
    supported: 'serviceWorker' in navigator,
    secure: window.isSecureContext,
    webdriver: navigator.webdriver === true,
    search: window.location.search,
  });
  if (!register) return;
  // 等畫面載完再註冊，不跟遊戲搶開場的時間
  const go = () => void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

/** 是不是從主畫面的圖示開的（瀏覽器自己的全螢幕不算） */
export function isStandalone(): boolean {
  const media = (q: string) => window.matchMedia?.(`(display-mode: ${q})`).matches === true;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    iosStandalone || media('standalone') || (media('fullscreen') && !document.fullscreenElement)
  );
}

export function installMode(): InstallMode {
  return installModeFor({
    standalone: installedNow || isStandalone(),
    canPrompt: promptEvent !== null,
    ios: isIos(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
  });
}

/** 跳出瀏覽器的安裝視窗；回傳玩家有沒有按安裝。一定要在點按的當下呼叫 */
export async function promptInstall(): Promise<boolean> {
  const e = promptEvent;
  if (!e) return false;
  // 同一個通知只能用一次
  promptEvent = null;
  try {
    await e.prompt();
    const choice = await e.userChoice;
    if (choice.outcome === 'accepted') installedNow = true;
    return choice.outcome === 'accepted';
  } catch {
    return false;
  }
}
