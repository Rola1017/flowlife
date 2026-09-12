"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { APP_STATE_KEYS, pushAppState, subscribeAppState } from "@/lib/appStateCloud";
import { CFG, type TodoReminderId, TODO_REMINDER_OPTIONS } from "@/lib/config";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { gcTodoTombstones, mergeTodosWithTombstones, normalizeTodo, normalizeTodoList, applyTodoComplete, applyTodoUncomplete, resolveDoneDate, resolveDoneTime } from "@/lib/todosCloud";
import type { Todo, TodoTombstone } from "@/lib/types";
import { nowHM, nowStr } from "@/lib/utils";

function normalizeReminder(r: unknown): TodoReminderId {
  const s = typeof r === "string" ? r : "none";
  return TODO_REMINDER_OPTIONS.some((o) => o.id === s) ? (s as TodoReminderId) : "none";
}

function stamp(): string {
  return new Date().toISOString();
}

function makeTodo(raw: Partial<Todo>, today: string): Todo {
  const base = normalizeTodo({ ...raw, id: raw.id ?? Date.now(), phase: "pending" }, today);
  if (!base) throw new Error("invalid todo");
  return {
    ...base,
    phase: "pending",
    startAt: null,
    endAt: null,
    startTs: null,
    elapsed: null,
    doneDate: undefined,
    doneTime: undefined,
    reminder: normalizeReminder(raw.reminder),
    updatedAt: stamp(),
  };
}

function loadTombstones(): TodoTombstone[] {
  return gcTodoTombstones(loadJSON(LS_KEYS.deletedTodoIds, []), Date.now());
}

function persistTombstones(next: TodoTombstone[]) {
  saveJSON(LS_KEYS.deletedTodoIds, next);
  void pushAppState(APP_STATE_KEYS.deletedTodos, next);
}

