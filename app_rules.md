# FlowLife 習慣追蹤 APP — 專案規則手冊 v2.1

> **版本**：v2.1（2026-05-12）
> **環境**：Next.js 16 App Router + TypeScript
> **部署**：Vercel · `https://flowlife-iota.vercel.app`
> **GitHub**：`https://github.com/Rola1017/flowlife`
> **localStorage 前綴**：`flowlife_v1_`

---

## ★ 核心開發原則（所有改動必須遵守）

> **所有程式碼必須符合：方便維護、管理、編輯、升級，讓迭代順利進行。**

具體要求：
1. **未來性**：每個功能都要考慮「三個月後改起來方便嗎？」
2. **一致性**：相關聯動的地方必須同步更改（例如改了時間格式，所有顯示時間的元件都要一起改）
3. **單一來源**：顏色從 `lib/theme.ts`、分類從 `lib/categories.ts`、設定從 `lib/config.ts`，不要在元件裡 hardcode
4. **改動範圍確認**：每次修改前，先告訴我「這個改動會影響哪些檔案」，確認後再動手

### 紀律備忘

- **【資料關聯地圖優先】**：動功能前先列出該資料被誰讀/寫/衍生，同一批改齊所有連動面，完成定義＝無任何一面漂移（日後併入對話與交接紀律 §8）。
- **【副作用禁止置於 setState updater 內】**：`setState(updater)` 在 React 嚴格模式會雙執行，造成重複記錄等 bug；`setCoinIncomeLog`/`updateSessions`/`toast` 等副作用一律移出 updater 外（用 ref 讀目前值＋防重入）。
- **【不變式守恆】**：每種資料先寫下不變式→單一寫入口強制把關→做成共用檢查器多處重用（併入 §8）。例：作息行時間互不重疊 → `timeRangesOverlap`／`overlappingIndices`。
- **【課表分類引用必須存在】**：課表／便利貼課程的 `cat1/2/3` 必須對應分類設定；分類被刪時經 `purgeCategoryRefs` 降級為「未分類」（保留課名與時段），不毀格子、不碰番茄歷史。
- **【區段輸出必須落在傳入視窗內】**：`availableSegments`／`subtract` 等區段運算的輸出必須完全落在 `[winStart, winEnd]`；只夾下界會讓未來不可用時段把可用區段撐出「現在」之後（未利用超界根因）。

---

## 二、現在的檔案結構

```
app/
├── page.tsx              ← "use client" 必須第一行，只有 8 行，引入 App 元件
├── layout.tsx
├── globals.css

components/
├── App.tsx               ← 根元件，管理全域狀態 + 頁面路由（subPage state）
├── Header.tsx            ← 固定頂部，動態顯示今天日期，右上角設定按鈕（無 😤🙂😴）
├── useCoinLog.ts         ← 金幣單一真相（明細帳＋餘額＝加總；append/remove/upsert/spend）
│
├── ui/
│   ├── Card.tsx          ← 也 re-export SL（import { SL } from "@/components/ui/Card"）
│   ├── Chip.tsx
│   ├── BackBtn.tsx
│   └── SL.tsx
│
├── charts/（LineChart / PieChart / CatBars / TriCharts / WeekHeat）
├── home/（HomePage / BattleCard）
├── pomodoro/（PomodoroPage / SessionHistoryPage / CoinHistoryPage / RingTimer / CategorySelector / CatBadge）
│
├── timeline/
│   ├── TimelinePage.tsx   ← 版面由上到下：直式行程表 → 橫向行程條 → 待辦清單
│   └── VerticalTimeline.tsx
│
├── calendar/（CalendarPage / DayViewPage）
├── todo/（TodoCard / useTodos.ts）
├── schedule/（SchedulePage / CourseBanner）
├── settings/（SettingsPage — 重置資料、顯示 v1.0.0）
└── shop/（ShopPage）

lib/
├── theme.ts      ← TH 色彩常數（唯一來源）
├── categories.ts ← CATEGORY_TREE + CAT helpers
├── config.ts     ← CFG（TODAY_STR = toLocalDateStr() 本地日期，DAY_END = "23:00"）
├── mock.ts       ← MOCK 假資料
├── utils.ts      ← fmt / nowHM / roundHM5 / addMinHM / toLocalDateStr / pctPos / pctH / buildTimelineHours / DS / DE / DT / toM
├── analytics.ts  ← 行事曆／圖表統計聚合（sessionMatches / buildCalendarStats）
├── schedule.ts   ← 班別定義 + currentOrNextCourse 課程查找 + availableMinutesFor（單一來源）
├── types.ts      ← Session 等共用型別（含 intention／reflection／id）
├── sessions.ts   ← patchReflection（覆盤寫入單一來源）
├── reviews.ts    ← upsertReview / addReview / removeReview / nextId（覆盤表寫入單一來源）
├── period.ts     ← mondayOf／weekKey／monthKey／quarterKey／isoWeek／daysOfWeek／weekKeysOfMonth／monthKeysOfQuarter／weekLabel／monthLabel／quarterLabel（期間 key 單一來源）
├── timelineActual.ts ← actSessionsFor / overridesFor / actIdleFor / buildActualSegments（VT＋迷你 bar 單一來源）
├── tabs.ts       ← TABS 導航設定
└── storage.ts    ← LS_KEYS + loadJSON / saveJSON
```

---

## 三、全域狀態（App.tsx）

| 狀態 | localStorage | 說明 |
|------|-------------|------|
| `coins` | ✅ `flowlife_v1_coins` | 金幣餘額，初始值 0 |
| `focused/neutral/distracted` | ✅ 各自獨立 key | 番茄評分計數 |
| `idleTrackStart` | ❌ | 未利用時間起始 timestamp |
| `todos`（useTodos） | ✅ `flowlife_v1_todos` | 待辦清單 |
| `subPage` | ❌ | 子頁面路由（schedule/shop/dayView） |
| `calIntent` | ❌ | 一次性導航 intent（覆盤浮現卡→覆盤/日）；`{ review: "day" } \| null` |

---

## 四、localStorage 鍵值（全在 lib/storage.ts 的 LS_KEYS）

| Key | 內容 |
|-----|------|
| `flowlife_v1_todos` | 待辦清單 |
| `flowlife_v1_coins` | 金幣餘額 |
| `flowlife_v1_sessions` | 番茄鐘歷史 |
| `flowlife_v1_focused/neutral/distracted` | 評分計數 |
| `flowlife_v1_coin_income_log` | 金幣收入記錄 |
| `flowlife_v1_daily_override_YYYY-MM-DD` | 行程表當天個別修改 |
| `flowlife_v1_routine_override_YYYY-MM-DD` | 當日作息覆寫（睡眠／吃飯等不可用時間） |
| `flowlife_v1_reviews` | 覆盤表（day/week/month/quarter/free 總結） |
| `flowlife_v1_timeline_todo_view` | 直式行程表待辦疊圖顯示偏好 `{ pending, done }` |

---

## 五、VerticalTimeline 關鍵規格

**高度**：840px
**時間範圍**：06:30 ～ 23:00（`DAY_END = "23:00"`）

| 區域 | 位置 | 說明 |
|------|------|------|
| PLN 預定欄 | `left:4, right:"53%"` | 唯讀；固定作息（灰底）+ 課表課程 + 班別兼差 |
| ACT 實際欄 | `left:"47%", right:4` | 未利用時間（深灰墊底）+ 番茄 sessions + `dailyOverride` 手動補登 |
| 分隔線 | `left:"50%"` | 視覺分界 |
| 待辦（未完成） | `left:"35%", transform:translateX(-50%)` | 黃框黃字，用 startTime 定位；可由開關隱藏 |
| 待辦（已完成） | `left:"65%", transform:translateX(-50%)` | 暗色低調，用 endAt 定位；可由開關隱藏 |

**待辦顯示開關**（`TimelinePage` 時間軸上方、靠右；只控制直式時間軸疊圖，不影響下方「今日待辦」清單卡）：
- 兩顆獨立膠囊：「未完成」「已完成」，預設皆顯示（👁）
- 關閉後對應疊圖隱藏（🙈），兩顆互不影響；都關時時間軸只剩課表／班別／補登／未利用
- 持久化於 `LS_KEYS.timelineTodoView`（`{ pending: boolean, done: boolean }`）；mount 後讀取，避免 hydration 不一致

**固定作息**：PLN 欄固定作息讀 `routineBlocksInWindow(DS, DE, date)`，來源 `lib/schedule.routineFor(date)`（預設 `FIXED_ROUTINE`；有當日覆寫則用覆寫）。🍴 三餐／😴 起床·午覺；睡覺 23:00–24:00 在時間軸窗外不顯示。**作息塊單點可編輯**：點 PLN 灰色作息塊 → `RoutineEditor` 調整當日作息覆寫（`stopPropagation`，不誤觸左欄新增待辦）。**今日已自訂標記**：`TimelinePage` 用 `loadRoutineOverride(CFG.TODAY_STR)` 判斷，有覆寫時顯示「✏️ 今日作息已調整」（`TH.accent`）；存檔／恢復後隨 `routineRev` 即時更新。

**ACT 資料來源**（VerticalTimeline 與迷你 ACT bar 共用 `lib/timelineActual.ts`）：

| 來源 | 讀取 | 渲染 | 編輯 |
|------|------|------|------|
| 番茄 sessions | `LS_KEYS.sessions`，篩 `date` 當日且有 `startTime`／`endTime` | 分類色 `CAT.deepColorFull`，文字色 `readableTextOn(底色)`（深底白字／淺底黑字） | 唯讀（`stopPropagation`） |
| 手動補登 | `LS_KEYS.dailyOverride` + 日期（`flowlife_v1_daily_override_YYYY-MM-DD`） | `CAT.cat1Color(cat1)`，文字色 `readableTextOn(底色)`，細白框 | 點色塊開 override popup |
| 未利用時間 | `lib/idle.idleGapsWithin`（`availableSegments` 扣作息／班別後，再扣番茄／補登） | 深灰 `#16161B`、虛線框、`未利用` 小字 | 唯讀（`stopPropagation`） |

**未利用時間**（`idleBlocks`，演算法見 `lib/idle.ts`）：
- **定義**：可用時間（已扣固定作息與班別）內、未被番茄／手動補登覆蓋的空檔
- **fills 僅含**：當日番茄 `sessions`、當日 `dailyOverride`；**不含** PLN 課表課程
- **off-hours 加碼**：作息／班別時段內的番茄不遮蓋可用時段的未利用灰塊（不當 fills）
- **共用 API**：`availableSegments`／`idleGapsWithin`／`idleMinutes`／`splitSessionsByAvailability`（時間軸與週曆共用）

**未利用時間範圍**（視窗 `[DS, cutoff]`）：
- **今天**：`DS`（06:30）→ 現在時刻（依 `nowPct`）
- **過去日期**：`DS` → `DE`（23:00）整天
- **未來日期**：不畫
- 空檔 **< 5 分鐘** 不渲染（避免碎縫）

**override key 規則**：`act_*`（舊 MOCK 時代遺留）與 `man_*`（點 ACT 空白新增）共用同一 `dailyOverride` 物件與 `saveOverride` 存檔邏輯。

**zIndex**：未利用(1) → PLN(2) → ACT 番茄／補登(3) → 分隔線(4) → 待辦已完成(6) → 待辦未完成(7) → 紅線(10) → override popup(20)

**點擊行為**（`handleTimelineClick` 左右分流，`clientX >= 50%` 為 ACT 側）：
- 空白 **左半（PLN）** → `onTimeClick(time)` → 快速新增待辦（24 小時制）
- 空白 **右半（ACT）** → 開 override popup，key `man_${time}`，預設結束 = 開始 + 30 分（不超過 `DE`）
- PLN 區塊 → 唯讀（改課表頁）
- ACT 番茄色塊 → 唯讀
- ACT 未利用灰塊 → 唯讀（不觸發待辦／補登 popup）
- ACT 手動補登色塊 → 點擊開 override popup
- popup 位置：`act_` 或 `man_` key → 靠 ACT 欄右側（`left:"47%"`）

---

## 五（補）、SchedulePage 多選與複製整天

**元件內 state（僅 UI，不另開 localStorage key）**

| State | 用途 |
|-------|------|
| `selectMode` | 是否處於多選模式 |
| `selected` | `Set<"${day}__${time}">` 已選格子 |
| `clip` | 剪貼簿：`{ from, courses, plan, mode: "courses" \| "full" }` |
| `dayMenu` | 目前開啟整天選單的星期（`一`～`日`） |
| `editTargets` | 單格或批次編輯目標 `{ d, t }[]` |

**多選進入**：工具列「▦ 多選」或長按任一格（450ms；位移 >8px 視為橫向捲動、取消長按）。長按觸發後 `lpFired` 抑制隨後一次 `click`，避免立刻反選。

**批次寫入**：`setCells(targets, data)` 一次 `setSched` 寫多格（同日多格正確）；儲存／清除編輯卡後 `exitSelect()` 結束多選。

**整天複製／貼上**：欄頭點 `⋯` 開選單。複製課程或課程＋班別時須深拷貝（`courses.map(c => ({...c}))`、`{ ...plan, shifts: [...] }`）。**貼上＝覆蓋目標日整天課程**（非合併）；`mode: "full"` 時一併覆蓋該日 `day_plans`。與編輯卡互斥（`dayMenu && !editTargets`）。

---

## 六、時間顯示規範

> **全專案統一使用 24 小時制**

- 時間 input 一律 `type="time"`，數值格式 `HH:mm`（24 小時）
- 日期 input 使用 `type="date"`，格式 `YYYY-MM-DD`
- 不使用「上午/下午」自訂標籤；若系統原生 time 選單仍顯示在地化文字，屬 OS／瀏覽器行為
- **提醒**：待辦物件欄位 `reminder`（`TodoReminderId`），選項定義在 `lib/config.ts` 的 `TODO_REMINDER_OPTIONS`（無／事件發生時／5～30 分鐘前／1～2 小時前／1～2 天前）。目前僅**寫入 localStorage**，實際推播／通知尚未實作

