import { beforeEach, describe, expect, it } from "vitest";
import { buildDistribution, sessionMatches } from "@/lib/analytics";
import { CAT_PATH_SEP, catPath, DEFAULT_CATEGORIES } from "@/lib/categories";
import { LS_KEYS, saveJSON } from "@/lib/storage";
import type { Session } from "@/lib/types";

beforeEach(() => {
  localStorage.clear();
  saveJSON(LS_KEYS.categories, DEFAULT_CATEGORIES);
});

function sess(partial: Partial<Session> & Pick<Session, "id" | "cat1" | "mins">): Session {
  return {
    date: "2026-07-25",
    name: "t",
    cat2: "",
    cat3: "",
    rating: "",
    earnedCoins: 0,
    ...partial,
  };
}

describe("analytics.sessionMatches / buildDistribution", () => {
  it("未選分類時＝各大分類總覽", () => {
    const cat1a = DEFAULT_CATEGORIES[0]?.name ?? "學習";
    const cat1b = DEFAULT_CATEGORIES[1]?.name ?? cat1a;
    const sessions = [
      sess({ id: 1, cat1: cat1a, mins: 25 }),
      sess({ id: 2, cat1: cat1a, mins: 10 }),
      sess({ id: 3, cat1: cat1b, mins: 30 }),
    ];
    const dist = buildDistribution(sessions, new Set());
    const byLabel = Object.fromEntries(dist.map((d) => [d.label, d.value]));
    expect(byLabel[cat1a]).toBe(35);
    if (cat1b !== cat1a) expect(byLabel[cat1b]).toBe(30);
  });

  it("有選時＝每個選取路徑一片，各片總和等於過濾後總時數（不重複計）", () => {
    const c1 = DEFAULT_CATEGORIES[0]?.name ?? "學習";
    const c2 = DEFAULT_CATEGORIES[0]?.mids[0]?.name ?? "中";
    const sessions = [
      sess({ id: 1, cat1: c1, cat2: c2, mins: 25 }),
      sess({ id: 2, cat1: c1, cat2: "其他中類", mins: 40 }),
    ];
    const sel = new Set([catPath(c1, c2)]);
    const filtered = sessions.filter((s) => sessionMatches(s, sel));
    expect(filtered).toHaveLength(1);
    const dist = buildDistribution(sessions, sel);
    expect(dist.reduce((a, d) => a + d.value, 0)).toBe(
      filtered.reduce((a, s) => a + s.mins, 0),
    );
    expect(dist[0]?.label).toBe(c2);
  });

  it("sessionMatches 走路徑前綴語意", () => {
    const p = catPath("A", "B");
    expect(sessionMatches(sess({ id: 1, cat1: "A", cat2: "B", cat3: "C", mins: 1 }), new Set([p]))).toBe(
      true,
    );
    expect(sessionMatches(sess({ id: 2, cat1: "A", cat2: "X", mins: 1 }), new Set([p]))).toBe(false);
    expect(p.includes(CAT_PATH_SEP)).toBe(true);
  });
});
