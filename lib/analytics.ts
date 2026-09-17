import { CFG } from "@/lib/config";
import { resolveCatIds } from "@/lib/categories";
import { shiftDateStr } from "@/lib/dateStr";
import { DELETED_TAG_LABEL, resolveIsTimeDestination, type Tag, type TagGroup } from "@/lib/tags";
import { childrenOf } from "@/lib/tagTree";
import { matchesTagSelection, tagChain } from "@/lib/tagsCompat";
import { primaryTagColor, tagPathLabel, UNCATEGORIZED_COLOR } from "@/lib/tagSelect";
import { splitMinutesByGroup } from "@/lib/tagStats";
import type { Session } from "@/lib/types";

export type ChartDatum = { label: string; value: number; color: string; path?: string; tagId?: string };
export type LineSeries = { labels: string[]; focus: number[]; pomos: number[] };

export const UNCATEGORIZED_SLICE = "__uncat__";

const pad = (n: number) => String(n).padStart(2, "0");

/** 舊資料無 tagIds：用 cat 名經 resolveCatIds 推最深一層（整鏈會被誤分成多片） */
export function resolveSessionTagIds(
  s: { tagIds?: string[]; cat1?: string; cat2?: string; cat3?: string },
  tags: Tag[],
): string[] {
  if (s.tagIds?.length) return s.tagIds.filter((id) => typeof id === "string" && id.trim());
  const ids = resolveCatIds(s.cat1 ?? "", s.cat2, s.cat3);
  const deepest = ids.cat3Id || ids.cat2Id || ids.cat1Id;
  if (deepest && tags.some((t) => t.id === deepest)) return [deepest];
  return [];
}

export function sessionMatches(s: Session, sel: Set<string>, tags: Tag[]): boolean {
  return matchesTagSelection(sel, resolveSessionTagIds(s, tags), tags);
}

function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

function lastDateOfMonth(y: number, m: number): string {
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return shiftDateStr(`${nextY}-${pad(nextM)}-01`, -1);
}

/** period 視窗（含端點）。日/週/14天/季一律以 todayStr 往回；「月」用導覽中的月 */
export function periodRange(
  period: string,
  anchorY: number,
  anchorM: number,
  todayStr = CFG.TODAY_STR,
): { start: string; end: string } {
  const end = todayStr;
  if (period === "月") {
    return { start: `${anchorY}-${pad(anchorM)}-01`, end: lastDateOfMonth(anchorY, anchorM) };
  }
  if (period === "季") {
    const { y, m } = parseYmd(todayStr);
    let sm = m - 2;
    let sy = y;
    while (sm <= 0) {
      sm += 12;
      sy -= 1;
    }
    return { start: `${sy}-${pad(sm)}-01`, end };
  }
  const daysBack = period === "3天" ? 3 : period === "14天" ? 14 : 7;
  return { start: shiftDateStr(todayStr, -(daysBack - 1)), end };
}

function rootInGroup(tagId: string, tags: Tag[], groupId: string): string | undefined {
  const inGroup = tagChain(tagId, tags).filter((t) => t.groupId === groupId);
  return inGroup[0]?.id;
}

/** 選父命中子孫：把分攤片段歸到最深的選取標籤，避免父+子雙計 */
function deepestMatchingSlice(tagId: string, sliceIds: string[], tags: Tag[]): string | undefined {
  const chainIds = tagChain(tagId, tags).map((t) => t.id);
  let best: string | undefined;
  let bestDepth = -1;
  for (const sid of sliceIds) {
    const idx = chainIds.indexOf(sid);
    if (idx > bestDepth) {
      bestDepth = idx;
      best = sid;
    }
  }
  return best;
}

function sliceDatum(id: string, value: number, tags: Tag[]): ChartDatum {
  if (id === UNCATEGORIZED_SLICE) {
    return { label: "未分類", value, color: UNCATEGORIZED_COLOR, path: "未分類", tagId: id };
  }
  const t = tags.find((x) => x.id === id);
  const label = !t || t.deletedAt ? DELETED_TAG_LABEL : t.name;
  return {
    label,
    value,
    color: primaryTagColor([id], tags),
    path: t ? tagPathLabel(id, tags) : DELETED_TAG_LABEL,
    tagId: id,
  };
}

/**
 * 圓餅/長條：未選＝該維度頂層標籤；有選（且選在該維度）＝各選取標籤一片。
 * 時數經 splitMinutesByGroup 分攤後累加，禁止整筆 s.mins 加給多片。
 */