---

## 七、待辦（TodoCard）規格

**phase 流程**：`pending → started → ending（防抖 1 秒）→ done`

> ⚠️ END_CONFIRM = 1000ms（原本 2000ms，已改短）

- `startAt`：開始時間（字串 "HH:MM:SS"）
- `endAt`：完成時間（字串 "HH:MM:SS"）
- `startTime`：排定開始時間（用於行程表定位）
- `endTime`：排定結束時間
- `date`：待辦所屬日期（`YYYY-MM-DD`），新增表單可選；未選或無效時 `makeTodo` 預設為 `CFG.TODAY_STR`
- `reminder`：提醒設定（見第六節）；預設 `none`
- **時段頁新增預設時間**：`lib/utils.nowHM` + `roundHM5` + `addMinHM`；開始＝當下取整 5 分、結束＝+`CFG.DEFAULT_TODO_DURATION_MIN`（60 分）；不再寫死 09:00／10:00

---

## 八、UI 設計規範

```typescript
// 從 lib/theme.ts 引入，絕不 hardcode
TH.bg      = "#09090B"   // 最深背景
TH.card    = "#111113"   // 卡片
TH.border  = "#1E1E24"   // 邊框
TH.text    = "#F4F4F5"   // 主文字
TH.muted   = "#52525B"   // 次要
TH.accent  = "#F97316"   // 橘色主色
TH.green   = "#22C55E"   // 休息/完成
TH.red     = "#EF4444"   // 警示
TH.yellow  = "#F59E0B"   // 待辦
TH.gold    = "#FBBF24"   // 金幣
```

- 全部 inline style，不用 Tailwind class
- 手機優先 maxWidth: 430px
- 暗色系，不用白色背景

---

## 八（補）、番茄頁統計分層與圖表標題

**今日統計三層**（`usePomodoro` → `todaySessions`，當日 `date === localDateParts().date`）：

| 層級 | 門檻 | 顯示色 | 說明 |
|------|------|--------|------|
| 有效 | `mins >= 1` | 灰字 | `min1Count` / `min1Total` |
| 進步 | `mins >= 10` | 黃字 `TH.yellow` | `min10Count` / `min10Total` |
| 紮實 | `mins >= 25` | 綠字 `TH.green` | `min25Count` / `min25Total` |

**圖表標題正名**：

| 位置 | 標題 |
|------|------|
| 番茄頁趨勢卡（`PomodoroPage`） | `趨勢(番茄顆數)` — 資料來自 `buildLineSeries(sessions, linePeriod, …).pomos` |
| 行事曆折線圖（`TriCharts`） | `{period} 趨勢(時長)` |
| 行事曆長條圖（`TriCharts`） | `{period} {label} 分佈(時長)` |
| 行事曆圓餅圖 | 不變：`{period} {label} 圓餅圖` |

**當前/即將課程橫幅**（`CourseBanner` + `lib/schedule.currentOrNextCourse`）：
- 讀 `week_schedule`，依現在時間找「當前 30 分鐘格內」或「下一堂課」
- **主頁**（`HomePage`）：頂部橫幅；無課時 fallback 顯示接下來的待辦；無「一鍵開始」；**BattleCard**「昨日」vs 真實前天 `dayBeforeSessions`（已移除寫死 350/6）
- **番茄頁**（`PomodoroPage`）：同款橫幅 +「一鍵開始 🍅」→ `usePomodoro.quickStart`（帶入分類/名稱並立即 `beginFocus`）；專注中隱藏按鈕
- 每 30 秒自動刷新

**番茄頁真實趨勢／昨日學習**（`usePomodoro`）：
- `lineD`：`buildLineSeries(sessions, linePeriod, 當年, 當月).pomos`（已移除 `MOCK.lineData`）
- `yLearn`：昨日 `sessions` 中 `cat1 === "學習"` 的 `mins` 加總（已移除 `MOCK.yesterdayPomos`）

**意圖一句話**（`intention`）：
- UI 預設**收合**：小鈕「✍️ 這次想弄懂的小概念／小目標（可選）」點開才展開；已有內容時自動展開
- placeholder 正名為「想弄懂的小概念／小目標」；≤60 字、可選；**開始後仍可編輯**（綁定 `confirmed` 快照，專注中計時圈下方 input；`confirmRating` 寫入最新值）；寫入 `Session.intention`（空白不存）；`quickStart` 啟動時無意圖、專注中可補

**事件名稱**（`taskName` / `confirmed.name`）：
- 啟動前綁 `taskName`；**專注中仍可編輯**（綁定 `confirmed` 快照，`updateConfirmedName`；完成時 `confirmRating` 寫入最新值）；歷史下拉僅非專注中顯示

**單顆覆盤**（`reflection`）：
- 評分後可選填「✍️ 寫覆盤」；寫入 `Session.reflection`（空白不存）
- 新 Session 帶 `id: Date.now()`；覆盤寫入**唯一路徑** `lib/sessions.patchReflection`（`usePomodoro.updateReflection` 內部呼叫）

---

## 八（補2）、行事曆統計（CalendarPage + `lib/analytics.ts`）

**資料來源**：真實 `sessions`（`buildCalendarStats`）；已移除 `MOCK.lineData`、`CAT.chartDataFor` 假資料。

**大分類篩選**（`selPaths: Set<string>`，路徑語意）：
- 空 Set＝全部；可跨大分類複選中／小分類路徑做加總
- UI：`MultiCategoryFilter` 可折疊面板（與金幣頁同一元件／`matchesCatSelection`）
- 圓餅有選時每路徑一片；未選時各大分類總覽
- 選取路徑互不巢套（MultiCategoryFilter toggle 保證）＝加總不重複計

**period 視窗**（圓餅／長條用 `periodRange`；折線用 `buildLineSeries`）：
- `3天`／`7天`／`14天`／`季`：以今天往回
- `月`：導覽中的 `curY`／`curM`

**分佈切片**（`buildDistribution`）：未選→大分類總覽；有選→每條路徑一片加總。

**月曆四宮格**：時長／日均／有效天＋番茄數 `x/y`（滿10分顆數／滿25分顆數，旁註「滿10/25分」）。

**月曆圓圈**（比照週曆 95/10/5 模型）：內圈 r=13＝可用內讀書（`activeColor` 弧）＋底圈 `TH.border` 未畫滿處＝未利用；外圈 r=15 藍弧＝加碼 off-hours（`offDash > 0` 才畫，不與內弧重疊）；不再用總讀書同圈 overflow。

**連動**：月曆圈圈 `focusByDate`、四宮格、`TriCharts` 三圖、覆盤明細皆吃同一組 `selPaths`。

**週曆**（`calView === "week"`）：
- 每欄底部頁尾：上排專注時長 `fmt(dayFocus)`、中排 `🍅` 番茄顆數、下排 `{totalPct}%`（≥100% 藍色，可破百）
- **繞行線三段（95/10/5 模型）**：第一圈＝可用內讀書（分類色）＋未利用（灰 `#4B5563`）剛好一圈；第二圈外圈＝加碼 off-hours 讀書（藍 `#3B82F6`，`WEEK_BORDER_SEG_OUTER` 不重疊）；資料來自 `lib/idle.splitSessionsByAvailability`
- 待辦完整顯示：早／午／晚時段無 3 筆上限、無 `+N`；`minHeight: 40` 隨內容長高
- 標頭時段標籤：早 06-12／午 12-18／晚 **18-24**；唯讀班別 `{place}{shifts}`（如「彩晚」「診晚」），來自 `dayPlans`

**可用時間**（`lib/schedule.ts` → `availableMinutesFor` / `blockedRanges`）：
- 不可用區間單一來源：`blockedRanges(date)`＝當日作息（`routineFor` → 預設 `FIXED_ROUTINE`，或 `routine_override_YYYY-MM-DD` 覆寫）∪ 當日班別（已合併）
- `availableMinutesFor`＝1440 − blocked 總長
- 固定作息預設：`FIXED_ROUTINE` — 睡眠 00:00–06:30、起床 06:30–07:00、早餐 07:00–08:00、午餐 12:00–13:00、午覺 13:00–13:30、晚餐 17:00–18:00、睡覺 23:00–24:00；無班別時基準可用 **750 分**（1440−690）
- **當日作息覆寫**：`LS_KEYS.routineOverride` + 日期（`flowlife_v1_routine_override_YYYY-MM-DD`）；`loadRoutineOverride`／`saveRoutineOverride`／`clearRoutineOverride`；`routineFor(date)` 為 `blockedRanges` 上游單一來源
- 週曆／月曆圈圈百分比皆吃此函式；課表改班別後重整即反映
- **班別邏輯**（技術債 #1 **已完成**）：`SchedulePage`、`CalendarPage`、`VerticalTimeline` 皆 import `lib/schedule.ts`（`PLACE_NAME` / `shiftRange` / `loadDayPlans` / `weekdayOf` / `availableMinutesFor`）。時間軸與課表固定作息皆已改讀 `routineBlocksInWindow`／`FIXED_ROUTINE`，本地 `FIXED_BLOCKS`／手寫 `ROWS` 已移除
- 已移除 `LS_KEYS.weekendShifts` 與 `lib/utils.getAvailableMinutes` 死碼

---

## 八（補3）、覆盤頁 ReviewView（`components/calendar/ReviewView.tsx`）

**入口**：`CalendarPage` 頂端 `calMode` 切換「📆 行事曆／🔍 覆盤」；預設行事曆；分類篩選面板與行事曆模式共用（`selPaths`）。

**資料來源**：真實 `sessions`，篩選「有意圖或覆盤」的番茄（`intention?.trim() || reflection?.trim()`）；零 MOCK。

**期間視窗**：自帶 `period` state（3天／7天／14天／月／季），用 `lib/analytics.periodRange`；**不**與行事曆 `TriCharts` 的 `period` 共用。

**分類篩選**：`matchesCatSelection(selPaths, …)`（`lib/analytics.sessionMatches` 為薄包裝）。

**清單卡片**：評分 emoji、名稱（或分類路徑）、時長、日期＋起訖＋分類路徑（›）；🎯 意圖唯讀；✍️ 覆盤可點 inline 編輯。

**寫入唯一路徑**：`onPatchReflection(id, text)` → `App.updateSessions` → `lib/sessions.patchReflection`；無 id 舊資料唯讀。

---

## 八（補4）、覆盤表 reviews（`lib/reviews.ts` + `DayReview.tsx`）

**儲存**：`LS_KEYS.reviews`（`flowlife_v1_reviews`），陣列 `ReviewEntry[]`。

**型別**：
- `ReviewScope`：`day` | `week` | `month` | `quarter` | `free`
- `ReviewEntry`：`{ id, scope, periodKey, text, createdAt, updatedAt? }`
- `periodKey`：`day`／`free`＝`YYYY-MM-DD`；`week`＝該週週一 `YYYY-MM-DD`（避開 ISO 週跨年地雷）；`month`＝`YYYY-MM`；`quarter`＝`YYYY-Q#`（如 `2026-Q2`）。「第 N 週」人類標籤用 `lib/period.isoWeekLabel`（顯示用，不進 key）。

**寫入單一來源**：`lib/reviews.ts`；`loadReviews`／`getReview` 唯讀。**free 用 `addReview` append、`removeReview` 刪；day／week／month／quarter 用 `upsertReview` 單筆**（空白 text ＝刪除該筆）。新建 id 走 `nextId` 單調遞增（防撞）。

**未利用覆盤（E2）**：月曆「未利用」卡沿用同一套 reviews，**不另開儲存**；`periodKey` 前綴 `idle:`（例 `idle:2026-07`、`idle:${weekKey}`）與一般覆盤互不覆蓋；自動獲得雲端同步、LWW、空字串刪除。scope／key 隨 TriCharts 時間範圍切換。

**入口**：`CalendarPage` → 🔍 覆盤 → 子切換「明細｜日｜週｜月｜季」；預設「日」。

**ReviewView（明細）**：期間內番茄意圖/覆盤 inline 編輯（不變）。

**DayReview（日）**：
- **上半素材（唯讀）**：聚合今日 `sessions` 中有 `intention` 或 `reflection` 的番茄（🎯→✍️＋評分＋名稱·分類·時長）；零重複輸入、零 MOCK
- **靈感**：「＋靈感」→ `addReview("free", 今日, text)`（同日可多則）；卡片「刪」→ `removeReview(id)`
- **下半總結**：textarea 綁 `getReview("day", dayKey)`；失焦或「儲存」→ `upsertReview("day", dayKey, text)`
- 💡 小提示已加於頂部
- **支援過去期數導覽**（內部 `dayOffset`／`dayKey` 由 `CFG.TODAY` 推算，‹ › 翻頁、不可往未來）＋已訂閱 `subscribeReviews` 即時刷新（編輯中 textarea 有 `editingRef` 守衛不被覆蓋）

**PeriodReview（週／月／季）**＝`components/calendar/PeriodReview.tsx`：
- **俄羅斯娃娃聚合**：週←各日 `day` 總結；月←各週 `week` 總結（`weekKeysOfMonth`，週一落點歸屬）；季←各月 `month` 總結
- 上半子期素材唯讀、顯示「已寫 X / 共 Y」；下半 `upsertReview(scope, periodKey)` + savedFlash
- **靈感僅「日」**；週/月/季無「＋靈感」
- **支援過去期數導覽**（內部 `offset`、`periodKey` 依 `CFG.TODAY` 推算，‹ › 翻頁、不可往未來；切 scope 自動歸 0）＋已訂閱 `subscribeReviews` 即時刷新（編輯中 textarea 有 `editingRef` 守衛不被覆蓋）

