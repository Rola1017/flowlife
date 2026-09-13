import { isValidDateStr, json, nowIsoTaipei, todayTaipei } from "@/lib/apiShared";
import { availableSegmentsWith, summarizeFreeSlots, toFreeSlots } from "@/lib/idle";
import { weekdayOf } from "@/lib/schedule";
import { loadScheduleDataFor } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMinMinutes(raw: string | null): number | { error: string } {
  if (raw == null || raw.trim() === "") return 15;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 480) {
    return { error: "invalid minMinutes, expected 1-480" };
  }
  return n;
}

/** HH:mm；to 允許 "24:00"→1440。from 不得為 24:00。 */
function parseClock(raw: string, allow24: boolean): number | null {
  if (raw === "24:00") return allow24 ? 1440 : null;
  if (!/^\d{2}:\d{2}$/.test(raw)) return null;
  const [h, m] = raw.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function fmtClock(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  try {
    const key = req.headers.get("x-roro-key");
    if (!key || key !== process.env.RORO_API_KEY) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const url = new URL(req.url);
    const dateRaw = url.searchParams.get("date");
    const date = dateRaw && dateRaw.trim() ? dateRaw.trim() : todayTaipei();
    if (!isValidDateStr(date)) {
      return json({ ok: false, error: "invalid date, expected YYYY-MM-DD" }, 400);
    }

    const minMinutes = parseMinMinutes(url.searchParams.get("minMinutes"));
    if (typeof minMinutes !== "number") {
      return json({ ok: false, error: minMinutes.error }, 400);
    }

    const fromRaw = url.searchParams.get("from")?.trim() || "06:00";
    const toRaw = url.searchParams.get("to")?.trim() || "24:00";
    const fromMin = parseClock(fromRaw, false);
    if (fromMin == null) {
      return json({ ok: false, error: "invalid from, expected HH:mm" }, 400);
    }
    const toMinVal = parseClock(toRaw, true);
    if (toMinVal == null) {
      return json({ ok: false, error: "invalid to, expected HH:mm" }, 400);
    }
    if (fromMin >= toMinVal) {
      return json({ ok: false, error: "invalid from/to" }, 400);
    }

    const userId = process.env.RORO_USER_ID;
    if (!userId) {
      return json({ ok: false, error: "internal" }, 500);
    }

    // 語意：未被作息／班別／課程規劃佔用的空檔；不扣番茄紀錄。
    const data = await loadScheduleDataFor(userId);
    const segs = availableSegmentsWith(date, fromMin, toMinVal, data);
    const freeSlots = toFreeSlots(segs, minMinutes);

    return json(
      {
        ok: true,
        date,
        weekday: weekdayOf(date),
        generatedAt: nowIsoTaipei(),
        window: { from: fmtClock(fromMin), to: fmtClock(toMinVal) },
        minMinutes,
        freeSlots,
        summary: summarizeFreeSlots(freeSlots),
      },
      200,
    );
  } catch {
    return json({ ok: false, error: "internal" }, 500);
  }
}
