# FlowLife 批次 F｜habit-tracker18 收尾報告

> 產出：2026-09-24  
> **完工、未 git add／commit／push**。工作區保留，由 Rola 提交。  
> 建議 commit 訊息：`登入改讀本機 session，signOut 預設只退這台`

---

## 任務

修「斷網被當成登出」與「一台登出害全部裝置登出」（E28）。不動 schema、不動 `shouldWipe`（uid 為 null 不清資料）。

---

## 先寫方案，再對照業界（紀律 §8-18／§8-41）

### 本批方案

1. **登入狀態＝本機憑證**：`auth.getSession()` 讀本機 JWT，不向伺服器問「你還在嗎」。斷網時 session 還在＝仍登入。
2. **網路只影響同步能力**：`navigator.onLine`＋`online`／`offline` 事件。離線＝不能 sync，不是登出。
3. **`getUser()` 降級為驗證工具**：只包在 `getVerifiedUid()`，UI 不得拿它當登入判定。失敗不得回寫本機狀態。
4. **signOut 顯式 scope**：本機登出 `local`；另開「登出所有裝置」才 `global`，二次確認。
5. **單一來源** `lib/authState.ts`，元件不得各自 `getSession`／`getUser`。
6. **止血邊界**：不改資料模型、不做離線佇列；`syncNow` 寫入失敗仍計 `failed`，`allClear` 仍要驗證通過。

### 對照

| 來源 | 主張 | 本批 |
|------|------|------|
| Supabase 官方 | `getSession` 用於本機狀態；`getUser` 用於需伺服器驗證處 | **照做** |
| 離線優先通則 | 本機憑證即狀態；網路只影響同步能力 | **照做**（UI＋`syncNow` 離線短路） |
| ElectricSQL／PowerSync／Replicache | 伺服器時間、游標增量、雲端 tombstone | **不照做**。那是批次 G（schema）。本批只修 auth 邊界。 |
| Supabase `signOut` 預設 `global` | 一套件選擇；社群 issue #1608 有爭議 | **不照做**。本專案預設 `local`（一台退出不波及他機）。`global` 必須使用者明確點「登出所有裝置」。 |

**為什麼不照套件預設：** 外部預設值須逐一檢視（§8-41）。`global` 對「手機登出、電腦繼續用」是錯的語意。

---

## 改了什麼

| 檔 | 做什麼 |
|----|--------|
| `lib/authState.ts` **新** | `getLocalSession`／`subscribeAuth`／`getVerifiedUid`／`isOnline`／`subscribeOnline`／`signOut(scope)` |
| `lib/accountOwner.ts` | 「目前是誰」改 `getLocalSession`。**`shouldWipe` 未動**（uid null 仍不清） |
| `lib/cloudSync.ts` | `SyncReport.offline`；離線立即回（loggedIn 依本機 session、allClear=false）；uid 改本機 session |
| `components/auth/AuthPanel.tsx` | 登入判定走 `getLocalSession`＋`subscribeAuth`；登出 `local`；「登出所有裝置」`global`＋二次確認；離線登出警告、預設取消 |
| `components/settings/SettingsPage.tsx` | 離線顯示「📴 目前離線，無法同步」、按鈕停用、不顯示 ✅ |
| `components/Header.tsx` | 頂部「📴 離線」；不斷網踢回登入 |
| `components/auth/AccountGate.tsx` | 無直接 `getUser`，維持走 `ensureAccountOwnership`（內部已改本機 session） |
| `tests/authState.test.ts` **新** | 離線 getUser 失敗仍已登入；無 session＝未登入；verified 失敗不改本機狀態 |
| `tests/cloudSync.test.ts` | 離線 `syncNow` 立即回、allClear=false、elapsed&lt;500ms |
| `tests/architecture.test.ts` | E28：`components/` 不得 `auth.getUser()`；全庫 `.auth.signOut(` 必須顯式 scope |
| `tests/contract/cloudRoundtrip.test.ts` | cleanup `signOut({ scope: "local" })` |
| `app_rules.md` | §8-41；§二 `authState.ts`；§九 item 13；§十批次 F；業界標準改觸發批次 G；§十二 |

**本批不做：** 伺服器蓋章／游標增量／雲端 tombstone（原登記「批次 F」，本批佔名後改 **批次 G**）。

---

## 驗證

```
npx tsc --noEmit
（stdout 空、exit 0）

npm test
 Test Files  26 passed (26)
      Tests  241 passed (241)
```

瀏覽器 `localhost:3000`：主頁仍是 App（未被踢去純登入牆）。設定頁模擬 `navigator.onLine=false` 後：頂部「📴 離線」、同步區「📴 目前離線，無法同步」、「立即同步並檢查」disabled、無 ✅。

「手機登出後電腦維持登入」＝`scope: "local"`；請真機驗收（本環境無法同時控兩台）。

---

## git status（完工時、未 add）

```
 M app_rules.md
 M components/Header.tsx
 M components/auth/AuthPanel.tsx
 M components/settings/SettingsPage.tsx
 M lib/accountOwner.ts
 M lib/cloudSync.ts
 M tests/architecture.test.ts
 M tests/cloudSync.test.ts
 M tests/contract/cloudRoundtrip.test.ts
?? lib/authState.ts
?? tests/authState.test.ts
?? habit-tracker18批次F-收尾報告.md
```

建議 commit 訊息：`登入改讀本機 session，signOut 預設只退這台`

Cursor **不得** git add／commit／push。
