import { LS_KEYS, loadJSON, saveJSON, snapshotForS2 } from "@/lib/storage";
import { APP_STATE_KEYS, pushAppState } from "@/lib/appStateCloud";

export type SmallCat = { id: string; name: string };
export type MidCat = { id: string; name: string; color: string; subs: SmallCat[] };
export type BigCat = { id: string; name: string; color: string; mids: MidCat[] };
export type CategoryData = BigCat[];

export const DEFAULT_CATEGORIES: BigCat[] = [
  {
    name: "學習",
    color: "#FFFF37",
    id: "b1dbddc9-fb0e-4db7-b2ff-9c120f4a0a93",
    mids: [
      {
        name: "法律",
        color: "#4444f8",
        id: "99c789ba-d4e8-4f7a-826f-906d96a1d5e3",
        subs: [
          { id: "d3084363-57d9-40fc-8c88-daaa09fa49be", name: "勞健保暨勞動法規管理師" },
          { id: "0c26061f-0229-425e-b43e-3f259ec08c4f", name: "乙級技術士（紅人學院許朝茂老師）" },
          { id: "5827b6cc-2ade-4351-805c-5f1afb62a991", name: "謝清風老師" },
          { id: "923fdc72-379c-4a7b-b734-60080096e53f", name: "沈以軒律師團隊" },
        ],
      },
      {
        name: "英文",
        color: "#ec69ec",
        id: "57e5ab7d-15e1-4356-bf94-7b2a74357696",
        subs: [
          { id: "1411c24c-d4dc-4915-8fec-5f18e8ae99f0", name: "聽力" },
          { id: "b8d06c26-66d1-4643-9a52-b873e37d6e3c", name: "寫作" },
        ],
      },
      {
        name: "線上課",
        color: "#41764c",
        id: "0140a964-5627-44eb-b4ea-9a11e29cd2e6",
        subs: [
          { id: "29b7e978-43ad-4999-8c4a-af3c64438a20", name: "雷蒙claude迷你課" },
          { id: "944c5fe2-e80b-40fa-9b8b-b8b9952f47dc", name: "卡片盒" },
          { id: "d1880c1a-01db-49d1-bc66-a23fe079f603", name: "金頭腦" },
          { id: "5f646ee2-40fb-417b-9518-221d71ebbc9f", name: "雷蒙超級個體術" },
          { id: "d104df7e-c376-4b01-9a88-05aff72aba69", name: "n8n超級個體包" },
          { id: "e3acb34f-e4ce-4493-8ae5-32bbd31929ec", name: "30 種零門檻 AI 工作應用術" },
        ],
      },
      {
        name: "保險",
        color: "#93571b",
        id: "d0a29a9d-b9ae-4a64-b257-3254e69cf578",
        subs: [
          { id: "d1d58736-16eb-4901-ace4-00b3bba5be8c", name: "意外險" },
          { id: "5bd3eba4-269e-4465-901b-598536791c46", name: "醫療險" },
          { id: "f49a709b-3a21-4f6a-8866-243d32353dcf", name: "儲蓄險" },
        ],
      },
      { name: "RemNote復習", color: "#85b1db", id: "09e2adc5-dcb0-4cb1-85ca-665d047df672", subs: [] },
    ],
  },
  {
    name: "事業",
    color: "#4DFFFF",
    id: "3eebe052-5748-44e0-89b1-0d3525284de6",
    mids: [
      { name: "架設網站", color: "#46A3FF", id: "eaaae17b-7ce8-4d89-bcf5-1453af16cc86", subs: [] },
      { name: "知識萃取", color: "#6868df", id: "0c743144-b3e0-4911-9ad0-8904b995f727", subs: [] },
    ],
  },
  {
    name: "閱讀",
    color: "#4EFEB3",
    id: "a84b9136-9426-4952-b955-9188e7b69a12",
    mids: [
      { name: "溝通術", color: "#2382e1", id: "f2e5b7ff-b278-42a9-9a2d-50dedd4f8ae7", subs: [] },
      { name: "情緒療癒", color: "#d18fc9", id: "63d08bcf-6c19-4d37-a5b3-c46bcd6cdbaf", subs: [] },
      { name: "學習技巧", color: "#46A3FF", id: "a70296b5-f0b6-4711-a9c4-a1c8ab39d906", subs: [] },
      {
        name: "金融",
        color: "#FFFF37",
        id: "1f1c2d1b-4c66-4761-a9e8-7dbc4a3c5f2f",
        subs: [
          { id: "90b5d31d-dbca-486d-b336-fb25e09e4676", name: "投資" },
          { id: "1cedf0f7-442e-4506-9c94-16fd27c65494", name: "經濟學" },
        ],
      },
      { name: "商業", color: "#1010e0", id: "9efc0d4c-ad6f-478c-a568-61f78848c232", subs: [] },
    ],
  },
  {
    name: "健康",
    color: "#00EC00",
    id: "c310502a-299b-423e-86a8-0765bc0d6d40",
    mids: [
      { name: "重訓", color: "#f33535", id: "324f3116-5c1d-4dc4-9ca8-70523c885282", subs: [] },
      { name: "有氧", color: "#5df95d", id: "665d5c58-cb97-4ac0-9443-7ef56517c74f", subs: [] },
    ],
  },
  {
    name: "兼差",
    color: "#3e3d3d",
    id: "afe8c121-2aeb-4467-8518-0b8f50e3b39f",
    mids: [
      { name: "彩券行", color: "#ec8383", id: "e98a7e74-6356-438b-ba1b-02492e450353", subs: [] },
      { name: "診所", color: "#6b3333", id: "800db2c6-ae45-48c7-94ad-e5876465b32c", subs: [] },
    ],
  },
  {
    name: "活動",
    color: "#5b2191",
    id: "aad5ebfb-470c-45a0-baf8-e050d670f2af",
    mids: [
      { name: "展覽", color: "#C2FF68", id: "b0ada8e1-cfef-4fc2-8679-372abc915a59", subs: [] },
      { name: "旅遊", color: "#4DFFFF", id: "a2d811b1-b034-4e20-b0dc-61b6117bab52", subs: [] },
      { name: "聚會", color: "#93571b", id: "591648dc-38a4-4ee7-aa97-80030cde154d", subs: [] },
    ],
  },
  { name: "未分類", color: "#9D9D9D", id: "cd6c4a3d-08cd-42d5-aef3-440b87058d10", mids: [] },
];

