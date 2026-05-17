<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# FlowLife 專案工作規則

## 開始工作前必讀
1. 閱讀 `app_rules.md` 了解完整專案架構和現況
2. 閱讀 `FlowLife對話交接檔案2.md`（若有更新版本則讀最新版）了解上次做了什麼

## 核心開發原則（每次都要遵守）
- **未來性**：所有程式碼要方便維護、管理、編輯、升級，讓迭代順利進行
- **一致性**：相關聯動的地方必須同步更改，確保全APP顯示一致
- **單一來源**：顏色從 `lib/theme.ts`、分類從 `lib/categories.ts`、設定從 `lib/config.ts`，不要 hardcode
- **改前確認**：修改前先說明「會影響哪些檔案」

## 完成工作後必做
1. 確認 `localhost:3000` 正常運作
2. 更新 `app_rules.md` 的「已完成功能」和「待完成事項」兩個表格
3. **若 Cursor 對話額度接近上限**：
   - 立即回報「對話額度即將用盡，請開啟新對話」
   - 自動產出更新版 `app_rules.md`
   - 提醒使用者：新對話開場白為「請閱讀 @app_rules.md 了解專案現況」

## 命名規則（重要）
- 本專案的 Claude 對話依序命名：`APP習慣追蹤habit-tracker2`、`habit-tracker3`...
- 每個對話對應一份交接手冊：`FlowLife對話交接檔案2.md`、`FlowLife對話交接檔案3.md`...
- 若讀到交接檔案N但沒有N+1，表示當前對話是 habit-tracker(N+1)，應產出交接檔案(N+1).md
