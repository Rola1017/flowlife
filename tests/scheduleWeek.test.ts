import { describe, expect, it } from "vitest";
import {
  addDaysYmd,
  mondayOfDateStr,
  weekDatesFromMonday,
  weekRangeMd,
  weekdayMon0,
} from "@/lib/dateStr";
import {
  applyDayVacation,
  resolveDayView,
  restoreDayToTemplate,
  vacationClearCounts,
  type CourseInfo,
  type DayOverride,
  type DayPlan,
} from "@/lib/schedule";

const WED = "2026-09-16"; // 三
const FRI = "2026-09-18"; // 五
const COURSE_A: CourseInfo = { t: "09:00", n: "民法", cat1: "學習", cat2: "法律", cat3: "" };
const COURSE_B: CourseInfo = { t: "14:00", n: "刑法", cat1: "學習", cat2: "法律", cat3: "" };
const PICK_A = { place: "診", shift: "早" };
const PICK_B = { place: "券", shift: "晚" };

const WEEK: Record<string, CourseInfo[]> = { 三: [COURSE_A] };
const PLANS: Record<string, DayPlan> = { 三: { picks: [PICK_A] } };

function cloneWeek() {
  return { 三: [{ ...COURSE_A }] };
}
function clonePlans() {
  return { 三: { picks: [{ ...PICK_A }] } };
}

describe("週區間（週一為首，日期字串鎖死）", () => {
  it("給定週五算出該週一與 9/14 ~ 9/20", () => {
    expect(mondayOfDateStr(FRI)).toBe("2026-09-14");
    expect(weekRangeMd("2026-09-14")).toBe("9/14 ~ 9/20");
    expect(weekDatesFromMonday("2026-09-14")).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
  });

  it("週一／週日都落在同一週", () => {
    expect(mondayOfDateStr("2026-09-14")).toBe("2026-09-14");
    expect(mondayOfDateStr("2026-09-20")).toBe("2026-09-14");
    expect(weekdayMon0("2026-09-14")).toBe(0);
    expect(weekdayMon0("2026-09-20")).toBe(6);
  });

  it("跨月：9/30 所在週為 9/28 ~ 10/4", () => {
    expect(mondayOfDateStr("2026-09-30")).toBe("2026-09-28");
    expect(weekRangeMd("2026-09-28")).toBe("9/28 ~ 10/4");
  });

  it("跨年：2027-01-01 所在週為 12/28 ~ 1/3", () => {
    expect(mondayOfDateStr("2027-01-01")).toBe("2026-12-28");
    expect(weekRangeMd("2026-12-28")).toBe("12/28 ~ 1/3");
  });

  it("加減天不經 Date：月底／閏日", () => {
    expect(addDaysYmd("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysYmd("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysYmd("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDaysYmd("2026-09-14", 7)).toBe("2026-09-21");
  });
});

describe("resolveDayView：有 override 顯示例外，沒有顯示常用模板", () => {
  it("無 override → 模板課程與班別，isOverride=false", () => {
    const v = resolveDayView(WED, WEEK, PLANS, {});
    expect(v.weekday).toBe("三");
    expect(v.isOverride).toBe(false);
    expect(v.courses).toEqual([COURSE_A]);
    expect(v.picks).toEqual([PICK_A]);
  });

  it("有 override（含 courses）→ 整天取代", () => {
    const ovs: Record<string, DayOverride> = {
      [WED]: { picks: [PICK_B], courses: [COURSE_B] },
    };
    const v = resolveDayView(WED, WEEK, PLANS, ovs);
    expect(v.isOverride).toBe(true);
    expect(v.courses).toEqual([COURSE_B]);
    expect(v.picks).toEqual([PICK_B]);
  });

  it("override 只有 picks、courses 未定義 → 班用例外、課沿用模板", () => {
    const ovs: Record<string, DayOverride> = { [WED]: { picks: [PICK_B] } };
    const v = resolveDayView(WED, WEEK, PLANS, ovs);
    expect(v.isOverride).toBe(true);
    expect(v.picks).toEqual([PICK_B]);
    expect(v.courses).toEqual([COURSE_A]);
  });

  it("override picks=[] courses=[] → 當天課班皆空（仍標例外）", () => {
    const ovs: Record<string, DayOverride> = { [WED]: { picks: [], courses: [] } };
    const v = resolveDayView(WED, WEEK, PLANS, ovs);
    expect(v.isOverride).toBe(true);
    expect(v.picks).toEqual([]);
    expect(v.courses).toEqual([]);
  });
});

describe("休假快捷：只寫 override，常用模板不變", () => {
  it("課程休假：courses 空、picks 保留；week/plans 原樣", () => {
    const week = cloneWeek();
    const plans = clonePlans();
    const ovs: Record<string, DayOverride> = {};
    const next = applyDayVacation(WED, "courses", week, plans, ovs);
    expect(week).toEqual(cloneWeek());
    expect(plans).toEqual(clonePlans());
    expect(ovs[WED]).toBeUndefined();
    expect(next[WED]?.courses).toEqual([]);
    expect(next[WED]?.picks).toEqual([PICK_A]);
    const v = resolveDayView(WED, week, plans, next);
    expect(v.courses).toEqual([]);
    expect(v.picks).toEqual([PICK_A]);
    expect(v.isOverride).toBe(true);
  });

  it("兼差休假：picks 空、課沿用模板", () => {
    const week = cloneWeek();
    const plans = clonePlans();
    const next = applyDayVacation(WED, "shifts", week, plans, {});
    expect(week).toEqual(cloneWeek());
    expect(plans).toEqual(clonePlans());
    expect(next[WED]?.picks).toEqual([]);
    expect(next[WED]?.courses).toBeUndefined();
    const v = resolveDayView(WED, week, plans, next);
    expect(v.picks).toEqual([]);
    expect(v.courses).toEqual([COURSE_A]);
  });

  it("都休假：課班皆空", () => {
    const week = cloneWeek();
    const plans = clonePlans();
    const next = applyDayVacation(WED, "both", week, plans, {});
    expect(week).toEqual(cloneWeek());
    expect(plans).toEqual(clonePlans());
    const v = resolveDayView(WED, week, plans, next);
    expect(v.picks).toEqual([]);
    expect(v.courses).toEqual([]);
    expect(vacationClearCounts(resolveDayView(WED, week, plans, {}))).toEqual({ shifts: 1, courses: 1 });
  });
});

describe("恢復成常用模板：清掉 override 後回到模板", () => {
  it("刪掉該日 key，課班回到 week_schedule / day_plans", () => {
    const week = cloneWeek();
    const plans = clonePlans();
    const ovs: Record<string, DayOverride> = {
      [WED]: { picks: [], courses: [] },
      "2026-09-17": { picks: [PICK_B] },
    };
    const next = restoreDayToTemplate(ovs, WED);
    expect(next[WED]).toBeUndefined();
    expect(next["2026-09-17"]).toEqual({ picks: [PICK_B] });
    expect(ovs[WED]).toBeDefined();
    const v = resolveDayView(WED, week, plans, next);
    expect(v.isOverride).toBe(false);
    expect(v.courses).toEqual([COURSE_A]);
    expect(v.picks).toEqual([PICK_A]);
  });
});
