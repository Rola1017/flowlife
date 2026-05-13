# FlowLife 習慣追蹤 APP — 專案規則手冊 v2.0

> **版本**：v2.0（2026-05-12）
> **環境**：Next.js 16 App Router + TypeScript
> **部署**：Vercel · `https://flowlife-iota.vercel.app`
> **GitHub**：`https://github.com/Rola1017/flowlife`
> **localStorage 前綴**：`flowlife_v1_`

---

## 一、APP 核心定位

FlowLife 是個人時間掌控工具，核心閉環：
> 計畫（課表）→ 執行（番茄鐘）→ 記錄（待辦）→ 覆盤（行事曆）

---

## 二、現在的檔案結構

```
app/
├── page.tsx              ← "use client" 必須第一行，只有 8 行，引入 App 元件
├── layout.tsx
├── globals.css

components/
├── App.tsx               ← 根元件，管理全域狀態 + 頁面路由（subPage state）
├── Header.tsx            ← 固定頂部，顯示今天日期（動態）、設定按鈕
├── useCoins.ts           ← 金幣全域 Hook
│
├── ui/
│   ├── Card.tsx          ← 也 re-export SL（export { SL } from "./SL"）
│   ├── Chip.tsx
│   ├── BackBtn.tsx
│   └── SL.tsx            ← 小標籤元件
│
├── charts/
│   ├── LineChart.tsx
│   ├── PieChart.tsx
│   ├── CatBars.tsx
│   ├── TriCharts.tsx
│   └── WeekHeat.tsx
│
├── home/
│   ├── HomePage.tsx
│   └── BattleCard.tsx
│
├── pomodoro/
│   ├── PomodoroPage.tsx
│   ├── RingTimer.tsx
│   └── CategorySelector.tsx
│   └── CatBadge.tsx
│
├── timeline/
│   ├── TimelinePage.tsx   ← 版面：直式行程表在上，待辦清單在下
│   └── VerticalTimeline.tsx ← 共用元件，時段頁和行事曆詳情頁都用
│
├── calendar/
│   ├── CalendarPage.tsx
│   └── DayViewPage.tsx
│
├── todo/
│   ├── TodoCard.tsx       ← phase: pending/started/ending/done，結束有 2 秒防抖
│   └── useTodos.ts        ← localStorage 持久化，key: flowlife_v1_todos
│
├── schedule/
│   └── SchedulePage.tsx   ← 週課表，可編輯
│
├── settings/
│   └── SettingsPage.tsx   ← 重置資料按鈕，顯示 v1.0.0
│
└── shop/
    └── ShopPage.tsx       ← 購買記錄，key: flowlife_v1_purchase_log

lib/
├── theme.ts               ← TH 色彩常數（唯一來源，不要在元件 hardcode）
├── categories.ts          ← CATEGORY_TREE + CAT helpers
├── config.ts              ← CFG，TODAY_STR 和 TODAY 都是動態 new Date()
├── mock.ts                ← MOCK 假資料（PLN/ACT 行程、昨日番茄等）
├── utils.ts               ← fmt / pctPos / pctH / buildTimelineHours / DS / DE / DT / toM
├── tabs.ts                ← TABS 導航頁籤設定
└── storage.ts             ← LS_KEYS 常數 + loadJSON / saveJSON 工具函式
```

---

## 三、全域狀態（在 App.tsx）

| 狀態 | 說明 | 持久化 |
|------|------|--------|
| `coins` / `setCoins` | 金幣餘額 | ✅ localStorage |
| `focused/neutral/distracted` | 番茄評分計數 | ✅ localStorage |
| `idleTrackStart` | 未利用時間起始點（timestamp） | ❌ session only |
| `todos` | 待辦清單（useTodos Hook） | ✅ localStorage |
| `subPage` | 子頁面路由（schedule/shop/dayView） | ❌ state only |

---

## 四、localStorage 鍵值一覽

所有 key 定義在 `lib/storage.ts` 的 `LS_KEYS`：

| Key | 內容 |
|-----|------|
| `flowlife_v1_todos` | 待辦清單陣列 |
| `flowlife_v1_coins` | 金幣餘額數字 |
| `flowlife_v1_sessions` | 番茄鐘歷史紀錄 |
| `flowlife_v1_focused/neutral/distracted` | 評分計數 |
| `flowlife_v1_purchase_log` | 商店購買記錄 |
| `flowlife_v1_coin_income_log` | 金幣收入記錄 |
| `flowlife_v1_daily_override_YYYY-MM-DD` | 當天行程表的個別修改 |

---

## 五、VerticalTimeline 關鍵規格

**高度**：840px（1.5 倍，方便看密集時段）

**欄位劃分**：
- PLN 預定欄：`left: 4, right: "47%"`
- ACT 實際欄：`left: "47%", right: 4`
- 分隔線：`left: "50%"`

