# FlowLife 批次 E｜habit-tracker18 收尾報告

> 產出：2026-09-24  
> **完工、未 git add／commit／push**。工作區保留，由 Rola 提交。  
> 建議 commit 訊息：`時間比較改走 tsMs，同步先拉再推`

---

## 任務

修同步永遠「未完成」（E27）：時間比較正規化＋`syncNow` 補拉取＋真實往返契約測試。不改 schema。

---

## .gitignore／帳密

- `.gitignore` 第 34 行已有 `.env*`。  
  `git check-ignore -v .env.local` → `.gitignore:34:.env*`。**未改 gitignore。**
- 附帶：同一規則也忽略 `.env.example`，本機加的契約測試變數名註解不會進版控。變數名已寫在 `app_rules.md` §十二。
- **帳密只在本機 `.env.local`，本報告與任何會進版控的檔案皆無帳密。**

---

## 步驟 0｜實地量測（改比較函式之前）

測試帳號登入後，三表各 upsert 一列（`updated_at` 用本機 ISO），立刻 select 同一列。  
sessions／reviews 第一次用字面 `e27-ts-probe-*` 當 uuid，Postgres 拒收（非 UUID）；改 `crypto.randomUUID()` 後三表皆成功。探測列已刪，探測腳本已刪。

三表結果**相同**（無微秒）：

```
送上去：2026-09-24T08:48:11.964Z
讀回來：2026-09-24T08:48:11.964+00:00
```

| 比較 | 結果 |
|------|------|
| 字串 `sent > got` | **true** |
| 字串 `got > sent` | false |
| `Date.parse(sent)` | `1790239691964` |
| `Date.parse(got)` | `1790239691964` |
| `Date.parse` 相等 | **true** |
| `abs_diff_ms` | **0** |

根因確認：`Z`（ASCII 90）`>` `+`（ASCII 43），字串比較讓本機恆勝 → `planPush` 永不空 → 同步永遠「未完成」。同一瞬間毫秒相同，**未跨毫秒、無微秒**。

### tsEqualish 裁示結果

**不加。** 步驟 0 僅格式差（`Z` vs `+00:00`），`abs_diff_ms = 0`。`tsMs`＋`tsNewer` 已足夠。若日後 Postgres 回微秒且 `Date.parse` 截斷導致誤判，再加。

---

## 改了什麼

| 檔 | 做什麼 |
|----|--------|
| `lib/time.ts` **新** | `tsMs`（`Date.parse`，無效／空→0）、`tsNewer`（`tsMs(a)>tsMs(b)`）。全庫唯一比較來源。無 `tsEqualish`。 |
| `lib/cloudSync.ts` | `planPushSessions`／`planPushAppStateKeys`／`planPushReviews` 改 `tsNewer`。`runSync` 在推／刪／驗證前 `await syncSessionsFromCloud`／`syncAppStateFromCloud`／`syncReviewsFromCloud`。 |
| `lib/sessionsCloud.ts` | `mergeSessionsWithTombstones` 兩處 `>` → `tsNewer` |
| `lib/appStateCloud.ts` | `reconcileTodos`＋`syncAppStateFromCloud` → `tsNewer` |
| `lib/reviews.ts` | 四處理 `stamp() > stamp()` → `tsNewer` |
| `lib/todosCloud.ts` | `mergeTodosWithTombstones` 兩處 → `tsNewer`（`sessionsCloud.test.ts` 期望未改） |
| `tests/time.test.ts` **新** | Z vs +00:00；微秒 vs 毫秒；空→0；property ≥500 seed `20260924` |
| `tests/cloudSync.test.ts` | E27：三處 planPush 同一時刻空。300 筆改為拉後 pending 0（不再主張 getUser×1／select×2／upsert×3——拉重用 `sync*FromCloud` 會再 `getUid`） |
| `tests/architecture.test.ts` | E27 守門：欄位當 `>`／`<` 運算元；`stamp(` 比較。**不用「同行出現 >」**，避開 `lib/sessions.ts` `counted: safe > 1, updatedAt:` |
| `tests/contract/cloudRoundtrip.test.ts` **新** | 真實 Supabase。無帳號印 `契約測試已略過`。有帳號：三表寫讀 `tsNewer` 兩向 false、不在 planPush；100 筆 upsert |
| `vitest.config.ts` | 讀 `.env.local` 進 `process.env`（未設才填） |
| `app_rules.md` | §8-39／§8-40；§二 `time.ts`；§九 item 12 拉→推→刪；§十批次 E；暫緩帳本；§十一兩條 ⬜；§十二 |

