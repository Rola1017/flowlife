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

**固定作息**：PLN 欄固定作息讀 `routineBlocksInWindow(DS, DE)`，來源 `lib/schedule.FIXED_ROUTINE`（🍴 三餐／😴 起床·午覺；睡覺 23:00–24:00 在時間軸窗外不顯示）

**ACT 資料來源**（`MOCK.schedule.ACT` 已棄用，VerticalTimeline 不再 import MOCK）：

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
- placeholder 正名為「想弄懂的小概念／小目標」；≤60 字、可選；開始後鎖定，專注中顯示在計時圈下方；寫入 `Session.intention`（空白不存）；`quickStart` 無意圖

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
- 不可用區間單一來源：`blockedRanges(date)`＝固定作息 `ROUTINE_RANGES` ∪ 當日班別（已合併）
- `availableMinutesFor`＝1440 − blocked 總長
- 固定作息單一來源：`FIXED_ROUTINE`（`ROUTINE_RANGES` 衍生）— 睡眠 00:00–06:30、起床 06:30–07:00、早餐 07:00–08:00、午餐 12:00–13:00、午覺 13:00–13:30、晚餐 17:00–18:00、睡覺 23:00–24:00；無班別時基準可用 **750 分**（1440−690）
- 週曆／月曆圈圈百分比皆吃此函式；課表改班別後重整即反映
- **班別邏輯**（技術債 #1 **已完成**）：`SchedulePage`、`CalendarPage`、`VerticalTimeline` 皆 import `lib/schedule.ts`（`PLACE_NAME` / `shiftRange` / `loadDayPlans` / `weekdayOf` / `availableMinutesFor`）。時間軸與課表固定作息皆已改讀 `routineBlocksInWindow`／`FIXED_ROUTINE`，本地 `FIXED_BLOCKS`／手寫 `ROWS` 已移除
- 已移除 `LS_KEYS.weekendShifts` 與 `lib/utils.getAvailableMinutes` 死碼

---

## 九、Cursor 開發必讀（重要提醒）

1. **`SL` 元件** → `import { Card, SL } from "@/components/ui/Card"`
2. **日期全動態** → `CFG.TODAY_STR = toLocalDateStr()`（本地 YYYY-MM-DD，禁止 toISOString 取日期）
3. **金幣兩套** → COIN_TABLE（時長）+ MILESTONES（里程碑）都要接
4. **番茄評分** → 同時更新 Header 的 😤🙂😴 計數器
5. **圖表純 SVG** → 不裝任何圖表庫
6. **next.config.ts** → `ignoreBuildErrors: true, ignoreDuringBuilds: true`
7. **改動前確認範圍** → 先說「會影響哪些檔案」，確認後再動

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
- 直式行程表 ACT 已真實化：讀當日 `sessions`（有起訖才畫唯讀色塊）+ `dailyOverride` 手動補登（`act_`／`man_` key）；點 ACT 空白新增補登、點補登色塊可編輯；`MOCK.schedule.ACT` 已棄用
- 直式行程表 ACT 未利用時間：可用時間內空檔深灰墊底（`lib/idle`）；fills 僅番茄＋補登；作息／班別不畫灰、off-hours 番茄不遮蓋；今天填至現在、過去填整天、未來不填
- 直式行程表待辦顯示開關：未完成／已完成可獨立隱藏（時間軸疊圖 only），持久化 `LS_KEYS.timelineTodoView`
- 直式行程表三餐圖案統一為 🍴（起床／午覺／睡覺仍 😴）
- **技術債 #2（實色底文字色寫死）已關閉**：新增 `lib/theme.ts:readableTextOn(bg)` 為單一來源，套用於 `VerticalTimeline` 的 `actSessions`／`dailyOverride`。未來任何在「實色背景上印文字」的新 UI，文字色一律改讀 `readableTextOn`，禁止再寫死 `#111`／`#fff`。
- 番茄「意圖一句話」：開始前填意圖→鎖定→專注中顯示→存進 `Session.intention`（可選，空白不存）。
- 主頁「覆盤方針」假卡 → 改真實「🎯 今日意圖回顧」：列今日有意圖的番茄（評分＋意圖＋名稱·分類·時長），移除寫死假文字。為 Stage 2 專屬覆盤頁鋪路。
- 作息統一為 `lib/schedule.FIXED_ROUTINE` 單一來源（含 `routineBlocksInWindow`）；`availableMinutesFor` 改讀 `ROUTINE_RANGES`；移除 `lib/utils.getAvailableMinutes` 死碼。
- **第二層完成**——時間軸與課表顯示改吃 `FIXED_ROUTINE`，emoji 統一 🍴/😴，早餐 07:00–08:00、22:30 可排課。
- **第三層完成**——未利用改「可用內」算法：抽 `lib/idle.ts`；`blockedRanges` 為不可用單一來源；時間軸灰塊＝可用時間內空檔（off-hours 番茄不遮蓋）。
- **週曆三段線完成**：95/10/5 模型上線（可用內＋未利用第一圈、加碼外圈藍線、`totalPct` 可破百）。
- **月曆圓圈**也改新模型（內圈可用內＋底圈未利用、外圈 r=15 藍色加碼）；週／月視圖一致。
- **habit-tracker8 派工 1/2**：待辦預設時間改 `nowHM`／`roundHM5`／`addMinHM`（+60 分）；未完成待辦疊圖 zIndex 7＞已完成 6；時段頁補登提示；月曆死碼 `pct` 清除。
- **habit-tracker8 派工 2/2**：`Session.id`＋`reflection`；`lib/sessions.patchReflection` 覆盤寫入單一來源；評分後可選寫覆盤；意圖 UI 收合＋正名「小概念／小目標」。

---

## 十一、待完成事項 ⬜

- ⬜ 待辦提醒：依 `reminder` 觸發推播／系統通知（目前僅儲存設定）
- ⬜ 健康模組
- ⬜ 閱讀模組
- ⬜ **覆盤／閱讀筆記佔位**：主頁假覆盤卡已除；專屬週／月洞察覆盤頁仍 ⬜（未利用時間趨勢可接 `lib/idle.idleMinutes`）
- ⬜ PWA 圖示（手機安裝用）
- ⬜ Git 功能分支習慣建立
- ⬜ Supabase（確定多人使用再做）

---

*最後更新：2026-05-19*
*維護原則：每次完成重要功能，同步更新第十、十一節*