**待辦疊加**：
- 未完成（pendingTodos）→ PLN 欄中心（`left: "35%", transform: translateX(-50%)`），黃框黃字
- 已完成（doneTodos）→ ACT 欄中心（`left: "65%", transform: translateX(-50%)`），暗色低調
- 已完成待辦用 `endAt`（實際完成時間）定位，不用 `startTime`
- 同一時間多個 done todo → flex row 並排，gap: 0

**zIndex 層序**：
PLN 背景(2) → ACT 背景(3) → 分隔線(4) → 待辦浮層(6) → 紅線(10) → override popup(20)

**點擊功能**：
- 點擊空白處 → 計算對應時間 → 觸發 `onTimeClick(time)` → 快速新增待辦面板
- 點擊 PLN 區塊 → 彈出 override popup（可改名稱、分類、時間，只改今天）
- 點擊 ACT 區塊 → 同上，存入 `act_${item.start}` key

**daily override 邏輯**：
- key：`flowlife_v1_daily_override_YYYY-MM-DD`
- 不影響週課表範本，只覆蓋今天的顯示

---

## 六、UI 設計規範

### 色彩系統（從 lib/theme.ts 引入，不要 hardcode）
```typescript
TH.bg      = "#09090B"  // 最深背景
TH.card    = "#111113"  // 卡片
TH.border  = "#1E1E24"  // 邊框
TH.text    = "#F4F4F5"  // 主文字
TH.muted   = "#52525B"  // 次要
TH.accent  = "#F97316"  // 橘色主色
TH.green   = "#22C55E"  // 休息/完成
TH.red     = "#EF4444"  // 警示/未利用時間
TH.yellow  = "#F59E0B"  // 待辦/提醒
TH.gold    = "#FBBF24"  // 金幣
```

### 原則
- 全部用 inline style，不用 Tailwind class
- 手機優先，maxWidth: 430px
- 暗色系，不用白色背景頁面
- 圓角：卡片 14px，按鈕 20px，小元素 8px

---

## 七、重要注意事項（Cursor 必讀）

1. **`SL` 元件**從 `@/components/ui/Card` 引入（Card.tsx 有 re-export），不要從 SL.tsx 直接引
2. **日期全部動態**：`CFG.TODAY_STR = new Date().toISOString().slice(0,10)`，不要寫死
3. **金幣有兩套計算**：COIN_TABLE（時長）+ MILESTONES（里程碑），不能只接一套
4. **待辦 phase**：`pending → started → ending（2秒防抖）→ done`
5. **圖表純 SVG 手刻**，不用任何圖表庫
6. **TimelinePage 版面順序**（由上到下）：直式行程表 → 橫向行程條 → 待辦清單卡片
7. **番茄鐘評分**同時更新 Header 的 😤🙂😴 計數器（不只是記錄）
8. **next.config.ts** 已設定 `ignoreBuildErrors: true` 和 `ignoreDuringBuilds: true`

---

## 八、目前仍是假資料的部分（日後接 Supabase）

| 項目 | 位置 | 說明 |
|------|------|------|
| PLN 預定行程 | `MOCK.schedule.PLN` | 靜態，尚未串聯週課表 |
| ACT 實際行程 | `MOCK.schedule.ACT` | 靜態假資料 |
| 昨日番茄鐘 | `MOCK.yesterdayPomos` | 假資料，對戰卡用 |
| 熱力圖 | `MOCK.heat` | 假資料 |
| 折線趨勢圖 | `MOCK.lineData` | 假資料 |
| 月曆資料 | `genMonthData()` | 種子亂數產生 |

---

## 九、已確認完成的功能

- ✅ localStorage 持久化（todos/coins/sessions/評分）
- ✅ 元件拆分（33個檔案）
- ✅ 設定頁（重置資料、v1.0.0版本標記）
- ✅ 動態日期
- ✅ ErrorBoundary
- ✅ 新增待辦功能（時段頁）
- ✅ 購買記錄 + 金幣收入記錄
- ✅ 直式行程表點擊新增待辦
- ✅ 預定/實際區塊點擊編輯（daily override）
- ✅ 已完成待辦用實際完成時間定位
- ✅ 紅線對應真實時間（每分鐘更新）
- ✅ 行程表延伸至 23:00
- ✅ 行程表高度 840px

---

## 十、待完成的事項

- ⬜ 週課表串聯直式行程表（PLN 改為動態讀取今天的課）
- ⬜ TimelinePage 版面修正（直式行程表要在待辦清單上面）
- ⬜ 健康模組
- ⬜ 閱讀模組
- ⬜ Supabase 接入（等確定多人使用再做）
- ⬜ PWA 圖示設定（手機安裝用）
- ⬜ Git 功能分支習慣

---

*最後更新：2026-05-12*
*維護原則：每次完成重要功能，更新「已完成」和「待完成」兩個表格*
