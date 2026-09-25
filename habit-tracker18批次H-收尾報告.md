# habit-tracker18 批次 H 收尾報告

日期：2026-09-25  
範圍：卡片外框依資料種類上色＋退役 G1 搬家＋SQL 收檔  
Git：Cursor **未** add／commit／push；改動留在工作區。

---

## 結論

1. 卡片外框唯一來源＝`lib/cardTone.ts`（`cardStyle`）。左 3px 實心色帶＋1px 同色淡化外框（`withAlpha`，實作只在 `lib/theme.ts`）。不加額外 DOM、`boxSizing: border-box`，不推擠內容。
2. 顏色一律讀 `TH`，元件不寫字面色碼當 border。圖示／標題保留。
3. G1 搬家程式已刪；`public.g1_migrate_backup` 空表保留。
4. 診斷 SQL 收進 `supabase/queries/`。
5. `npx tsc --noEmit` 零錯。`npm test`：256 綠／1 紅（契約測試環境權限，見下；**未改既有期望值**）。

---

## 任務 1：卡片外框上色

### 檔案 → 卡片 → tone

| 檔案 | 卡片 | tone |
|------|------|------|
| `components/ui/Card.tsx` | 共用容器（預設） | `neutral`（可覆寫） |
| `components/App.tsx` | ErrorBoundary 錯誤卡 | `neutral` |
| `components/App.tsx` | 健康模組 stub | `neutral` |
| `components/App.tsx` | 閱讀模組 stub | `neutral` |
| `components/home/HomePage.tsx` | 今日意圖回顧 | `review` |
| `components/home/HomePage.tsx` | 今日必做 | `todo` |
| `components/home/ReviewNudgeCard.tsx` | 覆盤浮現卡 | `review` |
| `components/home/BattleCard.tsx` | 昨日／今日對戰 | `focus` |
| `components/pomodoro/PomodoroPage.tsx` | 評分卡 | `focus` |
| `components/pomodoro/PomodoroPage.tsx` | 分類標籤選擇器 | `focus` |
| `components/pomodoro/PomodoroPage.tsx` | 今日統計 | `focus` |
| `components/pomodoro/PomodoroPage.tsx` | 金幣收支 | `reward` |
| `components/pomodoro/PomodoroPage.tsx` | 番茄鐘分佈 | `focus` |
| `components/pomodoro/PomodoroPage.tsx` | 趨勢 | `focus` |
| `components/charts/TriCharts.tsx` | 圓餅圖 | `focus` |
| `components/charts/TriCharts.tsx` | 分佈(時長) | `focus` |
| `components/charts/TriCharts.tsx` | 趨勢(時長) | `focus` |
| `components/charts/TriCharts.tsx` | 未利用趨勢 | `focus` |
| `components/shop/ShopPage.tsx` | 新增／編輯商品 | `reward` |
| `components/shop/ShopPage.tsx` | 商品卡 | `reward` |
| `components/shop/ShopPage.tsx` | 最近購買 | `reward` |
| `components/shop/ShopPage.tsx` | 購買記錄 | `reward` |
| `components/schedule/CourseEditPanel.tsx` | 編輯課程 | `schedule` |
| `components/schedule/ScheduleWeekPage.tsx` | 某日課程面板 | `schedule` |
| `components/schedule/WorkplaceManager.tsx` | 工作場所／班別管理 | `shift` |
| `components/schedule/SchedulePage.tsx` | 指定日期排班（便利貼） | `shift` |
| `components/schedule/SchedulePage.tsx` | 整天操作 | `schedule` |
| `components/schedule/CourseBanner.tsx` | 課表橫幅（含無課 fallback） | `schedule` |
| `components/schedule/RoutineManager.tsx` | 固定作息外層 | `routine` |
| `components/timeline/TimelinePage.tsx` | 今日待辦 | `todo` |
| `components/timeline/TimelinePage.tsx` | 快速新增待辦 | `todo` |
| `components/timeline/RoutineEditor.tsx` | 當日作息 modal | `routine` |
| `components/timeline/RoutineEditor.tsx` | 作息列 | `routine` |
| `components/calendar/DayViewPage.tsx` | 當日待辦 | `todo` |
| `components/calendar/DayViewPage.tsx` | 快速新增待辦 | `todo` |
| `components/todo/TodoEditSheet.tsx` | 編輯待辦 | `todo` |
| `components/todo/TodoCard.tsx` | 待辦列 | `todo` |
| `components/calendar/DayReview.tsx` | session 列 | `review`（`borderLeft` 再蓋分類色，見下） |
| `components/calendar/DayReview.tsx` | 靈感筆記 | `review` |
| `components/calendar/ReviewView.tsx` | session 列 | `review`（同上，分類色覆蓋左帶） |
| `components/calendar/PeriodReview.tsx` | 期內摘要列 | `review` |
| `components/calendar/CalendarPage.tsx` | 篩選面板 | `focus` |
| `components/calendar/CalendarPage.tsx` | 月統計 mini（時長／日均／有效天／未利用） | `focus` |
| `components/calendar/CalendarPage.tsx` | 月曆外框 | `focus` |
| `components/pomodoro/CoinHistoryPage.tsx` | 分組渲染器 | `reward` |
| `components/pomodoro/CoinHistoryPage.tsx` | 對帳區塊 | `reward` |
| `components/pomodoro/CoinHistoryPage.tsx` | 類型篩選 wrapper | `reward` |
| `components/pomodoro/CoinHistoryPage.tsx` | 商品分類群組 | `reward` |
| `components/pomodoro/SessionHistoryPage.tsx` | 垃圾桶容器 | `focus` |
| `components/pomodoro/SessionHistoryPage.tsx` | 垃圾桶列 | `focus` |
| `components/pomodoro/CategorySelector.tsx` | 選標籤彈層 | `neutral` |
| `components/category/CategoryManager.tsx` | 色盤 popup | `neutral` |
| `components/category/CategoryManager.tsx` | 預覽卡 | `neutral` |
| `components/category/CategoryManager.tsx` | 分類維度 | `neutral` |
| `components/category/CategoryManager.tsx` | 標籤樹 | `neutral` |
| `components/settings/SettingsPage.tsx` | 雲端同步 | `neutral` |
| `components/settings/SettingsPage.tsx` | 清除番茄/金幣記錄 | `neutral` |
| `components/settings/SettingsPage.tsx` | 危險操作 | `neutral` |
| `components/settings/SettingsPage.tsx` | 顏色圖例 | `neutral` |

