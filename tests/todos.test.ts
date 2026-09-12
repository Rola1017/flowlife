import { describe, expect, it } from "vitest";
import { applyTodoComplete, applyTodoUncomplete, doneLabel, mergeTodosWithTombstones, normalizeTodo, resolveDoneDate, resolveDoneTime, todoShowsOn } from "@/lib/todosCloud";
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

  it("doneDate 非法／空字串 → undefined；合法日期保留", () => {
    expect(normalizeTodo({ id: 40, text: "x", date: TODAY, doneDate: "" }, TODAY)!.doneDate).toBeUndefined();
    expect(normalizeTodo({ id: 41, text: "x", date: TODAY, doneDate: "09-16" }, TODAY)!.doneDate).toBeUndefined();
    expect(normalizeTodo({ id: 42, text: "x", date: TODAY, doneDate: "nope" }, TODAY)!.doneDate).toBeUndefined();
    expect(normalizeTodo({ id: 43, text: "x", date: TODAY, doneDate: "2026-09-16" }, TODAY)!.doneDate).toBe("2026-09-16");
  });

  it("doneTime 僅接受 HH:mm；非法格式 → undefined", () => {
    expect(normalizeTodo({ id: 44, text: "x", date: TODAY, doneTime: "14:30" }, TODAY)!.doneTime).toBe("14:30");
    expect(normalizeTodo({ id: 45, text: "x", date: TODAY, doneTime: "" }, TODAY)!.doneTime).toBeUndefined();
    expect(normalizeTodo({ id: 46, text: "x", date: TODAY, doneTime: "9:30" }, TODAY)!.doneTime).toBeUndefined();
    expect(normalizeTodo({ id: 47, text: "x", date: TODAY, doneTime: "14:30:00" }, TODAY)!.doneTime).toBeUndefined();
    expect(normalizeTodo({ id: 48, text: "x", date: TODAY, doneTime: "24:00" }, TODAY)!.doneTime).toBeUndefined();
    expect(normalizeTodo({ id: 49, text: "x", date: TODAY, doneTime: "nope" }, TODAY)!.doneTime).toBeUndefined();
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

  it("todoShowsOn 不受 doneDate 影響", () => {
    const span = { date: "2026-09-15", endDate: "2026-09-18", doneDate: "2026-09-16" };
    expect(todoShowsOn(span, "2026-09-15")).toBe(true);
    expect(todoShowsOn(span, "2026-09-16")).toBe(true);
    expect(todoShowsOn(span, "2026-09-18")).toBe(true);
    expect(todoShowsOn(span, "2026-09-14")).toBe(false);
  });
});

describe("todos complete doneDate", () => {
  it("跨日完成寫入完成當天；取消完成清空 doneDate 與 doneTime，不改 date/endDate/deadline", () => {
    const span = todo({
      id: 50,
      date: "2026-09-15",
      endDate: "2026-09-18",
      deadline: "2026-09-20",
      phase: "started",
    });
    const done = applyTodoComplete(span, {
      endAt: "10:00:00",
      doneDate: "2026-09-16",
      doneTime: "14:30",
      elapsed: 1200,
      updatedAt: "2026-09-16T10:00:00.000Z",
    });
    expect(done.phase).toBe("done");
    expect(done.endAt).toBe("10:00:00");
    expect(done.doneDate).toBe("2026-09-16");
    expect(done.doneTime).toBe("14:30");
    expect(done.date).toBe("2026-09-15");
    expect(done.endDate).toBe("2026-09-18");
    expect(done.deadline).toBe("2026-09-20");

    const undone = applyTodoUncomplete(done, "2026-09-16T10:01:00.000Z");
    expect(undone.phase).toBe("pending");
    expect(undone.doneDate).toBeUndefined();
    expect(undone.doneTime).toBeUndefined();
    expect(undone.endAt).toBeNull();
    expect(undone.elapsed).toBeNull();
    expect(undone.date).toBe("2026-09-15");
    expect(undone.endDate).toBe("2026-09-18");
    expect(undone.deadline).toBe("2026-09-20");
  });

  it("resolveDoneDate：有合法 hint 用 hint；未傳或非法用今天（禁止 new Date）", () => {
    expect(resolveDoneDate("2026-09-16", "2026-09-13")).toBe("2026-09-16");
    expect(resolveDoneDate(undefined, "2026-09-13")).toBe("2026-09-13");
    expect(resolveDoneDate("", "2026-09-13")).toBe("2026-09-13");
    expect(resolveDoneDate("09-16", "2026-09-13")).toBe("2026-09-13");
  });

  it("resolveDoneTime：完成日＝今天才填時間；非今天留空", () => {
    expect(resolveDoneTime("2026-09-13", "2026-09-13", "07:40")).toBe("07:40");
    expect(resolveDoneTime("2026-09-19", "2026-09-13", "07:40")).toBeUndefined();
    expect(resolveDoneTime("2026-09-12", "2026-09-13", "07:40")).toBeUndefined();
    const backdated = applyTodoComplete(todo({ id: 51, date: "2026-09-19", phase: "started" }), {
      endAt: "07:40:00",
      doneDate: "2026-09-19",
      doneTime: resolveDoneTime("2026-09-19", "2026-09-13", "07:40"),
      elapsed: 0,
      updatedAt: "2026-09-13T07:40:00.000Z",
    });
    expect(backdated.doneDate).toBe("2026-09-19");
    expect(backdated.doneTime).toBeUndefined();
  });
});

describe("doneLabel 三態", () => {
  it("無 doneDate → 已完成；同日／無 viewDate → 當天完成；其他日 → 已於 M/D；皆帶 ✏️", () => {
    expect(doneLabel(undefined, "2026-09-16")).toBe("✅ 已完成 ✏️");
    expect(doneLabel("2026-09-16", "2026-09-16")).toBe("✅ 當天完成 ✏️");
    expect(doneLabel("2026-09-16", undefined)).toBe("✅ 當天完成 ✏️");
    expect(doneLabel("2026-09-16", "2026-09-15")).toBe("✅ 已於 9/16 完成 ✏️");
    expect(doneLabel("2026-09-16", "2026-09-18")).toBe("✅ 已於 9/16 完成 ✏️");
    expect(doneLabel("2026-09-19", "2026-09-13", undefined)).toBe("✅ 已於 9/19 完成 ✏️");
    expect(doneLabel("2026-09-19", "2026-09-13", undefined)).not.toContain("undefined");
  });

  it("有 doneTime 時附在日期後", () => {
    expect(doneLabel("2026-09-16", "2026-09-15", "14:30")).toBe("✅ 已於 9/16 14:30 完成 ✏️");
    expect(doneLabel("2026-09-16", "2026-09-16", "14:30")).toBe("✅ 當天 14:30 完成 ✏️");
    expect(doneLabel(undefined, "2026-09-16", "14:30")).toBe("✅ 已完成 14:30 ✏️");
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
