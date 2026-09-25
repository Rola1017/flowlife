# FlowLife 批次 G1｜habit-tracker18 收尾報告

> 產出：2026-09-25  
> Cursor 不得 git add／commit／push。工作區保留，由 Rola 提交。

開場可用：請閱讀 `@app_rules.md` 了解專案現況。

---

## 做了什麼

把「誰比較新」從裝置時鐘改成**雲端蓋章**；刪除改成雲端 `deleted_at` 記號；本機編輯用持久化 **dirty** 集合進 `planPush`。不做 G2 游標／佇列、不做 G3 即時推播、不做 tombstone GC。

**SQL 尚未在共用庫執行**（裁示 10：必須等 Vercel 新 client 上線後立刻跑）。

---

## 上線順序（Rola 照做）

① Rola 檢視改動並 push  
② 等 Vercel 部署完成  
③ Rola 在 SQL Editor 跑 `supabase/g1_stamp_and_tombstone.sql`（附錄 A）  
④ 兩台裝置都重新整理（PWA 要完全關掉再開）  
⑤ 驗收

**不可提前數天跑 SQL。** 舊 client 仍送裝置時間，trigger 會覆寫；快鐘裝置會短暫回到 E27 假 pending。

回滾：`supabase/g1_stamp_and_tombstone_rollback.sql`（已壓回的 `updated_at` 無法自動還原）。

---

## Postgres 版本

施工前 **PostgREST 查不到 `version()`**（沒有 RPC／直連）。附錄 A **第一行就是 `SELECT version();`**。

SQL 採 **`EXECUTE FUNCTION`**（PG15+；Supabase 託管現況）。若 Rola 跑出 **14.x**，把三條 trigger 改成 **`EXECUTE PROCEDURE`**。

---

## 測試帳號搬家演練前後計數

G1 schema **尚未上線**（契約測試探測 `deleted_at` 不存在），**沒有對測試帳號執行搬家寫入**（INV-3／旗標關）。

只讀計數（2026-09-25，測試帳號、未跑 migrate）：

| 表 | 筆數 | 未來時戳（> now+60s） |
|----|------|------------------------|
| sessions | 1 | 0 |
| reviews | 4 | 0 |
| app_state | 16 | 0 |
| **合計** | **21** | **0** |

等 SQL 上線後，本機開 `NEXT_PUBLIC_G1_MIGRATE=1` 再整理，設定頁應出現：

「資料搬家已完成：標記 21 筆、壓回 0 筆」（若資料沒變）。

正式 Vercel **先關** 此旗標。

---

## 衝突政策（已寫進 app_rules 與 `lib/syncDirty.ts` 註解）

兩台同時改同一筆＝**後送達雲端者勝**。單人雙裝置可接受；G2 正式佇列再評估是否細化。

---

## 業界對照完整版（§8-41）

### 本批自己的方案（先寫）

1. **蓋章**：`BEFORE INSERT OR UPDATE` trigger 把 `updated_at` 設成 `now()`；client **不送** `updated_at`；成功後 `.select` 把雲端郵戳寫回本機，才清 dirty。  
2. **刪除**：`deleted_at` 軟刪。client 送非 null 佔位 `1970-01-01T00:00:00.000Z`，trigger 覆寫成伺服器時間。還原送 `null`，trigger **不得**再蓋。  
3. **待送**：本機持久化 dirty 集合（sessions=uuid、reviews=key、app_state=key），單一寫入口 `markSyncDirty`。`planPush`＝dirty **或** 雲端缺。時間比較只用於兩邊都已是雲端郵戳的 overlay。  
4. **拉取**：dirty 列不被雲端覆蓋。  
5. **搬家**：壓回前寫 `g1_migrate_backup`（雲端表＋本機 LS）；觸碰列讓 trigger 蓋章；未來時戳才算壓回。旗標 `NEXT_PUBLIC_G1_MIGRATE`。  
6. **INV-1**：雲端 `deleted_at` ≠ `Session.deletedAt`（後者是進垃圾桶事件時間）。  
7. **整包拉**：本批仍全表 select，不做書籤／游標。

這是單人、雙裝置、資料量小、可整包下載的最小可替換模型：蓋章／墓碑／dirty（待送清單的雛形）。書籤留給 G2。

### 對照常見做法

