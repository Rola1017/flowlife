# habit-tracker18 批次 L 收尾報告（2026-09-26）

Cursor 未 git add／commit／push。改動留在工作區。

## 做了什麼

1. **清單型 key 先合併再推**（修待辦靜默覆蓋）
   - `APP_STATE_LIST_KEYS`＝`todos`、`deleted_todo_ids`，集中一處。
   - dirty 只代表合併後必須推，不再 `dirty → pushAppState(本機整包)` 跳過合併。
   - todos：dirty 仍走 `reconcileTodos` → 唯一合併實作 `mergeTodosWithTombstones`，合併後 `forcePush`。
   - tombstones：新 `mergeTodoTombstones`（id 聯集、同 id 較早 `at`）＋既有 TTL gc；`reconcileTodoTombstones`；dirty 合併後強制推。
   - 非清單型維持 key 級 LWW＋dirty 盲推。清 dirty 仍走 G1（推送成功且取回雲端郵戳）。

2. **遷移失敗明細**
   - 設定頁失敗行下「查看明細」展開：待辦文字（>24 截斷）＋舊分類名。
   - 💡：找不到對應標籤 → 打開重選分類 → 重新整理。明細本機 LS，無新雲端 key。
   - 本機目前已是「已完成，寫入 0 筆、沿用 0 筆」（無孤兒）。

3. **面板關閉鈕**
   - 唯一實作 `components/ui/PanelDismissButton.tsx`（`data-panel-dismiss="1"`；取消／關閉；min 44×44；全寬；無 media query 隱藏）。
   - 架構守門：該屬性只准出現在此檔；指定頁必須 import。

4. **日詳情底部換日**
   - 頂／底共用 `shiftViewDate`＋`DayShiftArrows`，不複製換日邏輯。
   - 切換前記 `scrollTop`／距底，`useLayoutEffect` 還原（不在 effect 內 setState）。
   - 滑動仍 `useHorizontalSwipe`。💡 底部也能換日。

## 面板清單（grep 可開關面板／表單／彈出）

| 檔案 | 面板 | 關閉鍵 |
|------|------|--------|
| `TimelinePage` | 新增待辦 `addOpen` | **本批補** `PanelDismissButton`「取消」 |
| `TimelinePage` | 快捷新增 `quickDraft` | 原手寫取消 → **改用** 共用元件 |
| `DayViewPage` | 新增待辦 `addOpen` | **本批補**「取消」 |
| `DayViewPage` | 快捷新增 `quickDraft` | 原手寫取消 → **改用** 共用元件 |
| `CalendarPage` | 分類篩選 `filterOpen` | **本批補**「關閉」 |
| `SchedulePage` | 指定日期排班／便利貼 `showDateOv` | 原小「關閉」→ **改用** 共用元件 |
| `SchedulePage` | 便利貼格子選課 `ovSlotEdit` | 原小「關閉」→ **改用** 共用元件 |
| `SchedulePage` | 整天操作 `dayMenu` | 原小「關閉」→ **改用** 共用元件 |
| `ScheduleWeekPage` | 當日面板 `dayPanel` | 原不明顯「關閉」→ **改用** 共用元件 |
| `ShopPage` | 新增／編輯商品 `addOpen` | **本批補**「取消」（grep 發現無關閉） |
| `TodoEditSheet` | 編輯待辦 | 已有「取消」，未重複加 |
| `CourseEditPanel` | 選課／編輯 | 已有「取消」，未重複加 |
| `RoutineEditor`／`RoutineManager` | 作息編輯 | 已有「取消」／onClose |
| `WorkplaceManager` | 場所管理 | 既有 onClose |
| `AuthPanel` | 登入／確認 | 表單取消，非本批面板 |
| `SettingsPage` | 重置確認 | 已有「取消」 |
| `PomodoroPage`／`DayReview`／`ReviewView`／`CoinHistory`／`SessionHistory` | 表單／意圖／垃圾桶 | 已有取消或折疊，非本批 |
| `CategorySelector` | 標籤 picker | 「完成」＋ overlay，未改 |
| `pasteNotice ✕` | toast | 略過 |

## 測試

- `tsc --noEmit` 零錯。
- `npm test`：**289 綠／1 紅**。紅燈＝既有契約 `cloudRoundtrip` `42501` GRANT sessions TO anon（環境／RLS，Z5 已知）。**未改既有期望值。**
- 新增 `tests/appStateList.test.ts`：todos 雙向含兩邊、墓碑永不復活、tombstone 聯集／較早 at、property ≥500。
- `architecture.test.ts`：清單型不得 dirty 盲推；`data-panel-dismiss` 唯一；指定頁必須用元件；DayView 單一 `shiftViewDate`；Settings 明細文案。
- `todoTagsMigrate.test.ts`：孤兒明細含完整文字＋舊分類名。

## 瀏覽器（localhost:3000）

- 設定：遷移列「已完成，寫入 0 筆、沿用 0 筆」。
- 時段新增待辦：「取消」44×全寬，可關。
- 行事曆分類篩選：「關閉」44×379，可關。
- 日詳情：底部 ‹ ›＋💡；換日 26→27；新增待辦「取消」44×353。嵌入式視窗 DayView 未溢出，捲動還原無法目測，邏輯在 `shiftViewDate`＋ref。
- 課表模板便利貼：「關閉」44×371。

## 期望值變更

無。既有測試 assert 未改。

## 建議 commit 訊息

```
fix(sync): 清單型 app_state 先合併再推，避免 dirty 整包覆蓋他機待辦

todos／deleted_todo_ids 不再因 dirty 跳過合併。遷移失敗可展開孤兒明細。面板關閉收成 PanelDismissButton。日詳情底部換日並保持捲動。
```

## 更新

`app_rules.md` §二／§九-11／§十／§十二／暫緩帳本（未來清單型 key 必須加入 `APP_STATE_LIST_KEYS`）。
