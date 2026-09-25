import { CFG } from "@/lib/config";
import { APP_STATE_KEYS, notifyAppState, pushAppState } from "@/lib/appStateCloud";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import type { Tag } from "@/lib/tags";
import { loadTags } from "@/lib/tagsStore";
import type { Todo } from "@/lib/types";
import { domainRootNameMap, hasDomainTag, stampTodoTags } from "@/lib/todoTags";
import { gcTodoTombstones, mergeTodosWithTombstones, normalizeTodoList } from "@/lib/todosCloud";

export type TodoMigrateRow = {
  cat: string;
  count: number;
  tagId: string;
  tagName: string;
  kept: number;
  written: number;
};

export type TodoMigrateOrphan = { id: number; text: string; cat: string };

export type TodoMigrateReport = {
  ok: boolean;
  written: number;
  kept: number;
  orphanCount: number;
  message: string;
  rows: TodoMigrateRow[];
  orphans: TodoMigrateOrphan[];
  at: string;
};

export type TodoMigrateApply = TodoMigrateReport & { todos: Todo[] };

function msgOk(written: number, kept: number): string {
  return `待辦標籤遷移：已完成，寫入 ${written} 筆、沿用 ${kept} 筆`;
}

function msgFail(n: number): string {
  return `待辦標籤遷移：已停止，有 ${n} 筆分類對不上，資料未變更`;
}

function emptyReport(at: string, todos: Todo[]): TodoMigrateApply {
  return {
    ok: true,
    written: 0,
    kept: todos.length,
    orphanCount: 0,
    message: msgOk(0, todos.length),
    rows: [],
    orphans: [],
    at,
    todos,
  };
}

/** 純函式：對不上整批 abort，todos 原樣回傳。 */
export function applyTodoTagsMigration(todos: Todo[], tags: Tag[], at = "2026-09-25T00:00:00.000Z"): TodoMigrateApply {
  const { map, duplicates } = domainRootNameMap(tags);
  if (duplicates.length) {
    return {
      ok: false,
      written: 0,
      kept: 0,
      orphanCount: todos.length,
      message: msgFail(todos.length),
      rows: [],
      orphans: todos.map((t) => ({ id: t.id, text: t.text, cat: t.cat })),
      at,
      todos,
    };
  }

  if (!todos.length) return emptyReport(at, todos);

  const next: Todo[] = [];
  const orphans: TodoMigrateOrphan[] = [];
  const byCat = new Map<string, { count: number; kept: number; written: number }>();
  const bump = (cat: string, field: "count" | "kept" | "written") => {
    const cur = byCat.get(cat) ?? { count: 0, kept: 0, written: 0 };
    cur[field] += 1;
    byCat.set(cat, cur);
  };

  for (const t of todos) {
    bump(t.cat, "count");
    if (hasDomainTag(t.tagIds, tags)) {
      bump(t.cat, "kept");
      next.push(t);
      continue;
    }
    const rootId = map.get(t.cat);
    if (!rootId) {
      orphans.push({ id: t.id, text: t.text, cat: t.cat });
      next.push(t);
      continue;
    }
    const rest = (t.tagIds ?? []).filter((id) => id !== rootId);
    const tagged = stampTodoTags({ ...t, tagIds: [rootId, ...rest] }, tags);
    bump(t.cat, "written");
    next.push(tagged);
  }

  if (orphans.length) {
    return {
      ok: false,
      written: 0,
      kept: 0,
      orphanCount: orphans.length,
      message: msgFail(orphans.length),
      rows: [],
      orphans,
      at,
      todos,
    };
  }

  for (const [cat, n] of byCat) {
    if (n.count !== n.kept + n.written) {
      return {
        ok: false,
        written: 0,
        kept: 0,
        orphanCount: n.count,
        message: msgFail(n.count),
        rows: [],
        orphans: todos.filter((t) => t.cat === cat).map((t) => ({ id: t.id, text: t.text, cat: t.cat })),
        at,
        todos,
      };
    }
  }

  const written = [...byCat.values()].reduce((s, n) => s + n.written, 0);
  const kept = [...byCat.values()].reduce((s, n) => s + n.kept, 0);
  const rows: TodoMigrateRow[] = [...byCat.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, n]) => ({
      cat,
      count: n.count,
      tagId: map.get(cat) ?? "",
      tagName: cat,
      kept: n.kept,
      written: n.written,
    }));

  return {
    ok: true,
    written,
    kept,
    orphanCount: 0,
    message: msgOk(written, kept),
    rows,
    orphans: [],
    at,
    todos: next,
  };
}

export function loadTodoTagsMigrateReport(): TodoMigrateReport | null {
  const raw = loadJSON<TodoMigrateReport | null>(LS_KEYS.todoTagsMigrate, null);
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.message !== "string") return null;
  return raw;
}

function persistReport(r: TodoMigrateApply): TodoMigrateReport {
  const report: TodoMigrateReport = {
    ok: r.ok,
    written: r.written,
    kept: r.kept,
    orphanCount: r.orphanCount,
    message: r.message,
    rows: r.rows,
    orphans: r.orphans,
    at: r.at,
  };
  saveJSON(LS_KEYS.todoTagsMigrate, report);
  return report;
}

/** 冪等。失敗不寫 todos。成功且有寫入才 pushAppState。 */
export function ensureTodoTagsMigrated(): TodoMigrateReport {
  const at = new Date().toISOString();
  const tombs = gcTodoTombstones(loadJSON(LS_KEYS.deletedTodoIds, []), Date.now());
  const local = normalizeTodoList(loadJSON(LS_KEYS.todos, []), CFG.TODAY_STR);
  const { merged } = mergeTodosWithTombstones(local, [], tombs);
  const result = applyTodoTagsMigration(merged, loadTags(), at);
  const prev = loadTodoTagsMigrateReport();
  if (result.ok && result.written === 0 && prev?.ok) return prev;
  persistReport(result);
  if (!result.ok || result.written === 0) return result;
  saveJSON(LS_KEYS.todos, result.todos);
  notifyAppState(APP_STATE_KEYS.todos);
  void pushAppState(APP_STATE_KEYS.todos, result.todos);
  return result;
}
