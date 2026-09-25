import { describe, expect, it } from "vitest";
import { normalizeHex } from "@/components/ui/ColorField";

describe("normalizeHex", () => {
  it("接受 #RGB／RGB／#RRGGBB／RRGGBB，三碼展開為六碼，輸出大寫 #RRGGBB", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("abc")).toBe("#AABBCC");
    expect(normalizeHex("#AABBCC")).toBe("#AABBCC");
    expect(normalizeHex("AABBCC")).toBe("#AABBCC");
    expect(normalizeHex("#aabbcc")).toBe("#AABBCC");
    expect(normalizeHex("  #AbC  ")).toBe("#AABBCC");
  });

  it("拒絕空字串、色名、半截、非 hex、超長", () => {
    expect(normalizeHex("")).toBeNull();
    expect(normalizeHex("   ")).toBeNull();
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex("#12")).toBeNull();
    expect(normalizeHex("#GGGGGG")).toBeNull();
    expect(normalizeHex("AABBCCDD")).toBeNull();
    expect(normalizeHex("#AABBCCDD")).toBeNull();
    expect(normalizeHex("#abcd")).toBeNull();
  });

  it("輸出格式一致", () => {
    const samples = ["#abc", "abc", "#AABBCC", "AABBCC", "#Ec4899"];
    for (const s of samples) {
      const n = normalizeHex(s);
      expect(n).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
