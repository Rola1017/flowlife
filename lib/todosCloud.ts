import type { Todo, TodoPhase, TodoTombstone } from "@/lib/types";

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
  return {
    id,
    text: typeof r.text === "string" ? r.text : "",
    cat: typeof r.cat === "string" && r.cat ? r.cat : "未分類",
    date: isDate(r.date) ? r.date : today,
    startTime,
    endTime,
    deadline: normalizeDeadline(r.deadline),
    mustDo: Boolean(r.mustDo),
    reminder: typeof r.reminder === "string" ? r.reminder : "none",
    phase: asPhase(r.phase),
    startAt: typeof r.startAt === "string" ? r.startAt : null,
    endAt: typeof r.endAt === "string" ? r.endAt : null,
    startTs: typeof r.startTs === "number" ? r.startTs : null,
    elapsed: typeof r.elapsed === "number" ? r.elapsed : null,
    updatedAt,
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
