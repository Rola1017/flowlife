import { describe, expect, it } from "vitest";
import { tsMs, tsNewer } from "@/lib/time";

/** 鎖死字串；禁止 Date.now()／new Date() */

const Z = "2026-09-24T08:48:11.964Z";
const OFFSET = "2026-09-24T08:48:11.964+00:00";
const Z_MS = "2026-09-24T08:48:11.123Z";
const OFFSET_US = "2026-09-24T08:48:11.123456+00:00";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("tsMs／tsNewer", () => {
  it("同一時刻的 Z 與 +00:00 必須相等、互不大於", () => {
    expect(tsMs(Z)).toBe(tsMs(OFFSET));
    expect(tsNewer(Z, OFFSET)).toBe(false);
    expect(tsNewer(OFFSET, Z)).toBe(false);
  });

  it("微秒版本與毫秒版本視為相等", () => {
    expect(tsMs(Z_MS)).toBe(tsMs(OFFSET_US));
    expect(tsNewer(Z_MS, OFFSET_US)).toBe(false);
    expect(tsNewer(OFFSET_US, Z_MS)).toBe(false);
  });

  it("空字串／null／undefined → 0；無效字串 → 0", () => {
    expect(tsMs("")).toBe(0);
    expect(tsMs(null)).toBe(0);
    expect(tsMs(undefined)).toBe(0);
    expect(tsMs("not-a-date")).toBe(0);
  });

  it("較新者 tsNewer 為 true", () => {
    expect(tsNewer("2026-09-24T08:48:12.000Z", Z)).toBe(true);
    expect(tsNewer(Z, "2026-09-24T08:48:12.000+00:00")).toBe(false);
  });
});

describe("tsNewer property ≥500：同一時刻兩種寫法兩向皆 false", () => {
  it("Z vs +00:00", () => {
    const rnd = mulberry32(20260924);
    const bases = [
      "2026-01-01T00:00:00.000",
      "2026-03-15T12:30:45.001",
      "2026-07-01T08:16:00.123",
      "2026-09-24T08:48:11.964",
      "2026-12-31T23:59:59.999",
    ];
    for (let i = 0; i < 500; i++) {
      const base = bases[Math.floor(rnd() * bases.length)];
      const z = `${base}Z`;
      const offset = `${base}+00:00`;
      expect(tsNewer(z, offset), `i=${i} z>offset`).toBe(false);
      expect(tsNewer(offset, z), `i=${i} offset>z`).toBe(false);
      expect(tsMs(z), `i=${i} ms`).toBe(tsMs(offset));
    }
  });
});
