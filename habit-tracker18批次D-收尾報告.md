# FlowLife 批次 D｜habit-tracker18 收尾報告

> 產出：2026-09-23  
> 狀態：**完工、未 git add／commit／push**。工作區保留給 Rola 提交。  
> 建議 commit 訊息：`登出改增量對帳 syncNow，不再盲推與假警報`

---

## 做了什麼

登出／設定頁同步收成 `lib/cloudSync.ts` **`syncNow` 唯一入口**。同步＝上傳＋刪除＋不動：

- uid 只取一次；增量 LWW（本機較新或雲端缺才推；**不蓋較新雲端**；app_state 用既有 meta 時戳，不 stamp now）
- **planDelete**：雲端 index 的 uuid 出現在本機墓碑（`trashed_sessions`、`deleted_session_uuids`；reviews 墓碑若有）才刪；**嚴禁**雲端有、本機沒、無墓碑就刪（E05／E06）
- todos 走 `mergeTodosWithTombstones`，墓碑 id 不進 payload
- 上傳後重抓 index：`planPush` **與** `planDelete` 皆空才 `allClear`
- 逾時 30 秒：pending ≠ 失敗
- reviews：free 對帳後批次 upsert；singleton 對帳後逐筆 select/update/insert（次數＝待推數）；`pushFreeCloud(entry, uid?)`
- 重置選 B：`forcePushAppStateForReset()`（暫行；註解指向 §十一）。**syncNow 無 force**
- 刪 `cloudFlush.ts`、`pushAllLocalSessionsToCloud`、`pushAllAppStateToCloud`、`pushAllReviewsToCloud`、`inspectSessionCloudStatus`

UI：登出進度 `同步中…（番茄 x/y）`；全清→確認登出；否則警告（重試／仍要登出／取消）。設定頁「立即同步並檢查」＋ 💡 三件套。

---

## 改了哪些檔

| 檔 | 動作 |
|---|---|
| `lib/cloudSync.ts` | **新增** `syncNow`／`planPush*`／`planDelete*`／`planTodosValueForPush` |
| `lib/cloudFlush.ts` | **刪除** |
| `lib/sessionsCloud.ts` | index／批次 upsert／tombstone 讀取；`deleteSessionsCloud(uuids, uid?)`；刪 pushAll／inspect |
| `lib/appStateCloud.ts` | `forcePushAppStateForReset`、`upsertAppStateBatch`（不 stamp now）、index |
| `lib/reviews.ts` | `pushFreeCloud(entry, uid?)`、free 批次、singleton 逐筆、index、`deleteReviewsByKeys` |
| `lib/cloudWrite.ts` | 註解改 syncNow 全清才 reset |
| `components/App.tsx` | 重置改呼叫 `forcePushAppStateForReset` |
| `components/auth/AuthPanel.tsx` | `syncNow`；進度／警告卡 |
| `components/settings/SettingsPage.tsx` | 「立即同步並檢查」＋ 💡 三件套 |
| `tests/cloudSync.test.ts` | **新增** |
| `tests/architecture.test.ts` | E25／forcePush 守門／syncNow 不得 force |
| `app_rules.md` | §二／九／十／十一／十二／暫緩帳本（§8-38 急救登記） |
| `habit-tracker18批次D-收尾報告.md` | 本檔（給 Claude 審查） |

---

## grep 結果

掃 `components/` `lib/` `app/`（不含 `tests/`）：

**舊全量入口**（`flushLocalToCloud`／`pushAllLocalSessionsToCloud`／`pushAllAppStateToCloud`／`pushAllReviewsToCloud`／`inspectSessionCloudStatus`／`cloudFlush`）：

```
(no matches)
```

`git` 顯示 `lib/cloudFlush.ts` 為 deleted。

**`forcePushAppStateForReset`（只准定義處 + App 重置路徑）：**

```
lib\appStateCloud.ts:165:export async function forcePushAppStateForReset(): Promise<void> {
components\App.tsx:27:import { APP_STATE_KEYS, forcePushAppStateForReset, pushAppState, subscribeAppState } from "@/lib/appStateCloud";
components\App.tsx:512:    await forcePushAppStateForReset();
```

**`syncNow(` 呼叫端：**

```
lib\cloudSync.ts:390:export async function syncNow(opts?: {
components\auth\AuthPanel.tsx:101:    syncNow({
components\settings\SettingsPage.tsx:44:            void syncNow({ onProgress: setSyncProgress })
components\calendar\DayViewPage.tsx:101:    syncNow();
components\timeline\TimelinePage.tsx:75:    syncNow();
```

後兩處是頁面分鐘鐘的**同名區域函式**（`setNow(getCurrentMinutes())`），不是 `lib/cloudSync`。E25 守門只鎖 AuthPanel／SettingsPage。

**`lib/cloudSync.ts` 的 `force?:`／`force:`：** 無匹配。

---

## typecheck 輸出末段原文

```
npx tsc --noEmit
```

（stdout 空、exit code 0）

---

## npm test 輸出末段原文

```
> flowlife@1.0.0 test
> vitest run


 RUN  v4.1.10 C:/Users/User/Desktop/flowlife


 Test Files  23 passed (23)
      Tests  226 passed (226)
   Start at  16:06:47
   Duration  3.43s (transform 4.62s, setup 0ms, import 8.64s, tests 399ms, environment 59.02s)
```

補測重點：planPush sessions property ≥500；planDelete (a) 墓碑在雲端必刪 (b) 雲端獨有無墓碑永不刪 ≥500 (c) 墓碑永不 planPush；app_state 不改 meta；todos 墓碑不進 payload；300 sessions → sessions 表 select×2 + upsert×3、`getUser`×1；驗證未清 pending>0 非 allClear。

---

## git status 原文

寫入本報告後 `git status --short`：

```
 M app_rules.md
 M components/App.tsx
 M components/auth/AuthPanel.tsx
 M components/settings/SettingsPage.tsx
 M lib/appStateCloud.ts
 D lib/cloudFlush.ts
 M lib/cloudWrite.ts
 M lib/reviews.ts
 M lib/sessionsCloud.ts
 M tests/architecture.test.ts
?? habit-tracker18批次D-收尾報告.md
?? lib/cloudSync.ts
?? tests/cloudSync.test.ts
```

branch：`main`，up to date with `origin/main`。no changes added to commit。

`git diff --stat`：`10 files changed, 356 insertions(+), 157 deletions(-)`（不含 untracked `cloudSync.ts`／測試／本報告）。

---

## 瀏覽器抽查

`localhost:3000` → ⚙️ 設定：

- 按鈕為「立即同步並檢查」（舊「檢查雲端同步狀態」已無）
- 未登入按下去：出現「同步中…」後結束，正文含「未登入」
- 💡 三件套都在（增量對帳／登出警告與逾時／紅色失敗標記）

未登入故無法真機走登出 allClear 路徑；該路徑由 `cloudSync.test.ts` 覆蓋。

---

## 建議 commit 訊息

```
登出改增量對帳 syncNow，不再盲推與假警報
```

Cursor **未** git add／commit／push。請 Rola 提交並同步。
