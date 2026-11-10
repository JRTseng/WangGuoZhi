# 汪國志（暫定名）

原創的三國題材狗狗收集養成遊戲。網頁優先，手機可玩，開源開發。

## 專案定位
- 個人開源作品，驗證「一人 + AI 夜間自動開發」的流程。
- 所有角色、名稱、美術、文案皆為原創，不借用任何既有遊戲的設定或梗。
- 程式碼採 MIT 授權；美術與文案另以 CC BY 4.0 授權（見 `LICENSE` 與 `docs/LICENSE-ASSETS.md`）。

## 技術選型
| 項目 | 選擇 | 理由 |
|---|---|---|
| 引擎 | Phaser 3 + TypeScript | 網頁原生、手機瀏覽器可直接玩、AI 工具對它的熟悉度高 |
| 建置 | Vite | 快速、設定少 |
| 測試 | Vitest（邏輯）+ Playwright（畫面截圖） | 夜間自動驗收用 |
| 存檔 | localStorage（第一階段） | 不需後端 |
| 部署 | GitHub Pages | PR 預覽與正式版都能用手機開連結 |

## 目錄結構
```
├─ README.md
├─ BACKLOG.md              # 待辦清單，夜間流程只做這裡的事
├─ docs/
│  ├─ GDD.md               # 遊戲設計一頁書
│  ├─ NIGHTLY_PROMPT.md    # 每晚給 AI 的執行指令
│  ├─ REPORT_TEMPLATE.md   # 早上報告格式
│  ├─ LICENSE-ASSETS.md
│  └─ specs/
│     ├─ TEMPLATE.md       # 任務規格範本
│     ├─ T001-專案骨架.md
│     ├─ T002-主畫面與角色列表.md
│     └─ T003-派遣出征循環.md
└─ src/                    # 由夜間流程建立
```

## 工作方式
1. 白天：Jimmy 在手機上看前一晚的 PR 與可玩連結，回覆決定，必要時往 `BACKLOG.md` 加任務。
2. 晚上：排程任務啟動，依 `docs/NIGHTLY_PROMPT.md` 執行 `BACKLOG.md` 最上面的任務，開 PR，寫報告。
3. 不自動合併。所有變更經 PR 進入主線。

## 分隔原則
本 repo 不放任何雇主或客戶相關的程式碼、工具、資料。通用工具若要共用，另建個人工具庫並以公開授權釋出。
