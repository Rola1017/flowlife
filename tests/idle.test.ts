import { beforeEach, describe, expect, it } from "vitest";
import { availableSegments } from "@/lib/idle";
import { LS_KEYS, saveJSON } from "@/lib/storage";
import type { RoutineBlock } from "@/lib/schedule";

beforeEach(() => {
  localStorage.clear();
});

/** 透過 availableSegments 行使 subtract（未 export）；驗證區段夾在視窗內 */
describe("idle.subtract via availableSegments", () => {
  function seedRoutine(routine: RoutineBlock[]) {
    saveJSON(LS_KEYS.routine, routine);
    saveJSON(LS_KEYS.dayPlans, {});
    saveJSON(LS_KEYS.dayOverrides, {});
    saveJSON(LS_KEYS.workplaces, []);
  }

  it("輸出區段必須完全落在傳入視窗內（歷史 bug：未利用延伸到下一個不可用時段）", () => {
    // 視窗外（13:00–14:00）有作息；若 subtract 未夾上界，會把可用推到 13:00
    seedRoutine([
      { start: "13:00", end: "14:00", emoji: "🍴", items: [{ name: "午餐" }], label: "🍴 午餐" },
    ]);
    const winStart = 8 * 60;
    const winEnd = 12 * 60;
    const segs = availableSegments("2026-07-25", winStart, winEnd, {});
    expect(segs.length).toBeGreaterThan(0);
    for (const [a, b] of segs) {
      expect(a).toBeGreaterThanOrEqual(winStart);
      expect(b).toBeLessThanOrEqual(winEnd);
      expect(b).toBeGreaterThan(a);
    }
    expect(segs).toEqual([[winStart, winEnd]]);
  });

  it("扣除區段與視窗完全重疊 → 無可用", () => {
    seedRoutine([{ start: "10:00", end: "11:00", label: "佔滿", items: [{ name: "佔滿" }] }]);
    expect(availableSegments("2026-07-25", 10 * 60, 11 * 60, {})).toEqual([]);
  });

  it("扣除區段與視窗部分重疊 → 兩側剩餘", () => {
    seedRoutine([{ start: "10:00", end: "11:00", label: "中段", items: [{ name: "中段" }] }]);
    expect(availableSegments("2026-07-25", 9 * 60, 12 * 60, {})).toEqual([
      [9 * 60, 10 * 60],
      [11 * 60, 12 * 60],
    ]);
  });

  it("扣除區段與視窗無交集 → 整段可用", () => {
    seedRoutine([{ start: "13:00", end: "14:00", label: "下午", items: [{ name: "下午" }] }]);
    expect(availableSegments("2026-07-25", 8 * 60, 9 * 60, {})).toEqual([[8 * 60, 9 * 60]]);
  });

  it("相鄰邊界（起點等於終點）不算佔用視窗內", () => {
    seedRoutine([{ start: "12:00", end: "13:00", label: "午餐", items: [{ name: "午餐" }] }]);
    expect(availableSegments("2026-07-25", 8 * 60, 12 * 60, {})).toEqual([[8 * 60, 12 * 60]]);
  });

  it("availableSegments：不得包含任何被作息佔用的分鐘", () => {
    seedRoutine([
      { start: "00:00", end: "08:00", label: "睡眠", items: [{ name: "睡眠" }] },
      { start: "12:00", end: "13:00", label: "午餐", items: [{ name: "午餐" }] },
    ]);
    const segs = availableSegments("2026-07-25", 0, 24 * 60, {});
    expect(segs).toEqual([
      [8 * 60, 12 * 60],
      [13 * 60, 24 * 60],
    ]);
    for (const [a, b] of segs) {
      expect(a < 8 * 60 && b > 0 ? false : true).toBe(true);
      expect(!(a < 13 * 60 && b > 12 * 60 && a < 12 * 60 === false && b > 13 * 60 === false)).toBeTruthy();
      // 區段與 [0,480)、[720,780) 無交集
      expect(Math.max(0, Math.min(b, 8 * 60) - Math.max(a, 0))).toBe(0);
      expect(Math.max(0, Math.min(b, 13 * 60) - Math.max(a, 12 * 60))).toBe(0);
    }
  });
});
