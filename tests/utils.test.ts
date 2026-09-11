import { describe, expect, it } from "vitest";
import { fmtIdleHM } from "@/lib/utils";

describe("fmtIdleHM", () => {
  it("63 分鐘 → 1時3分", () => {
    expect(fmtIdleHM(63 * 60)).toBe("1時3分");
  });
  it("45 分鐘 → 45分", () => {
    expect(fmtIdleHM(45 * 60)).toBe("45分");
  });
  it("120 分鐘 → 2時0分", () => {
    expect(fmtIdleHM(120 * 60)).toBe("2時0分");
  });
  it("0 → 0分", () => {
    expect(fmtIdleHM(0)).toBe("0分");
  });
});
