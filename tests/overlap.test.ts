import { describe, expect, it } from "vitest";
import { findOverlaps, sessionToSpan, spansOverlap, spanToAbsMin, type Span } from "@/lib/overlap";

/** 鎖死字串；禁止 Date.now()／new Date() */

describe("spansOverlap HH:mm", () => {
  it("相鄰不算重疊（10:00-11:00 與 11:00-12:00）", () => {
    expect(spansOverlap({ start: "10:00", end: "11:00" }, { start: "11:00", end: "12:00" })).toBe(false);
  });

  it("包含算重疊", () => {
    expect(spansOverlap({ start: "09:00", end: "12:00" }, { start: "10:00", end: "11:00" })).toBe(true);
  });

  it("部分重疊", () => {
    expect(spansOverlap({ start: "10:00", end: "12:00" }, { start: "11:00", end: "13:00" })).toBe(true);
  });

  it("完全相同算重疊", () => {
    expect(spansOverlap({ start: "10:00", end: "11:00" }, { start: "10:00", end: "11:00" })).toBe(true);
  });

  it('"24:00" = 1440，與 23:00-24:00 相鄰的次日不算（同日 22:00-24:00 含 23:00-24:00）', () => {
    expect(spanToAbsMin("24:00")).toBe(1440);
    expect(spansOverlap({ start: "22:00", end: "24:00" }, { start: "23:00", end: "24:00" })).toBe(true);
    expect(spansOverlap({ start: "22:00", end: "24:00" }, { start: "24:00", end: "24:00" })).toBe(false);
  });
});

describe("spansOverlap datetime-local", () => {
  it("相鄰不算重疊", () => {
    expect(
      spansOverlap(
        { start: "2026-09-16T10:00", end: "2026-09-16T11:00" },
        { start: "2026-09-16T11:00", end: "2026-09-16T12:00" },
      ),
    ).toBe(false);
  });

  it("包含／部分／完全相同", () => {
    const a: Span = { start: "2026-09-16T09:00", end: "2026-09-16T12:00" };
    expect(spansOverlap(a, { start: "2026-09-16T10:00", end: "2026-09-16T11:00" })).toBe(true);
    expect(
      spansOverlap(
        { start: "2026-09-16T10:00", end: "2026-09-16T12:00" },
        { start: "2026-09-16T11:00", end: "2026-09-16T13:00" },
      ),
    ).toBe(true);
    expect(
      spansOverlap(
        { start: "2026-09-16T10:00", end: "2026-09-16T11:00" },
        { start: "2026-09-16T10:00", end: "2026-09-16T11:00" },
      ),
    ).toBe(true);
  });

  it("跨日 T24:00 與次日 00:00 相鄰不算", () => {
    expect(
      spansOverlap(
        { start: "2026-09-16T23:00", end: "2026-09-16T24:00" },
        { start: "2026-09-17T00:00", end: "2026-09-17T01:00" },
      ),
    ).toBe(false);
  });
});

describe("findOverlaps", () => {
  it("只回傳重疊者；相鄰排除", () => {
    const target: Span = { start: "10:00", end: "12:00" };
    const existing: Span[] = [
      { start: "09:00", end: "10:00" },
      { start: "11:00", end: "13:00" },
      { start: "12:00", end: "13:00" },
      { start: "10:30", end: "11:00" },
    ];
    expect(findOverlaps(target, existing)).toEqual([
      { start: "11:00", end: "13:00" },
      { start: "10:30", end: "11:00" },
    ]);
  });
});

describe("sessionToSpan", () => {
  it("缺起迄 → null；有則拼 datetime", () => {
    expect(sessionToSpan({ date: "2026-09-16" })).toBeNull();
    expect(sessionToSpan({ date: "2026-09-16", startTime: "09:00", endTime: "10:30" })).toEqual({
      start: "2026-09-16T09:00",
      end: "2026-09-16T10:30",
    });
  });
});
