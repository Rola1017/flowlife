import { isValidDateStr, json, nowIsoTaipei, todayTaipei } from "@/lib/apiShared";
import { buildTodayBlocks, weekdayOf } from "@/lib/schedule";
import { loadScheduleDataFor } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