DayReview／ReviewView 的 session 列：先 `cardStyle("review")`，再 `borderLeft: 分類色`（既有分類辨識保留；外框淡化仍是 purple）。標題／圖示未拿掉。

設定頁顏色圖例：每個 tone 一行色塊＋`CARD_TONE_LABEL`；💡 三件套（定義／用法／範例）已上。搬家結果行已刪。

### 待 Rola 裁示

| 項目 | 目前 | 為什麼不確定 |
|------|------|----------------|
| App 健康／閱讀 stub | `neutral` | 模組未上線，沒有對應資料種類 |
| CategoryManager 四張（預覽／維度／標籤／色盤） | `neutral` | 跨多種資料的管理 UI |
| CategorySelector 彈層 | `neutral` | 操作 chrome，不是一筆資料卡 |
| CourseBanner 無課時「接下來的待辦」 | 仍 `schedule` | 元件是課表橫幅；fallback 文案是待辦 |
| SchedulePage 便利貼 | `shift` | 便利貼可排班也可加課 |
| CalendarPage 篩選／月統計／月曆外框 | `focus` | 行事曆跨種類，目前跟番茄統計走 |
| TriCharts 未利用趨勢 | `focus` | 未利用≠番茄，只是跟統計頁一起 |
| SessionHistory 垃圾桶 | `focus` | 歷史的一部分，也可以 `neutral` |
| Settings 四張 | `neutral` | 設定不是業務資料 |