export function useTodos(initial: Partial<Todo>[]) {
  const [todos, setTodos] = useState<Todo[]>(() =>
    initial.map((raw) => makeTodo(raw, CFG.TODAY_STR)),
  );
  const [hydrated, setHydrated] = useState(false);
  const endTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const endProgTimers = useRef<Record<number, ReturnType<typeof setInterval>>>({});
  const todosRef = useRef(todos);
  todosRef.current = todos;
  /** 初次載入與遠端套用不推雲，避免空清單覆蓋雲端 */
  const skipPush = useRef(true);
  /** 使用者動作才准推；遠端套用即使和 skip 撞在一起也不推 */
  const wantPush = useRef(false);

  const clearEndTimers = (id: number) => {
    clearTimeout(endTimers.current[id]);
    clearInterval(endProgTimers.current[id]);
    delete endTimers.current[id];
    delete endProgTimers.current[id];
  };

  const apply = useCallback((updater: (prev: Todo[]) => Todo[]) => {
    wantPush.current = true;
    setTodos(updater);
  }, []);

  useEffect(() => {
    const saved = normalizeTodoList(loadJSON(LS_KEYS.todos, null), CFG.TODAY_STR);
    const tombs = loadTombstones();
    saveJSON(LS_KEYS.deletedTodoIds, tombs);
    const { merged } = mergeTodosWithTombstones(saved, [], tombs);
    skipPush.current = true;
    wantPush.current = false;
    setTodos(merged.map((t) => ({ ...t, reminder: normalizeReminder(t.reminder) })));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(LS_KEYS.todos, todos);
    if (skipPush.current && !wantPush.current) {
      skipPush.current = false;
      return;
    }
    skipPush.current = false;
    if (!wantPush.current) return;
    wantPush.current = false;
    void pushAppState(APP_STATE_KEYS.todos, todos);
  }, [todos, hydrated]);

  useEffect(() => {
    const pull = () => {
      const remote = normalizeTodoList(loadJSON(LS_KEYS.todos, []), CFG.TODAY_STR);
      const tombs = loadTombstones();
      const { merged, toPush, strippedRemote } = mergeTodosWithTombstones(
        todosRef.current,
        remote,
        tombs,
      );
      const next = merged.map((t) => ({ ...t, reminder: normalizeReminder(t.reminder) }));
      if (strippedRemote || toPush.length) {
        saveJSON(LS_KEYS.todos, next);
        void pushAppState(APP_STATE_KEYS.todos, next);
      }
      skipPush.current = true;
      wantPush.current = false;
      setTodos(next);
    };
    const unsubTodos = subscribeAppState(APP_STATE_KEYS.todos, pull);
    const unsubTombs = subscribeAppState(APP_STATE_KEYS.deletedTodos, pull);
    return () => {
      unsubTodos();
      unsubTombs();
    };
  }, []);

  useEffect(
    () => () => {
      for (const id of Object.keys(endTimers.current)) clearEndTimers(Number(id));
    },
    [],
  );

  const bury = (ids: number[]) => {
    if (!ids.length) return;
    const at = stamp();
    const tombs = loadTombstones().filter((t) => !ids.includes(t.id));
    persistTombstones([...tombs, ...ids.map((id) => ({ id, at }))]);
  };

  const handleStart = useCallback(
    (id: number) => {
      apply((ts) => {
        const t = ts.find((x) => x.id === id);
        if (!t) return ts;
        if (t.phase === "pending") {
          return ts.map((x) =>
            x.id === id
              ? { ...x, phase: "started", startAt: nowStr(), startTs: Date.now(), updatedAt: stamp() }
              : x,
          );
        }
        if (t.phase === "started") {
          return ts.map((x) =>
            x.id === id
              ? { ...x, phase: "pending", startAt: null, startTs: null, updatedAt: stamp() }
              : x,
          );
        }
        return ts;
      });
    },
    [apply],
  );

  const handleEnd = useCallback(
    (id: number, doneDateHint?: string) => {
      const t = todosRef.current.find((x) => x.id === id);
      if (!t) return;
      if (t.phase === "ending" || endTimers.current[id]) {
        clearEndTimers(id);
        apply((ts) =>
          ts.map((x) =>
            x.id === id
              ? { ...x, phase: x.startTs ? "started" : "pending", updatedAt: stamp() }
              : x,
          ),
        );
        return;
      }
      const doneDate = resolveDoneDate(doneDateHint, CFG.TODAY_STR);
      const start = Date.now();
      endProgTimers.current[id] = setInterval(() => {
        const bar = document.getElementById(`end-bar-${id}`);
        if (bar) bar.style.width = `${Math.max(0, 1 - (Date.now() - start) / CFG.END_CONFIRM) * 100}%`;
      }, 16);
      endTimers.current[id] = setTimeout(() => {
        clearEndTimers(id);
        const cur = todosRef.current.find((x) => x.id === id);
        if (!cur) return;
        const elapsed = cur.startTs ? Date.now() - cur.startTs : 0;
        const endAt = nowStr();
        const doneTime = resolveDoneTime(doneDate, CFG.TODAY_STR, nowHM());
        const updatedAt = stamp();
        apply((prev) =>
          prev.map((x) =>
            x.id === id ? applyTodoComplete(x, { endAt, doneDate, doneTime, elapsed, updatedAt }) : x,
          ),
        );
      }, CFG.END_CONFIRM);
      apply((ts) =>
        ts.map((x) => (x.id === id ? { ...x, phase: "ending", updatedAt: stamp() } : x)),
      );
    },
    [apply],
  );

  const handleToggleDone = useCallback(
    (id: number) => {
      const updatedAt = stamp();
      apply((ts) =>
        ts.map((t) => (t.id === id && t.phase === "done" ? applyTodoUncomplete(t, updatedAt) : t)),
      );
    },
    [apply],
  );

  const addTodo = useCallback(
    (raw: Partial<Todo>) => {
      const next = makeTodo(raw, CFG.TODAY_STR);
      apply((ts) => [...ts, next]);
    },
    [apply],
  );

  const updateTodo = useCallback(
    (id: number, patch: Partial<Todo>) => {
      apply((ts) =>
        ts.map((t) => {
          if (t.id !== id) return t;
          const merged = { ...t, ...patch, id: t.id, updatedAt: stamp() };
          const next = normalizeTodo(merged, t.date);
          return next ? { ...next, reminder: normalizeReminder(next.reminder) } : t;
        }),
      );
    },
    [apply],
  );

  const deleteTodo = useCallback((id: number) => {
    clearEndTimers(id);
    bury([id]);
    apply((ts) => ts.filter((t) => t.id !== id));
  }, [apply]);

  const resetTodos = useCallback(
    (next: Partial<Todo>[] = []) => {
      for (const id of Object.keys(endTimers.current)) clearEndTimers(Number(id));
      const built = next.map((raw) => makeTodo(raw, CFG.TODAY_STR));
      const keep = new Set(built.map((t) => t.id));
      bury(todosRef.current.map((t) => t.id).filter((id) => !keep.has(id)));
      apply(() => built);
    },
    [apply],
  );

  return { todos, handleStart, handleEnd, handleToggleDone, addTodo, updateTodo, deleteTodo, resetTodos };
}