**與單顆覆盤分工**：番茄 `Session.reflection` 仍走 `patchReflection`；跨番茄「今日總結」走 `reviews`，兩者不重複。

**主頁 ReviewNudgeCard**（`components/home/ReviewNudgeCard.tsx`）：
- 顯示條件：`nowHM >= CFG.REVIEW_NUDGE_AFTER`（22:30）且今日 `getReview("day", TODAY_STR)` 無內容
- 昨日總結唯讀展示（若有）；點「去寫今日總覆盤」→ `App.calIntent` → 覆盤 tab／「日」分頁
- `reviews` 不上提 App；HomePage 直讀 `getReview`；`nowTick` 每 60s 刷新（跨 22:30 自動浮現）

---

## 九、Cursor 開發必讀（重要提醒）

1. **`SL` 元件** → `import { Card, SL } from "@/components/ui/Card"`
2. **日期全動態** → `CFG.TODAY_STR = toLocalDateStr()`（本地 YYYY-MM-DD，禁止 toISOString 取日期）
3. **金幣兩套** → COIN_TABLE（時長）+ MILESTONES（里程碑）都要接
4. **番茄評分** → 同時更新 Header 的 😤🙂😴 計數器
5. **圖表純 SVG** → 不裝任何圖表庫
6. **next.config.ts** → `ignoreBuildErrors: true, ignoreDuringBuilds: true`
7. **改動前確認範圍** → 先說「會影響哪些檔案」，確認後再動
8. **💡 小提示** → 每個新功能都要在 UI 就近加一行 `💡` 操作提示（`fontSize: 9`、`TH.muted`），讓使用者不用猜怎麼用
9. **金幣記錄＝`useCoinLog` 單一真相** → 餘額＝明細 `amount` 加總；`coinIncomeLog` 只在 `App.tsx` 經 `useCoinLog()` 持有；變動只走 `appendCoinRow`／`removeCoinRows*`／`upsertCoinRowForSession`／`spendCoins` 四入口；禁止獨立餘額 state 或元件各自 load/save 金幣
10. **番茄雲端同步＝`lib/sessionsCloud`** → 番茄上雲（push/delete/拉合併）一律走 `sessionsCloud`（uuid 主鍵、last-write-wins by `updatedAt`、localStorage 為本機快取/備援）；寫入路徑由 `App.updateSessions` 末端 `syncSessionDiffToCloud(prev,next)` 自動增量推送，禁止元件各自直連 supabase 寫 sessions
11. **app_state 雲端同步＝`lib/appStateCloud`** → 金幣明細（`coin_income_log`）整包上雲；餘額由明細加總、不再讀寫獨立 `coins` key（舊 `coins` 僅遷移用）；`useCoinLog` 本地變動才 `pushAppState`、訂閱套回；禁止元件各自直連 supabase 寫 app_state

---

## 十、已完成功能 ✅

- localStorage 持久化（todos/coins/sessions/評分）
- 元件拆分（33個檔案）
- 設定頁（重置資料、v1.0.0）；新增「只清番茄/金幣記錄」（保留分類／課表／班別等設定，與「重置所有資料」分開）
- 動態日期 + 動態紅線（每分鐘更新）
- ErrorBoundary
- 新增待辦（時段頁）：`type="date"` + `type="time"`（24h）+ 提醒下拉；寫入 `date` / `reminder` 欄位
- 購買記錄 + 金幣收入記錄
- 直式行程表點擊新增待辦
- 預定/實際區塊點擊編輯（daily override）
- 已完成待辦用實際完成時間（endAt）定位
- 行程表延伸至 23:00，高度 840px
- TimelinePage 版面：直式在上，待辦在下
- 待辦結束防抖改為 1 秒
- 番茄頁：事件名稱歷史下拉（sessions + coinIncomeLog）；依 cat1／cat2／cat3 過濾（有選才比對）
- 番茄頁：金幣收支歷史獨立頁（CoinHistoryPage）、sessions 改 `updateSessions` 立即寫入 localStorage
- 金幣收支頁（CoinHistoryPage）、番茄頁金幣列表（PomodoroPage）：inline 編輯 cat1 必填、cat2／cat3 選填（`— 不選 —`）；大／中／小分類標籤；顯示以 `›` 串接已有層級
- 番茄頁：時長／加時休息按鈕標籤、版面重排（評分在計時圈下方）
- 番茄獎勵動畫：>25 分鐘大硬幣＋金額 3 倍字；≥60 分鐘 30% 雙倍金幣＋寶箱動畫
- 週課表（SchedulePage）：06:30~22:30 半小時一格；跨一小時固定作息（午餐／晚餐）合併大格；雙工作場所 + `day_plans`；兼差大格／班別 Chip 顏色 = `CAT.cat2Color("兼差", 診所|彩券行)`；編輯卡片「最近選過」快捷鈕（`schedule_history` 最多 10 筆、顯示前 5）；編輯卡片可跳分類管理；**多選套用同一課程**（`selectMode`／`selected`／`setCells` 批次寫入、長按進多選）；**複製整天課表**（`clip`／`dayMenu`、貼上覆蓋整天）；橫向滑動（minWidth 520）
- 課表入口：時段頁「📅 課表」按鈕（原行事曆 📋 已移除）
- 分類系統：中分類自訂 color（CategoryManager 色盤）；小分類 `cat3ColorFrom` 依 index 混入白／彩虹色／黑（35%）；金幣記錄標籤色點
- 預設分類色：`DEFAULT_CATEGORIES` 大／中分類各自獨立色（學習黃、法律紫等）；色盤 `color_palette` localStorage 可自訂
- 分類改名同步（階段一止血版）：`CategoryManager` 改名時連鎖更新 sessions／coin_income_log／week_schedule；同名跨大分類會一併改到（已知限制）；階段二接 Supabase 時改用穩定 ID
- 番茄鐘記錄（Session）與金幣收支（CoinIncomeLogRow）新增可選 `startTime`／`endTime`（HH:MM）；金幣列表有起訖則顯示「開始～結束」，舊資料 fallback `row.time`
- 番茄主頁今日統計／金幣收支已修正為只算當日（`date === localDateParts().date`）；Session 寫入 date 與金幣 log 統一 YYYY-MM-DD；今日統計三層番茄對比（滿1分／滿10分進步／滿25分紮實）
- 圖表標題正名：番茄趨勢卡「趨勢(番茄顆數)」；行事曆 TriCharts 折線「趨勢(時長)」、長條「分佈(時長)」
- 行事曆統計真實化：`lib/analytics.ts` 聚合 sessions；大分類單擊單選／長按多選；月曆四宮格番茄數 x/y（滿10／滿25）；移除 `CAT.chartDataFor`
- 週曆：每日統計頁尾（時長＋番茄數＋百分比）、繞行線依科目分色分段、待辦完整顯示（無 +N 裁切）
- 可用時間單一來源 `lib/schedule.ts`（`availableMinutesFor` 吃 `day_plans`）；週曆同步課表班別唯讀標籤；移除 `weekend_shifts` 週末開關
- `SchedulePage` 班別邏輯改 import `lib/schedule.ts`（移除本地 PLACE_* / shiftTimes / shiftRange 重複定義）
- `VerticalTimeline` PLN 班別方塊改 import `lib/schedule.ts`（`loadDayPlans` + `shiftRange`）；技術債 #1 班別單一來源完成
- 當前/即將課程：`lib/schedule.currentOrNextCourse`；共用 `CourseBanner`（主頁 + 番茄頁）；`usePomodoro.quickStart` 一鍵開始
- 番茄頁趨勢與「超越昨天學習」改真實 sessions（`buildLineSeries` / 昨日學習加總）；`MOCK.lineData`、`MOCK.yesterdayPomos` 已移除
- 主頁「昨日」BattleCard 改用真實前天資料（`dayBeforeSessions`），移除寫死 350/6
- 番茄鐘歷史頁（SessionHistoryPage）：每日評分對比（並排 😤🙂😴 + 有效／紮實統計，無框、上下靠近）；今日統計 ⌚ 入口已接線（`sessionHistory` subPage）
- 金幣收支頁（CoinHistoryPage）：修復 UTF-8 編碼損毀；起訖時間後顯示時長；每日分組卡片框
- 修正 `CFG.TODAY_STR` UTC 跨日 bug：新增 `lib/dateStr.ts` 的 `toLocalDateStr`（經 `utils` 匯出）；全專案「今天」統一本地日期算法
- WeekHeat 番茄鐘分佈已真實化（讀 `sessions`，最近 7 天，有起訖才畫色塊）；`MOCK.heat` 不再使用
- 直式行程表 PLN 已串聯課表（`week_schedule` + `day_plans`）；課程區塊結束時間 = 開始 + 30 分（不跨過固定作息）；兼差區塊顏色對應兼差中分類（診所／彩券行）；PLN 唯讀
- 直式行程表 ACT 已真實化：讀當日 `sessions`（有起訖才畫唯讀色塊）+ `dailyOverride` 手動補登（`act_`／`man_` key）；點 ACT 空白新增補登、點補登色塊可編輯
- 直式行程表 ACT 未利用時間：可用時間內空檔深灰墊底（`lib/idle`）；fills 僅番茄＋補登；作息／班別不畫灰、off-hours 番茄不遮蓋；今天填至現在、過去填整天、未來不填
- 直式行程表待辦顯示開關：未完成／已完成可獨立隱藏（時間軸疊圖 only），持久化 `LS_KEYS.timelineTodoView`
- 直式行程表三餐圖案統一為 🍴（起床／午覺／睡覺仍 😴）
- **技術債 #2（實色底文字色寫死）已關閉**：新增 `lib/theme.ts:readableTextOn(bg)` 為單一來源，套用於 `VerticalTimeline` 的 `actSessions`／`dailyOverride`。未來任何在「實色背景上印文字」的新 UI，文字色一律改讀 `readableTextOn`，禁止再寫死 `#111`／`#fff`。
- 番茄「意圖一句話」：開始前填意圖→專注中仍可編輯（`confirmed` 快照）→存進 `Session.intention`（可選，空白不存）。
- 主頁「覆盤方針」假卡 → 改真實「🎯 今日意圖回顧」：列今日有意圖的番茄（評分＋意圖＋名稱·分類·時長），移除寫死假文字。為 Stage 2 專屬覆盤頁鋪路。
- 作息統一為 `lib/schedule.FIXED_ROUTINE` 單一來源（含 `routineBlocksInWindow`）；`availableMinutesFor` 改讀 `routineFor`／`blockedRanges`；移除 `lib/utils.getAvailableMinutes` 死碼。
- **第二層完成**——時間軸與課表顯示改吃 `FIXED_ROUTINE`，emoji 統一 🍴/😴，早餐 07:00–08:00、22:30 可排課。
- **第三層完成**——未利用改「可用內」算法：抽 `lib/idle.ts`；`blockedRanges` 為不可用單一來源；時間軸灰塊＝可用時間內空檔（off-hours 番茄不遮蓋）。
- **週曆三段線完成**：95/10/5 模型上線（可用內＋未利用第一圈、加碼外圈藍線、`totalPct` 可破百）。
- **月曆圓圈**也改新模型（內圈可用內＋底圈未利用、外圈 r=15 藍色加碼）；週／月視圖一致。
- **habit-tracker8 派工 1/2**：待辦預設時間改 `nowHM`／`roundHM5`／`addMinHM`（+60 分）；未完成待辦疊圖 zIndex 7＞已完成 6；時段頁補登提示；月曆死碼 `pct` 清除。
- **habit-tracker8 派工 2/2**：`Session.id`＋`reflection`；`lib/sessions.patchReflection` 覆盤寫入單一來源；評分後可選寫覆盤；意圖 UI 收合＋正名「小概念／小目標」。
- **habit-tracker9 polish**：意圖框預設收合（`intentionOpen` 於開始專注重置）＋每顆番茄意圖重置（`beginFocus` 清 `intention` state，`confirmed` 仍保有值供記錄／顯示）。
- **habit-tracker9 MOCK 還債**：刪零引用欄位 `schedule.PLN`、`todayPomos`、`heat`、`initTodos`；保留 `weekdaySchedule`（課表種子）、`shopItems`（商店種子）。
- **habit-tracker9 迷你 ACT bar 真實化**：抽 `lib/timelineActual.ts`；TimelinePage／DayViewPage 迷你 bar 改 `buildActualSegments`；VerticalTimeline 改呼叫同一組函式；刪 `MOCK.schedule`。
- **habit-tracker10 覆盤頁 #2 骨架**：CalendarPage 頂端新增「📆 行事曆 / 🔍 覆盤」(calMode) 切換；新增 components/calendar/ReviewView.tsx，列出期間內「有意圖或有覆盤」的番茄成對清單（🎯意圖 → ✍️覆盤＋評分＋名稱·分類·時長），點卡片 inline 補/改覆盤，寫入唯一走 App.tsx 的 onPatchReflection → lib/sessions.patchReflection（updateSessions 持久化）。零新增假資料；分類 chips 與行事曆模式共用篩選；無 id 舊資料顯示唯讀。
- **habit-tracker10 月曆錨點根治**：CalendarPage 月份錨點改由 CFG.TODAY 推算（殺掉寫死的 2026／月基準 4），預設顯示本月；修好「選『月』圖表空白」與「今日小圓點不亮」兩個連動問題；翻頁自動跨年。
- **habit-tracker10 番茄啟動後可改名稱/意圖**：專注中事件名稱、意圖綁 `confirmed` 快照可編輯，`confirmRating` 讀 `confirmed` 寫入最新值；保留每顆意圖重置（`beginFocus` 清 `intention` state）；一鍵開始番茄可中途補意圖。
- **item 3 作息每日覆寫**：`lib/schedule.routineFor` + `routine_override_YYYY-MM-DD`；`blockedRanges` 上游接覆寫層；新增 `RoutineEditor`；VerticalTimeline 點作息塊開編輯、儲存後 PLN／未利用／週月曆可用圈同步重算；班別邏輯未動。
- **item 3 收尾**：時段頁加作息 💡 小提示；今日有覆寫顯示「✏️ 今日作息已調整」；編輯器刪光儲存改 `clearRoutineOverride`；`end<=start` 擋下並提示。
- **item 4 覆盤表第一步**：`lib/reviews.ts` + `DayReview` 今日總覆盤；CalendarPage 覆盤子切換「明細／總覆盤」；寫入走 `upsertReview`。
- **item 4 Batch A**：DayReview 今日總結加「已儲存 ✓」回饋（1.8s）；新增 `lib/period.ts` 期間 key 單一來源（週一 key、ISO 週標籤顯示用）。
- **item 4 Batch B**：週/月/季 `PeriodReview` + 俄羅斯娃娃聚合；覆盤子切換攤平五顆；`reviews.nextId` 防撞。
- **item 4 Batch C**：主頁 `ReviewNudgeCard`（22:30 浮現卡 + `calIntent` 跳覆盤/日）；`CFG.REVIEW_NUDGE_AFTER`。
- **bugfix 專注中誤累積未利用**：根因＝`App.tsx` 平日 08:00／13:30 自動 `setIdleTrackStart` 未檢查專注；修法＝`usePomodoro` 不變量 effect（`mode==="focus"` 或 `restSecs>0` 時立即熄滅 idle、不累加）。
- **Settings 歸零未利用時間**：設定頁新增「未利用時間」卡，一鍵 `handleResetIdle` 只清 `idleTrackStart`＋`idleTotalSecs`（歸零用 `DEFAULT_IDLE_TOTAL_SECS` 常數），不動番茄/金幣/評分；附「已歸零 ✓」回饋。
- **待辦↔未利用整合**：時間軸未利用 `fills` 新增來源「已執行待辦」——用實際執行時間 `startAt`～`endAt`（非排定 `startTime`/`endTime`，`toM(e)>toM(s)` 才碳），與 `showDone` 顯示開關無關（`doneTodos` prop 為完整清單）；只打勾沒進行的點待辦無 `startAt`、不碳掉維持未利用。補登小框可從今天已完成待辦一鍵帶入名稱（晶片）。
- **歷史頁可改時長/刪除**：`SessionHistoryPage` 每日彙總下列逐顆 session（依 `endTime` 由晚到早）；改時長走 `lib/sessions.setSessionMins`，只動餘額＋該筆 `earnedCoins` 基礎幣、餘額 `Math.max(0,...)` 不為負；里程碑/寶箱不回溯。刪除流程已由「垃圾桶-1」取代：進垃圾桶即以金幣帳本實際入帳退幣（含里程碑/寶箱；舊列雙管道比對），記下 `refundedCoins`、復原對稱加回，永久刪不再重複扣。無 `id` 舊資料改/刪鈕 disabled。`Session` 有 `manual?` 欄。
- **歷史頁可手動補番茄**：頂端「＋ 手動補番茄」表單（名稱/日期/起訖/分類/可選評分），`toM(end)>toM(start)` 驗證；走 `lib/sessions.buildManualSession`（`manual:true`、依時長 `coinsForSecs` 發基礎幣、`id=Date.now()`）；有起訖故自動進時間軸 `actSessions`、碳掉該段未利用；可再用改時長/刪除（有 id）。
- **Supabase S1-2 Auth**：`@supabase/ssr` browser/server client（`lib/supabase/client.ts`／`server.ts`）＋根目錄 `middleware.ts` 每次請求 `getUser()` 刷新 session；`components/auth/AuthPanel.tsx` 最小 email 登入/註冊（`onAuthStateChange` 同步、登出），掛在設定頁「雲端同步（測試中）」卡；只用 publishable key，secret 不入前端；**本批未接資料表**（reviews 同步留 S1-3）。
- **Supabase S1-3 reviews 雲端同步**（路A：本地快取＋背景同步、last-write-wins）：`lib/reviews.ts` 加雲端層——`syncReviewsFromCloud`（拉＋合併＋自動遷移本地較新者）、`pushSingletonCloud`/`deleteSingletonCloud`（手動「先查再 update/insert」避 partial-index `onConflict`）；寫入函式末端 fire-and-forget（`void`，不擋 UI）推雲；`subscribeReviews`/`emitReviews` pub-sub；只同步單筆覆盤 `day/week/month/quarter`，**free 靈感暫不上雲**（本地行為不變）；未登入 `getUid` 回 null 即純本地。新增 `components/hooks/useReviewCloudSync`（App 掛一次、`onAuthStateChange` 觸發同步）。
- **reviews 兩洞合補**：`DayReview`/`PeriodReview` 加過去期數導覽（內部 `dayOffset`／`offset`，`CFG.TODAY` 推算 key，‹ › 翻頁、「下一期」當期 disabled 不可往未來；切 scope 自動歸 0）＋訂閱 `subscribeReviews` 即時刷新（`editingRef` 守衛：focus 中遠端刷新不蓋草稿，blur 即存）。未動 `lib/reviews.ts`。

