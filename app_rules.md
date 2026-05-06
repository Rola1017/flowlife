# FlowLife 習慣追蹤 APP — Cursor 專案交接手冊

> **版本**：v13（2026-05-06）  
> **原型環境**：Claude.ai Artifacts（React JSX 單檔）  
> **目標環境**：Next.js 14 App Router + TypeScript + Tailwind  
> **部署目標**：Vercel

---

## 一、APP 核心定位

**FlowLife** 是一款個人時間掌控工具，核心理念是：

> 「讓每一分鐘都被看見、被選擇、被記錄。」

不只是番茄鐘，而是一套**從計畫 → 執行 → 覆盤**的完整閉環：
- 早上：看今天的預定行程 + 必做清單
- 執行中：番茄鐘計時 + 即時分類
- 休息後：追蹤未利用時間
- 晚上：行事曆覆盤 + 金幣獎勵

---

## 二、目前已完成的功能模組（v13 原型）

### 📱 導航頁籤（6個）
| 頁籤 | 狀態 | 說明 |
|------|------|------|
| 🏠 主頁 | ✅ 完成 | 昨今對戰卡 + 必做清單 + 覆盤方針 |
| 📅 時段 | ✅ 完成 | 待辦卡片 + 直式行程表（預定/實際雙欄） |
| 🍅 番茄 | ✅ 完成 | 完整番茄鐘系統（見下方詳述） |
| 📆 行事曆 | ✅ 完成 | 月曆 + 點日期進入當天詳情頁 |
| 💪 健康 | 🔲 佔位 | 尚未開發 |
| 📚 閱讀 | 🔲 佔位 | 尚未開發 |

### 🍅 番茄鐘系統（最核心）
- **時長選擇**：5分 / 25分 / 60分 / 90分
- **分類系統**：大 → 中 → 小三層（學習/事業/閱讀/健康/兼差/活動/未分類）
- **圓環計時器**：專注/休息遞減，未利用時間遞增
- **休息加時**：+1/3/5/10/20/30分鐘按鈕
- **未利用時間追蹤**：休息結束未開始下一顆 → 自動計時，灰色圓環 + 紅字橫幅
- **評分機制**：每顆結束評 😤專心 / 🙂一般 / 😴分心
- **金幣獎勵**：依時長計算，達里程碑額外獎勵
- **跨頁面持久**：未利用時間狀態提升至 App 層，切頁面不中斷

### 📅 時段 & 日期詳情頁
- 直式行程表共用元件 `VerticalTimeline`（時段頁 & 行事曆詳情頁共用）
- **待辦疊加**：未完成 → PLN預定欄（黃框黃字 + 黃線）；已完成 → ACT實際欄（白底黑字 + 黑線）
- 有時間段（含開始+結束時間）的待辦會延伸垂直線

### 🗓️ 行事曆
- 月曆視圖：每天圓環顯示當日專注量
- 分類篩選：大分類 + 中分類
- 點擊任意日期 → 進入詳情頁（待辦卡片 + 行程表）
- 圖表：圓餅圖 / 橫條圖 / 折線趨勢圖

### 📋 週課表（子頁面）
- 週一～週五固定課程格子
- 週六/日可切換早班/晚班模式（對應不同可用時段）

### 🏪 金幣商店（子頁面）
- 顯示可兌換獎勵 + 自訂新增商品
- 金幣餘額全域共享

---

## 三、UI 設計規範

### 色彩系統（全部使用 inline style，不用 Tailwind class）
```typescript
const TH = {
  bg: "#09090B",      // 最深背景
  card: "#111113",    // 卡片背景
  border: "#1E1E24",  // 邊框
  text: "#F4F4F5",    // 主文字
  muted: "#52525B",   // 次要文字
  accent: "#F97316",  // 主色（橘）
  green: "#22C55E",   // 休息 / 完成
  red: "#EF4444",     // 警示 / 未利用時間
  yellow: "#F59E0B",  // 待辦 / 提醒
  gold: "#FBBF24",    // 金幣
  // + blue / purple / cyan / pink（各分類用）
};
```

