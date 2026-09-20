import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  addDaysYmd,
  mondayOfDateStr,
  weekDatesFromMonday,
  weekRangeMd,
  weekdayMon0,
  isCurrentWeek,
} from "@/lib/dateStr";
import {
  applyDayVacation,
  cloneCoursesForPaste,
  ensureCourseIds,
  patchCourseKeepId,
  resolveDayView,
  restoreDayToTemplate,
  stampCourseIds,
  vacationClearCounts,
  type CourseInfo,
  type DayOverride,
  type DayPlan,
} from "@/lib/schedule";
import { LS_KEYS, saveJSON } from "@/lib/storage";

vi.mock("@/lib/appStateCloud", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appStateCloud")>();
  return { ...actual, pushAppState: async () => true };
});

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

describe("回本週目標週", () => {
  it("今天若在該週，monday 就是回本週的目標", () => {
    expect(isCurrentWeek("2026-09-14", FRI)).toBe(true);
    expect(isCurrentWeek("2026-09-21", FRI)).toBe(false);
    expect(mondayOfDateStr(FRI)).toBe("2026-09-14");
    expect(mondayOfDateStr("2026-09-21")).toBe("2026-09-21");
  });
});

describe("課程穩定 id", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stampCourseIds 冪等：第二次不改已有 id", () => {
    let n = 0;
    const newId = () => `id-${++n}`;
    const week = { 一: [{ t: "09:00", n: "民法", cat1: "學習", cat2: "", cat3: "" }] };
    const ovs: Record<string, DayOverride> = {
      "2026-09-14": { picks: [], courses: [{ t: "10:00", n: "刑法", cat1: "學習", cat2: "", cat3: "" }] },
    };
    const a = stampCourseIds(week, ovs, newId);
    expect(a.changed).toBe(true);
    expect(a.week["一"][0].id).toBe("id-1");
    expect(a.overrides["2026-09-14"].courses?.[0].id).toBe("id-2");
    const b = stampCourseIds(a.week, a.overrides, newId);
    expect(b.changed).toBe(false);
    expect(b.week["一"][0].id).toBe("id-1");
    expect(b.overrides["2026-09-14"].courses?.[0].id).toBe("id-2");
    expect(n).toBe(2);
  });

  it("ensureCourseIds 執行兩次結果相同，已有 id 不被覆寫", () => {
    saveJSON(LS_KEYS.weekSchedule, {
      一: [{ t: "09:00", n: "民法", cat1: "學習", cat2: "", cat3: "", id: "keep-me" }],
    });
    saveJSON(LS_KEYS.dayOverrides, {
      "2026-09-14": { picks: [], courses: [{ t: "10:00", n: "刑法", cat1: "學習", cat2: "", cat3: "" }] },
    });
    const a = ensureCourseIds(() => "new-only");
    expect(a.week["一"][0].id).toBe("keep-me");
    expect(a.overrides["2026-09-14"].courses?.[0].id).toBe("new-only");
    expect(a.changed).toBe(true);
    const b = ensureCourseIds(() => "should-not-apply");
    expect(b.changed).toBe(false);
    expect(b.week["一"][0].id).toBe("keep-me");
    expect(b.overrides["2026-09-14"].courses?.[0].id).toBe("new-only");
  });

  it("複製整天課程 → 新格子 id 與原格子不同", () => {
    const src: CourseInfo[] = [
      { id: "src-a", t: "09:00", n: "民法", cat1: "學習", cat2: "", cat3: "" },
      { id: "src-b", t: "10:00", n: "刑法", cat1: "學習", cat2: "", cat3: "" },
    ];
    let n = 0;
    const pasted = cloneCoursesForPaste(src, () => `paste-${++n}`);
    expect(pasted.map((c) => c.id)).toEqual(["paste-1", "paste-2"]);
    expect(pasted[0].id).not.toBe(src[0].id);
    expect(pasted[1].id).not.toBe(src[1].id);
    expect(pasted[0].n).toBe("民法");
    expect(src[0].id).toBe("src-a");
  });

  it("改課程時間或名稱後 id 不變", () => {
    const c: CourseInfo = { id: "stable", t: "09:00", n: "民法", cat1: "學習", cat2: "", cat3: "" };
    const renamed = patchCourseKeepId(c, { n: "民法總則" });
    const retimed = patchCourseKeepId(renamed, { t: "14:00" });
    expect(renamed.id).toBe("stable");
    expect(retimed.id).toBe("stable");
    expect(retimed.n).toBe("民法總則");
    expect(retimed.t).toBe("14:00");
  });
});
