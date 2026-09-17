import { beforeEach, describe, expect, it } from "vitest";
import { CAT, CAT_PATH_SEP, catPath, matchesCatSelection, DEFAULT_CATEGORIES } from "@/lib/categories";
import { LS_KEYS, saveJSON } from "@/lib/storage";

beforeEach(() => {
  localStorage.clear();
  saveJSON(LS_KEYS.categories, DEFAULT_CATEGORIES);
});

describe("categories.catPath", () => {
  it("一層", () => {
    expect(catPath("學習")).toBe("學習");
  });
  it("二層", () => {
    expect(catPath("學習", "寫作")).toBe(`學習${CAT_PATH_SEP}寫作`);
  });
  it("三層", () => {
    expect(catPath("學習", "寫作", "論文")).toBe(`學習${CAT_PATH_SEP}寫作${CAT_PATH_SEP}論文`);
  });
});

describe("categories.matchesCatSelection", () => {
  it("空選取＝全通過", () => {
    expect(matchesCatSelection(new Set(), "學習", "寫作", "論文")).toBe(true);
  });

  it("選父層時子層資料要通過", () => {
    const sel = new Set([catPath("學習")]);
    expect(matchesCatSelection(sel, "學習", "寫作", "論文")).toBe(true);
  });

  it("選子層時父層其他子項不通過", () => {
    const sel = new Set([catPath("學習", "寫作")]);
    expect(matchesCatSelection(sel, "學習", "寫作", "論文")).toBe(true);
    expect(matchesCatSelection(sel, "學習", "閱讀", "")).toBe(false);
  });

  it("不重複計不變式：同時選父路徑與子路徑時，一筆資料只算一次（歷史 bug：跨分類加總重複計）", () => {
    const sel = new Set([catPath("學習"), catPath("學習", "寫作")]);
    expect(matchesCatSelection(sel, "學習", "寫作", "論文")).toBe(true);
  });
});

describe("CAT.cat1Emoji", () => {
  it("六個指定分類回對應 emoji；未知分類回空字串", () => {
    expect(CAT.cat1Emoji("學習")).toBe("✍️");
    expect(CAT.cat1Emoji("事業")).toBe("💼");
    expect(CAT.cat1Emoji("閱讀")).toBe("📖");
    expect(CAT.cat1Emoji("健康")).toBe("🌱");
    expect(CAT.cat1Emoji("娛樂")).toBe("🎀");
    expect(CAT.cat1Emoji("未分類")).toBe("🌑");
    expect(CAT.cat1Emoji("自訂分類")).toBe("");
    expect(CAT.cat1Emoji("兼差")).toBe("");
    expect(CAT.cat1Display("學習")).toBe("✍️ 學習");
    expect(CAT.cat1Display("自訂分類")).toBe("自訂分類");
    expect(CAT.cat1Display("")).toBe("");
  });
});
