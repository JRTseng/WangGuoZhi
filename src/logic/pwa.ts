/**
 * 手機 App 化（T012）：把網頁做成可以「加到主畫面」的 PWA。
 * 這裡只放不碰瀏覽器的判斷與字串產生：要不要啟用離線快取、設定面板要顯示哪種安裝按鈕、
 * 離線快取用的 service worker 程式碼（建置時由 vite.config.ts 寫成 dist/sw.js）。
 */

/** 快取名稱的開頭；換版時只清自己這個開頭的舊快取 */
export const CACHE_PREFIX = 'wgz-';

/** 開網頁時先問網路，超過這麼久沒回應就先用上次存的版本（毫秒） */
export const PAGE_TIMEOUT_MS = 4000;

export function cacheNameFor(version: string): string {
  const v = version.trim().replace(/[^0-9A-Za-z.+_-]/g, '');
  return `${CACHE_PREFIX}${v || 'dev'}`;
}

/**
 * 要不要註冊 service worker（離線快取）。
 * - 只在正式建置啟用（開發伺服器不要快取，改了程式才看得到）
 * - 要 https 或 localhost，瀏覽器才允許
 * - 自動化測試（navigator.webdriver）預設不啟用，免得每個測試都先下載一輪；網址加 ?sw=1 可強制打開
 * - 網址加 ?sw=0 可以關掉（出問題時救急用）
 */
export function shouldRegisterServiceWorker(o: {
  prod: boolean;
  supported: boolean;
  secure: boolean;
  webdriver: boolean;
  search: string;
}): boolean {
  if (!o.prod || !o.supported || !o.secure) return false;
  const flag = new URLSearchParams(o.search).get('sw');
  if (flag === '0') return false;
  if (flag === '1') return true;
  return !o.webdriver;
}

/** 是不是 iPhone／iPad（iPad 會假裝成 Mac，要看有沒有觸控） */
export function isIos(userAgent: string, platform = '', maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  return platform === 'MacIntel' && maxTouchPoints > 1;
}

/**
 * 設定面板的「加到主畫面」要怎麼顯示：
 * - installed：已經是從主畫面開的，不用顯示
 * - prompt：瀏覽器可以直接跳出安裝視窗（Android 的 Chrome）
 * - ios：iPhone 沒有安裝視窗，只能教玩家按「分享 → 加入主畫面」
 * - none：這個瀏覽器不支援，不顯示
 */
export type InstallMode = 'installed' | 'prompt' | 'ios' | 'none';

export function installModeFor(o: {
  standalone: boolean;
  canPrompt: boolean;
  ios: boolean;
}): InstallMode {
  if (o.standalone) return 'installed';
  if (o.canPrompt) return 'prompt';
  if (o.ios) return 'ios';
  return 'none';
}

export const IOS_INSTALL_HINT = '請按瀏覽器的「分享」按鈕，\n再選「加入主畫面」。';
export const INSTALL_DONE_TEXT = '已加到主畫面，\n之後從主畫面的圖示開就是全螢幕。';
export const INSTALL_CANCEL_TEXT = '還沒加到主畫面，\n想加的時候再按一次。';

/**
 * 從建置輸出的檔案清單挑出要事先存起來的檔案（離線也要能開的那些）。
 * 路徑一律相對於網站根目錄；首頁用 './' 代表，sw.js 自己與 source map 不存。
 */
export function precacheList(files: readonly string[]): string[] {
  const out = new Set<string>(['./']);
  for (const raw of files) {
    const f = raw.replace(/\\/g, '/').replace(/^\.?\//, '');
    if (!f || f === 'index.html' || f === 'sw.js') continue;
    if (f.endsWith('.map') || f.startsWith('.')) continue;
    out.add(f);
  }
  return [...out].sort((a, b) => (a === './' ? -1 : b === './' ? 1 : a < b ? -1 : a > b ? 1 : 0));
}

/**
 * 產生 service worker 的程式碼。做法：
 * - 安裝時把整個遊戲（首頁、程式、圖示）存起來，之後沒網路也能開
 * - 開網頁時先問網路拿最新的首頁（有新版馬上看得到），沒網路或太慢才用存起來的
 * - 其他檔案（檔名帶內容雜湊，內容不會變）先用存起來的，沒有才上網抓
 * - 換版後清掉舊版的快取
 * 只處理同一個網站、遊戲資料夾底下的 GET；其他請求原樣放行。
 */
export function serviceWorkerSource(o: { version: string; files: readonly string[] }): string {
  const cache = cacheNameFor(o.version);
  const files = precacheList(o.files);
  return `// 汪國志離線快取（T012）。這個檔案是建置時自動產生的，請改 src/logic/pwa.ts。
const CACHE = ${JSON.stringify(cache)};
const PREFIX = ${JSON.stringify(CACHE_PREFIX)};
const FILES = ${JSON.stringify(files)};
const PAGE_TIMEOUT_MS = ${PAGE_TIMEOUT_MS};
const SCOPE = new URL('./', self.location.href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await Promise.race([
      fetch(request.url, { cache: 'no-cache' }),
      timeout(PAGE_TIMEOUT_MS),
    ]);
    if (fresh.ok) return fresh;
    return (await cache.match('./', { ignoreVary: true })) || fresh;
  } catch (err) {
    const saved = await cache.match('./', { ignoreVary: true });
    if (saved) return saved;
    throw err;
  }
}

async function asset(request) {
  const cache = await caches.open(CACHE);
  // 伺服器回的 Vary 標頭不管它：同一個網址就是同一個檔案
  const saved = await cache.match(request, { ignoreVary: true });
  if (saved) return saved;
  const fresh = await fetch(request);
  if (fresh.ok && fresh.type === 'basic') cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  event.respondWith(request.mode === 'navigate' ? page(request) : asset(request));
});
`;
}