### 設計原則
- **暗色系**為主，不使用白色背景頁面
- **圓角**：卡片 14px，按鈕 20px（膠囊），小元素 8px
- **字體**：`-apple-system, 'Noto Sans TC', sans-serif`
- **全部用 inline style**，不依賴 Tailwind（方便未來遷移）
- 手機寬度優先（maxWidth: 430px，置中）
- 避免過多標題層級，資訊用小標籤（`SL` 元件）帶過

### 分類顏色規則
每個大分類有固定主色，中分類有子色，全部集中在 `CATEGORY_TREE` 物件管理，**不要分散在各元件裡 hardcode**。

---

## 四、假資料清單（尚未接上資料庫的部分）

以下所有資料目前都是 `MOCK` 物件裡的靜態假資料，**頁面刷新就會消失**：

| 假資料項目 | 變數位置 | 說明 |
|-----------|---------|------|
| 今日/昨日番茄鐘紀錄 | `MOCK.todayPomos` / `MOCK.yesterdayPomos` | 含分類、時長、評分 |
| 預定行程 | `MOCK.schedule.PLN` | 每日固定預定時段 |
| 實際行程 | `MOCK.schedule.ACT` | 每日實際執行紀錄 |
| 熱力圖資料 | `MOCK.heat` | 過去7天各時段分類 |
| 折線趨勢圖 | `MOCK.lineData` | 3天/7天/14天/月/季 |
| 月曆資料 | `genMonthData()` | 用種子亂數假造，非真實 |
| 週課表 | `MOCK.weekdaySchedule` | 固定課程安排 |
| 商店商品 | `MOCK.shopItems` | 可兌換獎勵清單 |
| 今日待辦 | `MOCK.initTodos` | 初始4筆待辦 |
| 金幣餘額 | `useState(1240)` | 每次刷新重置 |
| 日期鎖定 | `CFG.TODAY_STR = "2026-05-02"` | 寫死的今天，非動態 |

**唯一真實運作的狀態**（頁面不刷新時有效）：
- 番茄鐘倒數計時
- 未利用時間計時
- 待辦開始/結束/完成操作
- 金幣增減（session 內有效）

---

## 五、程式架構說明（給 Cursor AI 看）

### 檔案結構（現在是單檔原型）
```
habit-tracker-v13.jsx  ← 全部塞在這一個檔案
```

### 遷移後建議的元件拆分
```
app/
├── page.tsx                  ← 主框架（Header + Nav + 頁面路由）
├── layout.tsx                ← 根 Layout
components/
├── ui/
│   ├── Card.tsx
│   ├── Chip.tsx
│   └── BackBtn.tsx
├── charts/
│   ├── LineChart.tsx
│   ├── PieChart.tsx
│   └── CatBars.tsx
├── pomodoro/
│   ├── PomodoroPage.tsx
│   ├── RingTimer.tsx
│   └── CategorySelector.tsx
├── timeline/
│   ├── TimelinePage.tsx
│   └── VerticalTimeline.tsx   ← 行程表（含待辦疊加）
├── calendar/
│   ├── CalendarPage.tsx
│   └── DayViewPage.tsx
├── todo/
│   ├── TodoCard.tsx
│   └── useTodos.ts            ← 自訂 Hook
└── shop/
    └── ShopPage.tsx
lib/
├── theme.ts                   ← TH 色彩常數
├── categories.ts              ← CATEGORY_TREE + CAT helpers
├── config.ts                  ← CFG 設定
└── utils.ts                   ← fmt / fmtMs / pctPos 等工具函式
```

### 狀態管理現況
- **全局狀態**（在 App 根層）：`coins`、`focused/neutral/distracted`、`idleTrackStart`、`todos`
- **頁面狀態**（各頁元件內）：番茄倒數、休息秒數、分類選擇、月份偏移等
- 目前無 Context / Zustand / Redux，規模夠小可先保持
- 若待辦需要跨頁操作，`useTodos` Hook 已抽出可直接共用

