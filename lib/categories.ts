import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";

export type SmallCat = string;
export type MidCat = { name: string; color: string; subs: SmallCat[] };
export type BigCat = { name: string; color: string; mids: MidCat[] };
export type CategoryData = BigCat[];

export const DEFAULT_CATEGORIES: CategoryData = [
  {
    name: "學習",
    color: "#FFFF37",
    mids: [
      { name: "法律", color: "#a154e8", subs: ["勞動社會法", "保險法", "民法", "行政法", "刑法", "民事訴訟法"] },
      { name: "保險", color: "#93571b", subs: ["意外險", "醫療險", "儲蓄險"] },
      { name: "英文", color: "#ec69ec", subs: ["口說", "文法", "寫作"] },
    ],
  },
  {
    name: "事業",
    color: "#0000E3",
    mids: [
      { name: "架網站", color: "#2a2ac6", subs: [] },
      { name: "知識萃取", color: "#6868df", subs: [] },
    ],
  },
  {
    name: "閱讀",
    color: "#a154e8",
    mids: [
      { name: "溝通術", color: "#2382e1", subs: [] },
      { name: "情緒療癒", color: "#d18fc9", subs: [] },
      { name: "學習技巧", color: "#46A3FF", subs: [] },
      { name: "金融", color: "#FFFF37", subs: ["投資", "經濟學"] },
      { name: "商業", color: "#1010e0", subs: [] },
    ],
  },
  {
    name: "健康",
    color: "#00EC00",
    mids: [
      { name: "重訓", color: "#f33535", subs: [] },
      { name: "有氧", color: "#5df95d", subs: [] },
    ],
  },
  {
    name: "兼差",
    color: "#AD5A5A",
    mids: [
      { name: "兼差A", color: "#ec8383", subs: [] },
      { name: "兼差B", color: "#6b3333", subs: [] },
    ],
  },
  {
    name: "活動",
    color: "#350561",
    mids: [
      { name: "展覽", color: "#C2FF68", subs: [] },
      { name: "旅遊", color: "#4DFFFF", subs: [] },
      { name: "聚會", color: "#93571b", subs: [] },
    ],
  },
  { name: "未分類", color: "#9D9D9D", mids: [] },
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

/** @deprecated 舊小分類色盤，新資料請用 cat3ColorFrom */
export function cat3Color(index: number): string {
  return SMALL_CAT_PALETTE[index % SMALL_CAT_PALETTE.length];
}

export function blendToWhite(hex: string, factor: number): string {
  const f = Math.min(Math.max(factor, 0), 1);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r + (255 - r) * f);
  const ng = Math.round(g + (255 - g) * f);
  const nb = Math.round(b + (255 - b) * f);
  return "#" + [nr, ng, nb].map((n) => n.toString(16).padStart(2, "0")).join("");
}

/**
 * 將 baseHex 與 blendHex 混合，factor = 混入比例（0~1）
 */
function blendColors(baseHex: string, blendHex: string, factor: number): string {
  const f = Math.min(Math.max(factor, 0), 1);
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(baseHex);
  const [r2, g2, b2] = parse(blendHex);
  const nr = Math.round(r1 + (r2 - r1) * f);
  const ng = Math.round(g1 + (g2 - g1) * f);
  const nb = Math.round(b1 + (b2 - b1) * f);
  return "#" + [nr, ng, nb].map((n) => n.toString(16).padStart(2, "0")).join("");
}

/**
 * 小分類顏色：繼承中分類，依 index 混入不同色調
 * index 0 → 與中分類完全相同
 * index 1 → 混入白色
 * index 2 → 混入紅色
 * index 3 → 混入橙色
 * index 4 → 混入黃色
 * index 5 → 混入綠色
 * index 6 → 混入藍色
 * index 7 → 混入靛色
 * index 8 → 混入紫色
 * index 9 → 混入黑色
 * index 10+ → 循環（index % 10）
 */
export function cat3ColorFrom(cat2Hex: string, index: number): string {
  const i = index % 10;
  const BLEND_TARGETS: string[] = [
    cat2Hex, // 0：完全相同
    "#FFFFFF", // 1：白
    "#FF0000", // 2：紅
    "#FF8000", // 3：橙
    "#FFFF00", // 4：黃
    "#00CC00", // 5：綠
    "#0000FF", // 6：藍
    "#3B0080", // 7：靛
    "#8B00FF", // 8：紫
    "#000000", // 9：黑
  ];
  if (i === 0) return cat2Hex;
  return blendColors(cat2Hex, BLEND_TARGETS[i], 0.35);
}

export function loadCategories(): CategoryData {
  const data = loadJSON<CategoryData>(LS_KEYS.categories, DEFAULT_CATEGORIES);
  return data.map((big) => ({
    ...big,
    mids: big.mids.map((mid, mi) => ({
      ...mid,
      color: (mid as MidCat & { color?: string }).color ?? cat2Color(big.color, mi),
    })),
  }));
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
    const mid = big?.mids.find((m) => m.name === cat2);
    return mid?.color ?? "#6B7280";
  },
  cat3List: (cat1: string, cat2: string) =>
    loadCategories().find((c) => c.name === cat1)?.mids.find((m) => m.name === cat2)?.subs ?? [],
  cat3Color: (cat1: string, cat2: string, cat3: string) => {
    const big = loadCategories().find((c) => c.name === cat1);
    const mid = big?.mids.find((m) => m.name === cat2);
    if (!mid) return "#6B7280";
    const idx = mid.subs.indexOf(cat3);
    return cat3ColorFrom(mid.color, Math.max(idx, 0));
  },
  deepColor: (cat1: string, cat2?: string) => (cat2 ? CAT.cat2Color(cat1, cat2) : CAT.cat1Color(cat1)),
  deepColorFull: (cat1: string, cat2?: string, cat3?: string) => {
    if (cat3 && cat2) return CAT.cat3Color(cat1, cat2, cat3);
    if (cat2) return CAT.cat2Color(cat1, cat2);
    return CAT.cat1Color(cat1);
  },
};

export function catColorMap(): Record<string, string> {
  return Object.fromEntries(CAT.cat1List().map((c) => [c, CAT.cat1Color(c)]));
}

/** @deprecated 請改用 catColorMap() 或 CAT.cat1Color */
export const CAT_COLOR = new Proxy({} as Record<string, string>, {
  get: (_t, prop: string) => CAT.cat1Color(prop),
});
