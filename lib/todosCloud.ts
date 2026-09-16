import type { Todo, TodoPhase, TodoTombstone } from "@/lib/types";
import { formatMd } from "@/lib/dateStr";
import { LS_KEYS, loadJSON } from "@/lib/storage";

const PHASES: TodoPhase[] = ["pending", "started", "ending", "done"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const TODO_TOMBSTONE_TTL_MS = 60 * 86400000;

function isDate(v: unknown): v is string {
  return typeof v === "string" && DATE_RE.test(v);
}

function asPhase(v: unknown): TodoPhase {
  return PHASES.includes(v as TodoPhase) ? (v as TodoPhase) : "pending";
}

/** 空字串／非法日期一律 undefined，不得留 ""。 */
export function normalizeDeadline(v: unknown): string | undefined {
  return isDate(v) ? v : undefined;
}

/** 僅跨日時存；非法、空字串、或 endDate < date 皆 undefined。等於 date 視為單日不存。 */
export function normalizeEndDate(endDate: unknown, date: string): string | undefined {
  if (!isDate(endDate) || !isDate(date)) return undefined;
  return endDate > date ? endDate : undefined;
}

/** 僅接受 > 0 的有限數字；0／負／NaN／非數字 → undefined。 */
export function normalizeEstimateHours(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

/** 實際完成日：僅合法 YYYY-MM-DD，否則 undefined。 */
export function normalizeDoneDate(v: unknown): string | undefined {
  return isDate(v) ? v : undefined;
}

const HM_RE = /^\d{2}:\d{2}$/;

/** 實際完成時間：僅精確 HH:mm（00–23:00–59），否則 undefined。 */
export function normalizeDoneTime(v: unknown): string | undefined {
  if (typeof v !== "string" || !HM_RE.test(v)) return undefined;
  const h = Number(v.slice(0, 2));
  const m = Number(v.slice(3, 5));
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return undefined;
  return v;
}

/** 完成日取值：合法 hint 優先，否則今天字串。禁止在此用 new Date()。 */
export function resolveDoneDate(hint: string | undefined, today: string): string {
  return isDate(hint) ? hint : today;
}

/** 完成時間：僅當完成日＝今天才填 nowHm；補記過去／未來留空。禁止在此用 new Date()。 */
export function resolveDoneTime(doneDate: string, today: string, nowHm: string): string | undefined {
  return doneDate === today ? nowHm : undefined;
}

/** 該待辦是否應顯示在 dateStr 這一天（跨日區間含首尾；單一來源）。與 doneDate 無關。 */
export function todoShowsOn(todo: { date: string; endDate?: string }, dateStr: string): boolean {
  if (todo.endDate && todo.endDate > todo.date) {
    return dateStr >= todo.date && dateStr <= todo.endDate;
  }
  return todo.date === dateStr;
}

/** 完成：時間／日期取值須在 updater 外算好再傳入。不改寫既有 endAt 語意，只加 doneDate／doneTime。 */
export function applyTodoComplete(
  t: Todo,
  fields: { endAt: string; doneDate: string; doneTime?: string; elapsed: number; updatedAt: string },
): Todo {
  return {
    ...t,
    phase: "done",
    endAt: fields.endAt,
    doneDate: fields.doneDate,
    doneTime: fields.doneTime,
    elapsed: fields.elapsed,
    updatedAt: fields.updatedAt,
  };
}

/** 取消完成：endAt／elapsed／doneDate／doneTime 一併清空。 */
export function applyTodoUncomplete(t: Todo, updatedAt: string): Todo {
  return {
    ...t,
    phase: "pending",
    startAt: null,
    endAt: null,
    startTs: null,
    elapsed: null,
    doneDate: undefined,
    doneTime: undefined,
    updatedAt,
  };
}

/** 完成卡文案三態（歷史無 doneDate 不說「當天完成」，避免誤導）。可點擊編輯故帶 ✏️。 */
export function doneLabel(
  doneDate: string | undefined,
  viewDate: string | undefined,
  doneTime?: string,
): string {
  const timeBit = doneTime ? ` ${doneTime}` : "";
  if (!doneDate) return `✅ 已完成${timeBit} ✏️`;
  if (viewDate && doneDate !== viewDate) return `✅ 已於 ${formatMd(doneDate)}${timeBit} 完成 ✏️`;
  return doneTime ? `✅ 當天 ${doneTime} 完成 ✏️` : "✅ 當天完成 ✏️";
}

/**
 * 正規化單筆待辦。`today` 由呼叫端傳入（測試鎖死日期，禁止在此用 new Date()）。
 * 缺 id 回 null。
 */
export function normalizeTodo(raw: unknown, today: string): Todo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "number" && Number.isFinite(r.id) ? r.id : null;
  if (id == null) return null;
  const startTime = typeof r.startTime === "string" && r.startTime.trim() ? r.startTime : undefined;
  const endTime = typeof r.endTime === "string" && r.endTime.trim() ? r.endTime : undefined;
  const updatedAt = typeof r.updatedAt === "string" && r.updatedAt ? r.updatedAt : undefined;
  const date = isDate(r.date) ? r.date : today;
  const cat = typeof r.cat === "string" && r.cat ? r.cat : "未分類";
  const rawTagIds = Array.isArray(r.tagIds)
    ? r.tagIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : undefined;
  const derivedCat1Id = loadJSON<{ id?: string; name: string }[]>(LS_KEYS.categories, []).find(
    (c) => c.name === cat,
  )?.id;
  const tagIds = rawTagIds?.length ? rawTagIds : derivedCat1Id ? [derivedCat1Id] : undefined;
  return {
    id,
    text: typeof r.text === "string" ? r.text : "",
    cat,
    date,
    startTime,
    endTime,
    endDate: normalizeEndDate(r.endDate, date),
    deadline: normalizeDeadline(r.deadline),
    estimateHours: normalizeEstimateHours(r.estimateHours),
    mustDo: Boolean(r.mustDo),
    reminder: typeof r.reminder === "string" ? r.reminder : "none",
    phase: asPhase(r.phase),
    startAt: typeof r.startAt === "string" ? r.startAt : null,
    endAt: typeof r.endAt === "string" ? r.endAt : null,
    doneDate: normalizeDoneDate(r.doneDate),
    doneTime: normalizeDoneTime(r.doneTime),
    startTs: typeof r.startTs === "number" ? r.startTs : null,
    elapsed: typeof r.elapsed === "number" ? r.elapsed : null,
    updatedAt,
    tagIds,
  };
}

export function normalizeTodoList(raw: unknown, today: string): Todo[] {
  if (!Array.isArray(raw)) return [];
  const out: Todo[] = [];
  for (const item of raw) {
    const t = normalizeTodo(item, today);
    if (t) out.push(t);
  }
  return out;
}

export function gcTodoTombstones(raw: unknown, nowMs: number): TodoTombstone[] {
  if (!Array.isArray(raw)) return [];
  const cutoff = nowMs - TODO_TOMBSTONE_TTL_MS;
  const out: TodoTombstone[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = (item as { id?: unknown }).id;
    const at = (item as { at?: unknown }).at;
    if (typeof id !== "number" || typeof at !== "string" || !at) continue;
    const ts = new Date(at).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    out.push({ id, at });
  }
  return out;
}

/**
 * 待辦合併（純函式）。墓碑 id 不得進入 merged，也不得進入 toPush（防推回復活）。
 * 同 id：updatedAt 較大者勝；缺 updatedAt 視為較舊。
 */
export function mergeTodosWithTombstones(
  local: Todo[],
  remote: Todo[],
  tombstones: { id: number }[],
): { merged: Todo[]; toPush: Todo[]; strippedRemote: boolean } {
  const dead = new Set(tombstones.map((t) => t.id));
  const strippedRemote = remote.some((t) => dead.has(t.id));
  const map = new Map<number, Todo>();

  for (const t of local) {
    if (dead.has(t.id)) continue;
    map.set(t.id, t);
  }
  for (const t of remote) {
    if (dead.has(t.id)) continue;
    const cur = map.get(t.id);
    if (!cur || (t.updatedAt ?? "") > (cur.updatedAt ?? "")) map.set(t.id, t);
  }

  const merged = Array.from(map.values());
  const toPush = merged.filter((t) => {
    const r = remote.find((x) => x.id === t.id);
    return !r || (t.updatedAt ?? "") > (r.updatedAt ?? "");
  });
  return { merged, toPush, strippedRemote };
}
