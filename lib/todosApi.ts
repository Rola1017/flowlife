import { CAT } from "@/lib/categories";
import { shiftDateStr } from "@/lib/dateStr";
import { primaryTagEmoji } from "@/lib/tagSelect";
import type { Todo, TodoPhase } from "@/lib/types";

export type TodoAlertInfo = {
  daysUntilDeadline: number | null;
  hoursUntilDeadline: number | null;
  shouldAlert: boolean;
};

export type TodoScheduleType = "scheduled" | "range";

export type TodoApiItem = {
  id: number;
  text: string;
  cat: string;
  tagIds: string[];
  catEmoji: string;
  date: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  deadline: string | null;
  estimateHours: number | null;
  mustDo: boolean;
  phase: TodoPhase;
  doneDate: string | null;
  doneTime: string | null;
  scheduleType: TodoScheduleType;
  daysUntilDeadline: number | null;
  hoursUntilDeadline: number | null;
  shouldAlert: boolean;
};

/**
 * 提醒門檻（Rola 裁示）：剩餘時間 <= max(24, estimateHours * 1.5) 小時 → 應通報。
 * 無 deadline → 不通報。已過期（剩餘 <= 0）→ 一律通報。
 * nowIso 由呼叫端傳入（測試鎖死時間，禁止在此用 new Date()）。
 * deadline 視為該日 23:59:59（+08:00）為截止點。
 */
export function computeAlert(
  todo: { deadline?: string; estimateHours?: number },
  nowIso: string,
): TodoAlertInfo {
  if (!todo.deadline) {
    return { daysUntilDeadline: null, hoursUntilDeadline: null, shouldAlert: false };
  }
  const cutoff = Date.parse(`${todo.deadline}T23:59:59+08:00`);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(cutoff) || !Number.isFinite(now)) {
    return { daysUntilDeadline: null, hoursUntilDeadline: null, shouldAlert: false };
  }
  const hoursUntilDeadline = Math.round(((cutoff - now) / 3_600_000) * 10) / 10;
  const daysUntilDeadline = Math.floor(hoursUntilDeadline / 24);
  const threshold = Math.max(24, (todo.estimateHours ?? 0) * 1.5);
  const shouldAlert = hoursUntilDeadline <= threshold;
  return { daysUntilDeadline, hoursUntilDeadline, shouldAlert };
}

/** 待辦是否落在查詢視窗內（考慮跨日區間與期限） */
export function todoInWindow(
  todo: { date: string; endDate?: string; deadline?: string },
  fromDate: string,
  toDate: string,
): boolean {
  const rangeEnd = todo.endDate && todo.endDate > todo.date ? todo.endDate : todo.date;
  if (todo.date <= toDate && rangeEnd >= fromDate) return true;
  if (todo.deadline && todo.deadline >= fromDate && todo.deadline <= toDate) return true;
  return false;
}

export function scheduleTypeOf(todo: { endDate?: string }): TodoScheduleType {
  return todo.endDate ? "range" : "scheduled";
}

export function toApiTodo(todo: Todo, nowIso: string): TodoApiItem {
  const alert = computeAlert(todo, nowIso);
  return {
    id: todo.id,
    text: todo.text,
    cat: todo.cat,
    tagIds: todo.tagIds?.length ? [...todo.tagIds] : [],
    catEmoji: todo.tagIds?.length ? primaryTagEmoji(todo.tagIds) || CAT.cat1Emoji(todo.cat) : CAT.cat1Emoji(todo.cat),
    date: todo.date,
    endDate: todo.endDate ?? null,
    startTime: todo.startTime ?? null,
    endTime: todo.endTime ?? null,
    deadline: todo.deadline ?? null,
    estimateHours: todo.estimateHours ?? null,
    mustDo: Boolean(todo.mustDo),
    phase: todo.phase,
    doneDate: todo.doneDate ?? null,
    doneTime: todo.doneTime ?? null,
    scheduleType: scheduleTypeOf(todo),
    daysUntilDeadline: alert.daysUntilDeadline,
    hoursUntilDeadline: alert.hoursUntilDeadline,
    shouldAlert: alert.shouldAlert,
  };
}

export function sortApiTodos(rows: TodoApiItem[]): TodoApiItem[] {
  return [...rows].sort((a, b) => {
    if (a.shouldAlert !== b.shouldAlert) return a.shouldAlert ? -1 : 1;
    const ad = a.deadline ?? "9999-99-99";
    const bd = b.deadline ?? "9999-99-99";
    if (ad !== bd) return ad < bd ? -1 : 1;
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id - b.id;
  });
}

export function defaultTodosWindow(today: string, days: number): { from: string; to: string } {
  return { from: today, to: shiftDateStr(today, days) };
}

export function summarizeApiTodos(rows: TodoApiItem[]) {
  return {
    total: rows.length,
    alerting: rows.filter((r) => r.shouldAlert).length,
    scheduled: rows.filter((r) => r.scheduleType === "scheduled").length,
    flexible: rows.filter((r) => r.scheduleType === "range").length,
    overdue: rows.filter((r) => r.hoursUntilDeadline != null && r.hoursUntilDeadline <= 0).length,
  };
}
