import { toM } from "@/lib/utils";
import { blockedRanges, type Interval, type DayPlan } from "@/lib/schedule";

export type IdleGap = { start: string; end: string };

const fmtHM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function merge(ivs: Interval[]): Interval[] {
  const s = ivs.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

function subtract(winStart: number, winEnd: number, blocked: Interval[]): Interval[] {
  const out: Interval[] = [];
  let pos = winStart;
  for (const [a, b] of blocked) {
    const s = Math.max(a, winStart),
      e = Math.min(b, winEnd);
    if (e <= pos) continue;
    if (s > pos) out.push([pos, s]);
    pos = Math.max(pos, e);
    if (pos >= winEnd) break;
  }
  if (pos < winEnd) out.push([pos, winEnd]);
  return out;
}

/** 某日在 [winStart,winEnd] 內的「可用」區段（已扣作息與班別） */
export function availableSegments(
  date: string,
  winStart: number,
  winEnd: number,
  dayPlans?: Record<string, DayPlan>,
): Interval[] {
  return subtract(winStart, winEnd, blockedRanges(date, dayPlans));
}

/** 可用區段內、未被 fills 覆蓋、且 ≥ minGap 的空檔（時間軸未利用灰塊用） */
export function idleGapsWithin(avail: Interval[], fills: Interval[], minGap = 5): IdleGap[] {
  const merged = merge(fills);
  const gaps: IdleGap[] = [];
  for (const [as, ae] of avail) {
    let pos = as;
    for (const [fs, fe] of merged) {
      if (fe <= pos || fs >= ae) continue;
      const s = Math.max(fs, as);
      if (s > pos) gaps.push({ start: fmtHM(pos), end: fmtHM(s) });
      pos = Math.max(pos, Math.min(fe, ae));
    }
    if (pos < ae) gaps.push({ start: fmtHM(pos), end: fmtHM(ae) });
  }
  return gaps.filter((g) => toM(g.end) - toM(g.start) >= minGap);
}

export function idleMinutes(gaps: IdleGap[]): number {
  return gaps.reduce((s, g) => s + (toM(g.end) - toM(g.start)), 0);
}

function overlapMins(s: number, e: number, segs: Interval[]): number {
  let sum = 0;
  for (const [a, b] of segs) sum += Math.max(0, Math.min(e, b) - Math.max(s, a));
  return sum;
}

type SLite = { mins?: number; cat1?: string; startTime?: string; endTime?: string };

/**
 * 某日 sessions 拆成「可用內」與「不可用(加碼)」分鐘，並回傳可用內依大分類加總（週曆三段線用）。
 * 無 startTime/endTime 的舊資料 → 全算可用內（保守：不灌加碼、不假裝有空檔）。
 */
export function splitSessionsByAvailability(
  sessions: SLite[],
  availFullDay: Interval[],
): { within: number; off: number; withinByCat1: Record<string, number> } {
  let within = 0,
    off = 0;
  const withinByCat1: Record<string, number> = {};
  const addCat = (c: string, m: number) => {
    withinByCat1[c] = (withinByCat1[c] ?? 0) + m;
  };
  for (const s of sessions) {
    const cat1 = s.cat1 || "未分類";
    const dur = s.mins ?? 0;
    if (!s.startTime || !s.endTime) {
      within += dur;
      addCat(cat1, dur);
      continue;
    }
    const a = toM(s.startTime),
      b = toM(s.endTime);
    const span = Math.max(0, b - a);
    const w = span > 0 ? overlapMins(a, b, availFullDay) : 0;
    within += w;
    off += span - w;
    addCat(cat1, w);
  }
  return { within, off, withinByCat1 };
}
