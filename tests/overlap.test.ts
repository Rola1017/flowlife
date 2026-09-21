import { beforeEach, describe, expect, it } from "vitest";
import {
  findOverlaps,
  rangeStrToSpan,
  rangeStrsOverlap,
  sessionToSpan,
  spansOverlap,
  spanToAbsMin,
  type Span,
} from "@/lib/overlap";
import { pickOverlapsOn, timeRangesOverlap, type WorkplaceConfig } from "@/lib/schedule";
import { LS_KEYS, saveJSON } from "@/lib/storage";

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

describe("rangeStrToSpan", () => {
  it("正常 HH:mm~HH:mm", () => {
    expect(rangeStrToSpan("08:30~12:00")).toEqual({ start: "08:30", end: "12:00" });
  });
  it('"24:00" 合法', () => {
    expect(rangeStrToSpan("22:00~24:00")).toEqual({ start: "22:00", end: "24:00" });
  });
  it("空字串 → null", () => {
    expect(rangeStrToSpan("")).toBeNull();
  });
  it('缺 "~" → null', () => {
    expect(rangeStrToSpan("08:30-12:00")).toBeNull();
  });
  it("非數字 → null", () => {
    expect(rangeStrToSpan("ab:cd~10:00")).toBeNull();
    expect(rangeStrToSpan("10:00~xx:yy")).toBeNull();
  });
});

describe("rangeStrsOverlap", () => {
  it("碰邊不算（14:00~18:00 vs 18:00~22:00）", () => {
    expect(rangeStrsOverlap("14:00~18:00", "18:00~22:00")).toBe(false);
  });
  it("包含算重疊", () => {
    expect(rangeStrsOverlap("09:00~12:00", "10:00~11:00")).toBe(true);
  });
  it("部分重疊", () => {
    expect(rangeStrsOverlap("10:00~12:00", "11:00~13:00")).toBe(true);
  });
  it("完全相同算重疊", () => {
    expect(rangeStrsOverlap("10:00~11:00", "10:00~11:00")).toBe(true);
  });
  it("任一空字串 → false（當天不可用＝不佔時間）", () => {
    expect(rangeStrsOverlap("", "10:00~11:00")).toBe(false);
    expect(rangeStrsOverlap("10:00~11:00", "")).toBe(false);
    expect(rangeStrsOverlap("", "")).toBe(false);
  });
});

describe("timeRangesOverlap / rangeStrsOverlap / spansOverlap 等價性", () => {
  it("隨機 ≥500 組（5 分步進、含 24:00）三者一致且交換律", () => {
    const rand = mulberry32(20260920);
    const nSlots = 1440 / 5 + 1;
    const hmAt = (i: number) => {
      const m = i * 5;
      if (m >= 1440) return "24:00";
      return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    };
    for (let n = 0; n < 500; n++) {
      const a1 = hmAt(Math.floor(rand() * nSlots));
      const a2 = hmAt(Math.floor(rand() * nSlots));
      const b1 = hmAt(Math.floor(rand() * nSlots));
      const b2 = hmAt(Math.floor(rand() * nSlots));
      const viaSpans = spansOverlap({ start: a1, end: a2 }, { start: b1, end: b2 });
      const viaTime = timeRangesOverlap(a1, a2, b1, b2);
      const viaStr = rangeStrsOverlap(`${a1}~${a2}`, `${b1}~${b2}`);
      expect(viaTime).toBe(viaSpans);
      expect(viaStr).toBe(viaSpans);
      expect(spansOverlap({ start: b1, end: b2 }, { start: a1, end: a2 })).toBe(viaSpans);
      expect(timeRangesOverlap(b1, b2, a1, a2)).toBe(viaTime);
      expect(rangeStrsOverlap(`${b1}~${b2}`, `${a1}~${a2}`)).toBe(viaStr);
    }
  });
});

/** 鎖死 2026-08-17＝週一（與 today.test 的 2026-08-19＝週三對齊）；禁止 Date.now()／new Date() */
const MON = "2026-08-17";

const pickWps: WorkplaceConfig[] = [
  {
    id: "彩",
    name: "彩券行",
    shifts: [
      { id: "早", label: "早", days: ["一"], ranges: [{ days: null, start: "07:30", end: "14:00" }] },
      { id: "晚", label: "晚", days: ["一"], ranges: [{ days: null, start: "14:00", end: "22:00" }] },
    ],
  },
  {
    id: "診",
    name: "診所",
    shifts: [
      { id: "午", label: "午", days: ["一"], ranges: [{ days: null, start: "14:00", end: "18:00" }] },
      { id: "專", label: "專", days: ["三"], ranges: [{ days: null, start: "10:00", end: "12:00" }] },
    ],
  },
];

describe("pickOverlapsOn", () => {
  beforeEach(() => {
    localStorage.clear();
    saveJSON(LS_KEYS.workplaces, pickWps);
  });

  it("碰邊可並存（彩早 14:00 結束接診午 14:00 開始）", () => {
    expect(pickOverlapsOn(MON, "診", "午", [{ place: "彩", shift: "早" }], false)).toBe(false);
  });

  it("重疊擋下（彩晚 14:00–22:00 vs 診午 14:00–18:00）", () => {
    expect(pickOverlapsOn(MON, "診", "午", [{ place: "彩", shift: "晚" }], false)).toBe(true);
  });

  it("isOverride=true 不受可上班日閘門（週一可取週三專班時段，與彩早重疊）", () => {
    expect(pickOverlapsOn(MON, "診", "專", [{ place: "彩", shift: "早" }], true)).toBe(true);
  });

  it("isOverride=false 守閘門（週一取週三專班＝無時段，不判重疊）", () => {
    expect(pickOverlapsOn(MON, "診", "專", [{ place: "彩", shift: "早" }], false)).toBe(false);
  });
});

/** 固定種子 PRNG；禁止 Date.now() */
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
