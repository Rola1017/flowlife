import { describe, expect, it } from "vitest";
import { classifySwipe, SWIPE_CONTAINER_TOUCH_ACTION } from "@/components/hooks/useHorizontalSwipe";

/** 鎖死輸入數字；禁止 Date.now()／new Date() */

describe("classifySwipe", () => {
  it("dx=-61 dy=0 → left", () => {
    expect(classifySwipe(-61, 0)).toBe("left");
  });
  it("dx=61 → right", () => {
    expect(classifySwipe(61, 0)).toBe("right");
  });
  it("dx=60 → null（門檻不含）", () => {
    expect(classifySwipe(60, 0)).toBeNull();
  });
  it("dx=90 dy=61 → null（未達 1.5 倍）", () => {
    expect(classifySwipe(90, 61)).toBeNull();
  });
  it("dx=-100 dy=10 → left", () => {
    expect(classifySwipe(-100, 10)).toBe("left");
  });
});

describe("SWIPE_CONTAINER_TOUCH_ACTION", () => {
  it('必須為 "pan-y"', () => {
    expect(SWIPE_CONTAINER_TOUCH_ACTION).toBe("pan-y");
  });
});
