import { CFG } from "@/lib/config";
import { CAT } from "@/lib/categories";
import { DS, DE, toM } from "@/lib/utils";
import { availableSegments, idleGapsWithin } from "@/lib/idle";
import { LS_KEYS, loadJSON } from "@/lib/storage";

export type ActSegment = { start: string; end: string; label: string; color: string };
export type IdleSegment = { start: string; end: string };

type DailyOverride = Record<string, { label: string; cat1: string; startTime: string; endTime: string }>;

export function actSessionsFor(date: string): ActSegment[] {
  type SRow = {
    date: string;
    name?: string;
    cat1?: string;
    cat2?: string;
    cat3?: string;
    startTime?: string;
    endTime?: string;
  };
  const all = loadJSON<SRow[]>(LS_KEYS.sessions, []);
  return all
    .filter((s) => s.date === date && s.startTime && s.endTime)
    .map((s) => {
      const cat1 = s.cat1 ?? "";
      const color =
        CAT.deepColorFull(cat1, s.cat2 || undefined, s.cat3 || undefined) ||
        CAT.cat1Color(cat1) ||
        "#374151";
      return {
        start: s.startTime as string,
        end: s.endTime as string,
        label: s.name || s.cat3 || s.cat2 || cat1 || "番茄",
        color,
      };
    });
}

export function overridesFor(date: string): ActSegment[] {
  const dailyOverride = loadJSON<DailyOverride>(`${LS_KEYS.dailyOverride}${date}`, {});
  return Object.values(dailyOverride).map((ov) => ({
    start: ov.startTime,
    end: ov.endTime,
    label: ov.label,
    color: CAT.cat1Color(ov.cat1) || "#374151",
  }));
}

export function actIdleFor(
  date: string,
  nowPct: number,
  fills: [number, number][],
  winStart: number = DS,
  winEnd: number = DE,
): IdleSegment[] {
  let cutoff: number;
  if (date === CFG.TODAY_STR) cutoff = Math.round(winStart + Math.min(1, Math.max(0, nowPct / 100)) * (winEnd - winStart));
  else if (date < CFG.TODAY_STR) cutoff = winEnd;
  else return [];
  if (cutoff <= winStart) return [];
  const avail = availableSegments(date, winStart, cutoff);
  return idleGapsWithin(avail, fills, 5);
}

export function buildActualSegments(
  date: string,
  nowPct: number,
): { act: ActSegment[]; idle: IdleSegment[] } {
  const act = [...actSessionsFor(date), ...overridesFor(date)];
  const fills: [number, number][] = act.map((b) => [toM(b.start), toM(b.end)]);
  const idle = actIdleFor(date, nowPct, fills);
  return { act, idle };
}
