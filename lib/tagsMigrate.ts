import { loadCategories } from "@/lib/categories";
import {
  DEFAULT_ATTR_TAGS,
  DEFAULT_TAG_GROUPS,
  TAG_GROUP_IDS,
  buildDomainTagsFromCategories,
  countCategoryNodes,
  domainMigrateMappings,
  type MigrateMapping,
  type Tag,
  type TagGroup,
} from "@/lib/tags";
import { isDomainTagsMigrated, loadTagGroups, loadTags, saveTagGroups, saveTags } from "@/lib/tagsStore";

function mergeGroups(existing: TagGroup[], defaults: TagGroup[]): TagGroup[] {
  const byId = new Map(existing.map((g) => [g.id, g]));
  const out = [...existing];
  for (const g of defaults) {
    if (!byId.has(g.id)) out.push(g);
  }
  return out;
}

function mergeAttrTags(existing: Tag[]): Tag[] {
  const byId = new Set(existing.map((t) => t.id));
  const extra = DEFAULT_ATTR_TAGS.filter((t) => !byId.has(t.id));
  return extra.length ? [...existing, ...extra] : existing;
}

export type TagsMigrateResult = {
  skipped: boolean;
  oldCount: number;
  newCount: number;
  groups: TagGroup[];
  tags: Tag[];
  mappings: MigrateMapping[];
};

/** 純函式：已遷移則 skipped；否則組出新 groups/tags（不寫 LS、不推雲） */
export function applyTagsMigration(
  cats: { id: string; name: string; color?: string; noCoin?: boolean; mids: { id: string; name: string; color?: string; subs: { id: string; name: string }[] }[] }[],
  groups: TagGroup[],
  tags: Tag[],
): TagsMigrateResult {
  if (isDomainTagsMigrated(groups, tags)) {
    return { skipped: true, oldCount: 0, newCount: 0, groups, tags, mappings: [] };
  }
  const domainTags = buildDomainTagsFromCategories(cats, TAG_GROUP_IDS.domain);
  const oldCount = countCategoryNodes(cats);
  const newCount = domainTags.length;
  const kept = tags.filter((t) => t.groupId !== TAG_GROUP_IDS.domain);
  return {
    skipped: false,
    oldCount,
    newCount,
    groups: mergeGroups(groups, DEFAULT_TAG_GROUPS),
    tags: mergeAttrTags([...kept, ...domainTags]),
    mappings: domainMigrateMappings(cats),
  };
}

/** 一次性、冪等：分類樹 → 領域標籤＋四個預設群組（寫入走 tagsStore／pushAppState） */
export function ensureTagsMigrated(): TagsMigrateResult {
  const result = applyTagsMigration(loadCategories(), loadTagGroups(), loadTags());
  if (result.skipped) return result;

  saveTagGroups(result.groups);
  saveTags(result.tags);

  console.info("[FlowLife tags migrate] 分類 → 標籤對照");
  for (const row of result.mappings) {
    console.info(`  ${row.path}  (${row.oldId}) → ${row.newId}`);
  }
  console.info(`[FlowLife tags migrate] 舊分類 ${result.oldCount} 筆 → 新標籤 ${result.newCount} 筆`);
  if (result.oldCount !== result.newCount) {
    console.warn(
      `[FlowLife tags migrate] 警告：舊分類總數 (${result.oldCount}) 與新標籤總數 (${result.newCount}) 不相等`,
    );
  }

  return result;
}