**本批不做（已登記）：** `sync*FromCloud` 收 uid。優先重用既有合併，不動結構。

---

## 業界對照（紀律 §8-18）

跨裝置同步業界標準：①時間戳由伺服器產生（不信任裝置時鐘）②游標／書籤增量 ③刪除以 tombstone 表達 ④成熟方案如 ElectricSQL、PowerSync、Replicache。

| | 做法 | 本批 |
|--|------|------|
| 與業界**一致** | 外部值先正規化再比較（§8-40），不比對方字串表象 | `tsMs`／`tsNewer` |
| 與業界**一致** | 先拉再推，避免本機舊資料蓋他機新資料 | `syncNow`：拉→推→刪→驗證 |
| 與業界**一致** | 刪除用 tombstone，禁止「雲端有、本機沒」就刪 | 沿用批次 D 本機墓碑＋`planDelete` |
| 與業界**一致** | 對真實儲存做契約測試，不用 mock 冒充往返（§8-39） | `tests/contract/cloudRoundtrip.test.ts` |
| **暫行** | 時間戳仍由裝置 `toISOString()` 產生 | 未改成伺服器蓋章後回傳 |
| **暫行** | 全量 index 拉取，無游標／書籤 | 未做增量 |
| **暫行** | 墓碑在本機 `deleted_*`，雲端無 `deleted_at` | 未改 schema |
| **暫行** | `sync*FromCloud` 各自再 `getUid` | 本批不動結構 |

**暫行原因（§8-38 急救登記）：** 伺服器權威時間、游標增量、雲端 tombstone 欄位都要 schema／協定變更。本批只止血（格式正規化＋補拉＋契約），讓兩台不再因 `Z` vs `+00:00` 永遠 pending。正確模型＝批次 F（先出設計草圖再動）。

---

## app_rules §十一 本批登記（不施工）

- ⬜ **同步改為業界標準**：時間由伺服器蓋章並回傳、以游標做增量拉取、刪除改為雲端 tombstone 欄位；觸發＝批次 F；原因＝目前比較兩台裝置各自產生的時間戳，時鐘偏移與格式差異都會出錯（E27）。
- ⬜ **`sync*FromCloud` 收 uid**（本批不做）：優先重用既有合併邏輯、不動結構。觸發＝下次動 `syncNow` 效能時。

---

## 驗證

```
npx tsc --noEmit
（stdout 空、exit 0）

npm test
 Test Files  25 passed (25)
      Tests  235 passed (235)
 Duration  9.07s
```

契約測試**有跑**（測試帳號已設，未印「契約測試已略過」、無 skipped）。跑完 afterAll 清探測列。

`localhost:3000`：GET 200；設定頁仍有「立即同步並檢查」。瀏覽器未登入故未按同步（契約測試已對真實雲端往返）。請兩台各按一次，應可歸零、且他機資料會被拉下來。

---

## git status（完工時、未 add）

```
 M app_rules.md
 M lib/appStateCloud.ts
 M lib/cloudSync.ts
 M lib/reviews.ts
 M lib/sessionsCloud.ts
 M lib/todosCloud.ts
 M tests/architecture.test.ts
 M tests/cloudSync.test.ts
 M vitest.config.ts
?? lib/time.ts
?? tests/contract/
?? tests/time.test.ts
?? habit-tracker18批次E-收尾報告.md
```

建議 commit 訊息：`時間比較改走 tsMs，同步先拉再推`

Cursor **不得** git add／commit／push。
