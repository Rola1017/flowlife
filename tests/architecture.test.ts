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
});
