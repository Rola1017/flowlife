# FlowLife 批次 M｜habit-tracker18 收尾報告

日期：2026-09-26  
對話：habit-tracker18  
Git：Cursor **未** add／commit／push；改動保留工作區。

---

## 任務 1：快捷新增跨裝置缺口（先查證，未改同步）

### (a) 兩裝置模擬測試

`tests/quickTodoSync.test.ts`：

- A 快捷路徑：`createTodoFormDraft(today, { startTime, endTime, mustDo: true })` → `formDraftToTodoPatch` → `normalizeTodo`
- B 底部路徑：`createTodoFormDraft(today)`（無時間）同一套 patch
- `mergeTodosWithTombstones` 雙向後兩 id 都在，且 `todoShowsOn(t, today)` 皆 true
- 對調路徑再跑一次
- property ≥200：隨機哪台走快捷、亂序夾帶額外筆，合併後非墓碑 id 雙向都在

**結果：合併層沒有「快捷寫不進去／他機濾掉」的缺口。** 兩條路徑都進同一個 `onAddTodo` → `makeTodo` → `pushAppState(todos)`。本批**沒有**加強制推送或輪詢。

### (b) DayView 快捷 date 是不是檢視日？

**是。** 這是 Rola「另一台在看今天、看不到」最可能的**顯示**原因（不是同步丟資料）。

| 入口 | 快捷 `createTodoFormDraft` 的 date |
|---|---|
| `TimelinePage` 點空白 | `CFG.TODAY_STR`（今天） |
| `DayViewPage` 點空白 | **`viewDate`（當時檢視的那一天）** |

DayView `submitQuickTodo` 也寫 `date: result.patch.date || viewDate`。若在日詳情翻到昨天／明天再點空白，該筆綁在那一天；他機主頁／時段頁只看今天就會以為「沒同步」。

時段頁底部與快捷都是今天，**若 Rola 是在時段頁點空白，(b) 解釋不了。**

### (c) `normalizeTodo`／`todoShowsOn` 會不會因 mustDo／startTime 濾掉？

**不會。** `todoShowsOn` 只看 `date`／`endDate`。`normalizeTodo` 保留 `mustDo`、`startTime`，缺欄不丟整筆。測試已鎖死。

附帶（非同步、且與回報方向相反）：時間軸 overlay `pendingTL` 只畫有 `startTime` 的待辦；無時間的底部新增只出現在下方清單。快捷**有**時間，overlay 反而比較容易看到。

### (d) 結論

**查無同步缺口。** 已排除：

1. 快捷／底部寫入函式分叉  
2. merge 把快捷筆吃掉  
3. mustDo／startTime 讓他機 `todoShowsOn` 失敗  
4. 為了看起來修好而加 force-push／輪詢（未做）

若真機再復現：先對設定頁「資料筆數」（任務 2）；數字一樣＝資料在、是顯示日／畫面；數字不一樣＝再查那台 pull。優先核對是否從**日詳情非今天**快捷新增。

---

## 任務 3：快捷面板子標籤（渲染差異）

兩條路徑都渲染**同一個** `TodoFormFields` → 完整 `CategorySelector`（`showQuickLane`、群組、`＋ 加標籤`），不是簡化版。

瀏覽器底部「＋新增待辦」已見到：領域、`＋ 加標籤`、難／普通／易、重要性、精力。

| | Timeline 底部 | Timeline 快捷 | DayView 底部 | DayView 快捷 |
|---|---|---|---|---|
| 表單 | `TodoFormFields` | 同左 | 同左 | 同左 |
| CategorySelector | 完整 | 完整 | 完整 | 完整 |
| autoFocusName | 否 | 是 | 否 | 是 |
| 預設時間 | `defaultTodoStartTime/End` | 同左 | 寫死 `09:00` | 同左 |
| date | `TODAY_STR` | `TODAY_STR` | `viewDate` | `viewDate` |

本批 UX：標籤區塊改到名稱欄正下方（難易度不再埋在日期鍵盤下面）；`TagTreePicker` `zIndex` 80→**210**（底 nav 99）。未另寫簡化選擇器。

---

## 任務 8：週檢視待辦色塊

**以前：** 無 `startTime` 的待辦 `getWeekSlot` 回 `null`，**週曆不畫**（Rola 找不到色塊的主因；不是沒同步）。

**現在：** `weekTodoSlot` 永遠有格：未排（無時間或 06 前）／早 06–12／午 12–18／晚 18–24。色塊 `cardStyle("todo")`＋左側標籤色、`TH.text` 9px。圖例「未排 無時間」。

瀏覽器週曆已見到「Z5驗…」黃框色塊在未排列。

**月曆不畫待辦色塊**（只有週曆疊圖）。

**分類篩選目前影響：** 週曆待辦疊圖、番茄圈圈／分鐘統計、`TriCharts`、覆盤明細（同一組 `selTags`）。不影響待辦寫入與同步。

---

## 其餘任務

2. 雲端同步卡本機筆數：`待辦 N（未完成 X／已完成 Y）、番茄 N、垃圾桶 N`＋💡。`lib/localCounts.ts`，不上雲。  
4. 孤兒「開啟編輯」→ 既有 `TodoEditSheet`；「刪除這筆」`confirm`＋`deleteTodo` 墓碑。關編輯後 `ensureTodoTagsMigrated`。  
5. `useActionCooldown`（400ms）；DayView 換日 `arm`；開始／完成／刪除 `wrap`；編輯與換日鍵不擋。誤按開始 💡 再按取消。  
6. 重置 `data-danger-zone="1"` 置底＋註解。瀏覽器確認最後一塊是危險操作。  
7. `resetMainScroll` 只在 `App` 的 push／pop／分頁 onClick；日詳情換日不呼叫。

---

## 測試與契約紅燈

- `tsc --noEmit` 零錯  
- `npm test`：**307 passed／1 failed**（35 files；本批新增約 18 筆）  
- 唯一紅燈：`tests/contract/cloudRoundtrip.test.ts` → `42501 GRANT SELECT, INSERT, UPDATE ON public.sessions TO anon`  
- **本批未改既有期望值。**

**42501 影響正式功能？** 契約測試用測試帳號對 `sessions` 表 upsert。正式待辦走 `app_state`（todos），**此 GRANT 不擋待辦同步**。番茄若真機已能上雲，正式走已登入 JWT＋RLS；此紅燈是測試環境／sessions 表 GRANT 缺口，**另案**，不在本批。

---

## 建議 commit

```
fix(batch-M): 快捷新增查證、資料筆數、子標籤可見、孤兒可處理、誤觸防護與分頁捲動

合併測試確認快捷與底部同寫入路徑、不改合併規則；週曆補未排待辦色塊；設定重置置底、分頁回頂、換日 400ms 動作鈕冷卻。
```
