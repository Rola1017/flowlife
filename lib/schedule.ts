import { LS_KEYS, loadJSON, saveJSON, removeKey } from "@/lib/storage";

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

const fmtHM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export type RoutineBlock = { start: string; end: string; label: string };

/**
 * 固定作息（不可用時間）— 全 App 單一來源。全天 24h。
 * 可用時間／直式行程表／課表／未利用時間皆由此衍生，禁止再各自寫死。
 * 未來 Supabase 階段抽成使用者可編輯設定（與班別 WorkplaceConfig 同批）。
 */
export const FIXED_ROUTINE: RoutineBlock[] = [
  { start: "00:00", end: "06:30", label: "😴 睡眠" },
  { start: "06:30", end: "07:00", label: "😴 起床" },
  { start: "07:00", end: "08:00", label: "🍴 早餐" },
  { start: "12:00", end: "13:00", label: "🍴 午餐" },
  { start: "13:00", end: "13:30", label: "😴 午覺" },
  { start: "17:00", end: "18:00", label: "🍴 晚餐" },
  { start: "23:00", end: "24:00", label: "😴 睡覺" },
];

export function loadRoutineOverride(dateStr: string): RoutineBlock[] | null {
  const v = loadJSON<RoutineBlock[] | null>(`${LS_KEYS.routineOverride}${dateStr}`, null);
  return Array.isArray(v) && v.length > 0 ? v : null;
}

export function saveRoutineOverride(dateStr: string, blocks: RoutineBlock[]): void {
  saveJSON(`${LS_KEYS.routineOverride}${dateStr}`, blocks);
}

export function clearRoutineOverride(dateStr: string): void {
  removeKey(`${LS_KEYS.routineOverride}${dateStr}`);
}

/** 某日生效作息：有覆寫用覆寫，否則 FIXED_ROUTINE — 單一來源 */
export function routineFor(dateStr?: string): RoutineBlock[] {
  if (dateStr) {
    const ov = loadRoutineOverride(dateStr);
    if (ov) return ov;
  }
  return FIXED_ROUTINE;
}

function routineRangesFor(dateStr: string): [number, number][] {
  return routineFor(dateStr).map((b) => [toMin(b.start), toMin(b.end)] as [number, number]);
}

/** 取 [startMin,endMin] 內、已裁切的作息塊（給直式行程表／課表顯示共用） */
export function routineBlocksInWindow(startMin: number, endMin: number, dateStr?: string): RoutineBlock[] {
  const out: RoutineBlock[] = [];
  for (const b of routineFor(dateStr)) {
    const s = Math.max(startMin, toMin(b.start));
    const e = Math.min(endMin, toMin(b.end));
    if (e > s) out.push({ start: fmtHM(s), end: fmtHM(e), label: b.label });
  }
  return out;
}

export type Interval = [number, number];

function mergeRanges(ivs: Interval[]): Interval[] {
  const s = ivs.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** 某日不可用區間＝固定作息 ∪ 當日班別（全天分鐘制、已合併）— 單一來源 */
export function blockedRanges(dateStr: string, dayPlans?: Record<string, DayPlan>): Interval[] {
  const plans = dayPlans ?? loadDayPlans();
  const day = weekdayOf(dateStr);
  const plan = plans[day];
  const ivs: Interval[] = [...routineRangesFor(dateStr)];
  if (plan) {
    for (const s of plan.shifts) {
      const r = shiftRange(plan.place, s, day);
      if (!r) continue;
      const [a, b] = r.split("~");
      ivs.push([toMin(a), toMin(b)]);
    }
  }
  return mergeRanges(ivs);
}

/** 某日可用分鐘數＝1440 −（固定不可用 ∪ 當天課表班別）合併後的總長 */
export function availableMinutesFor(dateStr: string, dayPlans?: Record<string, DayPlan>): number {
  const blocked = blockedRanges(dateStr, dayPlans).reduce((s, [a, b]) => s + (b - a), 0);
  return Math.max(0, 1440 - blocked);
}

export type CourseInfo = { t: string; n: string; cat1: string; cat2: string; cat3: string };
export type CourseNow = { status: "current" | "next"; course: CourseInfo; endTime: string };

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