### 2026/06/26 — Supabase S1 完成 ＋ 番茄記錄修正

- **Supabase S1 完成**（reviews 試點端到端雲端同步：增/查/改/刪＋localStorage→雲端自動遷移已真機驗證）：
  - 資料層：`lib/reviews.ts` 路A（本地快取＋背景同步＋last-write-wins＋手動 upsert 避 partial-index）、pub-sub（`subscribeReviews`/`emitReviews`）、`useReviewCloudSync`（App 掛載、登入觸發）。
  - 連線：`@supabase/ssr`（`lib/supabase/client.ts`、`server.ts`、`middleware.ts` 刷新 session）、`AuthPanel` email 登入（掛設定頁）。
  - DB：`public.reviews`（uuid 主鍵、`user_id`＋RLS 四 policy、partial unique on `(user_id,scope,period_key) where scope<>'free'`、grant authenticated）。
- **番茄記錄修正功能（B1~B3b）**：Settings 歸零未利用；待辦 `startAt`～`endAt` 自動碳掉未利用＋補登帶入待辦名；歷史頁改時長/刪除（金幣連動）＋手動補番茄（`manual:true`、依時長發幣、自動碳未利用）；`lib/sessions.ts` 為單一寫入來源。
- **usePomodoro 不變量**：專注/休息中強制熄滅 idle（不累加），修掉 08:00/13:30 自動 idle 在專注中誤點燃。
- **修 Vercel build**：browser client 改 lazy singleton、`reviews.ts` 移除 import-time 實例化，避免 prerender 在缺 env 時崩潰（型別改用 `ReturnType<typeof makeBrowserClient>` 保具體推斷，消除 implicit-any 外溢）。
- **S2-1 分類 ID 化＋全量備份**：`BigCat`/`MidCat` 加必填 `id`（`DEFAULT_CATEGORIES` 補固定 slug id、`small` 維持 `string[]`）；`migrateCategoryIds`（掛載跑一次、先 `snapshotForS2` 再補 id、冪等只在有變動時寫檔）；`loadCategories` 讀取端對缺 id 者 in-memory 補上（不寫檔防呆）；CategoryManager 新增大/中類帶 `crypto.randomUUID()`；`storage.snapshotForS2`/`hasS2Backup` 一次性備份 categories/sessions/coinIncomeLog/weekSchedule 原始字串。CAT 存取器形狀不變、畫面零變化。
- **S2-1b 小分類 ID 化（整棵樹完成）**：`SmallCat` 由 `string` 改 `{ id, name }`，`DEFAULT_CATEGORIES` 所有 subs 補固定 `sml-*` id；`migrateCategoryIds` subs 迴圈正規化（`string→{id,name}`、缺 id 補 `genCatId`，冪等仍先 `snapshotForS2`）＋`loadCategories` `normalizeSub` 同時吃舊 string／物件雙格式做讀取防呆；`CAT.cat3List` 改回 `subs.map(s=>s.name)`、`cat3Color` 改 `findIndex(s=>s.name===cat3)`（消費端仍拿名字陣列、零改動）；CategoryManager subs 全改讀 `.name`（render key 改 `sub.id`、addSub push `{id,name}`、updateSubName 改 `.name`、刪除確認取 `.name`，cascadeRename cat3 仍用名字未動）；新增 `storage.restoreFromS2Backup`（一鍵還原四鍵、無備份回 false，本步未接 UI）。畫面零變化。
- **分類「只計時、不發金幣」**：`BigCat.noCoin?`＋`CAT.isNoCoin(cat1)`（名稱查詢、娛樂分類不寫死）；分類管理的大分類展開區可切換並持久化。三條發幣路徑全面守門：`usePomodoro.confirmRating`（基礎幣 0、里程碑分鐘排除、寶箱停用、無金幣紀錄）、`buildManualSession`（`earnedCoins/coinGain=0`）、`setSessionMins`（新基礎幣 0）。noCoin 番茄仍正常存 session（`counted` 依分鐘），因此照常進時間軸／行事曆統計並填掉未利用時間。小修：開關文案改「⌛ 只計時（不發金幣 ❌）」；noCoin 結束評分不跳金幣動畫（`setRewardFx` 加 `!isNoCoin` 守門）。
- **#3a 直式行程表視窗可折疊**：預設 `DAY_START=06:00`～`DAY_END=23:00`；`VerticalTimeline` 加「展開凌晨 00:00–06:00」「展開深夜 23:00–24:00」兩鈕，展開後以區域 `wStart/wEnd`＋`lPos/lH/curNowPct/localHours` 重算定位／時刻標／紅線／點擊換算；`actIdleFor` 接受 `winStart/winEnd`（cutoff 跟視窗）；`actSessionsFor` 不再以全日 pct 裁切（可見性改由時間軸視窗守衛）。`DS/DE` 僅作時間軸預設精簡視窗，行事曆／統計呼叫端未改。小修：「展開深夜」鈕移到時間軸底部（貼近 23:00）、「展開凌晨」留頂部（貼近 06:00），就地展開。
- **#3b 跨午夜番茄自動切兩顆**：`usePomodoro.confirmRating` 判定 `crossed = toM(now.time) < toM(startClock)`（結束時刻早於開始＝跨午夜）。跨午夜時拆兩顆 `Session`：前段記昨天（`startClock`→`24:00`）、後段記今天（`00:00`→`now.time`），共用 `common` 欄位與同一評分。**#6 修正**：各段依自身分鐘各自計基礎幣（`coinsForSecs(segMins*60)`，`noCoin` 仍 0）；跨午夜金幣帳列各段一筆，里程碑/寶箱加成另筆掛第一段 `sUuid`；非跨日維持一筆合計。一般番茄行為回歸不變。`endTime "24:00"` 僅內部定位用（`toM=1440`）。
- **手動補番茄改雙 datetime 跨天切段**：`buildManualSession` 簽章改 `{ startAt, endAt }`（`"YYYY-MM-DDTHH:MM"`）＋回傳 `{ sessions: Session[], coinGain }`；`while` 迴圈按「本日 24:00」切段（`guard<40`、`toLocalDateStr`）。**#6 修正**：各段 `earnedCoins` 各自依 `seg.mins` 計幣（不再全塞第一段）；`coinGain`＝各段合計；`App.handleAddManualSession` 逐段 `appendCoinRow`。`isNoCoin` 仍發 0。
- **時間軸相鄰區塊細線分隔**：`VerticalTimeline` 課程/作息塊非 shift 者 `border` 由 `none` 改 `1px solid #0D0D0F`（底色）、番茄 session 塊加 `border: 1px solid #0D0D0F`；顏色相近的相鄰區塊間出現一條與背景同色的細縫，視覺分開（dailyOverride 已有邊框、idle 已有虛線，不動）。
- **垃圾桶-1 番茄軟刪除（可復原）**：`Session.deletedAt?`＋`LS_KEYS.trashedSessions`；垃圾桶以 app_state `key="trashed_sessions"`（預設 `[]`）做本地＋雲端 LWW 備份。`App.handleDeleteSession` 用既有 `updateSessions` 把番茄移出 active，再寫入獨立 `trashedSessions`；**金幣在進垃圾桶當下結算**，退幣金額以金幣帳本為單一真相（`removeCoinRowsForSession`：先 uuid、找不到再用日期＋起訖補比對舊列；回傳實際入帳含里程碑/寶箱；帳本查無才退 `earnedCoins`）。垃圾桶記下 `refundedCoins`，復原時對稱加回同一數字＋`appendCoinRow`。永久刪除有 `window.confirm`，只移出垃圾桶（金幣已於進垃圾桶時處理，不重複扣）。hydrate 時清掉 `deletedAt` 超過 30 天者；重置全部／清除記錄同步清垃圾桶。`SessionHistoryPage` 在手動補番茄後加可折疊「🗑 垃圾桶 (N)」；進垃圾桶／復原有 `coinToast` 提示扣回／加回金額。
- **手動補番茄禁止未來**：`ManualForm` 兩個 `datetime-local` 加 `max={nowLocal}`；submit 驗證 `endAt > Date.now()` 擋下並提示「不能補未來的番茄」；提示文案改為只能補到「現在」為止。
- **垃圾桶退幣改帳本單一真相**：修「發幣＝基礎＋里程碑＋寶箱、退幣卻只看 `earnedCoins`」與「舊金幣列無 `sessionUuid` 斷鏈刪不掉」——`useCoinLog.removeCoinRowsForSession` 雙管道比對＋回傳實際入帳總額；`Session.refundedCoins?` 記實退金額供復原對稱；無入帳時 toast「沒有入帳金幣」、不動餘額。
- **金幣孤兒對帳**：`useCoinLog.findOrphanCoinRows`／`removeCoinRowsByIds`——找出「番茄已不存在」（uuid 對不到，舊列再用日期＋起訖也對不到）的金幣帳列；金幣收支頁「🧾 對帳」先 confirm 筆數與金額，再清帳列並同步扣回金幣（修早期刪番茄遺留孤兒）。
- **番茄改以時間區段為主**：`lib/sessions.setSessionTimes`（分鐘＝結束−開始，`24:00`→1440；金幣重算與 `setSessionMins` 同套，`noCoin` 仍 0）；歷史頁編輯鈕改「✏️時間」，改開始～結束即時顯示換算分鐘，儲存後時間軸定位同步更新。
- **垃圾桶一鍵清空**：`handlePurgeAll`→`updateTrashed([])`；垃圾桶展開區「🗑 全部永久刪除（N）」有 confirm；金幣已於進垃圾桶時結清，全清不動金幣。
- **#6 跨日番茄各段各自計算金幣**：修「跨午夜切兩顆卻金幣全算第一段、第二段 earnedCoins=0」——與「一顆番茄一筆帳」對帳前提矛盾。即時番茄（`confirmRating`）與手動補（`buildManualSession`）皆改各段依自身分鐘＋同一套 `coinsForSecs` 計幣；跨午夜帳列各段一筆；刪任一段只退該段金額。
- **金幣架構治本（帳本單一真相）**：餘額＝`coinIncomeLog` 所有 `amount` 加總，不再獨立存 `useCoins`／`LS_KEYS.coins`（檔案已刪；`LS_KEYS.coins` 僅遷移讀取）。`CoinIncomeLogRow.kind?`（`session|bonus|spend|opening`）；一次性期初結餘遷移（`flowlife_coin_ledger_migrated`，diff＝舊餘額−明細總和）。四個唯一入口：`appendCoinRow`／`removeCoinRows*`／`upsertCoinRowForSession`／`spendCoins`。刪/改/商店皆只動明細 → 餘額自動變；`confirmRating`／`handleAddManual` 不再 `setCoins`。
- **刪番茄餘額防護**：`useCoinLog.previewRefundForSession` 預覽該番茄帳列總額；`handleDeleteSession` 在餘額不足扣回時擋下，toast 提示金幣已花掉、需先賺回或取消購買，避免帳本透支。
- **商店取消購買**：`useCoinLog.spendRows`（新到舊）＋`refundSpend`（只移除 `kind="spend"`）；商店新增「最近購買」前 10 筆與「↩ 取消購買」confirm，移除負數帳列後餘額自動回升。
- **金幣收支三檢視**：`CoinHistoryPage` 可切「🕒 依時間／🏷 依分類／➕➖ 收入支出」；分類依 cat1 或商店消費／期初結餘／其他分組並依小計排序；收入支出顯示收入總計、支出總計、餘額；負數統一紅字帶負號。純顯示，不改帳本資料。
- **金幣頁資訊架構調整**：順序固定為對帳卡 →「① 先選時間區間」→「② 再選要怎麼看」→ 內容（期間永遠先過濾）。收支可點總計卡進獨立收入／支出列表（近→遠）並返回總覽；`coinToast` 顯示延長至 4.6 秒。
- **金幣頁依分類 CategorySelector**：「依分類」檢視重用番茄鐘同款 `CategorySelector`（大／中／小可各自點選）；未選分類時顯示大分類總覽（`typeGroups`），選了則依 `filteredLog` 篩選並顯示明細小計；「✕ 清除分類」回總覽。移除舊逐層下鑽（drillCat1/2）。
- **金幣頁多選分類＋三檢視去重疊**：新增通用 `MultiCategoryFilter`（`components/ui`）支援跨大分類複選，分類命中改用 `catPath` + `matchesCatSelection`（完整路徑鍵，避免同名中分類誤加總）；「依時間」改打散流水帳（近→遠）、「收支」餘額卡改不可點、「依分類」未選顯示大分類總覽，有選則顯示「已選 N 項合計」。
- **MultiCategoryFilter 中分類常駐**：中分類區永遠顯示全部大分類（`activeCat1 = cat1s`），不因已選收合；可自由跨大分類複選中／小分類。
- **D1 商店商品資料化**：`ShopItem`（`instant` flat 價／`time` 每分鐘金幣＋掛番茄分類＋`productCat`）；`LS_KEYS.shopItems`＋`app_state key="shop_items"`；`ShopPage.updateShopItems` 單一寫入（LS＋推雲）；MOCK 僅首次種子為 instant；可編輯／刪除；time 購買已於 D2a 開放。
- **D1 收尾：購買記錄單一真相**：移除本地 `purchaseLog`；商店「購買記錄」改由金幣帳本 `kind="spend"`（`allSpendRows`）依日期分組衍生；取消購買只動帳本，兩卡同步消失。
- **D2a 計時商品購買→倒數→結束退幣**：`ActiveEntertainment`＋`LS_KEYS.activeEnt`（本地、不同步雲）；`useCoinLog.spendReturningId`／`setCoinRowAmount`（退幣＝調整原 spend 帳列金額，非另加一筆）；`App` 層 `ent`／`entRemain` 倒數 tick（歸零自動結束）；不滿一分鐘不計＝`Math.floor(秒/60)`；同時僅一個進行中娛樂；ShopPage time 商品分鐘輸入＋「購買並開始」；全域浮動倒數條＋手動結束。
- **D2b 開始專注自動結束娛樂＋2/1 分提醒**：`usePomodoro.beginFocus` 唯一入口觸發 `onFocusStart`（涵蓋開始鈕與課表快速開始）；`App` 綁 `onFocusStart={endEntertainment}`；倒數 tick 加 `entWarnRef` 門檻（剩 2 分／1 分各 toast 一次）；App 開啟時畫面提示，真推播仍待 Capacitor。
- **D3a 娛樂結束→記成娛樂番茄**：`endEntertainment` 在 `usedMins≥1` 時以 `splitSpanByDay` 切段寫入 `Session`（`earnedCoins:0`、商品設定的番茄分類）；走 `updateSessions` 自動進時間軸／排除未利用／月曆 mins 加總；跨午夜切兩段。修正：副作用移出 `setState updater`（`entRef` 防重入），杜絕嚴格模式雙跑重複記錄。買娛樂即停未利用累積；倒數 banner 加常駐提示。
- **娛樂取消購買連動移除 session**：商店 `onRefundSpend` 退幣後，以 `name+date+earnedCoins=0` 移除對應娛樂 session；結束提示補「可按開始專注 🍅」。
- **D3b 消費帶商品分類＋支出依 productCat 分組**：`CoinIncomeLogRow.productCat`；`spendCoins`／`spendReturningId` 帶入；金幣頁收支「支出」依 productCat 分組可展開；無 cat1 時顯示 productCat；0 元消費列 hydrate 清除＋退全額 `refundSpend` 刪列。
- **R1 固定作息資料化＋小項/細節＋編輯器**：`RoutineBlock` 擴充 `emoji`/`items`；`DEFAULT_ROUTINE`＋`loadRoutine`/`saveRoutine`/`ensureRoutineSeeded`（LS＋`app_state key="routine"`）；`routineFor` 改讀 `loadRoutine`；`routineLabel` 存檔時組字；課表頁 `RoutineManager`（加行/小項/細節/重設）；顯示端沿用 `label`，`blockedRanges` 僅用 start/end。
- **R3 課表頭尾折疊＋作息拖曳排序**：課表核心視窗 `06:00–23:00`，可展開凌晨/深夜；`buildRows(winStart,winEnd)` 單一視窗；班別覆蓋層跟 `HALF_SLOTS` 自動偏移。`RoutineManager` 原生 HTML5 拖曳排序，`persist` 不再強制依時間排序。
- **作息時間重疊防護＋小項拖曳**：`lib/schedule.timeRangesOverlap`／`overlappingIndices` 共用檢查器；`RoutineManager` 紅框＋頂部警告＋完成確認；小項列可 ⋮ 拖曳（`stopPropagation` 不干擾行拖曳）。
- **未利用自動起算改補觸發**：平日 08:00／13:30 改為「已過時刻且今日旗標未記 → 立即起算」；起點＝該時刻時間戳（不少計）；`LS_KEYS.idleAutoFlag`+日期防重複；娛樂進行中只記旗標不起算；專注中仍由 `usePomodoro` 熄滅 idle。
- **CFG.TODAY 現算＋未利用規則制**：`CFG.TODAY_STR`／`TODAY` 改 getter 每次現算（修跨午夜未利用整天填滿）；未利用改「落在 `availableSegments` 且未專注/娛樂 → 累積」規則制，移除寫死 08:00/13:30；`onFocusEnd`＋`pomoRunning` 串接。
- **idle.subtract 夾上界**：`s = min(max(a,winStart), winEnd)`，修「未利用超出現在」根因（未來不可用時段起點被當成可用終點）；時間軸／月曆／未利用統計共用底層一併正確。
- **E1 未利用升格為正式指標**：`idleMinutesForDate`／`usedFillsFor`／`idleSeries` 單一來源；月曆統計卡「未利用」＋「未利用 趨勢」折線（跟 period 切換）；每分鐘 tick 即時更新今天累積。
- **E2 未利用可寫覆盤＋趨勢標註分鐘**：未利用覆盤**不新建儲存**，沿用 `lib/reviews.ts`（`upsertReview`／`getReview`／`subscribeReviews`、雲端 LWW、空字串＝刪）；`periodKey` 前綴 `idle:`（例 `idle:2026-07`）與一般覆盤互不覆蓋。月曆未利用卡可點展開編輯；已寫方針以 `TH.yellow` 顯示；scope／key 跟 period 切換（3天→day＋range、7天→week＋`weekKey`、14天→week＋range、月→month＋`monthKey`、季→quarter＋`quarterKey`）。未利用趨勢折線每點上方標註分鐘（`LineChart.showValueLabels`，>14 點隔點顯示）。
- **趨勢標籤自適應＋課表欄寬加倍＋課表備註上雲**：未利用趨勢改 `adaptiveShowIdx`（等距抽樣＋永遠含最高／最低／最後一天）；最高紅／最低綠／圓點加大；x 軸同套 showIdx。課表日欄 `minmax(128px,1fr)`（約 2×）、`minWidth` 跟著加、時間欄 44 不變、班別覆蓋層仍用 `COL_W`；課名 `-webkit-line-clamp:2`。`LS_KEYS.scheduleNote`＋`app_state key="schedule_note"`（預設 `""`），課表頂「← 課表」右側輸入框即存即推雲。
- **課表欄寬縮 1/3＋刪分類連動課表**：`DAY_COL_MIN` 128→85。`purgeCategoryRefs`／`countCategoryRefs`（`lib/schedule.ts`）單一入口：刪大/中/小分類前 confirm（有引用則提示 N 格改未分類），persist 後降級週課表＋便利貼 `courses`（level1→`cat1=未分類`；level2 清 cat2/3；level3 清 cat3），課名時段保留、番茄歷史不動；寫入走 weekSchedule／`saveDayOverrides`＋`notifyAppState`。
- **課表欄寬動態量測**：移除固定 `DAY_COL_MIN`；元件內 `canvas.measureText` 量測週課表＋便利貼所有課名最長寬（font 700 8px），夾在 60–240px，`minmax(Npx,1fr)`＋`SCHED_MIN_W` 跟著變；課名改單行 ellipsis。SSR/無資料回退 85。
- **課程自訂色（同小分類可各自上色）**：`CourseInfo.color?`；讀取單一規則 `color || CAT.deepColorFull(...)`，四處一次改齊——課表格／便利貼單日格／直式行程表課程塊／「最近選過」。編輯卡可選跟隨分類、10 預設色、或自訂色；空＝跟分類（舊資料外觀不變）。隨 weekSchedule／dayOverrides 既有雲端同步。
- **功能B 行事曆分類篩選路徑集合化**：CalendarPage/ReviewView/analytics 由 `selCat1Set+selCat2` 舊模型改吃 `selPaths:Set<string>`＋`matchesCatSelection`（與金幣頁統一為單一分類篩選來源）；`buildDistribution` 選取時每路徑一片加總、未選時大分類總覽；`MultiCategoryFilter` 可折疊面板＋💡。
- **MultiCategoryFilter 小分類顯示修正**：小分類區塊改為「中分類被選 或 其下任一小分類被選」即展開（原本僅中分類被選才展開，導致選小分類後父層被移除→區塊收合→選中的小分類看不見）；共用元件，行事曆與金幣頁同步修好。
- **未利用單一來源化**：番茄鐘卡改用 `idleMinutesForDate`（當日夾界、扣睡眠/班別），退役 `idleTotalSecs` 累加器（移除 state/LS/累加寫入/props）；標題改「當日未利用時間加總」、移除「距離上次休息時間」與當前段進度條、加💡。與行事曆/時間軸統一為單一未利用來源。
- **番茄鐘頁『當前活動』卡**：新增 `lib/schedule.ts currentScheduleBlock(date,nowMins)` 共用判定器（作息＞班別＞課程，全部讀既有單一來源）；番茄鐘卡改為永遠顯示，依序 專注/休息/娛樂/已規劃區塊/未利用(預設)；未利用數字與顯示條件同源，非未利用狀態亦於卡底顯示今日未利用；移除設定頁「歸零未利用時間」與 `handleResetIdle`。
- **便利貼衝突處理強化（自訂鈕高亮＋一鍵移除）**：班課衝突時記住 `ovPendingPick`；尚未自訂課程時「👉 點我自訂這天課程」改黃色高亮。提醒橫幅新增含確認的「🗑 移除這 N 堂衝突課，並排入此班」：透過 `setOvCourses` 將週課 materialize 成當日自訂快照、刪除衝突課並避免重複地排入待排班別；取消確認不變更。開啟／切日期／關提醒／逐堂刪完皆同步清衝突與 pending state。
- **課表複製貼上「自動清潔＋貼不上提醒」**：複製「課程＋班別」貼上時以 `shiftRange(place, shift, day)!==""` 過濾 picks（只貼該天真能排的班，消除隱形貼券）；被略過的班以頁面層 `pasteNotice` ⚠️橫幅明列（哪個班、哪天、去管理工作場所開可上班日）；單日貼上與「貼到選取的 N 天」皆適用；複製/關閉清提醒。未動 `lib/schedule.ts`／排班模型。
- **便利貼微調（衝突紅格＋格內✕）**：班課衝突時衝突課格紅框紅底點亮（`ovConflictSlots`）、提醒精簡為一句含班別名；自訂狀態課格內建 ✕ 一鍵刪（刪完衝突自動消提醒）；沿用每週固定時紅格仍顯示但無 ✕；底部編輯器移除「移除這格」只留選/換科目。
- **便利貼 UX 改版（班＋課同框格子）**：便利貼課程編輯由扁平清單改為單日時間格子（仿課表頁）：課程是格子、班別是覆蓋色塊，重疊一眼可見；被班蓋住的時段＝placeholder 不可加課（結構防呆）；`toggleOvPick` 加班前檢查與 `ovEffectiveCourses` 衝突→擋下＋`ovCourseWarn` 提醒（不自動刪課）。自訂模式點空格/課格編輯；沿用每週固定時唯讀仍可見班壓課。技術債：未來抽共用 `<DayColumn>`（課表 7 欄與便利貼單欄）。
- **便利貼升級：班＋課一起客製**：`DayOverride` 加可選 `courses?: CourseInfo[]`（`normalizeDayOverride` 向後相容舊便利貼）；`coursesForDate` 課程單一裁決者（有 courses 整天取代、空陣列＝不排課、未定義＝沿用週固定）；`shiftTimesOn` 給便利貼編輯器算班占時段。`VerticalTimeline` 課程改 `coursesForDate`；`SchedulePage` 便利貼面板加「沿用每週固定⇄自訂這天課程」、科目庫加課/清空、存時一併寫 courses；清單顯示「・自訂課程」。課程為整天快照無孤兒；週模式課表格子不動。
- **指定日期例外排程 2b 便利貼 UI**：`SchedulePage` 加「📅 指定日期排班」面板——選日期/區間、挑任何班（不受可上班日閘門）、ungated 重疊擋、存成便利貼/設為休假/撕掉；已貼便利貼列表可點進改。`shiftRangeOn(place, shift, dateStr, isOverride)` 新增：便利貼日不看閘門、週模式仍守；`blockedRanges`/`VerticalTimeline` 改走 `shiftRangeOn`+`isOv`。週模式課表/複製貼上仍守 `shiftRange` 閘門不動。跨裝置 `day_overrides` 同步+訂閱。
- **指定日期例外排程 2a 地基（資料層＋雲端＋planForDate）**：`LS_KEYS.dayOverrides`＋`app_state` `key="day_overrides"`（比照 `day_plans` 完整鏡像：載入/訂閱/推送/LWW route A、不開新表）。`loadDayOverrides`/`saveDayOverrides`（唯一寫入）＋`planForDate(dateStr)` 單一裁決（有例外 key→整天取代、空 picks＝不排班；無例外→週模式；班別時間仍 `weekdayOf`+`shiftRange`）。`blockedRanges` 改吃 `planForDate`（`availableMinutesFor`/未利用/圓環自動跟）；`VerticalTimeline` schedulePln＋訂閱 `dayOverrides`；`CalendarPage` shiftLabel 改 `planForDate`。本批無 UI、尚無建立例外入口→使用者零可見變化。
- **課表 UX 第 1 批（完成鈕＋複製貼上）**：`WorkplaceManager` 右上角「✓ 完成」改實心強調色按鈕（`TH.accent`、白字）；`SchedulePage` 網格上方加 💡「點星期可複製整天課程／班別」提示；dayMenu 新增「一次貼多天」——多選星期 chips＋「📥 貼到選取的 N 天」（純課程只貼課程、課程＋班別連 picks 原樣搬 `{place, shift:id}`）；關閉選單清 `pasteTargets`。未動 `lib/schedule.ts`／排班模型。
- **WorkplaceManager 單段時間精簡**：單一時間段的班別隱藏 per-range 日子標籤與日子鈕（`s.ranges.length > 1` 才顯示，分配哪些天用哪段時間）；單段時只顯示「🟢 可上班日」＋起迄時間。`rangeForDay` 單段一律回 `ranges[0]`（套用所有可上班日、不看 range.days）。頂部 💡 提示改為可上班日模型文案。
- **班別加 days(可上班日)源頭閘門**：`ShiftDef` 新增 `days: string[]`（可上班日＝閘門，預設 `[]`）；`DEFAULT_WORKPLACES` 各班 `days: []`；`normalizeWorkplaces` 於 `loadWorkplaces` 正規化舊資料缺欄位→`days:[]`。`shiftRange`/`shiftTimes` 加閘門（`!sh.days?.includes(day)`→回空/[]，不在可上班日不可用）；`findShift` 維持只認 id。`WorkplaceManager` 每班別加「🟢 可上班日」chips（`setShiftDays`）；`SchedulePage` picker 只渲染 `s.days?.includes(d)` 的班（沒亮的日子不出按鈕、點不到）。需先在管理工作場所點亮可上班日，課表才能排該班。
- **班表改為只顯示明確點選**：`DEFAULT_PLANS` 改空 `{}`（移除自動預設排班——舊版每天預設帶診/彩晚班）；`loadDayPlans` `loaded[d] ?? DEFAULT_PLANS[d]`→undefined→`normalizeDayPlan`→`{picks:[]}`，全新/清空後每天預設空，已存選擇仍以 `loaded[d]` 為準不受影響。`SchedulePage` 頂部控制列「🏢 管理工作場所」後加「🧹 清空所有班別」鈕（confirm→`setDayPlans(Object.fromEntries(DAYS.map(d=>[d,{picks:[]}])))`，只動 dayPlans、不碰 weekSchedule/sessions，觸發既有存檔/推雲防呆）。
- **孤兒排班修復（reconcile 取代 prune）**：班別刪除後重建 id 變新→舊排班變孤兒，原 `pruneOrphanPicks` 直接刪除會弄丟使用者真實排班。改 `reconcileDayPlans`：id 仍有效保留；id 失效但同 `label` 班別存在→改寫成新 id（接回）；場所/班別都無→才移除。`handleWpChange` 與開頁 `orphanPrunedOnce` effect 皆改呼叫 reconcile；`changed` guard 無變動不推雲、idempotent（下次開頁 id 已有效不再改）。`WorkplaceManager` 標題列加「↺ 重設為預設」救援鈕（confirm→`onChange(DEFAULT_WORKPLACES)`，課表/番茄不受影響）＋頂部 💡 日子鈕語意說明。`findShift` 維持只認 id。
- **修 findShift phantom（只認 id ＋開頁清孤兒）**：`findShift` 移除 `|| s.label === shift`、只認 `s.id`，消除「按鈕未亮卻畫出班別塊」的不一致——因 `pickActive`/`pruneOrphanPicks` 已以 id 判斷、所有 `shiftRange`/`shiftTimes` 呼叫端皆傳 id，名字相容已無必要且有害（殘留排班按名解析出時間→畫塊＋擋重疊）。`SchedulePage` 加只跑一次的 effect（`orphanPrunedOnce` ref）開頁 `pruneOrphanPicks(workplaces)` 清掉指向不存在 id 的殘留（guard 無變動不推雲）。畫塊/時間/重疊與按鈕點亮全面以 id 一致；預設 id==label，舊真實排班仍解析得到不受影響。
- **S3-3c-2 增刪工作場所/班別**：`WorkplaceManager` 班別名稱可改（`setShiftLabel`＋`<input>`）、`＋新增班別`/`刪除班別`（`addShift`/`removeShift`）、`＋新增工作場所`/`刪除此場所`（`addWorkplace`/`removeWorkplace`，至少留一家、disabled 灰掉）；`genId` 以 `x` 前綴＋時戳亂數避撞既有「診/彩」。`SchedulePage` 每日排班 chip 改存 `s.id`（`pickActive`/`pickDisabled`/`togglePick` 第三參數；顯示仍 `s.label`；舊資料 label==id 相容）；`handleWpChange` 連帶 `pruneOrphanPicks` 以 `(placeId__shiftId)` 白名單清孤兒排班（刪場所/班別即時消失）。順手修 `theme.ts` `readableTextOn` JSDoc 回正位。S3 班別使用者化至此完成，剩 3c-d 單次微調（邊緣）。
- **修 weekSchedule MOCK 殘留＋標籤深色提亮**：① 課表假資料根除——`SchedulePage` `sched` useState 預設由 `MOCK.weekdaySchedule` 改空 `{}`、移除 `MOCK` import；`normalizeSchedule` 加 `inFixedSlot` 過濾掉落在 `FIXED_ROUTINE` 時段內的無效課格（重開排班頁即清、`saveJSON` 寫回乾淨版）。② 新增 `theme.labelOnDark(hex)`（lum<140 才往白混 0.55 保色相、非 hex 回 `#E5E7EB`）並套用：`VerticalTimeline` 課程/班別標籤、`SchedulePage` `renderClassCell` 課名＋兼差色塊四 span，深色分類色文字自動提亮可讀。MOCK 清查：`SchedulePage` 已改空；`ShopPage` `useState(MOCK.shopItems)` 為純本地展示、不寫入/不同步，保留不動；`lib/mock.ts` 定義保留。
- **3c-1b 工作場所改名稱/顏色（顏色從分類解綁）**：`WorkplaceManager` 每家加名稱 `<input>`＋`<input type="color">`（`setName`/`setColor` immutable，移除「名稱/顏色下批可改」提示）；顏色從 `CAT.cat2Color` 解綁存入 `workplace.color`——`SchedulePage` `colorSeeded` 一次性把現有分類色種進缺漏者（`w.color ? w : 種`，已有色不動、避免多裝置覆蓋自訂）＋`placeColor` 改優先讀 `workplace.color`（分類色為過渡 fallback）；`VerticalTimeline` shiftBlocks color 同改優先讀 `loadWorkplaces().color`。改名不再失色、改色即時生效＋上雲。工作場所色與分類色現為兩套（logged 兼差時間色仍走分類）。✅ 增刪已完成（3c-2）。
- **修 3c-1 日子互斥＋課表上雲**：① `WorkplaceManager.toggleDay` 改為「同班別一天只歸一段」——勾某日到某段時自動從同班別其它「有指定日子」的段移除該日（`null`/其它日子段保留為 catch-all），修掉多段同認領一天導致 `rangeForDay` 取首段、「改了沒效」。② `weekSchedule`（課程格子）上雲：`appStateCloud` 三處加 `weekSchedule`(`key="week_schedule"`、預設 `{}`)；`SchedulePage` sched 存檔 effect 改「一律存本地＋`firstSchedSave`/`skipSchedPush` 兩道防呆推雲」＋訂閱 `subscribeAppState("week_schedule")` 重載（`normalizeSchedule(loadJSON(...))`）；`VerticalTimeline` planRev 訂閱加第三條 `weekSchedule` 刷新。LWW、不開新 schema 表。
- **S3-3c-1 工作場所班別時間編輯器**：新元件 `components/schedule/WorkplaceManager.tsx`（每場所→每班別→多段 `ranges` 改時間，支援「同班別不同日子不同時間」；日子 chips 切換、空→`days:null`＝其它日子預設、`patchRange`/`addRange`/`removeRange` 全 immutable、`type="time"` colorScheme dark）。`SchedulePage` 持 `workplaces` 狀態（`loadWorkplaces`）＋訂閱 `subscribeAppState("workplaces")` 重載＋`handleWpChange`(`setWorkplaces`＋`saveWorkplaces` 即存即推雲)＋頂部「🏢 管理工作場所」開關鈕；每日選擇器 `listWorkplaces()`→`workplaces` 狀態（編輯即時反映）；加 💡 提示。`VerticalTimeline` planRev 訂閱擴充亦含 workplaces（班別時間改了時間軸刷新）。本批只改時間，名稱/顏色/增刪未做（後批）。
- **S3-3b-2 dayPlans 上雲**：每週班表選擇沿用 app_state 單例（`key="day_plans"`）。`appStateCloud` 三處各加 `dayPlans`（預設 `{}`，`loadDayPlans` 讀時正規化補預設）；`schedule.saveDayPlans` 單一寫入＝存本地＋`pushAppState`；`SchedulePage` dayPlans 存檔 effect 改 `saveDayPlans`＋`firstDayPlanSave`(初次載入不推雲)/`skipDayPlanPush`(遠端套用不回推) 兩道防呆，並訂閱 `subscribeAppState("day_plans")` 遠端較新時 `setDayPlans(loadDayPlans())`；`VerticalTimeline` 訂閱加 `planRev` 併入 `schedulePln` useMemo 依賴刷新。LWW、weekSchedule 仍純本地、不開新 schema 表。
- **S3-3b 一天可跨多工作場所＋擋重疊**：`DayPlan` 由 `{place, shifts[]}` 改 `{ picks: {place,shift}[] }`（跨場所多選）；`DEFAULT_PLANS`/`blockedRanges`/`VerticalTimeline`/`SchedulePage`/`CalendarPage`(shiftLabel) 全面改跑 picks；`loadDayPlans` 內 `normalizeDayPlan` 無痛升級舊 `{place,shifts[]}`→picks（本地、idempotent、相容新舊）；每日選擇器改列出所有場所（`listWorkplaces()`）跨店勾選，`pickOverlaps`＋`rangesOverlapStr` 嚴格 `<` 擋時間重疊（碰邊 end==start 不算重疊、可並存如彩早14:00 接診午14:00），重疊 chip 變灰(`opacity 0.3`)不可點；`togglePlace`/`toggleShift`→`togglePick`/`pickActive`/`pickDisabled`；表格上方加 💡 提示。
- **S3-3a 班別取用點資料驅動化**：`Place` 由 `"診"|"彩"` 放寬為 `string`（不再卡死兩家、為 3b 新增場所鋪路）；移除 `PLACE_NAME`/`PLACE_SHIFTS` 兩個 const，改 live 取值函式 `listWorkplaces()`/`placeName(id)`(找不到回退 id)/`placeShifts(id)`（皆讀 `loadWorkplaces()`）；`SchedulePage`（`placeColor`/`togglePlace` valid/`shiftsOfPlace`/覆蓋層標籤）與 `VerticalTimeline`（shiftBlocks label/color）取用點全面改用；每日場所選擇器外觀未動（仍單一「診」chip 切換診/彩，一般化留 3b）。全 repo 無殘留 `PLACE_NAME`/`PLACE_SHIFTS`、設定＝預設故畫面零變化。
- **S3-2 班表設定上雲**：班表沿用 app_state 單例（`key="workplaces"`）。`storage.LS_KEYS` 加 `workplaces`；`schedule` 加 `loadWorkplaces`(空/缺一律 fail-safe 回 `DEFAULT_WORKPLACES`)／`saveWorkplaces`(存本地＋`pushAppState`)／`ensureWorkplacesSeeded`(首次只寫本地不推雲、交給 sync LWW 對帳)；`findShift` 預設參數 `DEFAULT_WORKPLACES`→`loadWorkplaces()`，`shiftRange`/`shiftTimes` 隨之 live（六種班別輸出逐字不變）；`appStateCloud` 三處(`APP_STATE_KEYS`/`LS_FOR_KEY`/`DEFAULT_FOR_KEY`)各加 `workplaces`(預設 `[]` 避循環)；`App` 掛載 `ensureWorkplacesSeeded()`＋訂閱 `subscribeAppState("workplaces")` 用 `bumpWp` 重畫。順手整併重複 helper：刪 `toMinHM/fmtHM3`、僅留一份 `toMin/fmtHM`(移到 shiftTimes 前)。對外 `PLACE_NAME`/`PLACE_SHIFTS` 仍為 const(留 S3-3 註解)、`SchedulePage`/`VerticalTimeline` 未改、未開新 schema 表。
- **排班頁時間欄 sticky 凍結**：左側 44px 時間欄左右捲動恆顯（Excel 凍結首欄）。新增 `timeBackdropStyle`（`position:sticky, left:0, zIndex:6, background:TH.bg, height:"100%"`）包住四處第一欄：① header 星期列「時間」（背板 flex 底對齊保留原 `alignSelf:end` 視覺）② header 班別 chip 列首個空白格 ③ class 列時間 ④ fixed 列兩分支時間（背板 `height:100%` 填滿作息塊高、時間數字維持靠上）。背板不透明＋`zIndex:6`（高於日格與班別覆蓋層 `zIndex:5`），右捲時日格滑入底下不透出。未改 `gridTemplateColumns`/`COL_W`/`leftForDay`，班別覆蓋層座標不變、未新增第二欄；純呈現層、與 S3 資料層無關。
- **S3-1 班別設定資料化**：新增 `WorkplaceConfig`/`ShiftDef`/`ShiftRangeDef` 型別＋`DEFAULT_WORKPLACES`（診/彩兩處、逐字對齊現行寫死時間；午班用 `days:["一","三","五"]`/`["二","四","六","日"]` 分流）；`PLACE_NAME`/`PLACE_SHIFTS` 改 `Object.fromEntries` 自設定推算、`shiftRange`/`shiftTimes` 改 `findShift`+`rangeForDay` 讀設定，`shiftTimes` 由 range 以 `t+30<=end` 推算消除與 `shiftRange` 各寫死一份的重複；對外匯出名稱/型別/簽名/回傳值零變化（六種班別逐字驗證一致：診早 08:30~12:00 末格 11:30、診午一三五 14:00 起／二四六日 14:30 起、診晚 18:00~22:00、彩早 07:30~14:00 末格 13:30、彩晚 14:00~22:00）；`isMonWedFri` 已不再被內部使用但保留匯出未刪；`SchedulePage`/`VerticalTimeline` 一行未改。
- **覆盤靈感(free)上雲（row-based）**：`ReviewEntry` 加 `uuid?`；新增 `ensureFreeUuids`(冪等補號)、`pushFreeCloud`(以 uuid 當 reviews 表 `id` 主鍵 upsert onConflict id)、`deleteFreeCloud`；`addReview(free)` 給 uuid＋推雲、`removeReview(free)` 刪雲；`syncReviewsFromCloud` 末段對 free 做 uuid-last-write-wins 合併（拉 `.eq scope free`、雲有本地無→加、兩邊有→較新者勝、本地新/雲無→推）。reviews 表已有 uuid 主鍵 id、不受 partial-unique(scope<>'free') 影響，免改 schema。至此日/週/月/季＋靈感全上雲。
- **修「重置會被雲端拉回」**：`lib/reviews.ts` 加 `clearReviewsCloud()`（比照 getUid/sb，刪 reviews 表該 user_id 列）；`App.handleResetAllData` 於 `clearFlowLifeStorage()` 後加 `saveCategories(DEFAULT_CATEGORIES)`（分類重置＋推雲蓋舊）與 `void clearReviewsCloud()`（清雲端覆盤）。至此重置後雲端＝番茄空/金幣0/記錄空/分類預設/覆盤空，不再被下次同步拉回；`handleClearRecords` 未動。
- **分類上雲（沿用 app_state 單例）**：`appStateCloud` 的 `APP_STATE_KEYS`/`LS_FOR_KEY`/`DEFAULT_FOR_KEY` 各加 `categories`（預設 `[]`，不 import `DEFAULT_CATEGORIES` 避循環）；`syncAppStateFromCloud` 迴圈自動納入、套用時既有 `emit("categories")` 通知。`saveCategories` 存檔後加 `void pushAppState(APP_STATE_KEYS.categories, data)`（雲端套回走 saveJSON 不經 saveCategories→不互推）。`App` 加 `const [,bumpCat]=useState(0)`＋訂閱 `subscribeAppState("categories")` 觸發重畫。至此番茄/金幣/分類全上雲跨裝置一致。
- **金幣餘額/金幣記錄上雲（app_state）**：新增 `lib/appStateCloud.ts`（`sb`/`getUid`、`APP_STATE_KEYS={coins,coinLog}`、本地 meta `loadMeta`/`setMetaTs`(`LS_KEYS.appStateMeta`)、`subscribeAppState`/`emit` 以 key 分組、`pushAppState(key,value)` upsert onConflict `user_id,key`、`syncAppStateFromCloud` 兩 key 各做 雲無→推本地／雲新→寫回 LS＋meta＋emit／本地新→推雲）＋`components/hooks/useAppStateCloudSync`（掛載＋`onAuthStateChange` 同步）；`useCoins`/`useCoinLog` 加 `lastPushedRef`（hydrate 設值、本地變動才推、訂閱套回擋回推）；`App` 並列 `useAppStateCloudSync()`。`LS_KEYS` 加 `appStateMeta`。Supabase 需建 `app_state(user_id,key,value jsonb,updated_at)`＋unique(user_id,key)＋RLS。未登入＝純本地。
- **番茄上雲（S2-cloud）**：新增 `lib/sessionsCloud.ts`（比照 `lib/reviews.ts`：`sb`/`getUid`/`subscribeSessions`/`emitSessions`、`toRow`/`fromRow` 物件↔SQL 欄位、`pushSessionCloud(uuid)` upsert onConflict uuid、`deleteSessionCloud(uuid)`、`syncSessionsFromCloud` 拉合併 last-write-wins＋本地較新者回推、`syncSessionDiffToCloud(prev,next)` 增量 fire-and-forget）＋`components/hooks/useSessionCloudSync`（掛載＋`onAuthStateChange` 觸發同步）；`Session` 加 `updatedAt`（`confirmRating`/`buildManualSession`/`setSessionMins`/`patchReflection` 四寫入點皆蓋 ISO 時戳）；`App.updateSessions` 存檔後 `syncSessionDiffToCloud`、新增 `subscribeSessions` effect（用原始 `setSessions` 讀回本地、不再觸發推送）、並列 `useSessionCloudSync()`。uuid 為雲端主鍵、未登入＝純本地、localStorage 全程保留。
- **Batch 2b 收尾**：① 一次性回填舊金幣連結——`useCoinLog.linkRowsToSessions(sessions)`（無 `sessionUuid` 的舊金幣列依 `date`/起訖時間對到舊番茄 `uuid`、有變動才寫）＋ return `coinLogHydrated`；`App` 用 `didLinkCoinRef` 在 `hydrated && coinLogHydrated` 時跑一次，讓舊番茄改時長/刪除也能連動金幣。② `DEFAULT_CATEGORIES` 換成使用者實際分類樹（含自訂顏色與 uuid 形式 id；型別維持 `BigCat[]`）。③ 移除臨時「📋 複製分類設定」鈕。
- **金幣連動修正（Batch 2）**：修「手動補番茄沒進金幣記錄、刪番茄沒清金幣列、改時長金額沒同步」三問題——`useCoinLog` 以 `bumpCoinAmountBySession(uuid, delta)`（依差額調整、`Math.max(0,...)`、保留里程碑/寶箱加成）取代 `updateCoinAmountBySession`；`App.handleAddManualSession` 改 `ensureSessionUuid` 後 `appendCoinRow`（帶 `sessionUuid`）、`handleEditSessionMins` 用 `coinDelta` 呼 `bumpCoinAmountBySession`。刪除金幣連動現已由垃圾桶流程取代：軟刪不動，永久刪除才 `removeCoinRowsBySession`。舊番茄/舊金幣列無 uuid 者連動不生效（本批不回填）。
- **金幣記錄收歸單一來源 `useCoinLog`**：新增 `components/useCoinLog.ts`（比照 `useCoins`，讀/寫 `LS_KEYS.coinIncomeLog`＋`appendCoinRow`/`removeCoinRowsBySession`/`updateCoinAmountBySession`/`resetCoinLog`），由 `App.tsx` 持有並往下傳 prop；`usePomodoro` 刪掉自己那份 state＋load/save effect、改吃 `coinIncomeLog`/`setCoinIncomeLog` prop；`PomodoroPage`/`CoinHistoryPage` 同改吃 prop（不再各自存）。消除雙份狀態互蓋的隱藏雷（金幣頁編輯後再跑番茄不會被覆蓋）。`CoinIncomeLogRow` 加 `sessionUuid?`，`confirmRating` 產生 session 時給 `uuid` 並讓金幣列帶 `sessionUuid`（為下一批「依番茄連動刪/改」鋪路）。行為零變化。
- **補番茄表單兩項**：① 名稱改非必填（移除 submit 名稱檢查、placeholder 改「名稱（可留空）」），`buildManualSession` 名稱留空時依序退用 `cat3→cat2→cat1→"手動番茄"`；② 新增「📅 從課表帶入」（表單最上方）：`schedule.loadScheduleCourses()` 為週課表課程清單**單一讀取來源**（去重＋依 `cat1+n` 排序），點一筆一鍵帶入大/中/小分類與名稱（顏色點＋名稱＋分類路徑）；課表為空（`courses.length>0` 守衛）不顯示該區塊。
- **番茄歷史頁兩項改善**：① 手動補番茄改用 `CategorySelector`（重用課表同一套大/中/小三層、選大才出中、選中才出小），`CategorySelector.onShowCategoryManager` 改可選（不傳則不顯示 ⚙️、不會跳離半填表單；PomodoroPage 仍傳故照常顯示），`buildManualSession` input／session 補 `cat2`/`cat3`、`App.handleAddManualSession` input 型別同步加 `cat2`/`cat3`；② 歷史每顆 `SessionRow` 改「分類為主」：最前顏色圓點（`CAT.deepColorFull`）＋小分類（最深層）大字、中/大分類小字在後（`catParts=[cat3,cat2,cat1].filter(Boolean)`），名稱/手動/時間降為次行小字；右側 mins/✏️/🗑 與編輯刪除區未動。
- **S2-3 番茄並存 uuid 跨裝置主鍵**：`Session` 加可選 `uuid`（與 number `id` 並存，上雲主鍵用、`id` 不轉型）；`sessions.ensureSessionUuid`（`s.uuid ? s : 補 crypto.randomUUID()`，只補不覆蓋、冪等）＋`stampSession = stampSessionCatIds(ensureSessionUuid(s))` 合一入口；`App.updateSessions` 守衛改 `raw.some(s => !s.uuid || (s.cat1 && !s.cat1Id)) ? raw.map(stampSession) : raw`（啟動載入順手替舊番茄補 uuid）；本步無處讀 uuid＝純前置、行為零變化，未動計時/number id。
- **S2-2a 番茄並存分類編號**：`Session` 加可選 `cat1Id/cat2Id/cat3Id`（與名字並存）；`categories.resolveCatIds(cat1,cat2?,cat3?)` 由名字查編號；`sessions.stampSessionCatIds`（`!cat1` 原樣回、`??` 只補不覆蓋、找不到名字不清舊編號）；`App.updateSessions` 存檔前 `raw.some(s=>s.cat1&&!s.cat1Id)` 才 `map(stampSessionCatIds)`（單一接縫覆蓋所有番茄產生路徑＋啟動順手補舊番茄）；本步無處讀編號＝純並存 groundwork、行為零變化，未動計時邏輯/`cascadeRename`。

