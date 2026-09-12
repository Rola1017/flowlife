import { describe, expect, it } from "vitest";
import { mergeTodosWithTombstones, normalizeTodo } from "@/lib/todosCloud";
import type { Todo } from "@/lib/types";

const TODAY = "2026-09-13";

function todo(patch: Partial<Todo> & Pick<Todo, "id">): Todo {
  return {
    text: "取件",
    cat: "生活",
    date: TODAY,
    phase: "pending",
    ...patch,
  };
}

describe("todos 墓碑", () => {
  it("被刪除 id 不得出現在合併結果，也不得被推回", () => {
    const local = [todo({ id: 1, text: "本機", updatedAt: "2026-09-01T00:00:00.000Z" })];
    const remote = [todo({ id: 1, text: "雲端", updatedAt: "2026-09-02T00:00:00.000Z" })];
    const { merged, toPush } = mergeTodosWithTombstones(local, remote, [{ id: 1 }]);
    expect(merged.map((t) => t.id)).not.toContain(1);
    expect(toPush.map((t) => t.id)).not.toContain(1);
    expect(merged).toEqual([]);
    expect(toPush).toEqual([]);
  });

  it("重新新增同名待辦（id 不同）不受墓碑影響", () => {
    const revived = todo({
      id: 2,
      text: "取件",
      updatedAt: "2026-09-13T08:00:00.000Z",
    });
    const { merged, toPush } = mergeTodosWithTombstones([revived], [], [{ id: 1 }]);
    expect(merged).toEqual([revived]);
    expect(toPush).toEqual([revived]);
  });
});

describe("todos normalize", () => {
  it("缺 date 補指定今天；deadline 空字串為 undefined", () => {
    const t = normalizeTodo({ id: 7, text: "取件", deadline: "" }, TODAY);
    expect(t).not.toBeNull();
    expect(t!.date).toBe(TODAY);
    expect(t!.deadline).toBeUndefined();
    expect("deadline" in t! && t!.deadline === "").toBe(false);
  });
});

describe("todos 合併 LWW", () => {
  it("本地 updatedAt 較大保留本地", () => {
    const local = todo({ id: 3, text: "本地", updatedAt: "2026-09-13T10:00:00.000Z" });
    const remote = todo({ id: 3, text: "遠端", updatedAt: "2026-09-13T09:00:00.000Z" });
    const { merged } = mergeTodosWithTombstones([local], [remote], []);
    expect(merged).toEqual([local]);
  });

  it("遠端 updatedAt 較大採遠端", () => {
    const local = todo({ id: 3, text: "本地", updatedAt: "2026-09-13T08:00:00.000Z" });
    const remote = todo({ id: 3, text: "遠端", updatedAt: "2026-09-13T09:00:00.000Z" });
    const { merged } = mergeTodosWithTombstones([local], [remote], []);
    expect(merged).toEqual([remote]);
  });
});
