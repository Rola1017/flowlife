import { describe, expect, it } from "vitest";
import { localRecordCounts } from "@/lib/localCounts";
import type { Session, Todo } from "@/lib/types";

function todo(patch: Partial<Todo> & Pick<Todo, "id">): Todo {
  return {
    text: "x",
    cat: "未分類",
    date: "2026-09-26",
    phase: "pending",
    ...patch,
  };
}

function sess(name: string): Session {
  return { date: "2026-09-26", name, cat1: "學習", cat2: "", cat3: "", mins: 25, rating: "", earnedCoins: 0 };
}

describe("localRecordCounts 本機筆數", () => {
  it("未完成／已完成／墓碑不在 todos 內；垃圾桶＝傳入 trash 長度", () => {
    const todos = [
      todo({ id: 1, phase: "pending" }),
      todo({ id: 2, phase: "started" }),
      todo({ id: 3, phase: "ending" }),
      todo({ id: 4, phase: "done" }),
    ];
    const sessions = [sess("a"), sess("b")];
    const trash = [sess("gone")];
    const c = localRecordCounts(todos, sessions, trash);
    expect(c.todos).toBe(4);
    expect(c.todosPending).toBe(3);
    expect(c.todosDone).toBe(1);
    expect(c.sessions).toBe(2);
    expect(c.trash).toBe(1);
  });

  it("非陣列當空", () => {
    const c = localRecordCounts(null as unknown as Todo[], undefined as unknown as Session[], 0 as unknown as unknown[]);
    expect(c).toEqual({ todos: 0, todosPending: 0, todosDone: 0, sessions: 0, trash: 0 });
  });
});
