import { buildTodayBlocks, weekdayOf } from "@/lib/schedule";
import { loadScheduleDataFor } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function todayTaipei(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nowIsoTaipei(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+08:00`;
}

function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function GET(req: Request) {
  try {
    const key = req.headers.get("x-roro-key");
    if (!key || key !== process.env.RORO_API_KEY) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const url = new URL(req.url);
    const raw = url.searchParams.get("date");
    const date = raw && raw.trim() ? raw.trim() : todayTaipei();
    if (!isValidDateStr(date)) {
      return json({ ok: false, error: "invalid date, expected YYYY-MM-DD" }, 400);
    }

    const userId = process.env.RORO_USER_ID;
    if (!userId) {
      return json({ ok: false, error: "internal" }, 500);
    }

    // 臨時診斷：查完即移除（debug=1）
    if (url.searchParams.get("debug") === "1") {
      const data = await loadScheduleDataFor(userId);
      return json(
        {
          ok: true,
          date,
          weekday: weekdayOf(date),
          _debug: {
            routineCount: data.routine?.length ?? 0,
            workplacesCount: data.workplaces?.length ?? 0,
            dayPlansKeys: Object.keys(data.dayPlans ?? {}),
            weekScheduleKeys: Object.keys(data.weekSchedule ?? {}),
            weekScheduleForWeekday: data.weekSchedule?.[weekdayOf(date)] ?? null,
            dayOverrideForDate: data.dayOverrides?.[date] ?? null,
            sampleWeekSchedule: JSON.stringify(data.weekSchedule ?? {}).slice(0, 800),
          },
        },
        200,
      );
    }

    const data = await loadScheduleDataFor(userId);
    const blocks = buildTodayBlocks(date, data);

    const courses = blocks.filter((b) => b.type === "course");
    const shifts = blocks.filter((b) => b.type === "shift");
    const firstStart = blocks.length ? blocks[0].start : null;
    const lastEnd = blocks.length
      ? blocks.reduce((max, b) => (b.end > max ? b.end : max), blocks[0].end)
      : null;

    return json(
      {
        ok: true,
        date,
        weekday: weekdayOf(date),
        generatedAt: nowIsoTaipei(),
        blocks,
        summary: {
          courseCount: courses.length,
          shiftCount: shifts.length,
          firstStart,
          lastEnd,
        },
      },
      200,
    );
  } catch {
    return json({ ok: false, error: "internal" }, 500);
  }
}
