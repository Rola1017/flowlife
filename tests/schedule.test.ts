import { beforeEach, describe, expect, it } from "vitest";
import {
  currentScheduleBlock,
  loadRoutine,
  timeRangesOverlap,
  type RoutineBlock,
  type WorkplaceConfig,
} from "@/lib/schedule";
import { LS_KEYS, saveJSON } from "@/lib/storage";

beforeEach(() => {
  localStorage.clear();
});

describe("schedule.timeRangesOverlap", () => {
  it("相鄰不算重疊（10:00-11:00 與 11:00-12:00）", () => {
    expect(timeRangesOverlap("10:00", "11:00", "11:00", "12:00")).toBe(false);
  });

  it("包含算重疊", () => {
    expect(timeRangesOverlap("09:00", "12:00", "10:00", "11:00")).toBe(true);
  });

  it("部分重疊", () => {
    expect(timeRangesOverlap("10:00", "12:00", "11:00", "13:00")).toBe(true);
  });

  it("完全相同算重疊", () => {
    expect(timeRangesOverlap("10:00", "11:00", "10:00", "11:00")).toBe(true);
  });
});

describe("schedule.currentScheduleBlock", () => {
  const date = "2026-07-25"; // 六

  function seedBase() {
    saveJSON(LS_KEYS.dayPlans, {});
    saveJSON(LS_KEYS.dayOverrides, {});
    saveJSON(LS_KEYS.weekSchedule, {});
  }

  it("落在作息", () => {
    seedBase();
    saveJSON(LS_KEYS.routine, [
      { start: "12:00", end: "13:00", label: "🍴 午餐", items: [{ name: "午餐" }] },
    ] satisfies RoutineBlock[]);
    const b = currentScheduleBlock(date, 12 * 60 + 30);
    expect(b?.kind).toBe("routine");
    expect(b?.label).toContain("午餐");
  });

  it("落在班別", () => {
    seedBase();
    saveJSON(LS_KEYS.routine, []);
    const wp: WorkplaceConfig[] = [
      {
        id: "診",
        name: "診所",
        shifts: [
          {
            id: "早",
            label: "早",
            days: ["六"],
            ranges: [{ days: null, start: "08:30", end: "12:00" }],
          },
        ],
      },
    ];
    saveJSON(LS_KEYS.workplaces, wp);
    saveJSON(LS_KEYS.dayPlans, { 六: { picks: [{ place: "診", shift: "早" }] } });
    // routine empty array → loadRoutine falls back to DEFAULT; force a blank override via day with no routine conflict
    // 用不會蓋住 09:00 的作息
    saveJSON(LS_KEYS.routine, [
      { start: "00:00", end: "06:00", label: "睡", items: [{ name: "睡" }] },
    ]);
    const b = currentScheduleBlock(date, 9 * 60, { 六: { picks: [{ place: "診", shift: "早" }] } });
    expect(b?.kind).toBe("shift");
  });

  it("落在課程", () => {
    seedBase();
    saveJSON(LS_KEYS.routine, [
      { start: "00:00", end: "06:00", label: "睡", items: [{ name: "睡" }] },
    ]);
    saveJSON(LS_KEYS.workplaces, []);
    saveJSON(LS_KEYS.weekSchedule, {
      六: [{ t: "10:00", n: "默寫架構", cat1: "學習", cat2: "寫作", cat3: "" }],
    });
    const b = currentScheduleBlock(date, 10 * 60 + 10);
    expect(b?.kind).toBe("course");
    expect(b?.label).toContain("默寫架構");
  });

  it("都不落 → null（未利用）", () => {
    seedBase();
    saveJSON(LS_KEYS.routine, [
      { start: "00:00", end: "06:00", label: "睡", items: [{ name: "睡" }] },
    ]);
    saveJSON(LS_KEYS.workplaces, []);
    expect(currentScheduleBlock(date, 9 * 60)).toBeNull();
  });

  it('"24:00" 邊界：23:59 落在內、00:00 不落在前一天那筆', () => {
    seedBase();
    saveJSON(LS_KEYS.routine, [
      { start: "23:00", end: "24:00", label: "😴 睡覺", items: [{ name: "睡覺" }] },
    ]);
    saveJSON(LS_KEYS.workplaces, []);
    expect(currentScheduleBlock(date, 23 * 60 + 59)?.kind).toBe("routine");
    expect(currentScheduleBlock(date, 0)).toBeNull();
  });

  it("優先序：作息 > 班別 > 課程", () => {
    seedBase();
    // 三者皆蓋 10:00–10:30
    saveJSON(LS_KEYS.routine, [
      { start: "10:00", end: "11:00", label: "作息塊", items: [{ name: "作息塊" }] },
    ]);
    const wp: WorkplaceConfig[] = [
      {
        id: "診",
        name: "診所",
        shifts: [
          {
            id: "早",
            label: "早",
            days: ["六"],
            ranges: [{ days: null, start: "09:00", end: "12:00" }],
          },
        ],
      },
    ];
    saveJSON(LS_KEYS.workplaces, wp);
    saveJSON(LS_KEYS.weekSchedule, {
      六: [{ t: "10:00", n: "課程A", cat1: "學習", cat2: "", cat3: "" }],
    });
    const plans = { 六: { picks: [{ place: "診", shift: "早" }] } };
    expect(currentScheduleBlock(date, 10 * 60 + 5, plans)?.kind).toBe("routine");
  });
});

describe("schedule.loadRoutine", () => {
  it("items 的 hi 欄位必須被保留（歷史 bug：正規化把 hi 丟掉）", () => {
    saveJSON(LS_KEYS.routine, [
      {
        start: "07:00",
        end: "08:00",
        label: "🍴 早餐",
        emoji: "🍴",
        items: [{ name: "早餐", detail: "蛋白質", hi: true }],
      },
    ]);
    const loaded = loadRoutine();
    expect(loaded[0].items?.[0].hi).toBe(true);
    expect(loaded[0].items?.[0].detail).toBe("蛋白質");
  });
});
