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
├── useCoins.ts           ← 金幣全域 Hook
├── useCoinLog.ts         ← 金幣記錄單一來源 Hook（coinIncomeLog 讀/寫/append/依番茄刪改/reset）
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
| `flowlife_v1_purchase_log` | 商店購買記錄 |
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

**大分類篩選**（`selCat1Set: string[]`）：
- 空集合＝全部加總
- 單擊某大分類＝單選（可下鑽中分類 `selCat2`，僅恰選 1 大類時有效）
- 長按大分類 chip＝多選加總（`Chip.onLongPress`，450ms，長按不誤觸單擊）

**period 視窗**（圓餅／長條用 `periodRange`；折線用 `buildLineSeries`）：
- `3天`／`7天`／`14天`／`季`：以今天往回
- `月`：導覽中的 `curY`／`curM`

**分佈切片**（`buildDistribution`）：0 或 ≥2 大類→大分類；1 大類→中分類；1 大類+中分類→小分類。

**月曆四宮格**：時長／日均／有效天＋番茄數 `x/y`（滿10分顆數／滿25分顆數，旁註「滿10/25分」）。

**月曆圓圈**（比照週曆 95/10/5 模型）：內圈 r=13＝可用內讀書（`activeColor` 弧）＋底圈 `TH.border` 未畫滿處＝未利用；外圈 r=15 藍弧＝加碼 off-hours（`offDash > 0` 才畫，不與內弧重疊）；不再用總讀書同圈 overflow。

**連動**：月曆圈圈 `focusByDate`、四宮格、`TriCharts` 三圖皆吃 `sessionMatches` 篩選。

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

**入口**：`CalendarPage` 頂端 `calMode` 切換「📆 行事曆／🔍 覆盤」；預設行事曆；分類 chips 兩段與行事曆模式共用（`selCat1Set`／`selCat2`）。

**資料來源**：真實 `sessions`，篩選「有意圖或覆盤」的番茄（`intention?.trim() || reflection?.trim()`）；零 MOCK。

**期間視窗**：自帶 `period` state（3天／7天／14天／月／季），用 `lib/analytics.periodRange`；**不**與行事曆 `TriCharts` 的 `period` 共用。

