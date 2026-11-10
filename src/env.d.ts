/// <reference types="vite/client" />

/** build 時由 vite.config.ts 注入 */
declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;

interface Window {
  /** 給 Playwright 判斷遊戲狀態用，不影響遊戲邏輯 */
  __WGZ__?: { scene: string; version: string };
}
