import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";

export type SmallCat = string;
export type MidCat = { name: string; subs: SmallCat[] };
export type BigCat = { name: string; color: string; mids: MidCat[] };
export type CategoryData = BigCat[];

export const DEFAULT_CATEGORIES: CategoryData = [
  {
    name: "學習",
    color: "#F59E0B",
    mids: [
      { name: "法律", subs: ["勞動社會法", "保險法", "民法", "行政法", "刑法", "民事訴訟法"] },
      { name: "保險", subs: ["意外險", "醫療險", "儲蓄險"] },
      { name: "英文", subs: ["口說", "文法", "寫作"] },
    ],
  },
  {
    name: "事業",
    color: "#3B82F6",
    mids: [
      { name: "架網站", subs: [] },
      { name: "知識萃取", subs: [] },
    ],
  },
  {
    name: "閱讀",
    color: "#06B6D4",
    mids: [
      { name: "溝通術", subs: [] },
      { name: "情緒療癒", subs: [] },
      { name: "學習技巧", subs: [] },
      { name: "金融", subs: ["投資", "經濟學"] },
      { name: "商業", subs: [] },
    ],
  },
  {
    name: "健康",
    color: "#10B981",
    mids: [
      { name: "重訓", subs: [] },
      { name: "有氧", subs: [] },
    ],
  },
  {
    name: "兼差",
    color: "#8B5CF6",
    mids: [
      { name: "兼差A", subs: [] },
      { name: "兼差B", subs: [] },
    ],
  },
  {
    name: "活動",
    color: "#EC4899",
    mids: [
      { name: "展覽", subs: [] },
      { name: "旅遊", subs: [] },
      { name: "聚會", subs: [] },
    ],
  },
  { name: "未分類", color: "#6B7280", mids: [] },
];

const SMALL_CAT_PALETTE = [
  "#EF4444",
  "#F97316",
  "#84CC16",
  "#06B6D4",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F59E0B",
  "#3B82F6",
  "#10B981",
];

export function cat2Color(parentHex: string, index: number): string {
  const blend = Math.min(index * 0.2, 0.6);
  const r = parseInt(parentHex.slice(1, 3), 16);
  const g = parseInt(parentHex.slice(3, 5), 16);
  const b = parseInt(parentHex.slice(5, 7), 16);
  const nr = Math.round(r + (255 - r) * blend);
  const ng = Math.round(g + (255 - g) * blend);
  const nb = Math.round(b + (255 - b) * blend);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

export function cat3Color(index: number): string {
  return SMALL_CAT_PALETTE[index % SMALL_CAT_PALETTE.length];
}

export function loadCategories(): CategoryData {
  return loadJSON<CategoryData>(LS_KEYS.categories, DEFAULT_CATEGORIES);
}

export function saveCategories(data: CategoryData): void {
  saveJSON(LS_KEYS.categories, data);
}

export const CAT = {
  cat1List: () => loadCategories().map((c) => c.name),
  cat1Color: (name: string) => loadCategories().find((c) => c.name === name)?.color ?? "#6B7280",
  cat2List: (cat1: string) => loadCategories().find((c) => c.name === cat1)?.mids.map((m) => m.name) ?? [],
  cat2Color: (cat1: string, cat2: string) => {
    const big = loadCategories().find((c) => c.name === cat1);
    if (!big) return "#6B7280";
    const idx = big.mids.findIndex((m) => m.name === cat2);
    return cat2Color(big.color, Math.max(idx, 0));
  },
  cat3List: (cat1: string, cat2: string) =>
    loadCategories().find((c) => c.name === cat1)?.mids.find((m) => m.name === cat2)?.subs ?? [],
  cat3Color: (cat1: string, cat2: string, cat3: string) => {
    const subs =
      loadCategories()
        .find((c) => c.name === cat1)
        ?.mids.find((m) => m.name === cat2)?.subs ?? [];
    const idx = subs.indexOf(cat3);
    return cat3Color(Math.max(idx, 0));
  },
  deepColor: (cat1: string, cat2?: string) => (cat2 ? CAT.cat2Color(cat1, cat2) : CAT.cat1Color(cat1)),
  chartDataFor: (level: string, cat1?: string, cat2?: string) => {
    const cats = loadCategories();
    if (level === "all")
      return cats
        .filter((c) => c.name !== "未分類")
        .map((c, i) => ({ label: c.name, value: 120 + i * 55, color: c.color }));
    if (level === "cat1" && cat1) {
      const big = cats.find((c) => c.name === cat1);
      return (
        big?.mids.map((m, i) => ({
          label: m.name,
          value: 80 + i * 40,
          color: cat2Color(big.color, i),
        })) ?? []
      );
    }
    if (level === "cat2" && cat1 && cat2) {
      const subs = CAT.cat3List(cat1, cat2);
      if (subs.length)
        return subs.map((c, i) => ({
          label: c,
          value: 30 + i * 25,
          color: CAT.cat3Color(cat1, cat2, c),
        }));
      return [{ label: cat2, value: 120, color: CAT.cat2Color(cat1, cat2) }];
    }
    return [];
  },
};

export function catColorMap(): Record<string, string> {
  return Object.fromEntries(CAT.cat1List().map((c) => [c, CAT.cat1Color(c)]));
}

/** @deprecated 請改用 catColorMap() 或 CAT.cat1Color */
export const CAT_COLOR = new Proxy({} as Record<string, string>, {
  get: (_t, prop: string) => CAT.cat1Color(prop),
});
