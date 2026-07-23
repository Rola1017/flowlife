import { CAT, CAT_PATH_SEP, matchesCatSelection } from "@/lib/categories";
import type { Session } from "@/lib/types";

export type ChartDatum = { label: string; value: number; color: string };
export type LineSeries = { labels: string[]; focus: number[]; pomos: number[] };

const pad = (n: number) => String(n).padStart(2, "0");
const dstr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 是否符合目前選取（空 Set＝全部；路徑語意走 matchesCatSelection） */
export function sessionMatches(s: Session, sel: Set<string>): boolean {
  return matchesCatSelection(sel, s.cat1, s.cat2, s.cat3);
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

/** 圓餅/長條：未選＝各大分類總覽；有選＝每條路徑一片加總（選取互不巢套＝不重複計） */
export function buildDistribution(sessions: Session[], sel: Set<string>): ChartDatum[] {
  if (sel.size === 0) {
    const sum: Record<string, number> = {};
    for (const s of sessions) {
      const k = s.cat1 || "未分類";
      sum[k] = (sum[k] ?? 0) + s.mins;
    }
    return CAT.cat1List()
      .filter((c) => sum[c])
      .map((c) => ({ label: c, value: sum[c], color: CAT.cat1Color(c) }))
      .sort((a, b) => b.value - a.value);
  }

  return [...sel]
    .map((p) => {
      const [c1, c2, c3] = p.split(CAT_PATH_SEP);
      const one = new Set([p]);
      const value = sessions
        .filter((s) => matchesCatSelection(one, s.cat1, s.cat2, s.cat3))
        .reduce((a, s) => a + (s.mins ?? 0), 0);
      return {
        label: c3 || c2 || c1,
        value,
        color: CAT.deepColorFull(c1, c2 || undefined, c3 || undefined),
      };
    })
    .filter((d) => d.value > 0)
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

/** period 視窗內每一天（含端點） */
export function datesInPeriod(period: string, anchorY: number, anchorM: number): string[] {
  const { start, end } = periodRange(period, anchorY, anchorM);
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const endD = new Date(`${end}T12:00:00`);
  while (d <= endD) {
    out.push(dstr(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** 行事曆主統計入口 */
export function buildCalendarStats(opts: {
  sessions: Session[];
  sel: Set<string>;
  period: string;
  anchorY: number;
  anchorM: number;
}): { chartData: ChartDatum[]; lineD: LineSeries } {
  const { sessions, sel, period, anchorY, anchorM } = opts;
  const catFiltered = sessions.filter((s) => sessionMatches(s, sel));
  const { start, end } = periodRange(period, anchorY, anchorM);
  const windowSessions = catFiltered.filter((s) => s.date && s.date >= start && s.date <= end);
  return {
    chartData: buildDistribution(windowSessions, sel),
    lineD: buildLineSeries(catFiltered, period, anchorY, anchorM),
  };
}