---

## 暫緩決策帳本

| 決策 | 內容 |
|------|------|
| reviews 上提 App.tsx | 現況 `DayReview`／`ReviewNudgeCard` 各自 load/save 或直讀 `getReview`；暫緩原因＝覆盤頁與主頁不同 tab 不同時掛載，第三步經評估不需上提；**觸發上提時機＝未來同畫面同時出現浮現卡與覆盤編輯、需即時連動時**（附原脈絡：Batch C 走 `calIntent` 跳轉即可）。 |
| ~~行事曆與金幣頁兩套分類篩選~~ ✅ 已解決 | 行事曆與金幣頁兩套分類篩選 → 已統一為 `matchesCatSelection` 單一來源（`selPaths:Set<string>`＋`MultiCategoryFilter`）。 |
| 週/月/季靈感 | 現況靈感僅「日」；暫緩原因＝週 key＝週一日期會與日靈感撞同格；觸發＝若要週級靈感，把 free key 命名空間化為 `scope:periodKey`。 |
| ~~過去期數導覽~~ ✅ 已完成 | 日/週/月/季皆可用 ‹ › 往過去翻（`dayOffset`／`offset`，`CFG.TODAY` 推算，不可往未來），舊總結可編輯儲存走該期 key。 |
| ~~free 靈感上雲~~ ✅ 已解決 | 靈感(free) row-based 上雲：每則 `uuid`(對應 reviews 表 `id` 主鍵)、`ensureFreeUuids` 冪等補號、`addReview(free)`→`pushFreeCloud`、`removeReview(free)`→`deleteFreeCloud`、`syncReviewsFromCloud` 末段 uuid-LWW 合併；免改 schema。 |
| ~~過去期數 UI 入口~~ ✅ 已完成 | 四分頁皆有 ‹ › 導覽鈕可回看/編輯過去期間。 |
| ~~S1-3b 覆盤頁即時刷新~~ ✅ 已完成 | `DayReview`/`PeriodReview` 已訂閱 `subscribeReviews`，雲端/他處變更自動刷新；`editingRef` 守衛打字中不被覆蓋。 |
| 開回 email confirmation | 測試階段關閉信箱驗證；觸發＝上線前。 |
| 關閉開放註冊 | Supabase Auth 目前開放註冊；觸發＝主帳號建好後關閉。 |
| 自訂 SMTP | 觸發＝多人版上線。 |
| Google 一鍵登入 | 加值功能；觸發＝有需求時。 |
| ~~idleTotalSecs 跨日歸零~~ ✅ 已解決 | 未利用改單一來源 `idleMinutesForDate`，當日自動歸零、扣睡眠班別；`idleTotalSecs` 已退役。 |
| ~~未利用顯示依賴旗標~~ ✅ 已解決 | 未利用顯示依賴旗標導致作息時段整張卡消失 → 改為共用判定器 `currentScheduleBlock` 同源；番茄鐘「當前活動」卡永遠顯示。 |
| 待辦進行中即時碳掉未利用 | 目前完成（有 `endAt`）後才碳；觸發＝要「進行中」即時碳掉時。 |
| 「明細」分頁改名 | 建議改「番茄反思」以與期間總結區隔；觸發＝命名定案時。 |
| ~~手動補番茄跨午夜~~ ✅ 已解決 | `buildManualSession` 改雙 `datetime-local`（`startAt`/`endAt` 各含日期），`while` 迴圈按本日 24:00 切段、回傳多顆 `Session`，金幣一次算在第一段；跨午夜自動分段記到各天。 |
| 多裝置刪除「復活」硬化（墓碑/deletedAt 同步） | 目前軟刪會先從 active sessions 雲端刪除，再以 app_state 備份垃圾桶；sessionsCloud 尚無 tombstone，離線／多裝置競態下舊 session 仍可能被合併回 active。**觸發時機＝Capacitor 多裝置階段**：在 sessions 雲端模型同步 `deletedAt` 墓碑並讓合併層以墓碑壓過舊 active row。 |
| 娛樂計時為單機本地狀態，多裝置同步待評估 | **刻意本地**——進行中的計時娛樂存 `LS_KEYS.activeEnt`，不上雲；重開 App 依 `startAt` 時間戳續算倒數與退幣。多裝置同步待 Capacitor／多裝置階段再評估。 |
| 娛樂時間／番茄倒數結束前 2 分／1 分本機推播 | **暫緩至 Capacitor 原生打包批次**——Web 環境在 App 切走／手機鎖屏時無法可靠發提醒，目前僅 App 開著時提示；計時採結束時間戳記帳，關閉 App 再回來仍能正確結算與退幣。真推播需 Capacitor 原生殼；**進行 Capacitor 原生打包批次時必須一併實作本機推播提醒（結束前 2 分／1 分），並回頭移除本條。** |
| ~~reset 未清雲端~~ ✅ 已解決 | `handleResetAllData` 已清雲端全部：番茄(`updateSessions([])`)、金幣(`resetCoins`/`resetCoinLog`→push 0/[])、分類(`saveCategories(DEFAULT_CATEGORIES)`→推雲)、覆盤(`clearReviewsCloud()`)；重置後雲端＝番茄空/金幣0/記錄空/分類預設/覆盤空，不再被拉回。 |
| ~~分類尚未上雲~~ ✅ 已完成 | 分類沿用 app_state 單例 `key="categories"`，`saveCategories` 推雲＋`App` 訂閱刷新（番茄/金幣/分類全上雲）。 |
| 技術債 #1 班別硬寫死 | ✅ **S3 班別使用者化完成**（S3-1~3c-2）：資料化、上雲、跨店 picks、重疊擋、時間/名稱/顏色可編、場所/班別增刪、pick 存班別 id、`findShift` 只認 id、孤兒 `reconcileDayPlans`、`ShiftDef.days` 可上班日閘門、單段時間隱藏 per-range 日子鈕（`rangeForDay` 單段套用所有可上班日）、WorkplaceManager「重設為預設」救援鈕。**剩**：⬜ S3-3d 單次微調（邊緣）。 |
| ~~工作場所顏色綁分類名~~ ✅ 已解 | 3c-1b 顏色已解綁存入 `workplace.color`（`colorSeeded` 種子＋`placeColor`/`VerticalTimeline` 優先讀 color），改名不掉色。註：工作場所色與分類色現為兩套，logged 兼差時間色仍走 `CAT.cat2Color`。 |
| 【指定日期例外排程】 | ✅ **2a+2b 完成**（`day_overrides`/`planForDate`/`shiftRangeOn`＋課表便利貼面板）。**待辦**：`reconcileOverrides`（班別刪除後孤兒便利貼清理，比照 `reconcileDayPlans`）。 |
| 抽 DayColumn 共用元件 | **技術債**——便利貼單日格子與課表頁 7 欄格子有渲染邏輯重複；未來抽共用 `<DayColumn>` 元件（課表頁與便利貼共用），現階段隔離不改動已穩定課表頁。 |
| 便利貼新建科目 | **待議**——便利貼加課僅能從 `loadScheduleCourses` 科目庫選；全新科目需先在每週課表建立。未來如需在便利貼直接新建科目再議。 |
| reconcileOverrides 待辦 | 便利貼引用的班別被刪後 key 殘留但無害（`findShift`→空）；未來加 `reconcileOverrides` 比照 `reconcileDayPlans` 清孤兒。 |
| 例外排程：過去日期不自動清除 | **刻意保留**——過去日期的例外不自動清除，供時間軸/未利用回看歷史（非 bug）。 |
| 例外能否跨「可上班日」閘門 | ✅ **已決策（分流）**——**複製貼上/週模式課表**：守 `shiftRange` 閘門＋略過提醒；**便利貼**（2b）：`shiftRangeOn(..., isOverride=true)` 不受閘門，可挑任何班。 |
| session/分類 name-based 改 uuid | **S2-2a＋S2-3 完成**——番茄並存 `cat1Id/cat2Id/cat3Id`（`stampSessionCatIds`）＋並存 `uuid` 跨裝置主鍵（`ensureSessionUuid`，只補不覆蓋、冪等），`App.updateSessions` 經 `stampSession` 單一接縫補（含啟動載入補舊番茄）；名字/number `id` 仍為現行權威、尚無處讀編號或 uuid（行為零變化）。**待**：番茄上雲使用 uuid 主鍵、S2-2b 改名/顯示改用編號退役 `cascadeRename`、週課表/coinLog 編號化。 |
| ~~購買紀錄雙來源~~ ✅ 已解決 | 已移除本地 `purchaseLog`；商店「最近購買／購買記錄」皆讀金幣帳本 `kind="spend"`（`spendRows`／`allSpendRows`）；取消購買只動帳本即兩處同步。 |

