"use client";

import { useState, useCallback, useRef } from "react";
import { CFG } from "@/lib/config";
import { nowStr } from "@/lib/utils";

export type TodoState = Record<string, unknown>;

function makeTodo(raw: Record<string, unknown>): TodoState {
  return {
    ...raw,
    phase: "pending",
    startAt: null,
    endAt: null,
    startTs: null,
    elapsed: null,
    date: CFG.TODAY_STR,
  };
}

export function useTodos(initial: Record<string, unknown>[]) {
  const [todos, setTodos] = useState<TodoState[]>(() => initial.map(makeTodo));
  const endTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const endProgTimers = useRef<Record<number, ReturnType<typeof setInterval>>>({});

  const clearEndTimers = (id: number) => {
    clearTimeout(endTimers.current[id]);
    clearInterval(endProgTimers.current[id]);
    delete endTimers.current[id];
    delete endProgTimers.current[id];
  };

  const handleStart = useCallback((id: number) => {
    setTodos((ts) => {
      const t = ts.find((x) => x.id === id);
      if (!t) return ts;
      if (t.phase === "pending")
        return ts.map((x) =>
          x.id === id ? { ...x, phase: "started", startAt: nowStr(), startTs: Date.now() } : x,
        );
      if (t.phase === "started")
        return ts.map((x) =>
          x.id === id ? { ...x, phase: "pending", startAt: null, startTs: null } : x,
        );
      return ts;
    });
  }, []);

  const handleEnd = useCallback((id: number) => {
    setTodos((ts) => {
      const t = ts.find((x) => x.id === id);
      if (!t) return ts;
      if (t.phase === "ending") {
        clearEndTimers(id);
        return ts.map((x) =>
          x.id === id ? { ...x, phase: x.startTs ? "started" : "pending" } : x,
        );
      }
      const start = Date.now();
      endProgTimers.current[id] = setInterval(() => {
        const bar = document.getElementById(`end-bar-${id}`);
        if (bar) bar.style.width = Math.max(0, 1 - (Date.now() - start) / CFG.END_CONFIRM) * 100 + "%";
      }, 16);
      endTimers.current[id] = setTimeout(() => {
        clearEndTimers(id);
        const endAt = nowStr();
        setTodos((prev) => {
          const cur = prev.find((x) => x.id === id);
          const elapsed = cur?.startTs ? Date.now() - (cur.startTs as number) : 0;
          return prev.map((x) => (x.id === id ? { ...x, phase: "done", endAt, elapsed } : x));
        });
      }, CFG.END_CONFIRM);
      return ts.map((x) => (x.id === id ? { ...x, phase: "ending" } : x));
    });
  }, []);

  const handleToggleDone = useCallback((id: number) => {
    setTodos((ts) =>
      ts.map((t) =>
        t.id === id && t.phase === "done"
          ? { ...t, phase: "pending", startAt: null, endAt: null, startTs: null, elapsed: null }
          : t,
      ),
    );
  }, []);

  const addTodo = useCallback((raw: Record<string, unknown>) => {
    setTodos((ts) => [...ts, makeTodo({ ...raw, id: Date.now() })]);
  }, []);

  const deleteTodo = useCallback((id: number) => {
    setTodos((ts) => ts.filter((t) => t.id !== id));
  }, []);

  return { todos, handleStart, handleEnd, handleToggleDone, addTodo, deleteTodo };
}