**分類篩選**：`lib/analytics.sessionMatches(s, cats, cat2)`。

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
9. **金幣記錄＝`useCoinLog` 單一來源** → `coinIncomeLog` 只在 `App.tsx` 經 `useCoinLog()` 持有並讀/寫 `LS_KEYS.coinIncomeLog`，往下傳 prop；`usePomodoro`／`PomodoroPage`／`CoinHistoryPage` 一律用傳入的 `coinIncomeLog`/`setCoinIncomeLog`，禁止任何元件再自開一份 state 或各自 load/save（避免雙份互蓋）
10. **番茄雲端同步＝`lib/sessionsCloud`** → 番茄上雲（push/delete/拉合併）一律走 `sessionsCloud`（uuid 主鍵、last-write-wins by `updatedAt`、localStorage 為本機快取/備援）；寫入路徑由 `App.updateSessions` 末端 `syncSessionDiffToCloud(prev,next)` 自動增量推送，禁止元件各自直連 supabase 寫 sessions
11. **app_state 雲端同步＝`lib/appStateCloud`** → 金幣餘額（`coins`）與金幣記錄（`coin_income_log`）整包單例上雲，以 `(user_id,key)` 為主鍵、last-write-wins（本地 `LS_KEYS.appStateMeta` 時戳 vs 雲端 `updated_at`）；`useCoins`/`useCoinLog` 本地變動才 `pushAppState`、訂閱 `subscribeAppState` 套回，禁止元件各自直連 supabase 寫 app_state

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
- **歷史頁可改時長/刪除**：`SessionHistoryPage` 每日彙總下列逐顆 session（依 `endTime` 由晚到早）；改時長／刪除（二次確認）走 `lib/sessions.setSessionMins`／`removeSession`（單一寫入來源，回傳 `{sessions, coinDelta}`，為 Supabase S2 預留接縫），只動餘額＋該筆 `earnedCoins` 基礎幣、餘額 `Math.max(0,...)` 不為負；里程碑/寶箱不回溯、`coinIncomeLog` 帳本不變；無 `id` 舊資料改/刪鈕 disabled。`Session` 新增 `manual?` 欄。
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
- **金幣連動修正（Batch 2）**：修「手動補番茄沒進金幣記錄、刪番茄沒清金幣列、改時長金額沒同步」三問題——`useCoinLog` 以 `bumpCoinAmountBySession(uuid, delta)`（依差額調整、`Math.max(0,...)`、保留里程碑/寶箱加成）取代 `updateCoinAmountBySession`；`App.handleAddManualSession` 改 `ensureSessionUuid` 後 `appendCoinRow`（帶 `sessionUuid`）、`handleDeleteSession` 先抓 target 再 `removeCoinRowsBySession`、`handleEditSessionMins` 用 `coinDelta` 呼 `bumpCoinAmountBySession`。舊番茄/舊金幣列無 uuid 者連動不生效（本批不回填）。**臨時**：`CategoryManager` 最下方加「📋 複製分類設定（給 Claude）」唯讀複製鈕，**下批移除**。
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
| 週/月/季靈感 | 現況靈感僅「日」；暫緩原因＝週 key＝週一日期會與日靈感撞同格；觸發＝若要週級靈感，把 free key 命名空間化為 `scope:periodKey`。 |
| ~~過去期數導覽~~ ✅ 已完成 | 日/週/月/季皆可用 ‹ › 往過去翻（`dayOffset`／`offset`，`CFG.TODAY` 推算，不可往未來），舊總結可編輯儲存走該期 key。 |
| ~~free 靈感上雲~~ ✅ 已解決 | 靈感(free) row-based 上雲：每則 `uuid`(對應 reviews 表 `id` 主鍵)、`ensureFreeUuids` 冪等補號、`addReview(free)`→`pushFreeCloud`、`removeReview(free)`→`deleteFreeCloud`、`syncReviewsFromCloud` 末段 uuid-LWW 合併；免改 schema。 |
| ~~過去期數 UI 入口~~ ✅ 已完成 | 四分頁皆有 ‹ › 導覽鈕可回看/編輯過去期間。 |
| ~~S1-3b 覆盤頁即時刷新~~ ✅ 已完成 | `DayReview`/`PeriodReview` 已訂閱 `subscribeReviews`，雲端/他處變更自動刷新；`editingRef` 守衛打字中不被覆蓋。 |
| 開回 email confirmation | 測試階段關閉信箱驗證；觸發＝上線前。 |
| 關閉開放註冊 | Supabase Auth 目前開放註冊；觸發＝主帳號建好後關閉。 |
| 自訂 SMTP | 觸發＝多人版上線。 |
| Google 一鍵登入 | 加值功能；觸發＝有需求時。 |
| idleTotalSecs 跨日歸零 | 待議；觸發＝確認跨日行為後。 |
| 待辦進行中即時碳掉未利用 | 目前完成（有 `endAt`）後才碳；觸發＝要「進行中」即時碳掉時。 |
| 「明細」分頁改名 | 建議改「番茄反思」以與期間總結區隔；觸發＝命名定案時。 |
| ~~reset 未清雲端~~ ✅ 已解決 | `handleResetAllData` 已清雲端全部：番茄(`updateSessions([])`)、金幣(`resetCoins`/`resetCoinLog`→push 0/[])、分類(`saveCategories(DEFAULT_CATEGORIES)`→推雲)、覆盤(`clearReviewsCloud()`)；重置後雲端＝番茄空/金幣0/記錄空/分類預設/覆盤空，不再被拉回。 |
| ~~分類尚未上雲~~ ✅ 已完成 | 分類沿用 app_state 單例 `key="categories"`，`saveCategories` 推雲＋`App` 訂閱刷新（番茄/金幣/分類全上雲）。 |
| 技術債 #1 班別硬寫死 | **S3-1~S3-3c-1 完成**——班別資料化、workplaces＋dayPlans 上 app_state 同步、`DayPlan` picks 跨店、`pickOverlaps` 擋重疊、`WorkplaceManager` 可改班別時間（含日子差異）即存即上雲；**剩**：S3-3c-1b 改名/改色（含顏色解綁）、S3-3c-2 場所/班別增刪、S3-3d 單次微調。 |
| 工作場所顏色綁分類名 | 目前班別色塊顏色＝`CAT.cat2Color("兼差", placeName)`（綁「兼差」中分類下的場所名）；3c-1b 改名/改色前需先把顏色解綁、存入 `workplace.color` 並讓取用點改讀之，否則改名會連動掉色。 |
| session/分類 name-based 改 uuid | **S2-2a＋S2-3 完成**——番茄並存 `cat1Id/cat2Id/cat3Id`（`stampSessionCatIds`）＋並存 `uuid` 跨裝置主鍵（`ensureSessionUuid`，只補不覆蓋、冪等），`App.updateSessions` 經 `stampSession` 單一接縫補（含啟動載入補舊番茄）；名字/number `id` 仍為現行權威、尚無處讀編號或 uuid（行為零變化）。**待**：番茄上雲使用 uuid 主鍵、S2-2b 改名/顯示改用編號退役 `cascadeRename`、週課表/coinLog 編號化。 |

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
- 🔄 **S3 班別設定可編輯**：✅ **S3-1 完成**（班別資料化：`WorkplaceConfig`/`DEFAULT_WORKPLACES`，`shiftRange`/`shiftTimes` 改讀設定、對外簽名零變化）；✅ **S3-2 完成**（班表上雲：app_state `key="workplaces"`、`loadWorkplaces`/`saveWorkplaces`/`ensureWorkplacesSeeded`、`findShift` 改讀 `loadWorkplaces()`、fail-safe 回退、整併重複 helper）；✅ **S3-3a 完成**（`Place` 放寬 string、移除 `PLACE_NAME`/`PLACE_SHIFTS` const 改 `placeName`/`placeShifts`/`listWorkplaces` live、兩消費端取用點全面改用）；✅ **S3-3b 完成**（`DayPlan` 改 `{picks}` 一天可跨多場所、`normalizeDayPlan` 無痛升級舊格式、每日選擇器列所有場所跨店勾選、`pickOverlaps` 擋重疊碰邊不算、重疊 chip 變灰）；✅ **S3-3b-2 完成**（dayPlans 上雲 app_state `key="day_plans"`、`saveDayPlans` 單一寫入、`firstDayPlanSave`/`skipDayPlanPush` 兩道防呆、訂閱重載、VerticalTimeline `planRev` 刷新）；✅ **S3-3c-1 完成**（`WorkplaceManager` 改班別時間＋日子差異、immutable patch、即存即上雲、SchedulePage 持狀態＋訂閱、VerticalTimeline 訂閱 workplaces 刷新）；⬜ **S3-3c-1b** 改名/顏色（含顏色解綁）＋⬜ **S3-3c-2** 場所/班別增刪＋⬜ **S3-3d** 單次微調。

---

*最後更新：2026/06/30（修 3c-1 toggleDay 日子互斥一天只歸一段＋weekSchedule 課表上雲 app_state key=week_schedule、兩道防呆＋訂閱重載、VerticalTimeline 加訂閱刷新）*
*維護原則：每次完成重要功能，同步更新第十、十一節*
