import { isValidDateStr, json, nowIsoTaipei, todayTaipei } from "@/lib/apiShared";
import { loadTodosFor } from "@/lib/supabase/admin";
import {
  defaultTodosWindow,
  sortApiTodos,
  summarizeApiTodos,
  toApiTodo,
  todoInWindow,
} from "@/lib/todosApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDays(raw: string | null): number | { error: string } {
  if (raw == null || raw.trim() === "") return 30;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 365) {
    return { error: "invalid days, expected 1-365" };
  }
  return n;
}

export async function GET(req: Request) {
  try {
    const key = req.headers.get("x-roro-key");
    if (!key || key !== process.env.RORO_API_KEY) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const url = new URL(req.url);
    const fromRaw = url.searchParams.get("from")?.trim() ?? "";
    const toRaw = url.searchParams.get("to")?.trim() ?? "";
    const hasFrom = Boolean(fromRaw);
    const hasTo = Boolean(toRaw);

    let from: string;
    let to: string;
    if (hasFrom || hasTo) {
      if (!hasFrom || !hasTo || !isValidDateStr(fromRaw) || !isValidDateStr(toRaw) || fromRaw > toRaw) {
        return json({ ok: false, error: "invalid date" }, 400);
      }
      from = fromRaw;
      to = toRaw;
    } else {
      const days = parseDays(url.searchParams.get("days"));
      if (typeof days !== "number") {
        return json({ ok: false, error: days.error }, 400);
      }
      const win = defaultTodosWindow(todayTaipei(), days);
      from = win.from;
      to = win.to;
    }

    const userId = process.env.RORO_USER_ID;
    if (!userId) {
      return json({ ok: false, error: "internal" }, 500);
    }

    const includeDone = url.searchParams.get("includeDone") === "1";
    const nowIso = nowIsoTaipei();
    const loaded = await loadTodosFor(userId);
    const filtered = loaded.filter((t) => {
      if (!todoInWindow(t, from, to)) return false;
      if (!includeDone && t.phase === "done") return false;
      return true;
    });
    const todos = sortApiTodos(filtered.map((t) => toApiTodo(t, nowIso)));

    return json(
      {
        ok: true,
        generatedAt: nowIso,
        window: { from, to },
        todos,
        summary: summarizeApiTodos(todos),
      },
      200,
    );
  } catch {
    return json({ ok: false, error: "internal" }, 500);
  }
}