### 關鍵設計模式
- **子頁面路由**：用 `subPage` state 模擬，不用 Next.js router（原型方便）→ **遷移後應改為真實路由**
- **`VerticalTimeline`**：時段頁 & 日期詳情頁共用，傳入 `date` prop 決定顯示哪天的待辦

---

## 六、Cursor 應該優先知道的事

1. **`"use client"` 必須在 page.tsx 第一行**，否則 App Router 環境報錯
2. **日期今天是動態的**，`CFG.TODAY_STR` 現在寫死，需要改成 `new Date().toISOString().slice(0,10)`
3. **所有圖表用純 SVG 手刻**，不用任何圖表庫（recharts/chart.js 都不用），遷移時不需安裝
4. **待辦的 `phase` 欄位**有四個值：`"pending"` / `"started"` / `"ending"` / `"done"`，結束有 2 秒防抖
5. **金幣計算有兩套**：按時長的 `COIN_TABLE` + 達里程碑的 `MILESTONES`，別只接一套
6. **番茄鐘評分**不是只有記錄，它同時更新 Header 的 😤🙂😴 計數器
7. **`VerticalTimeline` 的 zIndex 層序**：PLN背景(2) → ACT背景(3) → 分隔線(4) → 待辦浮層(6) → 紅線(10)

---

## 七、進入 Cursor 後的優先實作步驟

### Step 1：把假資料接上 localStorage（1-2小時）
先不用真資料庫，用 `localStorage` 讓資料在刷新後還在。
優先順序：① 待辦清單 → ② 番茄鐘歷史紀錄 → ③ 金幣餘額

```typescript
// 範例：useTodos.ts 加上持久化
useEffect(() => {
  localStorage.setItem('todos', JSON.stringify(todos));
}, [todos]);
```

### Step 2：把路由改成真正的 Next.js 路由（2-3小時）
目前 subPage 是用 state 模擬的假路由，改成真實路由後：
- 瀏覽器上下頁按鈕才能用
- 每個頁面有獨立 URL（方便 Vercel 分享）
- 推薦路由結構：
  ```
  /                → 主頁
  /timeline        → 時段
  /pomodoro        → 番茄鐘
  /calendar        → 行事曆
  /calendar/[date] → 日期詳情頁
  /shop            → 商店
  ```

### Step 3：接上 Supabase 資料庫（4-6小時）
建議用 Supabase（有免費方案 + Next.js 官方支援）。

最小可行資料表：
```sql
-- 番茄鐘紀錄
CREATE TABLE pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  started_at TIMESTAMPTZ,
  duration_mins INT,
  cat1 TEXT, cat2 TEXT, cat3 TEXT,
  task_name TEXT,
  rating TEXT, -- '😤' | '🙂' | '😴'
  coins_earned INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 待辦事項
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  text TEXT,
  cat TEXT,
  start_time TEXT,
  end_time TEXT,
  must_do BOOLEAN DEFAULT FALSE,
  date DATE,
  phase TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 八、快速參考：元件對照表

| 元件名稱 | 功能 | 重要 props |
|---------|------|-----------|
| `PomodoroPage` | 番茄鐘主頁 | `idleTrackStart`, `setIdleTrackStart`（從App傳入） |
| `VerticalTimeline` | 直式行程表 | `todos`, `date`（決定哪天的待辦） |
| `DayViewPage` | 行事曆日期詳情 | `date`, `label`, `todos`, `onBack` |
| `CategorySelector` | 三層分類選擇 | `cat1/cat2/cat3`, `onChange` |
| `TodoCard` | 待辦卡片 | `todo`, `onStart`, `onEnd`, `onToggleDone` |
| `useTodos` | 待辦狀態管理 Hook | 回傳 `{todos, handleStart, handleEnd, handleToggleDone}` |
| `BattleCard` | 昨今對戰卡 | `pomos`, `prevMins`, `prevCount` |

---

*最後更新：2026-05-06 by Claude Sonnet*  
*對應原型檔案：habit-tracker-v13.jsx*
