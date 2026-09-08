import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUTINE,
  DEFAULT_WORKPLACES,
  buildTodayBlocks,
  weekdayOf,
  type ScheduleData,
  type WorkplaceConfig,
} from "@/lib/schedule";

/** 固定日期鎖死時區：2026-07-25＝週六；2026-08-19＝週三（勿用 Date.now()） */
const SAT = "2026-07-25";
const WED = "2026-08-19"; // 週三

function baseData(partial: Partial<ScheduleData> = {}): ScheduleData {
  return {
    routine: DEFAULT_ROUTINE,
    dayPlans: {},
    dayOverrides: {},
    weekSchedule: {},
    workplaces: DEFAULT_WORKPLACES,
    ...partial,
  };
}

const satWorkplace: WorkplaceConfig[] = [
  {
    id: "診",
    name: "診所",
    shifts: [
      {
        id: "晚",
        label: "晚",
        days: ["六"],
        ranges: [{ days: null, start: "14:00", end: "22:00" }],
      },
    ],
  },
];

describe("buildTodayBlocks", () => {
  it("① 週六：作息＋班別＋課程 → 數量／排序／type 正確", () => {
    expect(weekdayOf(SAT)).toBe("六");
    const data = baseData({
      workplaces: satWorkplace,
      dayPlans: { 六: { picks: [{ place: "診", shift: "晚" }] } },
      weekSchedule: {
        六: [{ t: "10:00", n: "默寫架構", cat1: "學習", cat2: "寫作", cat3: "" }],
      },
    });
    const blocks = buildTodayBlocks(SAT, data);
    expect(blocks.some((b) => b.type === "shift")).toBe(true);
    expect(blocks.some((b) => b.type === "course" && b.type === "course")).toBe(true);
    const course = blocks.find((b) => b.type === "course");
    expect(course && course.type === "course" && course.name).toBe("默寫架構");
    expect(blocks.filter((b) => b.type === "routine").length).toBeGreaterThanOrEqual(1);
    // 依 start 升冪
    for (let i = 1; i < blocks.length; i++) {
      const prev = blocks[i - 1].start === "24:00" ? 1440 : Number(blocks[i - 1].start.replace(":", ""));
      const cur = blocks[i].start === "24:00" ? 1440 : Number(blocks[i].start.replace(":", ""));
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
  });

  it("② 重疊：晚餐 17–18 與班別 14–22 → 兩者都出現（不裁決）", () => {
    const data = baseData({
      routine: [
        { start: "17:00", end: "18:00", label: "🍴 晚餐", items: [{ name: "晚餐" }] },
      ],
      workplaces: satWorkplace,
      dayPlans: { 六: { picks: [{ place: "診", shift: "晚" }] } },
    });
    const blocks = buildTodayBlocks(SAT, data);
    expect(blocks.some((b) => b.type === "routine" && b.start === "17:00")).toBe(true);
    expect(blocks.some((b) => b.type === "shift" && b.start === "14:00")).toBe(true);
  });

  it("③ day_overrides 便利貼覆蓋當天 picks／courses", () => {
    const data = baseData({
      workplaces: [
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
      ],
      dayPlans: { 六: { picks: [{ place: "診", shift: "早" }] } },
      weekSchedule: {
        六: [{ t: "09:00", n: "週課", cat1: "學習", cat2: "", cat3: "" }],
      },
      dayOverrides: {
        [SAT]: {
          picks: [{ place: "診", shift: "早" }],
          courses: [{ t: "15:00", n: "便利貼課", cat1: "學習", cat2: "", cat3: "" }],
        },
      },
    });
    const blocks = buildTodayBlocks(SAT, data);
    expect(blocks.some((b) => b.type === "course" && "name" in b && b.name === "便利貼課")).toBe(
      true,
    );
    expect(blocks.some((b) => b.type === "course" && "name" in b && b.name === "週課")).toBe(false);
  });

  it("④ 空資料 → 回退 DEFAULT_ROUTINE，不丟錯", () => {
    const blocks = buildTodayBlocks(SAT, {
      routine: [],
      dayPlans: {},
      dayOverrides: {},
      weekSchedule: {},
      workplaces: [],
    });
    expect(blocks.length).toBe(DEFAULT_ROUTINE.length);
    expect(blocks.every((b) => b.type === "routine")).toBe(true);
  });

  it("⑤ 未來日期週三（2026-08-19＝週三）套用該星期 week_schedule／day_plans", () => {
    expect(weekdayOf(WED)).toBe("三");
    const data = baseData({
      workplaces: [
        {
          id: "診",
          name: "診所",
          shifts: [
            {
              id: "午",
              label: "午",
              days: ["三"],
              ranges: [{ days: null, start: "14:00", end: "18:00" }],
            },
          ],
        },
      ],
      dayPlans: { 三: { picks: [{ place: "診", shift: "午" }] } },
      weekSchedule: {
        三: [{ t: "09:30", n: "未來週三課", cat1: "學習", cat2: "", cat3: "" }],
        六: [{ t: "10:00", n: "週六課不應出現", cat1: "學習", cat2: "", cat3: "" }],
      },
    });
    const blocks = buildTodayBlocks(WED, data);
    expect(blocks.some((b) => b.type === "course" && "name" in b && b.name === "未來週三課")).toBe(
      true,
    );
    expect(blocks.some((b) => b.type === "course" && "name" in b && b.name === "週六課不應出現")).toBe(
      false,
    );
    expect(blocks.some((b) => b.type === "shift" && b.start === "14:00")).toBe(true);
  });
});
