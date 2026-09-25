# habit-tracker18 批次 K 收尾報告

日期：2026-09-25  
範圍：全 App 選色一律支援色碼輸入（`ColorField`＋`normalizeHex`）  
Git：Cursor **未** add／commit／push。

---

## 結論

1. 選色唯一 UI＝`components/ui/ColorField.tsx`（取色器＋色碼輸入＋預覽色塊；既有色票當 `presets`）。
2. 驗證唯一實作＝`lib/theme.ts` `normalizeHex`；`parseHexRRGGBB` 改為別名。輸出 **大寫 `#RRGGBB`**。三碼展開；非法／空字串回 `null`，UI 退回原值並顯示「無效色碼，已恢復原值」。輸入中不套用，失焦或 Enter 才 commit（讀輸入框當下值）。
3. 不做資料遷移：讀取時 `normalizeHex`；寫入只走合法六碼。
4. `tsc` 零錯。`npm test` 264 綠／1 紅（契約 `42501` GRANT sessions TO anon，與本批無關，期望值未改）。

---

## 儲存格式

**大寫 `#RRGGBB`**（與批次 J `parseHexRRGGBB` 一致）。色票／取色器／輸入框顯示同一個正規化值；原生 `<input type="color">` 僅內部用小寫。

---

## 任務 1 盤點清單

| 檔案 | 哪個功能在選色 | 改前選法 | 本批 |
|------|----------------|----------|------|
| `components/settings/SettingsPage.tsx` | 卡片外框圖例 8 個 tone | `<input type="color">`＋列上「恢復預設」 | **改用 ColorField**（`defaultValue`＝`CARD_TONE_COLOR`；列上不重複 💡，清單下 `ColorFieldTips`） |
| `components/category/CategoryManager.tsx` | 標籤顏色（`ColorPicker`） | 色票格＋`<input type="color">`＋單調色碼文字 | **改用 ColorField**（色票格保留：點格選色＋指定哪一格給色輪改；色碼／取色器／預覽走 ColorField） |
| `components/schedule/WorkplaceManager.tsx` | 工作場所顏色 | 僅 `<input type="color">` | **改用 ColorField**（無預設色票；💡 一次） |
| `components/schedule/CourseEditPanel.tsx` | 課程／科目顏色 | 色票 `PRESET_COLORS`＋「跟隨分類」＋`<input type="color">` | **改用 ColorField**（`presets`＝原色票；「跟隨分類」仍為 `color=""`，`allowEmpty`） |
| `lib/categories.ts` `SMALL_CAT_PALETTE` | 小分類自動配色 | 非選色 UI | **不改**（沒有使用者選色） |
| `components/ui/Chip.tsx` | 顯示標籤色 | `color` prop 當背景 | **不改**（只顯示） |
| `lib/theme.ts` `TH`／`hexToRgb`／`withAlpha` | 主題色與 alpha | 常數／內部解析 | **不改為選色 UI**；`normalizeHex` 加在此檔（architecture 允許）。`hexToRgb` 仍服務 `withAlpha`（含 8 位），不是選色驗證 |
| `lib/cardTone.ts` | 圖例外框覆寫讀寫 | `parseHexRRGGBB` | **讀寫改走 normalizeHex 別名**（三碼舊資料讀取可展開；不遷移） |

全庫 `type="color"` 僅剩 `ColorField.tsx`。

---

## 任務 2／3 實作摘要

- `normalizeHex`：trim、可省略 `#`、大小寫、`#RGB`→六碼；長度不是 3 或 6、非 hex、空、`red`、`#12`、`#GGGGGG`、超長 → `null`。
- ColorField：`showHint`／`ColorFieldTips` 💡 三件套（定義／用法／範例）；`defaultValue` →「恢復預設」；色碼框 focus 全選可複製。
- 課程空值＝跟隨分類，不是非法色碼。

---

## 測試

- `tests/colorField.test.ts`：接受 `#abc`／`abc`／`#AABBCC`／`AABBCC`；拒絕 `""`／`red`／`#12`／`#GGGGGG`／超長；三碼展開；輸出大寫 `#RRGGBB`。
- `tests/architecture.test.ts`：註解「選色與色碼驗證單一來源」；`components/` 除 ColorField 外不得 `type="color"`、不得自寫 hex 驗證 regex。

---

## 瀏覽器驗收

- 設定頁顏色圖例：8 組色碼＋取色器。貼 `#EC4899` → 待辦覆寫寫入 LS `{"todo":"#EC4899"}`，取色器同步 `#ec4899`，出現「恢復預設」。非法 `red` → 色碼／LS 不變，出現「無效色碼，已恢復原值」。測完已「恢復預設」，LS `{}`。
- 課表模板「管理工作場所」：兩筆場所色碼＋取色器（大寫／小寫各一），💡 色碼三件套。
- 番茄「標籤管理」點色塊：彈層 ColorField `#FFFF37`＋取色器＋確認＋💡。
- CourseEditPanel：本機未點開編輯格（架構守門已確認無殘留 `type="color"`；元件已換 ColorField＋色票＋跟隨分類）。

§8-28 登出再登入：本機未登入。設定頁 tone 走 `app_state` `cardToneColors`；標籤／場所／課程走既有 tags／班表／課表寫入。請 Rola 登入後改一色再登出登入核對。

---

## Pre-mortem

最可能出事＝非法／空色碼寫進分類或課程 → 卡片透明。防範：寫入只接受 `normalizeHex` 成功值；UI 非法退回原值；測試含空字串與 `red`／`#GGGGGG`。

---

## 建議 commit 訊息

```
feat: 全 App 選色走 ColorField，色碼輸入與驗證單一來源

取色器＋色碼＋預覽共用；normalizeHex 輸出大寫 #RRGGBB，非法不寫入。
```