| 做法 | 業界常見 | 本批 |
|------|----------|------|
| 伺服器時間 | Postgres `now()`／DB trigger／gateway 蓋章 | **照做**（trigger） |
| 刪除 | tombstone 欄位，不硬刪 | **照做**（`deleted_at`）；不 REVOKE DELETE，程式守門 |
| 待送 | outbox／mutation queue（Replicache、PowerSync） | **部分**：持久化 dirty 集合，不是正式佇列（G2） |
| 增量拉 | WAL cursor、`updated_at > since`、Electric shape | **不照做**：G2 |
| 衝突 | CRDT／向量鐘／手動合併 | **不照做**：後送達者勝，夠用單人雙裝置 |
| 即時 | websocket／replication stream | **不照做**：G3 |
| GC | 依所有裝置書籤最早者 | **不照做**：§十一 與 G2 一起 |
| 現成引擎 | ElectricSQL／PowerSync／Replicache | **現在不綁**（暫緩帳本） |

### 哪些不照做、為什麼

- **不引入同步引擎**：市場變化快，提前綁定＝用不足資訊做決定。觸發見 app_rules 暫緩帳本。現在保持模型可替換。  
- **不做游標／佇列／GC／即時**：原指示本批不做；SQL 提前跑會讓舊 client 與 trigger 打架。  
- **planPush 不用時間當「要不要推」的裁判**：Claude 原設計在慢鐘會靜默丟資料；改 dirty（裁示 1A）。  
- **不 REVOKE DELETE**：契約測試仍需刪自己的探測列；改程式守門。  
- **不把雲端 `deleted_at` 寫進 `Session.deletedAt`**：欄位語意不同（INV-1）。

外部預設值核對（§8-41）：Supabase upsert 預設**接受** client `updated_at` → 我們用 trigger **忽略**；`signOut` 預設 global 已在 F 批改掉。PostgREST 允許 `.delete()` → 應用層禁止對 sessions／reviews 呼叫。

---

## 測試期望值變更（舊 → 新 → 為什麼正確）

E05／E06／`mergeSessionsWithTombstones` 三參數既有期望 **未改**。E27 單元測試（Z vs `+00:00` → planPush 空、不 dirty）**未改**。

| 測試 | 舊值 | 新值 | 為什麼這是正確答案 |
|------|------|------|-------------------|
| `planPushSessions` property | 雲端缺 **或本機較新** 才推 | 雲端缺 **或 dirty** 才推 | 蓋章後本機 `updatedAt` 可早於雲端（慢鐘）；時間不再決定要不要推 |
| `planPushAppStateKeys` property | 雲端缺 **或 meta 較新** | 雲端缺 **或 dirty** | 同上 |
| `syncNow` 墓碑 | `sessions.has("dead") === false` | `dead.deleted_at` 為真、列仍在 | INV-2 軟刪，不再硬刪 |
| `tags.test` `sessionToRow` | `fromRow(writeRow).updatedAt === UPDATED` | write row **沒有** `updated_at`；fromRow 讀列才帶郵戳 | client 不送 `updated_at` |
| 契約 (a)(b) | 送裝置 `updated_at` 後 `tsNewer` 兩向 false | 不送 `updated_at`；雲端郵戳可解析；**不 dirty 則 planPush 空** | trigger／預設會改寫時間；相等不再是協定。§8-21⑥＝不准把錯誤輸出貼成期望，不是協定不准改 |
| 契約寫入 payload | 帶 `updated_at`／`deleted_at` | schema 未上線時不帶 `deleted_at` | 否則 PGRST204；G1 專測 `skipIf` 無欄位 |

新增：慢鐘 dirty 必進 planPush；cloud persist 不清 dirty；LS 重載 dirty 仍在；merge dirty 不蓋本機；G1 trigger（送非 null → 伺服器時間；送 null → 還原）。G1 schema 未上線時契約印「契約測試已略過：G1 schema 未上線」。

`tsc --noEmit` 通過。`npm test`：**253 passed / 28 files**。

---

## 設定頁

已改提示為 dirty／stamp 軟刪。搬家結果行只在本機有 `g1_migrate_result` 時顯示（旗標關、尚未搬家 → 不顯示）。localhost:3000 設定頁已點過，hint 正確。

---

## 建議 commit（Rola 執行）

```
G1：雲端蓋章、deleted_at 軟刪、本機 dirty、可開關搬家。

planPush 改 dirty|缺，避免慢鐘靜默丟資料；SQL 等 Vercel 新 client 上線後立刻跑。
```

---

## 檔案

新：`lib/syncDirty.ts`、`lib/sessionPersist.ts`、`lib/cloudStamp.ts`、`lib/cloudMigrateG1.ts`、`supabase/g1_stamp_and_tombstone.sql`、`supabase/g1_stamp_and_tombstone_rollback.sql`、`tests/syncDirty.test.ts`、`tests/cloudMigrateG1.test.ts`

改：sessions／reviews／app_state 雲端寫入、`cloudSync` planPush、App／CategoryManager persist、AccountGate 搬家、Settings 結果行、architecture／cloudSync／contract／tags 測試、`app_rules.md`