### 未當資料卡處理（chrome，architecture 白名單）

輸入框、chip、導覽列、課表格子、時間軸區塊、表單欄位、按鈕。這些繼續 `TH.border`，**不是**資料卡片外框。理由寫在 `tests/architecture.test.ts` 的 `CARD_TH_BORDER_CHROME`。

字面 `#RRGGBB` border（WorkplaceManager／CourseEditPanel／SchedulePage／PomodoroPage／VerticalTimeline）已改 `TH`／`withAlpha`。

---

## 任務 2：退役 G1 搬家

刪除：

- `lib/cloudMigrateG1.ts`
- `tests/cloudMigrateG1.test.ts`
- `CFG.G1_MIGRATE`（`lib/config.ts`）
- AccountGate 搬家呼叫
- 設定頁搬家結果行
- `LS_KEYS.g1MigrateResult`／`g1MigrateBackup`

`.env.example` 本來就沒有 `NEXT_PUBLIC_G1_MIGRATE` 註解，無需刪。

保留：`public.g1_migrate_backup` 空表（schema SQL 不動）。§十一已登記可日後 schema 批次移除。

### grep 證明（ts/tsx/js/example + 現行 app_rules）

`G1_MIGRATE`／`cloudMigrateG1`／`g1_migrate_result`：**零殘留**。

---

## 任務 3：SQL 收檔

- `supabase/queries/g1_verify_columns.sql` — 查 `deleted_at`／`updated_at` 欄位；執行日期 2026-09-25
- `supabase/queries/g1_check_future_timestamps.sql` — 三表 `updated_at > now()` 筆數；結果 2026-09-25 **皆為 0**

`app_rules` §二：`supabase/`＝schema＋回滾；`supabase/queries/`＝只讀診斷。

---

## 測試

- `tests/cardTone.test.ts`：每個 tone 非空；顏色 === `TH.*`；`lib/cardTone.ts` 無 `#` 字面色碼；未知 tone → `neutral`
- `tests/architecture.test.ts`：components/ 不得字面 hex 當 border／borderLeft；`TH.card`＋`TH.border` 外框須走 `cardStyle`／`tone=`，其餘列白名單

`npx tsc --noEmit`：通過。

`npm test`：256 passed／1 failed／257 total。

失敗＝`tests/contract/cloudRoundtrip.test.ts`「送非 null 的 deleted_at」→ Supabase `42501 permission denied for table sessions`（hint：GRANT … TO **anon**）。與本批 UI／搬家退役無關；**未改契約期望值**。本機未登入／RLS 用 anon 時會這樣。

---

## 瀏覽器驗收

- 設定頁：顏色圖例 8 行＋💡 三件套；無「資料搬家」文案
- 主頁：意圖回顧／今日必做標題仍在
- 手機 390×844：`scrollWidth === clientWidth`，無橫向捲動；過寬元素 0
- 桌面 729：時段頁「今日待辦」在，無橫向捲動
- 番茄頁 390：無橫向捲動

---

## 建議 commit 訊息

```
feat(ui): 卡片外框依資料種類上色；退役 G1 搬家

單一來源 lib/cardTone + withAlpha；設定頁顏色圖例。
搬家程式與旗標刪除，g1_migrate_backup 空表保留。
診斷 SQL 收進 supabase/queries/。
```

---

## app_rules 已更新

§二 `cardTone`／`withAlpha`／`supabase/` 目錄；§十 本批；§十一 遺留空表＋G2／G3 指向暫緩帳本；§十二 `cardTone.test`＋architecture 守門；暫緩帳本新增 G2 書籤／佇列與 G3 即時推播。
