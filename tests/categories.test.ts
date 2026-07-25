import { beforeEach, describe, expect, it } from "vitest";
import { CAT_PATH_SEP, catPath, matchesCatSelection, DEFAULT_CATEGORIES } from "@/lib/categories";
import { buildDistribution, sessionMatches } from "@/lib/analytics";
import { LS_KEYS, saveJSON } from "@/lib/storage";
import type { Session } from "@/lib/types";

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
    const rows: Session[] = [
      {
        id: 1,
        date: "2026-07-25",
        name: "A",
        cat1: "學習",
        cat2: "寫作",
        cat3: "論文",
        mins: 25,
        rating: "",
        earnedCoins: 0,
      },
    ];
    const hit = rows.filter((s) => sessionMatches(s, sel));
    expect(hit).toHaveLength(1);
  });
});

describe("analytics.buildDistribution 不重複計", () => {
  it("未選＝各大分類總覽；有選（互不巢套）時各片總和＝過濾後總時數", () => {
    const sessions: Session[] = [
      {
        id: 1,
        date: "2026-07-25",
        name: "a",
        cat1: "學習",
        cat2: "寫作",
        cat3: "",
        mins: 25,
        rating: "",
        earnedCoins: 0,
      },
      {
        id: 2,
        date: "2026-07-25",
        name: "b",
        cat1: "健康",
        cat2: "運動",
        cat3: "",
        mins: 30,
        rating: "",
        earnedCoins: 0,
      },
    ];
    const empty = buildDistribution(sessions, new Set());
    const emptySum = empty.reduce((s, d) => s + d.value, 0);
    expect(emptySum).toBe(55);

    const sel = new Set([catPath("學習", "寫作"), catPath("健康", "運動")]);
    const filtered = sessions.filter((s) => sessionMatches(s, sel));
    const filteredMins = filtered.reduce((s, x) => s + x.mins, 0);
    const dist = buildDistribution(sessions, sel);
    expect(dist.reduce((s, d) => s + d.value, 0)).toBe(filteredMins);
  });
});
