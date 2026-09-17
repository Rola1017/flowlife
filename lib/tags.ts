export type TagGroup = {
  id: string;
  name: string;
  selectMode: "single" | "multi";
  required: boolean;
  /** 是否參與時數分攤（領域預設 true；難易度／重要性／精力需求預設 false） */
  isTimeDestination: boolean;
  /** 在番茄頁顯示為一鍵啟動的快捷按鈕 */
  quickStart?: boolean;
  order: number;
  deletedAt?: string;
};

export type Tag = {
  id: string;
  groupId: string;
  parentId?: string;
  name: string;
  color?: string;
  emoji?: string;
  noCoin?: boolean;
  order: number;
  deletedAt?: string;
};

export const TAG_GROUP_IDS = {
  domain: "tg_domain",
  difficulty: "tg_difficulty",
  importance: "tg_importance",
  energy: "tg_energy",
} as const;

export const DEFAULT_TAG_GROUPS: TagGroup[] = [
  { id: TAG_GROUP_IDS.domain, name: "領域", selectMode: "multi", required: true, isTimeDestination: true, quickStart: false, order: 0 },
  { id: TAG_GROUP_IDS.difficulty, name: "難易度", selectMode: "single", required: false, isTimeDestination: false, quickStart: false, order: 1 },
  { id: TAG_GROUP_IDS.importance, name: "重要性", selectMode: "single", required: false, isTimeDestination: false, quickStart: false, order: 2 },
  { id: TAG_GROUP_IDS.energy, name: "精力需求", selectMode: "single", required: false, isTimeDestination: false, quickStart: false, order: 3 },
];

/** 領域＝主維度，三個開關鎖定（不看名稱） */
export function isLockedGroup(g: Pick<TagGroup, "id">): boolean {
  return g.id === TAG_GROUP_IDS.domain;
}

/** 缺欄時依群組 id 給預設；已有 boolean 不覆寫（遷移冪等） */
export function withIsTimeDestination(g: TagGroup): TagGroup {
  if (typeof g.isTimeDestination === "boolean") return g;
  return { ...g, isTimeDestination: g.id === TAG_GROUP_IDS.domain };
}

export function patchTagGroupFlags(groups: TagGroup[]): { groups: TagGroup[]; changed: boolean } {
  let changed = false;
  const next = groups.map((g) => {
    let cur = g;
    if (typeof cur.isTimeDestination !== "boolean") {
      changed = true;
      cur = { ...cur, isTimeDestination: cur.id === TAG_GROUP_IDS.domain };
    }
    if (typeof cur.quickStart !== "boolean") {
      changed = true;
      cur = { ...cur, quickStart: false };
    }
    return cur;
  });
  return { groups: next, changed };
}

export function resolveIsTimeDestination(g: Pick<TagGroup, "id" | "isTimeDestination">): boolean {
  if (typeof g.isTimeDestination === "boolean") return g.isTimeDestination;
  return g.id === TAG_GROUP_IDS.domain;
}

export const DELETED_TAG_LABEL = "已刪除的標籤";

export const DEFAULT_ATTR_TAGS: Tag[] = [
  { id: "tg_diff_hard", groupId: TAG_GROUP_IDS.difficulty, name: "難", order: 0 },
  { id: "tg_diff_normal", groupId: TAG_GROUP_IDS.difficulty, name: "普通", order: 1 },
  { id: "tg_diff_easy", groupId: TAG_GROUP_IDS.difficulty, name: "易", order: 2 },
  { id: "tg_imp_high", groupId: TAG_GROUP_IDS.importance, name: "重要", order: 0 },
  { id: "tg_imp_low", groupId: TAG_GROUP_IDS.importance, name: "不重要", order: 1 },
  { id: "tg_nrg_high", groupId: TAG_GROUP_IDS.energy, name: "高專注", order: 0 },
  { id: "tg_nrg_normal", groupId: TAG_GROUP_IDS.energy, name: "普通", order: 1 },
  { id: "tg_nrg_bits", groupId: TAG_GROUP_IDS.energy, name: "零碎時間可做", order: 2 },
];

/** 分類樹節點（與 CategoryData 結構對齊，避免 tags.ts 反向依賴 categories） */
export type CategoryTreeNode = {
  id: string;
  name: string;
  color?: string;
  noCoin?: boolean;
  mids: { id: string; name: string; color?: string; subs: { id: string; name: string }[] }[];
};

export function countCategoryNodes(data: CategoryTreeNode[]): number {
  let n = 0;
  for (const big of data) {
    n += 1;
    for (const mid of big.mids) {
      n += 1;
      n += mid.subs.length;
    }
  }
  return n;
}

/** 三層分類樹 → 領域群組標籤（id 沿用、parentId 依層級） */
export function buildDomainTagsFromCategories(data: CategoryTreeNode[], groupId: string): Tag[] {
  const tags: Tag[] = [];
  data.forEach((big, bi) => {
    tags.push({
      id: big.id,
      groupId,
      name: big.name,
      color: big.color,
      noCoin: big.noCoin,
      order: bi,
    });
    big.mids.forEach((mid, mi) => {
      tags.push({
        id: mid.id,
        groupId,
        parentId: big.id,
        name: mid.name,
        color: mid.color,
        order: mi,
      });
      mid.subs.forEach((sub, si) => {
        tags.push({
          id: sub.id,
          groupId,
          parentId: mid.id,
          name: sub.name,
          order: si,
        });
      });
    });
  });
  return tags;
}

export type MigrateMapping = { path: string; oldId: string; newId: string };

export function domainMigrateMappings(data: CategoryTreeNode[]): MigrateMapping[] {
  const rows: MigrateMapping[] = [];
  for (const big of data) {
    rows.push({ path: big.name, oldId: big.id, newId: big.id });
    for (const mid of big.mids) {
      rows.push({ path: `${big.name} › ${mid.name}`, oldId: mid.id, newId: mid.id });
      for (const sub of mid.subs) {
        rows.push({ path: `${big.name} › ${mid.name} › ${sub.name}`, oldId: sub.id, newId: sub.id });
      }
    }
  }
  return rows;
}
