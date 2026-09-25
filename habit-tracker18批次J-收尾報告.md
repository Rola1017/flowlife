# habit-tracker18 批次 J 收尾報告

日期：2026-09-25  
範圍：補齊未上色區塊＋卡片外框色可自訂  
Git：Cursor **未** add／commit／push。

---

## 結論

1. VerticalTimeline 時段區塊已上色：課程 `schedule`、班別 `shift`、作息 `routine`、空檔 `neutral`。只加 `border`／`borderLeft`，`boxSizing` 維持原本的 `content-box`，高度仍是 `h%`。
2. **shift 實際使用**：課表行事曆班別覆蓋層、WorkplaceManager、便利貼卡、VT PLN 班別塊。
3. **routine 實際使用**：VT PLN 作息塊（本機可見綠帶 `rgb(34,197,94)`）、課表 `fixedCellStyle`、RoutineManager、RoutineEditor。
4. 顏色覆寫走 app_state key `cardToneColors`（只存改過的 tone），`lib/cardTone.ts` 讀取／驗證／顯示。設定頁原生 `<input type="color">`。
5. `tsc` 零錯。`npm test` 260 綠／1 紅（契約 42501，與本批無關，期望值未改）。

---

## VerticalTimeline 樣式差異（防位移）

共用：`position/top/height/left/right` 不變。`cardStyle` 之後覆寫 `boxSizing: "content-box"`（原本沒設＝content-box）。上下仍是 1px，高度計算與改前相同。

**PLN 課程／班別／作息**

| | 改前 | 改後 |
|--|------|------|
| background | 作息 `#1A1A22`／課程 `col+"2E"` | 不變 |
| border | 班別 `1px solid ${col}66`；其餘 `1px solid TH.bg` | `cardStyle(routine\|shift\|schedule)`：左 3px＋1px 淡化 |
| boxSizing | 未設（content-box） | 明示 `content-box` |

**ACT 空檔**

| | 改前 | 改後 |
|--|------|------|
| border | `1px dashed TH.border` | `cardStyle("neutral")` |
| boxSizing | 未設 | `content-box` |

**ACT 番茄／手動補登**：底色仍分類色；外框改 `cardStyle("focus")` + `content-box`。  
**待辦疊圖**：改 `cardStyle("todo")` + `content-box`。

本機 時段頁：作息綠帶、空檔灰帶可見；無橫向捲動。課表頁計數：藍 176（課程格）、青 4（班別塊）、綠 6（作息列）。

---

## 任務 1 完整清單：檔案 → 區塊 → tone → 本批有無上色

