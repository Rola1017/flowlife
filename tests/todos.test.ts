import { describe, expect, it } from "vitest";
import { mergeTodosWithTombstones, normalizeTodo, todoShowsOn } from "@/lib/todosCloud";
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

  it("endDate < date、等於 date、空字串皆不存；estimateHours 非法為 undefined", () => {
    const earlier = normalizeTodo(
      { id: 8, text: "跨日", date: "2026-09-15", endDate: "2026-09-14" },
      TODAY,
    );
    expect(earlier!.endDate).toBeUndefined();

    const sameDay = normalizeTodo(
      { id: 9, text: "單日", date: "2026-09-15", endDate: "2026-09-15" },
      TODAY,
    );
    expect(sameDay!.endDate).toBeUndefined();

    const emptyEnd = normalizeTodo(
      { id: 10, text: "空", date: "2026-09-15", endDate: "" },
      TODAY,
    );
    expect(emptyEnd!.endDate).toBeUndefined();

    const okRange = normalizeTodo(
      { id: 11, text: "區間", date: "2026-09-15", endDate: "2026-09-18" },
      TODAY,
    );
    expect(okRange!.endDate).toBe("2026-09-18");

    const zero = normalizeTodo({ id: 12, text: "估", date: TODAY, estimateHours: 0 }, TODAY);
    expect(zero!.estimateHours).toBeUndefined();
    const neg = normalizeTodo({ id: 13, text: "估", date: TODAY, estimateHours: -1 }, TODAY);
    expect(neg!.estimateHours).toBeUndefined();
    const nan = normalizeTodo({ id: 14, text: "估", date: TODAY, estimateHours: Number.NaN }, TODAY);
    expect(nan!.estimateHours).toBeUndefined();
    const asStr = normalizeTodo({ id: 15, text: "估", date: TODAY, estimateHours: "2" }, TODAY);
    expect(asStr!.estimateHours).toBeUndefined();
    const okEst = normalizeTodo({ id: 16, text: "估", date: TODAY, estimateHours: 0.5 }, TODAY);
    expect(okEst!.estimateHours).toBe(0.5);
  });

  it("挪動 date 不改 deadline（三層語意獨立）", () => {
    const orig = normalizeTodo(
      { id: 20, text: "取件", date: "2026-09-15", deadline: "2026-09-20", endDate: "2026-09-30" },
      TODAY,
    );
    expect(orig!.deadline).toBe("2026-09-20");
    expect(orig!.endDate).toBe("2026-09-30");
    const moved = normalizeTodo({ ...orig, date: "2026-09-22" }, TODAY);
    expect(moved!.date).toBe("2026-09-22");
    expect(moved!.deadline).toBe("2026-09-20");
    expect(moved!.endDate).toBe("2026-09-30");
  });
});

describe("todoShowsOn", () => {
  const day = { date: "2026-09-15" };

  it("單日待辦只在該天為 true", () => {
    expect(todoShowsOn(day, "2026-09-15")).toBe(true);
    expect(todoShowsOn(day, "2026-09-14")).toBe(false);
    expect(todoShowsOn(day, "2026-09-16")).toBe(false);
  });

  it("跨日區間含首尾，前後一天為 false", () => {
    const span = { date: "2026-09-15", endDate: "2026-09-18" };
    expect(todoShowsOn(span, "2026-09-14")).toBe(false);
    expect(todoShowsOn(span, "2026-09-15")).toBe(true);
    expect(todoShowsOn(span, "2026-09-16")).toBe(true);
    expect(todoShowsOn(span, "2026-09-17")).toBe(true);
    expect(todoShowsOn(span, "2026-09-18")).toBe(true);
    expect(todoShowsOn(span, "2026-09-19")).toBe(false);
  });

  it("endDate 等於 date 視為單日", () => {
    const same = { date: "2026-09-15", endDate: "2026-09-15" };
    expect(todoShowsOn(same, "2026-09-15")).toBe(true);
    expect(todoShowsOn(same, "2026-09-16")).toBe(false);
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
