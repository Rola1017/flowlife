import { describe, expect, it } from "vitest";
import { computeAlert, toApiTodo, todoInWindow } from "@/lib/todosApi";
import type { Todo } from "@/lib/types";

/** 鎖死時間，禁止 Date.now()／new Date() */
const NOW = "2026-09-13T07:40:00+08:00";

describe("computeAlert", () => {
  it("無 deadline → shouldAlert false、兩個數值皆 null", () => {
    expect(computeAlert({ estimateHours: 8 }, NOW)).toEqual({
      daysUntilDeadline: null,
      hoursUntilDeadline: null,
      shouldAlert: false,
    });
    expect(computeAlert({}, NOW).shouldAlert).toBe(false);
  });

  it("deadline 剩 12 小時、無 estimateHours → 門檻 24 → shouldAlert true", () => {
    const now = "2026-09-13T11:59:59+08:00";
    const info = computeAlert({ deadline: "2026-09-13" }, now);
    expect(info.hoursUntilDeadline).toBe(12);
    expect(info.daysUntilDeadline).toBe(0);
    expect(info.shouldAlert).toBe(true);
  });

  it("deadline 剩 40 小時、estimateHours=24 → 門檻 36 → false；剩 30 小時 → true", () => {
    const far = computeAlert({ deadline: "2026-09-14", estimateHours: 24 }, "2026-09-13T07:59:59+08:00");
    expect(far.hoursUntilDeadline).toBe(40);
    expect(far.shouldAlert).toBe(false);

    const near = computeAlert({ deadline: "2026-09-14", estimateHours: 24 }, "2026-09-13T17:59:59+08:00");
    expect(near.hoursUntilDeadline).toBe(30);
    expect(near.shouldAlert).toBe(true);
  });

  it("已過期（deadline 為昨天）→ hoursUntilDeadline 為負、shouldAlert true", () => {
    const info = computeAlert({ deadline: "2026-09-12" }, NOW);
    expect(info.hoursUntilDeadline).not.toBeNull();
    expect(info.hoursUntilDeadline!).toBeLessThan(0);
    expect(info.daysUntilDeadline!).toBeLessThan(0);
    expect(info.shouldAlert).toBe(true);
    expect(JSON.stringify(info)).not.toContain("undefined");
  });
});

describe("todoInWindow", () => {
  it("跨日區間與視窗部分重疊 → true；完全在視窗外 → false", () => {
    const span = { date: "2026-09-15", endDate: "2026-09-18" };
    expect(todoInWindow(span, "2026-09-13", "2026-10-13")).toBe(true);
    expect(todoInWindow(span, "2026-09-17", "2026-09-20")).toBe(true);
    expect(todoInWindow(span, "2026-09-18", "2026-09-20")).toBe(true);
    expect(todoInWindow(span, "2026-09-01", "2026-09-10")).toBe(false);
    expect(todoInWindow(span, "2026-09-19", "2026-09-30")).toBe(false);
  });

  it("僅 deadline 落在視窗內 → true", () => {
    const t = { date: "2026-10-20", deadline: "2026-09-20" };
    expect(todoInWindow(t, "2026-09-13", "2026-10-13")).toBe(true);
    expect(todoInWindow({ date: "2026-10-20" }, "2026-09-13", "2026-10-13")).toBe(false);
  });
});

describe("toApiTodo tagIds 雙寫", () => {
  it("輸出 tagIds 且仍帶 cat", () => {
    const todo: Todo = {
      id: 1,
      text: "取件",
      cat: "學習",
      tagIds: ["learn"],
      date: "2026-09-13",
      phase: "pending",
    };
    const item = toApiTodo(todo, NOW);
    expect(item.tagIds).toEqual(["learn"]);
    expect(item.cat).toBe("學習");
  });
});
