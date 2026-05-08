import { TH } from "@/lib/theme";

export const CATEGORY_TREE = {
  學習: {
    color: "#F59E0B",
    mid: {
      法律: { color: "#7C3AED", sub: ["勞動社會法", "保險法", "民法", "行政法", "刑法", "民事訴訟法"] },
      保險: { color: "#9333EA", sub: ["意外險", "醫療險", "儲蓄險"] },
      英文: { color: "#EC4899", sub: ["口說", "文法", "寫作"] },
    },
  },
  事業: {
    color: "#3B82F6",
    mid: {
      架網站: { color: "#2563EB", sub: [] },
      知識萃取: { color: "#1D4ED8", sub: [] },
    },
  },
  閱讀: {
    color: "#06B6D4",
    mid: {
      溝通術: { color: "#0891B2", sub: [] },
      情緒療癒: { color: "#7C3AED", sub: [] },
      學習技巧: { color: "#F59E0B", sub: [] },
      金融: { color: "#10B981", sub: ["投資", "經濟學"] },
      商業: { color: "#3B82F6", sub: [] },
    },
  },
  健康: {
    color: "#10B981",
    mid: {
      重訓: { color: "#059669", sub: [] },
      有氧: { color: "#22C55E", sub: [] },
    },
  },
  兼差: {
    color: "#8B5CF6",
    mid: {
      兼差A: { color: "#7C3AED", sub: [] },
      兼差B: { color: "#6D28D9", sub: [] },
    },
  },
  活動: {
    color: "#EC4899",
    mid: {
      展覽: { color: "#DB2777", sub: [] },
      旅遊: { color: "#E11D48", sub: [] },
      聚會: { color: "#BE185D", sub: [] },
    },
  },
  未分類: { color: "#6B7280", mid: {} },
};

type Tree = typeof CATEGORY_TREE;

export const CAT = {
  cat1List: () => Object.keys(CATEGORY_TREE) as (keyof Tree)[],
  cat1Color: (c1: string) => (CATEGORY_TREE as Record<string, { color: string }>)[c1]?.color || TH.muted,
  cat2List: (c1: string) =>
    Object.keys((CATEGORY_TREE as Record<string, { mid?: Record<string, unknown> }>)[c1]?.mid ?? {}),
  cat2Color: (c1: string, c2: string) =>
    (CATEGORY_TREE as Record<string, { mid?: Record<string, { color: string }>; color: string }>)[c1]?.mid?.[c2]
      ?.color ||
    (CATEGORY_TREE as Record<string, { color: string }>)[c1]?.color ||
    TH.muted,
  cat3List: (c1: string, c2: string) =>
    (
      (CATEGORY_TREE as Record<string, { mid?: Record<string, { sub: string[] }> }>)[c1]?.mid?.[c2] as
        | { sub: string[] }
        | undefined
    )?.sub ?? [],
  cat3Color: (c1: string, c2: string) =>
    (CATEGORY_TREE as Record<string, { mid?: Record<string, { color: string }> }>)[c1]?.mid?.[c2]?.color || TH.muted,
  deepColor: (c1: string, c2?: string) => (c2 ? CAT.cat2Color(c1, c2) : CAT.cat1Color(c1)),
  chartDataFor: (level: string, c1: string, c2: string) => {
    if (level === "all")
      return CAT.cat1List()
        .filter((c) => c !== "未分類")
        .map((c, i) => ({ label: c as string, value: 120 + i * 55, color: CAT.cat1Color(c as string) }));
    if (level === "cat1" && c1)
      return CAT.cat2List(c1).map((c, i) => ({
        label: c,
        value: 80 + i * 40,
        color: CAT.cat2Color(c1, c),
      }));
    if (level === "cat2" && c1 && c2) {
      const subs = CAT.cat3List(c1, c2);
      if (subs.length)
        return subs.map((c, i) => ({ label: c, value: 30 + i * 25, color: CAT.cat3Color(c1, c2) }));
      return [{ label: c2, value: 120, color: CAT.cat2Color(c1, c2) }];
    }
    return [];
  },
};

export const CAT_COLOR = Object.fromEntries(CAT.cat1List().map((c) => [c, CAT.cat1Color(c as string)]));
