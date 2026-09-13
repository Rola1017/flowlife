import { describe, expect, it } from "vitest";
import { availableSegmentsWith, toFreeSlots } from "@/lib/idle";
import { blockedRangesWith, type ScheduleData, type WorkplaceConfig } from "@/lib/schedule";
import { toM } from "@/lib/utils";

/** 固定日期鎖死時區：2026-09-15＝週二（禁止 new Date()） */
const TUE = "2026-09-15";
const WIN_FROM = "06:00";
const WIN_TO = "24:00";
const WIN_START = toM(WIN_FROM);
const WIN_END = toM(WIN_TO);

function emptyData(partial: Partial<ScheduleData> = {}): ScheduleData {
  return {
    routine: [],
    dayPlans: {},
    dayOverrides: {},
    weekSchedule: {},
    workplaces: [],
    ...partial,
  };
}

const tueWorkplace: WorkplaceConfig[] = [
  {
    id: "診",
    name: "診所",
    shifts: [
      {
        id: "晚",
        label: "晚",
        days: ["二"],
        ranges: [{ days: null, start: "14:00", end: "22:00" }],
      },
    ],
  },
];

function blockedMinsInWindow(
  blocked: [number, number][],
  winStart: number,
  winEnd: number,
): number {
  let n = 0;
  for (const [a, b] of blocked) {
    const s = Math.max(a, winStart);
    const e = Math.min(b, winEnd);
    if (e > s) n += e - s;
  }
  return n;
}

describe("availableSegmentsWith / free-slots", () => {
  it("① 全空的一天 → 整個視窗為一個大空檔", () => {
    const segs = availableSegmentsWith(TUE, WIN_START, WIN_END, emptyData());
    expect(segs).toEqual([[WIN_START, WIN_END]]);
    const slots = toFreeSlots(segs, 15);
    expect(slots).toEqual([{ start: "06:00", end: "24:00", minutes: WIN_END - WIN_START }]);
  });

  it("② 作息佔 12:00-13:00 → 空檔切成前後兩段，邊界正確", () => {
    const data = emptyData({
      routine: [{ start: "12:00", end: "13:00", label: "🍴 午餐", items: [{ name: "午餐" }] }],
    });
    const segs = availableSegmentsWith(TUE, WIN_START, WIN_END, data);
    expect(segs).toEqual([
      [toM("06:00"), toM("12:00")],
      [toM("13:00"), toM("24:00")],
    ]);
    expect(segs[0][1]).toBe(segs[1][0] - 60);
    expect(segs[0][1]).toBe(toM("12:00"));
    expect(segs[1][0]).toBe(toM("13:00"));
  });

  it("③ 班別 14:00-22:00 與作息 17:00-18:00 重疊 → 聯集只扣一次", () => {
    const data = emptyData({
      routine: [{ start: "17:00", end: "18:00", label: "🍴 晚餐", items: [{ name: "晚餐" }] }],
      workplaces: tueWorkplace,
      dayPlans: { 二: { picks: [{ place: "診", shift: "晚" }] } },
    });
    const segs = availableSegmentsWith(TUE, WIN_START, WIN_END, data);
    expect(segs).toEqual([
      [toM("06:00"), toM("14:00")],
      [toM("22:00"), toM("24:00")],
    ]);
    for (const [a, b] of segs) {
      expect(Math.max(0, Math.min(b, toM("18:00")) - Math.max(a, toM("17:00")))).toBe(0);
    }
  });

  it("④ minMinutes=30 時，小於 30 分的碎片空檔被濾掉", () => {
    const data = emptyData({
      routine: [
        { start: "12:00", end: "12:20", label: "A", items: [{ name: "A" }] },
        { start: "12:35", end: "13:00", label: "B", items: [{ name: "B" }] },
      ],
    });
    const segs = availableSegmentsWith(TUE, toM("12:00"), toM("13:00"), data);
    expect(segs).toEqual([[toM("12:20"), toM("12:35")]]);
    expect(toFreeSlots(segs, 15)).toEqual([{ start: "12:20", end: "12:35", minutes: 15 }]);
    expect(toFreeSlots(segs, 30)).toEqual([]);
  });

  it("⑤ 視窗邊界：\"24:00\" 正確處理為 1440", () => {
    expect(toM("24:00")).toBe(1440);
    expect(WIN_END).toBe(1440);
    const data = emptyData({
      routine: [{ start: "23:00", end: "24:00", label: "睡", items: [{ name: "睡" }] }],
    });
    const segs = availableSegmentsWith(TUE, toM("22:00"), toM("24:00"), data);
    expect(segs).toEqual([[toM("22:00"), toM("23:00")]]);
    const slots = toFreeSlots(segs, 1);
    expect(slots[0]?.end).toBe("23:00");
    const open = toFreeSlots(availableSegmentsWith(TUE, toM("22:00"), toM("24:00"), emptyData()), 1);
    expect(open).toEqual([{ start: "22:00", end: "24:00", minutes: 120 }]);
  });

  it("⑥ 空檔總分鐘數 + 被佔用分鐘數 = 視窗總長", () => {
    const data = emptyData({
      routine: [
        { start: "12:00", end: "13:00", label: "午餐", items: [{ name: "午餐" }] },
        { start: "17:00", end: "18:00", label: "晚餐", items: [{ name: "晚餐" }] },
      ],
      workplaces: tueWorkplace,
      dayPlans: { 二: { picks: [{ place: "診", shift: "晚" }] } },
      weekSchedule: {
        二: [{ t: "10:00", n: "課", cat1: "學習", cat2: "", cat3: "" }],
      },
    });
    const segs = availableSegmentsWith(TUE, WIN_START, WIN_END, data);
    const free = segs.reduce((s, [a, b]) => s + (b - a), 0);
    const blocked = blockedMinsInWindow(blockedRangesWith(TUE, data), WIN_START, WIN_END);
    expect(free + blocked).toBe(WIN_END - WIN_START);
  });
});
