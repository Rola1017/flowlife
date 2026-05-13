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
├── pomodoro/（PomodoroPage / RingTimer / CategorySelector / CatBadge）
│
├── timeline/
│   ├── TimelinePage.tsx   ← 版面由上到下：直式行程表 → 橫向行程條 → 待辦清單
│   └── VerticalTimeline.tsx
│
├── calendar/（CalendarPage / DayViewPage）
├── todo/（TodoCard / useTodos.ts）
├── schedule/（SchedulePage）
├── settings/（SettingsPage — 重置資料、顯示 v1.0.0）
└── shop/（ShopPage）

lib/
├── theme.ts      ← TH 色彩常數（唯一來源）
├── categories.ts ← CATEGORY_TREE + CAT helpers
├── config.ts     ← CFG（TODAY_STR / TODAY 全部動態 new Date()，DAY_END = "23:00"）
├── mock.ts       ← MOCK 假資料
├── utils.ts      ← fmt / pctPos / pctH / buildTimelineHours / DS / DE / DT / toM
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

---

## 五、VerticalTimeline 關鍵規格

**高度**：840px
**時間範圍**：06:30 ～ 23:00（`DAY_END = "23:00"`）

| 區域 | 位置 | 說明 |
|------|------|------|
| PLN 預定欄 | `left:4, right:"47%"` | 可點擊編輯（daily override） |
| ACT 實際欄 | `left:"47%", right:4` | 可點擊編輯 |
| 分隔線 | `left:"50%"` | 視覺分界 |
| 待辦（未完成） | `left:"35%", transform:translateX(-50%)` | 黃框黃字，用 startTime 定位 |
| 待辦（已完成） | `left:"65%", transform:translateX(-50%)` | 暗色低調，用 endAt 定位 |

**zIndex**：PLN(2) → ACT(3) → 分隔線(4) → 待辦浮層(6) → 紅線(10) → override popup(20)

**點擊行為**：
- 空白處 → `onTimeClick(time)` → 快速新增待辦面板（24小時制）
- PLN 區塊 → override popup（名稱/分類/時間，只改今天）
- ACT 區塊 → 同上，key 用 `act_${item.start}`

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

## 九、Cursor 開發必讀（重要提醒）

1. **`SL` 元件** → `import { Card, SL } from "@/components/ui/Card"`
2. **日期全動態** → `CFG.TODAY_STR = new Date().toISOString().slice(0,10)`
3. **金幣兩套** → COIN_TABLE（時長）+ MILESTONES（里程碑）都要接
4. **番茄評分** → 同時更新 Header 的 😤🙂😴 計數器
5. **圖表純 SVG** → 不裝任何圖表庫
6. **next.config.ts** → `ignoreBuildErrors: true, ignoreDuringBuilds: true`
7. **改動前確認範圍** → 先說「會影響哪些檔案」，確認後再動

---

## 十、已完成功能 ✅

- localStorage 持久化（todos/coins/sessions/評分）
- 元件拆分（33個檔案）
- 設定頁（重置資料、v1.0.0）
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

---

## 十一、待完成事項 ⬜

- ⬜ 待辦提醒：依 `reminder` 觸發推播／系統通知（目前僅儲存設定）
- ⬜ 週課表串聯直式行程表（PLN 改為動態讀取今天的課）
- ⬜ 健康模組
- ⬜ 閱讀模組
- ⬜ PWA 圖示（手機安裝用）
- ⬜ Git 功能分支習慣建立
- ⬜ Supabase（確定多人使用再做）

---

*最後更新：2026-05-13*
*維護原則：每次完成重要功能，同步更新第十、十一節*