export function buildDistribution(
  sessions: Session[],
  sel: Set<string>,
  groupId: string,
  tags: Tag[],
  groups: TagGroup[],
): ChartDatum[] {
  const group = groups.find((g) => g.id === groupId);
  if (group && !resolveIsTimeDestination(group)) return [];

  const filtered = sessions.filter((s) => sessionMatches(s, sel, tags));
  const selectedInGroup = [...sel].filter((id) => tags.find((t) => t.id === id)?.groupId === groupId);
  const useSelected = selectedInGroup.length > 0;
  const sliceIds = useSelected ? selectedInGroup : childrenOf(tags, undefined, groupId).map((t) => t.id);

  const sums = new Map<string, number>();
  const add = (id: string, m: number) => {
    if (m <= 0) return;
    sums.set(id, (sums.get(id) ?? 0) + m);
  };

  for (const s of filtered) {
    const mins = s.mins ?? 0;
    const ids = resolveSessionTagIds(s, tags);
    const pieces = splitMinutesByGroup(mins, ids, groupId, tags, groups);
    if (pieces.length === 0) {
      add(UNCATEGORIZED_SLICE, mins);
      continue;
    }
    let attributed = 0;
    for (const p of pieces) {
      const key = useSelected
        ? deepestMatchingSlice(p.tagId, sliceIds, tags) ?? UNCATEGORIZED_SLICE
        : rootInGroup(p.tagId, tags, groupId) ?? UNCATEGORIZED_SLICE;
      add(key, p.minutes);
      attributed += p.minutes;
    }
    if (mins - attributed > 0) add(UNCATEGORIZED_SLICE, mins - attributed);
  }

  return [...sums.entries()]
    .filter(([, v]) => v > 0)
    .map(([id, v]) => sliceDatum(id, v, tags))
    .sort((a, b) => b.value - a.value);
}

/** 折線（時長＋顆數）。傳入的 sessions 應已用標籤篩選過。總時數＝mins 直加，不經分攤。 */
export function buildLineSeries(
  sessions: Session[],
  period: string,
  anchorY: number,
  anchorM: number,
  todayStr = CFG.TODAY_STR,
): LineSeries {
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
    for (let i = n - 1; i >= 0; i--) {
      const ds = shiftDateStr(todayStr, -i);
      const { m, d } = parseYmd(ds);
      push(`${pad(m)}/${pad(d)}`, sessions.filter((s) => s.date === ds));
    }
    return { labels, focus, pomos };
  }
  if (period === "月") {
    const ym = `${anchorY}-${pad(anchorM)}`;
    const last = Number(lastDateOfMonth(anchorY, anchorM).slice(8, 10));
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
  const { y, m } = parseYmd(todayStr);
  for (let i = 2; i >= 0; i--) {
    let mm = m - i;
    let yy = y;
    while (mm <= 0) {
      mm += 12;
      yy -= 1;
    }
    const ym = `${yy}-${pad(mm)}`;
    push(`${mm}月`, sessions.filter((s) => s.date && s.date.slice(0, 7) === ym));
  }
  return { labels, focus, pomos };
}

/** period 視窗內每一天（含端點） */
export function datesInPeriod(
  period: string,
  anchorY: number,
  anchorM: number,
  todayStr = CFG.TODAY_STR,
): string[] {
  const { start, end } = periodRange(period, anchorY, anchorM, todayStr);
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = shiftDateStr(cur, 1);
  }
  return out;
}

/** 行事曆主統計入口。圓餅走分攤；折線總時數直加 mins。 */
export function buildCalendarStats(opts: {
  sessions: Session[];
  sel: Set<string>;
  groupId: string;
  tags: Tag[];
  groups: TagGroup[];
  period: string;
  anchorY: number;
  anchorM: number;
  todayStr?: string;
}): { chartData: ChartDatum[]; lineD: LineSeries } {
  const { sessions, sel, groupId, tags, groups, period, anchorY, anchorM } = opts;
  const todayStr = opts.todayStr ?? CFG.TODAY_STR;
  const catFiltered = sessions.filter((s) => sessionMatches(s, sel, tags));
  const { start, end } = periodRange(period, anchorY, anchorM, todayStr);
  const windowSessions = catFiltered.filter((s) => s.date && s.date >= start && s.date <= end);
  return {
    chartData: buildDistribution(windowSessions, sel, groupId, tags, groups),
    lineD: buildLineSeries(catFiltered, period, anchorY, anchorM, todayStr),
  };
}