| 檔案 | 區塊 | tone | 本批 |
|------|------|------|------|
| `VerticalTimeline.tsx` | PLN 課程 | schedule | **新上色** |
| `VerticalTimeline.tsx` | PLN 班別 | shift | **新上色** |
| `VerticalTimeline.tsx` | PLN 作息 | routine | **新上色** |
| `VerticalTimeline.tsx` | ACT 空檔／未利用 | neutral | **新上色** |
| `VerticalTimeline.tsx` | ACT 番茄 | focus | **新上色** |
| `VerticalTimeline.tsx` | ACT 手動補登 | focus | **新上色** |
| `VerticalTimeline.tsx` | 未完成待辦疊圖 | todo | **新上色** |
| `VerticalTimeline.tsx` | 已完成待辦疊圖 | todo | **新上色** |
| `VerticalTimeline.tsx` | 展開凌晨鈕／時間軸外框／補登表單 | chrome | 不上色：控制項 |
| `scheduleGridModel.ts` | 固定作息列 | routine | **新上色** |
| `ScheduleBoard.tsx` | 課格 | schedule | **新上色** |
| `ScheduleBoard.tsx` | 班別覆蓋層 | shift | **新上色** |
| `ScheduleBoard.tsx` | 日表頭／Chip | chrome | 不上色 |
| `SchedulePage.tsx` | 模板課格 | schedule | **新上色** |
| `SchedulePage.tsx` | 便利貼課格 | schedule | **新上色** |
| `SchedulePage.tsx` | 便利貼卡 | shift | H 已上 |
| `SchedulePage.tsx` | 整天操作 | schedule | H 已上 |
| `SessionHistoryPage.tsx` | 番茄歷史列 SessionRow | focus | **新上色** |
| `SessionHistoryPage.tsx` | 垃圾桶容器／列 | focus | H 已上 |
| `SessionHistoryPage.tsx` | 手動新增表單 | chrome | 不上色：表單 |
| `CoinHistoryPage.tsx` | 單筆金幣列 | reward | **新上色** |
| `CoinHistoryPage.tsx` | 分組／對帳／篩選／商品群 | reward | H 已上 |
| `TodoCard.tsx` | 待辦列 | todo | H 已上 |
| `CalendarPage.tsx` | 行事曆日格 | — | **不上色**：日格是混合 SVG 熱圖（番茄／未利用／課表疊線），不是單一種類 |
| `CalendarPage.tsx` | 篩選／月統計／月曆外框 | focus | H 已上 |
| `WorkplaceManager.tsx` | 工作場所卡 | shift | H 已上 |
| `RoutineManager.tsx` | 固定作息外層 | routine | H 已上 |
| `RoutineEditor.tsx` | modal／作息列 | routine | H 已上 |
| `CourseBanner.tsx` | 課表橫幅 | schedule | H 已上 |
| `CourseEditPanel.tsx` | 編輯課程 | schedule | H 已上 |
| `ScheduleWeekPage.tsx` | 某日課程面板 | schedule | H 已上 |
| `SettingsPage.tsx` | 雲端／清除／危險／圖例 | neutral | H 已上；圖例本批加取色 |
| 其餘 H 清單（Home／Shop／TriCharts／覆盤…） | 見批次 H 報告 | 各 tone | 未改 |

---

## 任務 2：顏色可自訂

- **資料**：`APP_STATE_KEYS.cardToneColors`＝`"cardToneColors"`；LS `flowlife_v1_card_tone_colors`；`LS_FOR_KEY`／`DEFAULT_FOR_KEY={}`；`APP_DATA_EXACT_KEYS`。走既有 `pushAppState`／dirty／蓋章 LWW，沒另寫同步。
- **讀取**：`toneColor`＝覆寫（`parseHexRRGGBB` 通過）否則 `CARD_TONE_COLOR`（TH）。空／`red`／`#12`／`#RGB` 丟掉。
- **顯示**：`displayToneColor`＝`liftStripeOnDark`（`lib/theme.ts`）。YIQ 亮度 &lt; `STRIPE_MIN_LUM`(50) 才往白混 55%（與 `labelOnDark` 同一套 mix，門檻較低以免把 TH.blue 也抬走）。**存檔仍是使用者選的值**。
- **UI**：每行色塊（顯示色）＋名稱＋「改顏色」原生 color input＋該行「恢復預設」（僅已改過才出現）＋「全部恢復預設」。`App` 訂閱 `cardToneColors` 整樹重畫。
- **💡**：定義＝外框顏色代表資料種類；用法＝點色塊可改、會同步到另一台；範例＝待辦黃改粉，手機與電腦都會變。

### 登出再登入（§8-28）

本機未登入，無法在瀏覽器走完登出／登入。路徑與 `shop_items` 相同：改色 → `saveJSON`＋`pushAppState`；他機／重登 → `syncAppStateFromCloud` 套回＋`emit`＋App bump。**請 Rola 登入後改一個 tone、登出再登入，確認圖例與卡片仍是新色。**

---

## 測試

- `cardTone.test.ts` 追加：覆寫採用覆寫；`""`／`"red"`／`"#12"` 退預設；`#050505` 提亮後 `yiqLum >= 50`；清覆寫回 TH。
- architecture 守門維持（字面 hex border 仍零）。
- 既有期望值未改。
- 契約測試 42501（anon 無 sessions 權限）＝環境，非本批。

---

## 建議 commit 訊息

```
feat(ui): 行程表／課格補色帶；卡片外框色可自訂並上雲

VerticalTimeline 課程／班別／作息／空檔走 cardStyle。
app_state cardToneColors 覆寫，非法 hex 丟棄，過暗只提亮顯示。
```
