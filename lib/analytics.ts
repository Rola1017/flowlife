import { CAT } from "@/lib/categories";
import type { Session } from "@/lib/types";

export type ChartDatum = { label: string; value: number; color: string };
export type LineSeries = { labels: string[]; focus: number[]; pomos: number[] };

const pad = (n: number) => String(n).padStart(2, "0");
const dstr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 是否符合目前選取（大分類集合空＝全部；selCat2 僅在恰選 1 大分類時有意義） */
export function sessionMatches(s: Session, cats: string[], cat2: string): boolean {
  if (cats.length > 0 && !cats.includes(s.cat1)) return false;
  if (cats.length === 1 && cat2 && s.cat2 !== cat2) return false;
  return true;
}

/** period 視窗（含端點）。日/週/14天/季一律以今天往回；「月」用導覽中的月 */
export function periodRange(period: string, anchorY: number, anchorM: number): { start: string; end: string } {
  const today = new Date();
  const end = dstr(today);
  if (period === "月") {
    const last = new Date(anchorY, anchorM, 0).getDate();
    return { start: `${anchorY}-${pad(anchorM)}-01`, end: `${anchorY}-${pad(anchorM)}-${pad(last)}` };
  }
  if (period === "季") {
    const s = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    return { start: dstr(s), end };
  }
  const daysBack = period === "3天" ? 3 : period === "14天" ? 14 : 7;
  const s = new Date(today);
  s.setDate(s.getDate() - (daysBack - 1));
  return { start: dstr(s), end };
}

/** 圓餅/長條切片：恰1大類→中分類；1大類+中分類→小分類；0或≥2大類→大分類 */
export function buildDistribution(sessions: Session[], cats: string[], cat2: string): ChartDatum[] {
  const sum: Record<string, number> = {};
  const add = (k: string, v: number) => {
    sum[k] = (sum[k] ?? 0) + v;
  };
  if (cats.length === 1 && cat2) {
    const c1 = cats[0];
    for (const s of sessions) add(s.cat3 || "（未細分）", s.mins);
    return Object.entries(sum)
      .map(([k, v]) => ({
        label: k,
        value: v,
        color: k === "（未細分）" ? CAT.cat2Color(c1, cat2) : CAT.cat3Color(c1, cat2, k),
      }))
      .sort((a, b) => b.value - a.value);
  }
  if (cats.length === 1) {
    const c1 = cats[0];
    for (const s of sessions) add(s.cat2 || "（未細分）", s.mins);
    return Object.entries(sum)
      .map(([k, v]) => ({
        label: k,
        value: v,
        color: k === "（未細分）" ? CAT.cat1Color(c1) : CAT.cat2Color(c1, k),
      }))
      .sort((a, b) => b.value - a.value);
  }
  for (const s of sessions) add(s.cat1 || "未分類", s.mins);
  return CAT.cat1List()
    .filter((c) => sum[c])
    .map((c) => ({ label: c, value: sum[c], color: CAT.cat1Color(c) }))
    .sort((a, b) => b.value - a.value);
}

/** 折線（時長＋顆數），依 period 決定 bucket。傳入的 sessions 應已用分類篩選過 */
export function buildLineSeries(sessions: Session[], period: string, anchorY: number, anchorM: number): LineSeries {
  const labels: string[] = [],
    focus: number[] = [],
    pomos: number[] = [];
  const push = (label: string, rows: Session[]) => {
    labels.push(label);
    focus.push(rows.reduce((a, s) => a + (s.mins ?? 0), 0));
    pomos.push(rows.length);
  };
  if (period === "3天" || period === "7天" || period === "14天") {
    const n = period === "3天" ? 3 : period === "14天" ? 14 : 7;
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = dstr(d);
      push(`${pad(d.getMonth() + 1)}/${pad(d.getDate())}`, sessions.filter((s) => s.date === ds));
    }
    return { labels, focus, pomos };
  }
  if (period === "月") {
    const ym = `${anchorY}-${pad(anchorM)}`;
    const last = new Date(anchorY, anchorM, 0).getDate();
    let w = 1;
    for (let sd = 1; sd <= last; sd += 7, w++) {
      const ed = Math.min(sd + 6, last);
      push(
        `W${w}`,
        sessions.filter((s) => {
          if (!s.date || s.date.slice(0, 7) !== ym) return false;
          const day = Number(s.date.slice(8, 10));
          return day >= sd && day <= ed;
        }),
      );
    }
    return { labels, focus, pomos };
  }
  const today = new Date();
  for (let i = 2; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    push(`${d.getMonth() + 1}月`, sessions.filter((s) => s.date && s.date.slice(0, 7) === ym));
  }
  return { labels, focus, pomos };
}

/** 行事曆主統計入口 */
export function buildCalendarStats(opts: {
  sessions: Session[];
  cats: string[];
  cat2: string;
  period: string;
  anchorY: number;
  anchorM: number;
}): { chartData: ChartDatum[]; lineD: LineSeries } {
  const { sessions, cats, cat2, period, anchorY, anchorM } = opts;
  const catFiltered = sessions.filter((s) => sessionMatches(s, cats, cat2));
  const { start, end } = periodRange(period, anchorY, anchorM);
  const windowSessions = catFiltered.filter((s) => s.date && s.date >= start && s.date <= end);
  return {
    chartData: buildDistribution(windowSessions, cats, cat2),
    lineD: buildLineSeries(catFiltered, period, anchorY, anchorM),
  };
}
