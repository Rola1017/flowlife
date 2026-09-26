import { describe, expect, it } from "vitest";
import { weekTodoSlot } from "@/lib/weekTodoSlot";

describe("weekTodoSlot 週檢視時段", () => {
  it("無時間或 06 點前＝未排（仍要畫）", () => {
    expect(weekTodoSlot()).toBe("untimed");
    expect(weekTodoSlot("")).toBe("untimed");
    expect(weekTodoSlot("   ")).toBe("untimed");
    expect(weekTodoSlot("05:59")).toBe("untimed");
  });

  it("早／午／晚分界", () => {
    expect(weekTodoSlot("06:00")).toBe("morning");
    expect(weekTodoSlot("11:59")).toBe("morning");
    expect(weekTodoSlot("12:00")).toBe("noon");
    expect(weekTodoSlot("17:59")).toBe("noon");
    expect(weekTodoSlot("18:00")).toBe("evening");
    expect(weekTodoSlot("23:00")).toBe("evening");
  });
});
