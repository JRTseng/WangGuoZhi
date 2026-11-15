# T012 手機 App 化（PWA）

## 目標
把網頁版做成可以「加到主畫面」的 App：主畫面有自己的圖示，點開是全螢幕、沒有網址列，開過一次以後沒有網路也能開。
這是上架前的第一步；打包成 iOS／Android 安裝檔（Capacitor）只先評估，不動工。

## 範圍
做：
- App 資訊檔（`public/manifest.webmanifest`）：名稱、圖示、全螢幕、固定橫向、底色
- 原創圖示（`public/icons/`）：192、512、Android 會裁切用的 512、iPhone 用的 180，原始檔 `icon.svg`
- iPhone 需要的網頁標籤（加到主畫面後全螢幕、圖示、名稱）
- 離線快取（service worker）：安裝時把整個遊戲存起來，沒網路也能開；有網路時一律拿最新版
- 設定面板「加到主畫面」按鈕：Android 的 Chrome 直接跳安裝視窗；iPhone 顯示怎麼加的說明；已經從主畫面開的不顯示
- Capacitor 打包評估（寫在本檔最後）

不做：
- 不加任何新套件（Capacitor、vite-plugin-pwa 都要 Jimmy 先確認）
- 不做推播通知、背景同步
- 不做存檔搬家（匯出／匯入）、雲端存檔
- 不做「有新版本」的提示視窗（目前每次開都會拿最新版，不需要）
- 不上架商店

## 驗收標準
- [x] 網頁有 App 資訊檔，內容是全螢幕、橫向，圖示有 192、512 與可裁切版本，圖示都抓得到（`tests/e2e/pwa.spec.ts`）
- [x] 開過一次以後斷網重新整理，遊戲照樣進主頁、能換畫面（`tests/e2e/pwa.spec.ts`）
- [x] 有網路時開網頁拿到的是最新的首頁；沒網路或超過 4 秒沒回應才用存起來的（`src/logic/pwa.test.ts`）
- [x] 換版後舊版的快取會清掉，別的快取不動（`src/logic/pwa.test.ts`）
- [x] iPhone 的設定面板有「加到主畫面」，按了顯示說明；不能安裝的瀏覽器沒有這顆（`tests/e2e/pwa.spec.ts`）
- [x] 所有新增邏輯有單元測試，`npm test` 全綠
- [x] 相關畫面有 Playwright 截圖，附在 PR
- [ ] 待 Jimmy 手機實測：iPhone 與 Android 實際加到主畫面、從圖示開是全螢幕橫向、開飛航模式還能開

## 設計說明
- 沒有用套件，service worker 是自己寫的。程式碼由 `src/logic/pwa.ts` 的 `serviceWorkerSource()` 產生成字串，
  建置完由 `vite.config.ts` 的小外掛列出 `dist` 的檔案、寫成 `dist/sw.js`。單元測試用假的瀏覽器環境把這段程式真的跑一遍。
- 快取策略：
  - 開網頁（首頁）：先問網路、而且不用瀏覽器自己的舊快取，所以有新版馬上看得到，不會被卡在舊版；沒網路或 4 秒沒回應才用存起來的首頁。
  - 其他檔案（程式、圖示）：檔名帶內容雜湊、內容不會變，先用存起來的。
  - 快取名稱帶版本號（`wgz-v0.1.0+abc1234`），新版裝好後清掉舊的。每一份快取裡的首頁和程式一定是同一版，不會混到。
- 註冊規則（`shouldRegisterServiceWorker`）：只有正式建置、https 才啟用；自動化測試預設不啟用，網址加 `?sw=1` 才開；
  萬一離線快取出問題，網址加 `?sw=0` 可以不啟用。
- 「加到主畫面」按鈕和「全螢幕」共用設定面板右欄同一列，兩顆都有就各佔一半。瀏覽器相關的程式在 `src/scenes/components/install.ts`。
- 圖示是自己畫的狗臉（綁紅頭帶），原始檔 `public/icons/icon.svg`，改了以後跑 `node scripts/make-icons.mjs` 重新產生各尺寸。
- 網頁的 `theme-color` 從米色改成和畫面外框一樣的深咖啡色，全螢幕時上下的邊不會有色差。
- `tsconfig.json` 加了 `allowImportingTsExtensions`：`vite.config.ts` 要引用 `src/logic/pwa.ts`，Vite 要求寫出副檔名。

## 已知限制
- iPhone：從主畫面開的 App 和 Safari 的存檔是分開的，加到主畫面後會是一份新的進度（Android 的 Chrome 是共用的）。
- iPhone 不理會「固定橫向」的設定，直拿還是會看到「請把手機橫放」。
- iPhone 沒有安裝視窗，只能自己按「分享 → 加入主畫面」。
- 第一次開一定要有網路；裝好離線快取大約要再下載一次遊戲（約 1.6 MB）。

## Capacitor 打包評估（先不做）
- 做法：加 `@capacitor/core`、`@capacitor/cli`、`@capacitor/ios`、`@capacitor/android`，把 `dist` 包成原生 App 的外殼。遊戲程式不用改。
- 好處：可以上 App Store／Google Play；iPhone 也能真的固定橫向、全螢幕；之後要推播、內購才有地方接。
- 代價：iOS 要 Mac＋Xcode 與 Apple 開發者帳號（一年 99 美元）；Android 要 Android Studio 與 Google Play 帳號（一次 25 美元）；
  打包與送審都要在自己的電腦上做，雲端夜間流程做不了，CI 也要另外設定。
- 建議：先用 PWA 在手機上玩一陣子、把 T009 的實測問題修完，確定要上架再做。Android 先（門檻低），iOS 後。

## 禁止事項
- 不引入未在 README 技術選型內的套件，除非在報告中說明理由並等待確認
- 不修改其他任務範圍內的檔案，除非為了讓本任務能運作

## 需要 Jimmy 決定的事
- A. 圖示（綁紅頭帶的狗臉）喜不喜歡，要不要換成某一隻主角狗
- B. iPhone 加到主畫面後存檔是新的一份：要不要做「存檔匯出／匯入」讓進度搬過去
- C. 要不要往 Capacitor 打包走（需要新增套件與開發者帳號），還是先停在 PWA
