import { CFG } from "@/lib/config";
import { resolveCatIds } from "@/lib/categories";
import { shiftDateStr } from "@/lib/dateStr";
import { DELETED_TAG_LABEL, resolveIsTimeDestination, type Tag, type TagGroup } from "@/lib/tags";
import { matchesTagSelection, tagChain } from "@/lib/tagsCompat";
import { primaryTagColor, tagPathLabel } from "@/lib/tagSelect";
import { splitMinutesByGroup } from "@/lib/tagStats";
import { TH } from "@/lib/theme";
import type { Session } from "@/lib/types";

export type ChartDatum = { label: string; value: number; color: string; path?: string; tagId?: string };
export type LineSeries = { labels: string[]; focus: number[]; pomos: number[] };

export type DistSlice = {
  tagId: string | null;
  label: string;
  color: string;
  minutes: number;
  path?: string;
};

/** 無該統計維度標籤的片段鍵；不得與真實「未分類」標籤混淆 */
export const UNSPECIFIED_SLICE = "__unspecified__";

const pad = (n: number) => String(n).padStart(2, "0");

export function unspecifiedLabel(groupName: string): string {
  return `未指定${groupName}`;
}

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

function selectedInStatsGroup(sel: Set<string>, groupId: string, tags: Tag[]): string[] {
  return [...sel].filter((id) => tags.find((t) => t.id === id)?.groupId === groupId);
}

function sliceFromTag(id: string, minutes: number, tags: Tag[]): DistSlice {
  const t = tags.find((x) => x.id === id);
  const label = !t || t.deletedAt ? DELETED_TAG_LABEL : t.name;
  return {
    tagId: id,
    label,
    color: primaryTagColor([id], tags),
    minutes,
    path: t ? tagPathLabel(id, tags) : DELETED_TAG_LABEL,
  };
}

function unspecifiedSlice(minutes: number, groupName: string): DistSlice {
  const label = unspecifiedLabel(groupName);
  return { tagId: null, label, color: TH.muted, minutes, path: label };
}

export type SplitPiece = DistSlice & { keep: boolean };

/**
 * 單筆分攤後的片段（含是否保留）。有篩選且選了本維度標籤時，未命中片段 keep=false（丟棄，不進未指定）。
 */
export function sessionSplitLayout(
  s: { tagIds?: string[]; cat1?: string; cat2?: string; cat3?: string; mins?: number },
  sel: Set<string>,
  groupId: string,
  tags: Tag[],
  groups: TagGroup[],
): SplitPiece[] {
  const group = groups.find((g) => g.id === groupId);
  if (group && !resolveIsTimeDestination(group)) return [];

  const mins = s.mins ?? 0;
  const ids = resolveSessionTagIds(s, tags);
  if (!matchesTagSelection(sel, ids, tags)) return [];
  const groupName = group?.name ?? "";
  const inGroupSel = selectedInStatsGroup(sel, groupId, tags);
  const useSelected = inGroupSel.length > 0;
  const pieces = splitMinutesByGroup(mins, ids, groupId, tags, groups);

  if (pieces.length === 0) {
    if (mins <= 0) return [];
    const u = unspecifiedSlice(mins, groupName);
    return [{ ...u, keep: !useSelected }];
  }

  const out: SplitPiece[] = [];
  for (const p of pieces) {
    if (useSelected) {
      const key = deepestMatchingSlice(p.tagId, inGroupSel, tags);
      if (!key) {
        out.push({ ...sliceFromTag(p.tagId, p.minutes, tags), keep: false });
        continue;
      }
      out.push({ ...sliceFromTag(key, p.minutes, tags), keep: true });
    } else {
      const root = rootInGroup(p.tagId, tags, groupId);
      const slice = root ? sliceFromTag(root, p.minutes, tags) : unspecifiedSlice(p.minutes, groupName);
      out.push({ ...slice, keep: true });
    }
  }
  return out;
}

