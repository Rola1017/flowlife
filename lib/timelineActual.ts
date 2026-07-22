import { CFG } from "@/lib/config";
import { CAT } from "@/lib/categories";
import { DS, DE, toM } from "@/lib/utils";
import { availableSegments, idleGapsWithin, idleMinutes } from "@/lib/idle";
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

/** 某日已利用時段（番茄 session ＋ 手動補登 override）。待辦實際時段由呼叫端可選傳入。 */
export function usedFillsFor(date: string, extraFills: [number, number][] = []): [number, number][] {
  const act = [...actSessionsFor(date), ...overridesFor(date)];
  return [...act.map((b) => [toM(b.start), toM(b.end)] as [number, number]), ...extraFills];
}

/**
 * 某日未利用分鐘（單一來源）。
 * 今天：只算到「現在」；過去：整日；未來：0。
 * nowMins 省略時以當下時間計算。
 */
export function idleMinutesForDate(
  date: string,
  nowMins?: number,
  extraFills: [number, number][] = [],
): number {
  const cur =
    nowMins ??
    (() => {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    })();
  const pct = ((cur - DS) / (DE - DS)) * 100;
  const gaps = actIdleFor(date, pct, usedFillsFor(date, extraFills));
  return idleMinutes(gaps);
}

/** 一段日期範圍的每日未利用分鐘（趨勢圖用） */
export function idleSeries(
  dates: string[],
  nowMins?: number,
): { date: string; mins: number }[] {
  return dates.map((d) => ({ date: d, mins: idleMinutesForDate(d, nowMins) }));
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