function genCatId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** 把單一 sub 正規化為 { id, name }，同時吃舊格式 string 與缺 id 的物件 */
function normalizeSub(sub: unknown): SmallCat {
  if (typeof sub === "string") return { id: genCatId(), name: sub };
  const o = sub as Partial<SmallCat>;
  return { id: o.id || genCatId(), name: o.name ?? "" };
}

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
    id: big.id || genCatId(),
    mids: big.mids.map((mid, mi) => ({
      ...mid,
      id: mid.id || genCatId(),
      color: (mid as MidCat & { color?: string }).color ?? cat2Color(big.color, mi),
      subs: (mid.subs ?? []).map(normalizeSub),
    })),
  }));
}

export function saveCategories(data: CategoryData): void {
  saveJSON(LS_KEYS.categories, data);
  void pushAppState(APP_STATE_KEYS.categories, data);
}

/** 由名字解析出分類穩定編號（找不到回 undefined） */
export function resolveCatIds(
  cat1: string,
  cat2?: string,
  cat3?: string,
): { cat1Id?: string; cat2Id?: string; cat3Id?: string } {
  const data = loadCategories();
  const big = data.find((c) => c.name === cat1);
  const mid = cat2 ? big?.mids.find((m) => m.name === cat2) : undefined;
  const sml = cat3 && mid ? mid.subs.find((s) => s.name === cat3) : undefined;
  return { cat1Id: big?.id, cat2Id: mid?.id, cat3Id: sml?.id };
}

/** S2-1/1b：為既有存檔的 big/mid/small 補上穩定 id（先備份、冪等、有變動才寫檔） */
export function migrateCategoryIds(): void {
  snapshotForS2();
  const data = loadJSON<CategoryData>(LS_KEYS.categories, DEFAULT_CATEGORIES);
  let changed = false;
  for (const big of data) {
    if (!big.id) {
      big.id = genCatId();
      changed = true;
    }
    for (const mid of big.mids) {
      if (!mid.id) {
        mid.id = genCatId();
        changed = true;
      }
      const rawSubs = (mid.subs ?? []) as unknown[];
      mid.subs = rawSubs.map((sub) => {
        if (typeof sub === "string") {
          changed = true;
          return { id: genCatId(), name: sub };
        }
        const o = sub as Partial<SmallCat>;
        if (!o.id) {
          changed = true;
          return { id: genCatId(), name: o.name ?? "" };
        }
        return o as SmallCat;
      });
    }
  }
  if (changed) saveCategories(data);
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
    loadCategories()
      .find((c) => c.name === cat1)
      ?.mids.find((m) => m.name === cat2)
      ?.subs.map((s) => s.name) ?? [],
  cat3Color: (cat1: string, cat2: string, cat3: string) => {
    const big = loadCategories().find((c) => c.name === cat1);
    const mid = big?.mids.find((m) => m.name === cat2);
    if (!mid) return "#6B7280";
    const idx = mid.subs.findIndex((s) => s.name === cat3);
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