/** 分攤 → 過濾 → 加總同源。有篩選時總時數＝保留片段總和。 */
export function distributeAndFilter(
  sessions: Session[],
  sel: Set<string>,
  groupId: string,
  tags: Tag[],
  groups: TagGroup[],
): { slices: DistSlice[]; totalMinutes: number } {
  const group = groups.find((g) => g.id === groupId);
  if (group && !resolveIsTimeDestination(group)) return { slices: [], totalMinutes: 0 };

  const filtered = sessions.filter((s) => sessionMatches(s, sel, tags));
  const sums = new Map<string, DistSlice>();
  const add = (p: DistSlice) => {
    if (p.minutes <= 0) return;
    const key = p.tagId ?? UNSPECIFIED_SLICE;
    const prev = sums.get(key);
    if (prev) prev.minutes += p.minutes;
    else sums.set(key, { ...p });
  };

  for (const s of filtered) {
    for (const p of sessionSplitLayout(s, sel, groupId, tags, groups)) {
      if (p.keep) add(p);
    }
  }

  const slices = [...sums.values()].filter((x) => x.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  const totalMinutes = slices.reduce((a, x) => a + x.minutes, 0);
  return { slices, totalMinutes };
}

export function sessionKeptMinutes(
  s: Session,
  sel: Set<string>,
  groupId: string,
  tags: Tag[],
  groups: TagGroup[],
): number {
  return sessionSplitLayout(s, sel, groupId, tags, groups)
    .filter((p) => p.keep)
    .reduce((a, p) => a + p.minutes, 0);
}

function toChartDatum(s: DistSlice): ChartDatum {
  return {
    label: s.label,
    value: s.minutes,
    color: s.color,
    path: s.path,
    tagId: s.tagId ?? UNSPECIFIED_SLICE,
  };
}

/**
 * 圓餅/長條：走 distributeAndFilter。未選＝頂層／未指定{維度}；有選＝只留選取標籤分攤額。
 */
export function buildDistribution(
  sessions: Session[],
  sel: Set<string>,
  groupId: string,
  tags: Tag[],
  groups: TagGroup[],
): ChartDatum[] {
  return distributeAndFilter(sessions, sel, groupId, tags, groups).slices.map(toChartDatum);
}

export type DistCtx = {
  sel: Set<string>;
  groupId: string;
  tags: Tag[];
  groups: TagGroup[];
};

/** 折線。有 dist 時每日時長＝該日保留片段總和；否則 mins 直加。 */
export function buildLineSeries(
  sessions: Session[],
  period: string,
  anchorY: number,
  anchorM: number,
  todayStr = CFG.TODAY_STR,
  dist?: DistCtx,
): LineSeries {
  const labels: string[] = [],
    focus: number[] = [],
    pomos: number[] = [];
  const dayMins = (rows: Session[]) => {
    if (!dist) return rows.reduce((a, s) => a + (s.mins ?? 0), 0);
    return distributeAndFilter(rows, dist.sel, dist.groupId, dist.tags, dist.groups).totalMinutes;
  };
  const dayPomos = (rows: Session[]) => {
    if (!dist) return rows.length;
    return rows.filter((s) => sessionKeptMinutes(s, dist.sel, dist.groupId, dist.tags, dist.groups) > 0).length;
  };
  const push = (label: string, rows: Session[]) => {
    labels.push(label);
    focus.push(dayMins(rows));
    pomos.push(dayPomos(rows));
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

/** 行事曆主統計入口。圓餅與折線皆走 distributeAndFilter。 */
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
}): { chartData: ChartDatum[]; lineD: LineSeries; totalMinutes: number } {
  const { sessions, sel, groupId, tags, groups, period, anchorY, anchorM } = opts;
  const todayStr = opts.todayStr ?? CFG.TODAY_STR;
  const dist: DistCtx = { sel, groupId, tags, groups };
  const { start, end } = periodRange(period, anchorY, anchorM, todayStr);
  const windowSessions = sessions.filter((s) => s.date && s.date >= start && s.date <= end);
  const { slices, totalMinutes } = distributeAndFilter(windowSessions, sel, groupId, tags, groups);
  return {
    chartData: slices.map(toChartDatum),
    lineD: buildLineSeries(sessions, period, anchorY, anchorM, todayStr, dist),
    totalMinutes,
  };
}
