# habit-tracker18 批次 Z5 收尾報告

待辦區單層 `cat` → 與番茄同一套標籤多選。舊欄 `cat` 雙寫、Z8 才刪。遷移對不上整批 abort、不得丟進「未分類」。Cursor 未 git add／commit／push。

## 可見四項（已在 localhost:3000 點過）

1. **表單選擇器＝番茄同一套**：時段 → ＋新增待辦 → `CategorySelector`（領域 picker、難／重要／精力、`＋ 加標籤`、不傳 `onShowCategoryManager`）。快捷／新增預設「主 未分類」。
2. **卡片徽章＝標籤樣式**：新增「Z5驗收待辦」後卡片為 `CatBadge` 藥丸「學習」，不是舊 `CAT.cat1Display` 字。
3. **行事曆篩選連待辦疊圖**：週曆週五晚／午段可見黃條「Z5驗收待辦」；篩「事業」後該格只剩 `0m`，疊圖消失。圓餅／熱圖仍 0m（待辦不進分鐘統計）。
4. **設定頁遷移結果**：雲端同步卡內一行「待辦標籤遷移：已完成，寫入 0 筆、沿用 0 筆」（不擋 UI、不彈窗）。此環境啟動時空待辦，故 N=0。

## 對照報告（追加 A）

Cursor 內建瀏覽器＝未登入、啟動時 `todos=[]`。`ensureTodoTagsMigrated` 跑過，C 桶未觸發。

| 舊分類 | 筆數 | 標籤id | 標籤名 | 沿用 | 寫入 |
|--------|------|--------|--------|------|------|
| （無列） | 0 | — | — | 0 | 0 |

訊息：`待辦標籤遷移：已完成，寫入 0 筆、沿用 0 筆`

驗收時才新增 1 筆，寫入時已帶領域 `tagIds`：

| 舊分類 | 筆數 | 標籤id | 標籤名 | 沿用 | 寫入 |
|--------|------|--------|--------|------|------|
| 學習 | 1 | `b1dbddc9-fb0e-4db7-b2ff-9c120f4a0a93` | 學習 | 1 | 0 |

（已有領域 → 完全不動；`cat` 雙寫「學習」。）

正式帳號：Rola 開 App 自動跑；孤兒 cat 進 C 桶 → 零寫入、設定頁「已停止，有 N 筆分類對不上，資料未變更」。測試 fixture `cat:"生活"` 未改。

領域根對照（`DEFAULT_CATEGORIES` id 沿用，遷移字典＝活著的領域根名）：

| 舊分類 | 標籤id |
|--------|--------|
| 學習 | `b1dbddc9-fb0e-4db7-b2ff-9c120f4a0a93` |
| 事業 | `3eebe052-5748-44e0-89b1-0d3525284de6` |
| 閱讀 | `a84b9136-9426-4952-b955-9188e7b69a12` |
| 健康 | `c310502a-299b-423e-86a8-0765bc0d6d40` |
| 兼差 | `afe8c121-2aeb-4467-8518-0b8f50e3b39f` |
| 活動 | `aad5ebfb-470c-45a0-baf8-e050d670f2af` |
| 未分類 | `cd6c4a3d-08cd-42d5-aef3-440b87058d10` |

## 裁示落地

1. 領域必填；難／重要／精力選填。`canStartWithTags`／`missingRequiredGroupNames`，不另寫規則。
2. 快捷新增 `tagIds=[未分類根 id]`，不得 `[]`。
3. 行事曆 `matchesTagSelection(sel, resolveTodoTagIds(todo), tags)`。
4. 待辦不進 `distributeAndFilter(sessions)`。
5. 已有任一領域 → 不動；有 tagIds 無領域 → 依 cat 補根、其餘保留；對不上 → C 桶 abort。
6. `/api/todos` 輸出 `tagIds`，`cat` 雙寫。Roro 客戶端本批不改。
7. fixture「生活」不改。
8. `ensureTagsMigrated` 之後 `ensureTodoTagsMigrated`；結果 `LS_KEYS.todoTagsMigrate`，**不**進 `APP_STATE_KEYS`。成功寫入才 `pushAppState(todos)`。失敗／冪等不改 todos。設定頁可見訊息。
9. 選擇器不傳 `onShowCategoryManager`。

## 寫入路徑

- `lib/todoTags.ts`：`stampTodoTags`／`hasDomainTag`／`resolveTodoTagIds`／`uncategorizedRootTagId`
- `lib/todoTagsMigrate.ts`：`applyTodoTagsMigration` 純函式閘門；`ensureTodoTagsMigrated` 冪等
- `normalizeTodo` 出口 `stampTodoTags`；`formDraftToTodoPatch` 同樣雙寫
- 刪 `TodoFormFields` 的 `CAT.cat1List` `<select>`

## 測試

- `tsc --noEmit` 綠
- `npm test`：279 筆／278 綠／1 紅＝契約 `42501 GRANT sessions TO anon`（既有 RLS／env，期望值未改）
- 新增 `tests/todoTagsMigrate.test.ts`（筆數閘門／生活 abort／冪等／缺領域就補／已有領域不動／stamp／快捷預設／ensure 失敗不寫）
- `architecture.test.ts`：CategorySelector、禁 cat1List／onShowCategoryManager、pushAppState(todos)、遷移鍵不上雲、Calendar matchesTagSelection
- 既有 `todos.test.ts`／`cloudSync.test.ts`「生活」、`tags.test.ts` `normalizeTodo` 學習→LEARN.id 期望未改

## 暫緩（追加 B，已入 app_rules）

待辦主鍵 `Date.now()` number，雙裝置同毫秒會撞 id、較新者整筆覆蓋。本批不動主鍵。

## 建議 commit（Rola 自行提交）

```
feat(todos): Z5 待辦改標籤多選並遷移 cat→領域根

消除待辦單層、其餘三層的地雷；對不上整批停止。設定頁可見遷移結果。
```
