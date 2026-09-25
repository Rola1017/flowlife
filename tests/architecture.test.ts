import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 防 2026-09 時段重疊判斷被複製 6 份的歷史問題。
 * 掃描 components/、lib/、app/（含 app/api）所有 .ts/.tsx：
 * 除 lib/overlap.ts 外不得出現 `.split("~")`。
 * 日期字串鎖死；禁止 Date.now()／new Date()。
 */
const SPLIT_TILDE_ALLOWLIST: string[] = [
  // 預期為空。若新增例外必須在此寫明理由。
];

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["components", "lib", "app"];
const SPLIT_RE = /\.split\(\s*["']~["']\s*\)/;
const CAPTURE_RE = /setPointerCapture/;
const OLD_SWIPE_ATTR_RE = /noDaySwipe|noWeekSwipe/;
const SWIPE_HOOK = "components/hooks/useHorizontalSwipe.ts";
const CAPTURE_ALLOWLIST: string[] = [
  // 預期為空。setPointerCapture 只准出現在 useHorizontalSwipe。
];

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTs(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

function relPosix(full: string): string {
  return path.relative(ROOT, full).replaceAll("\\", "/");
}

describe("時段字串解析單一來源", () => {
  it('components/lib/app 除 lib/overlap.ts 外不得 .split("~")', () => {
    const hits: string[] = [];
    for (const dirName of SCAN_DIRS) {
      const dir = path.join(ROOT, dirName);
      try {
        statSync(dir);
      } catch {
        continue;
      }
      for (const file of walkTs(dir)) {
        const rel = relPosix(file);
        if (rel === "lib/overlap.ts") continue;
        const text = readFileSync(file, "utf8");
        if (SPLIT_RE.test(text)) hits.push(rel);
      }
    }
    const extra = hits.filter((h) => !SPLIT_TILDE_ALLOWLIST.includes(h));
    const missing = SPLIT_TILDE_ALLOWLIST.filter((h) => !hits.includes(h));
    expect(extra).toEqual([]);
    expect(missing).toEqual([]);
  });
});

describe("水平滑動單一來源", () => {
  /**
   * 防 2026-09 滑動邏輯兩份、修一漏一，導致電腦版返回鍵失效。
   * 掃描 components/、lib/、app/（hooks 在 components/hooks）：
   * setPointerCapture 只准出現在 useHorizontalSwipe；白名單預期為空。
   */
  it("setPointerCapture 只准出現在 useHorizontalSwipe", () => {
    const hits: string[] = [];
    for (const dirName of SCAN_DIRS) {
      const dir = path.join(ROOT, dirName);
      try {
        statSync(dir);
      } catch {
        continue;
      }
      for (const file of walkTs(dir)) {
        const rel = relPosix(file);
        if (rel === SWIPE_HOOK) continue;
        const text = readFileSync(file, "utf8");
        if (CAPTURE_RE.test(text)) hits.push(rel);
      }
    }
    const extra = hits.filter((h) => !CAPTURE_ALLOWLIST.includes(h));
    const missing = CAPTURE_ALLOWLIST.filter((h) => !hits.includes(h));
    expect(extra).toEqual([]);
    expect(missing).toEqual([]);
  });

  it("data-noDaySwipe／data-noWeekSwipe 零出現", () => {
    const hits: string[] = [];
    for (const dirName of SCAN_DIRS) {
      const dir = path.join(ROOT, dirName);
      try {
        statSync(dir);
      } catch {
        continue;
      }
      for (const file of walkTs(dir)) {
        const rel = relPosix(file);
        const text = readFileSync(file, "utf8");
        if (OLD_SWIPE_ATTR_RE.test(text)) hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  /**
   * 防 2026-09 手機滑動因缺 touch-action 被瀏覽器取消（E23）。
   * 呼叫 useHorizontalSwipe 的檔案必須 {...swipe.bind}，不得 swipe.onPointerDown／onPointerUp 逐個掛。
   */
  it("useHorizontalSwipe 必須 {...swipe.bind}，不得逐個掛 onPointerDown/Up", () => {
    const missingBind: string[] = [];
    const splitMount: string[] = [];
    const BIND_RE = /\{\s*\.\.\.\s*swipe\.bind\s*\}/;
    const SPLIT_MOUNT_RE = /swipe\.onPointerDown|swipe\.onPointerUp/;
    for (const dirName of SCAN_DIRS) {
      const dir = path.join(ROOT, dirName);
      try {
        statSync(dir);
      } catch {
        continue;
      }
      for (const file of walkTs(dir)) {
        const rel = relPosix(file);
        if (rel === SWIPE_HOOK) continue;
        const text = readFileSync(file, "utf8");
        if (!/useHorizontalSwipe\s*\(/.test(text)) continue;
        if (!BIND_RE.test(text)) missingBind.push(rel);
        if (SPLIT_MOUNT_RE.test(text)) splitMount.push(rel);
      }
    }
    expect(missingBind).toEqual([]);
    expect(splitMount).toEqual([]);
  });
});

const BANNED_FLUSH = [
  "flushLocalToCloud",
  "pushAllLocalSessionsToCloud",
  "pushAllAppStateToCloud",
  "pushAllReviewsToCloud",
  "inspectSessionCloudStatus",
];

describe("雲端同步單一入口", () => {
  /**
   * 防 2026-09 登出盲推／假警報（E25）：登出與設定頁只能走 syncNow。
   */
  it("舊全量推送／inspect 零出現", () => {
    const hits: string[] = [];
    for (const dirName of SCAN_DIRS) {
      const dir = path.join(ROOT, dirName);
      try {
        statSync(dir);
      } catch {
        continue;
      }
      for (const file of walkTs(dir)) {
        const rel = relPosix(file);
        const text = readFileSync(file, "utf8");
        for (const ban of BANNED_FLUSH) {
          if (text.includes(ban)) hits.push(`${rel}:${ban}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("AuthPanel 與 SettingsPage 只能透過 syncNow（E25）", () => {
    const files = ["components/auth/AuthPanel.tsx", "components/settings/SettingsPage.tsx"];
    for (const rel of files) {
      const text = readFileSync(path.join(ROOT, rel), "utf8");
      expect(text, rel).toMatch(/\bsyncNow\s*\(/);
      for (const ban of BANNED_FLUSH) {
        expect(text.includes(ban), `${rel} ${ban}`).toBe(false);
      }
    }
  });

  it("forcePushAppStateForReset 只准出現在 appStateCloud.ts 與 App.tsx", () => {
    const hits: string[] = [];
    for (const dirName of SCAN_DIRS) {
      const dir = path.join(ROOT, dirName);
      try {
        statSync(dir);
      } catch {
        continue;
      }
      for (const file of walkTs(dir)) {
        const rel = relPosix(file);
        const text = readFileSync(file, "utf8");
        if (text.includes("forcePushAppStateForReset")) hits.push(rel);
      }
    }
    expect(hits.sort()).toEqual(["components/App.tsx", "lib/appStateCloud.ts"].sort());
  });

  it("syncNow 不得提供 force 參數", () => {
    const text = readFileSync(path.join(ROOT, "lib/cloudSync.ts"), "utf8");
    expect(/\bforce\s*\?:/.test(text)).toBe(false);
    expect(/\bforce\s*:/.test(text)).toBe(false);
  });
});

describe("時間比較單一來源", () => {
  /**
   * 防 2026-09 兩種時間格式直接比字串導致同步永不完成（E27）。
   * 掃描 components/、lib/、app/：除 lib/time.ts 外不得把
   * updated_at／updatedAt／created_at／createdAt 當 >／< 運算元。
   * 不可用「同行出現 >」——會誤殺 lib/sessions.ts 的 `counted: safe > 1, updatedAt:`。
   */
  it("除 lib/time.ts 外不得對 updated_at／updatedAt／createdAt 直接 >／<", () => {
    const FIELD = "(?:updated_at|updatedAt|created_at|createdAt)";
    const asLeft = new RegExp(FIELD + "(?:\\s*\\?\\?\\s*(?:\"\"|''))?\\s*\\)*\\s*[<>]=?");
    const asRight = new RegExp("[<>]=?\\s*\\(*\\s*" + FIELD);
    const stampCmp = /stamp\s*\([^)]*\)\s*[<>]|[<>]\s*stamp\s*\(/;
    const hits: string[] = [];
    for (const dirName of SCAN_DIRS) {
      const dir = path.join(ROOT, dirName);
      try {
        statSync(dir);
      } catch {
        continue;
      }
      for (const file of walkTs(dir)) {
        const rel = relPosix(file);
        if (rel === "lib/time.ts") continue;
        const text = readFileSync(file, "utf8");
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (asLeft.test(line) || asRight.test(line) || stampCmp.test(line)) {
            hits.push(`${rel}:${i + 1}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("登入狀態單一來源（E28）", () => {
  /**
   * 防 2026-09 斷網被當成登出、全域登出波及其他裝置（E28）
   */
  it("除 lib/authState.ts 外，components/ 不得直接呼叫 auth.getUser()", () => {
    const hits: string[] = [];
    const dir = path.join(ROOT, "components");
    const re = /auth\.getUser\s*\(/;
    for (const file of walkTs(dir)) {
      const rel = relPosix(file);
      const text = readFileSync(file, "utf8");
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) hits.push(`${rel}:${i + 1}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("全庫 .auth.signOut( 必須顯式帶 scope", () => {
    const hits: string[] = [];
    const re = /\.auth\.signOut\s*\(/g;
    for (const dirName of SCAN_DIRS) {
      const dir = path.join(ROOT, dirName);
      try {
        statSync(dir);
      } catch {
        continue;
      }
      for (const file of walkTs(dir)) {
        const rel = relPosix(file);
        const text = readFileSync(file, "utf8");
        let m: RegExpExecArray | null;
        re.lastIndex = 0;
        while ((m = re.exec(text))) {
          const slice = text.slice(m.index, m.index + 180);
          if (!/scope\s*:/.test(slice)) hits.push(`${rel}@${m.index}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

const DIRTY_MARK_ALLOWLIST = [
  "lib/syncDirty.ts",
  "lib/sessionPersist.ts",
  "lib/reviews.ts",
  "lib/appStateCloud.ts",
];

describe("G1 雲端蓋章／軟刪／dirty 守門", () => {
  it("markSyncDirty 只准出現在單一寫入口", () => {
    const hits: string[] = [];
    for (const dirName of SCAN_DIRS) {
      const dir = path.join(ROOT, dirName);
      try {
        statSync(dir);
      } catch {
        continue;
      }
      for (const file of walkTs(dir)) {
        const rel = relPosix(file);
        const text = readFileSync(file, "utf8");
        if (!text.includes("markSyncDirty")) continue;
        if (!DIRTY_MARK_ALLOWLIST.includes(rel)) hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it("lib／components／app 不得對 sessions／reviews 呼叫 .delete()", () => {
    const hits: string[] = [];
    const tableRe = /\.from\(\s*["'](sessions|reviews)["']\s*\)/;
    const deleteRe = /\.delete\s*\(\s*\)/;
    for (const dirName of SCAN_DIRS) {
      const dir = path.join(ROOT, dirName);
      try {
        statSync(dir);
      } catch {
        continue;
      }
      for (const file of walkTs(dir)) {
        const rel = relPosix(file);
        const text = readFileSync(file, "utf8");
        if (tableRe.test(text) && deleteRe.test(text)) hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it("sessionToRow 不得寫 updated_at；sessionFromRow 不得把 deleted_at 寫入 deletedAt", () => {
    const text = readFileSync(path.join(ROOT, "lib/sessionsCloud.ts"), "utf8");
    const toRow = text.slice(text.indexOf("export function sessionToRow"), text.indexOf("export function sessionFromRow"));
    const fromRow = text.slice(text.indexOf("export function sessionFromRow"), text.indexOf("function toRow"));
    expect(toRow).not.toMatch(/updated_at\s*:/);
    expect(fromRow).not.toMatch(/deletedAt\s*:/);
  });

  it("push 路徑不得在 upsert／insert payload 送 updated_at", () => {
    const files = ["lib/sessionsCloud.ts", "lib/reviews.ts", "lib/appStateCloud.ts"];
    const hits: string[] = [];
    for (const rel of files) {
      const lines = readFileSync(path.join(ROOT, rel), "utf8").split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/select\s*\(/.test(line)) continue;
        if (/updated_at\s*\??\s*:\s*(string|null)/.test(line)) continue;
        if (/\.updated_at/.test(line)) continue;
        if (/^\s*updated_at\s*:/.test(line) || /[{,]\s*updated_at\s*:/.test(line)) {
          hits.push(`${rel}:${i + 1}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