---

## 十一、待完成事項 ⬜

- ⬜ 待辦提醒：依 `reminder` 觸發推播／系統通知（目前僅儲存設定）
- ⬜ 健康模組
- ⬜ 閱讀模組
- ⬜ **覆盤頁 #3/#4/#5**：最佳專注時段（startTime 分桶）、未利用時間趨勢（lib/idle.idleMinutes 折線）、計畫vs實際（重用 95/10/5 模型）— #2 骨架已完成。
- ✅ **覆盤表 reviews（item 4）**：日/週/月/季總覆盤＋過去期數導覽（‹ › 翻頁）＋訂閱即時刷新皆完成；✅ 靈感(free) 也 row-based 上雲（uuid 鍵、LWW），覆盤全分頁全上雲。
- ⬜ PWA 圖示（手機安裝用）
- ⬜ Git 功能分支習慣建立
- ✅ **Supabase S1 完成**（reviews 試點端到端雲端同步已真機驗證）；多表全面同步留 S2
- ✅ **過去期數導覽**（日/週/月/季 ‹ › 翻頁，資料已在雲端）
- 🔄 **S2 分類 ID 化**：✅ S2-1/1b（整棵樹 id 化）＋✅ S2-2a（番茄並存 `cat1Id/2Id/3Id`、尚未被讀取）；⬜ **S2-2b** 改名/顯示改用編號、退役 `cascadeRename`；⬜ 週課表/coinLog 編號化。
- ✅ **S2-3 番茄 uuid**：`Session.uuid` 並存、`updateSessions` 經 `stampSession` 補 uuid。
- ✅ **番茄上雲（S2-cloud）完成**：`lib/sessionsCloud`＋`useSessionCloudSync`（uuid 主鍵、last-write-wins、localStorage 為快取/備援、未登入純本地）；`Session.updatedAt` 四寫入點蓋時戳；`updateSessions` 增量推雲＋訂閱讀回。Supabase `sessions` 表需含對應欄位＋RLS（user_id）。
- ✅ **金幣餘額/金幣記錄上雲（app_state）完成**：`lib/appStateCloud`＋`useAppStateCloudSync`，單例以 `(user_id,key)` 為主鍵（`key="coins"`／`"coin_income_log"`），last-write-wins by 本地 meta（`LS_KEYS.appStateMeta`）vs 雲端 `updated_at`；`useCoins`/`useCoinLog` 用 `lastPushedRef` 擋遠端套用後回推。Supabase `app_state` 表需含 `(user_id,key,value jsonb,updated_at)`＋unique(user_id,key)＋RLS。
- ✅ **分類上雲完成（番茄＋金幣＋分類全上雲，跨裝置一致）**：分類沿用 app_state 單例（`key="categories"`）；`saveCategories` 本地存檔後 `void pushAppState`，雲端套回走 appStateCloud→`saveJSON`（不經 saveCategories→不互推）；`App` 訂閱 `subscribeAppState("categories")` 用 `bumpCat` 觸發重畫讓子元件重讀 `CAT.*`。
- 🔄 **S3 班別設定可編輯**：✅ **S3-1~3c-2 全完成**（資料化、上雲、Place 放寬、DayPlan picks 跨店＋重疊擋、dayPlans/weekSchedule 上雲、WorkplaceManager 時間/名稱/顏色/增刪班別與場所、`reconcileDayPlans` 孤兒以 label 接回、pick 存班別 id、`findShift` 只認 id、`ShiftDef.days` 可上班日閘門、picker 只渲染當天可上班班別、班表只顯示明確點選＝`DEFAULT_PLANS` 空＋「🧹 清空所有班別」）。⬜ **剩 S3-3d** 單次微調（邊緣）；✅ **指定日期例外排程 2a+2b**（便利貼 UI＋`shiftRangeOn`）；⬜ **reconcileOverrides**（見帳本）；⬜ **S4** 金鑰移 Edge Functions。
- ✅ **D1 商店商品資料化**：商品可存 LS＋雲端同步＋編輯（instant／time 欄位齊備）；time 購買已於 D2a 開放。
- ✅ **D2a 計時購買／倒數／退幣**：全額先扣、結束時調整原 spend 帳列（不滿一分鐘不計）；同時僅一個娛樂；本地 `activeEnt` 續算。
- ✅ **D2b 開始專注自動結束娛樂＋2/1 分提醒**：`beginFocus`→`onFocusStart`→`endEntertainment`；剩 2 分／1 分 toast（App 開啟時）；真推播待 Capacitor。
- ✅ **D3a 娛樂結束記 session**：`splitSpanByDay`＋`earnedCoins:0`；進時間軸／月曆統計。
- ✅ **D3b 金幣頁商品支出分類（productCat）**：消費列帶 `productCat`；收支 view 支出依商品分類分組。
- ✅ **R1 固定作息資料化＋編輯器**：`loadRoutine`/`saveRoutine`/`RoutineManager`；小項＋細節存檔；label 單一組字。
- ⬜ **R1b 點小項看細節**：時間軸／課表點作息小項展開 detail。
- ⬜ **R2 某天不一樣（per-date 上雲＋UI）**：當日作息覆寫上雲與編輯 UI 強化。
- ✅ **R3 課表頭尾折疊**：核心 06:00–23:00，可展開凌晨/深夜；作息編輯器可拖曳排序。
- ⬜ **已完成待辦時段納入月曆未利用**：時間軸已用 doneTodos 的 startAt～endAt 當 fills；月曆 `idleMinutesForDate` 暫不傳 extraFills，兩邊略有差異。
- ⬜ **娛樂 session 加 `source:"entertainment"` 標記**：讓「取消購買↔移除 session」以 id 精準對應（目前以 name+date+零幣比對）。

---

*最後更新：2026/07/23（番茄鐘當前活動卡＋currentScheduleBlock）*
*維護原則：每次完成重要功能，同步更新第十、十一節*
