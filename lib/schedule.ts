import { LS_KEYS, loadJSON } from "@/lib/storage";

export type Place = "診" | "彩";
export type DayPlan = { place: Place; shifts: string[] };

export const PLACE_NAME: Record<Place, string> = { 診: "診所", 彩: "彩券行" };
export const PLACE_SHIFTS: Record<Place, string[]> = { 診: ["早", "午", "晚"], 彩: ["早", "晚"] };

export const DEFAULT_PLANS: Record<string, DayPlan> = {
  一: { place: "診", shifts: ["晚"] },
  二: { place: "診", shifts: ["晚"] },
  三: { place: "診", shifts: ["晚"] },
  四: { place: "診", shifts: ["晚"] },
  五: { place: "診", shifts: ["晚"] },
  六: { place: "彩", shifts: ["晚"] },
  日: { place: "彩", shifts: ["晚"] },
};

const DAYS = ["一", "二", "三", "四", "五", "六", "日"] as const;
const WEEKDAY_FROM_DOW = ["日", "一", "二", "三", "四", "五", "六"] as const;

export function weekdayOf(dateStr: string): string {
  return WEEKDAY_FROM_DOW[new Date(dateStr + "T12:00:00").getDay()];
}

export const isMonWedFri = (day: string) => day === "一" || day === "三" || day === "五";

export function shiftRange(place: Place, shift: string, day: string): string {
  if (place === "診") {
    if (shift === "早") return "08:30~12:00";
    if (shift === "午") return isMonWedFri(day) ? "14:00~18:00" : "14:30~18:00";
    if (shift === "晚") return "18:00~22:00";
  } else {
    if (shift === "早") return "07:30~14:00";
    if (shift === "晚") return "14:00~22:00";
  }
  return "";
}

export function shiftTimes(place: Place, shift: string, day: string): string[] {
  if (place === "診") {
    if (shift === "早") return ["08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];
    if (shift === "午")
      return isMonWedFri(day)
        ? ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"]
        : ["14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"];
    if (shift === "晚") return ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];
  } else {
    if (shift === "早")
      return [
        "07:30",
        "08:00",
        "08:30",
        "09:00",
        "09:30",
        "10:00",
        "10:30",
        "11:00",
        "11:30",
        "12:00",
        "12:30",
        "13:00",
        "13:30",
      ];
    if (shift === "晚")
      return [
        "14:00",
        "14:30",
        "15:00",
        "15:30",
        "16:00",
        "16:30",
        "17:00",
        "17:30",
        "18:00",
        "18:30",
        "19:00",
        "19:30",
        "20:00",
        "20:30",
        "21:00",
        "21:30",
      ];
  }
  return [];
}

export function loadDayPlans(): Record<string, DayPlan> {
  const loaded = loadJSON<Record<string, DayPlan>>(LS_KEYS.dayPlans, {});
  const merged: Record<string, DayPlan> = {};
  for (const d of DAYS) merged[d] = loaded[d] ?? DEFAULT_PLANS[d] ?? { place: "彩", shifts: [] };
  return merged;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// 固定不可用：睡眠 00:00–06:30、午餐+午覺 12:00–13:30、晚餐 17:00–18:00、夜間 23:00–24:00
const FIXED_UNAVAIL: [number, number][] = [
  [0, 390],
  [720, 810],
  [1020, 1080],
  [1380, 1440],
];

/** 某日可用分鐘數＝1440 −（固定不可用 ∪ 當天課表班別）合併後的總長 */
export function availableMinutesFor(dateStr: string, dayPlans?: Record<string, DayPlan>): number {
  const plans = dayPlans ?? loadDayPlans();
  const day = weekdayOf(dateStr);
  const plan = plans[day];
  const ranges: [number, number][] = [...FIXED_UNAVAIL];
  if (plan) {
    for (const s of plan.shifts) {
      const r = shiftRange(plan.place, s, day);
      if (!r) continue;
      const [a, b] = r.split("~");
      ranges.push([toMin(a), toMin(b)]);
    }
  }
  ranges.sort((x, y) => x[0] - y[0]);
  let blocked = 0,
    curS = -1,
    curE = -1;
  for (const [a, b] of ranges) {
    if (a > curE) {
      if (curE > curS) blocked += curE - curS;
      curS = a;
      curE = b;
    } else curE = Math.max(curE, b);
  }
  if (curE > curS) blocked += curE - curS;
  return Math.max(0, 1440 - blocked);
}

export type CourseInfo = { t: string; n: string; cat1: string; cat2: string; cat3: string };
export type CourseNow = { status: "current" | "next"; course: CourseInfo; endTime: string };

const fmtHM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** 依「現在時間」找當前課（落在某格 30 分鐘內）或今天接下來的下一堂課 */
export function currentOrNextCourse(now: Date = new Date()): CourseNow | null {
  const dayKey = WEEKDAY_FROM_DOW[now.getDay()];
  const week = loadJSON<Record<string, CourseInfo[]>>(LS_KEYS.weekSchedule, {});
  const cells = (week[dayKey] ?? []).slice().sort((a, b) => a.t.localeCompare(b.t));
  if (cells.length === 0) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const c of cells) {
    const start = toMin(c.t);
    if (nowMin >= start && nowMin < start + 30) return { status: "current", course: c, endTime: fmtHM(start + 30) };
  }
  for (const c of cells) {
    const start = toMin(c.t);
    if (start > nowMin) return { status: "next", course: c, endTime: fmtHM(start + 30) };
  }
  return null;
}
