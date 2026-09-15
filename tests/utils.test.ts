import { describe, expect, it } from "vitest";
import { fmtIdleHM, moveItem } from "@/lib/utils";

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

describe("moveItem", () => {
  it("from===to → 順序不變、回新陣列", () => {
    const src = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const out = moveItem(src, 1, 1);
    expect(out.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(out).not.toBe(src);
    expect(out[1]).toBe(src[1]);
  });

  it("頭尾互換", () => {
    const src = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(moveItem(src, 0, 2).map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(moveItem(src, 2, 0).map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(src.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(moveItem(src, 0, 2)[2]).toBe(src[0]);
  });

  it("中段搬移", () => {
    expect(moveItem(["a", "b", "c", "d"], 1, 3)).toEqual(["a", "c", "d", "b"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });
});
