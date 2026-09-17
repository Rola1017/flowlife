import type { Tag, TagGroup } from "@/lib/tags";
import { DELETED_TAG_LABEL, TAG_GROUP_IDS } from "@/lib/tags";
import { CAT } from "@/lib/categories";
import { liveGroups, childrenOf } from "@/lib/tagTree";
import { legacyPath, primaryTagId, tagChain } from "@/lib/tagsCompat";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";

export const UNCATEGORIZED_COLOR = "#6B7280";
export const TAG_COMBO_MAX = 5;

export type TagSel = { tagIds: string[]; cat1: string; cat2: string; cat3: string };

export function selFromTagIds(tagIds: string[], allTags?: Tag[]): TagSel {
  const ids = tagIds.filter((id) => typeof id === "string" && id.trim());
  return { tagIds: ids, ...legacyPath(ids, allTags) };
}

export function missingRequiredGroupNames(
  tagIds: string[],
  groups: TagGroup[],
  tags: Tag[],
): string[] {
  const selected = new Set(tagIds);
  const byId = new Map(tags.map((t) => [t.id, t]));
  return liveGroups(groups)
    .filter((g) => g.required)
    .filter((g) => {
      for (const id of selected) {
        const t = byId.get(id);
        if (t && !t.deletedAt && t.groupId === g.id) return false;
      }
      return true;
    })
    .map((g) => g.name);
}

export function canStartWithTags(tagIds: string[], groups: TagGroup[], tags: Tag[]): boolean {
  return missingRequiredGroupNames(tagIds, groups, tags).length === 0;
}

export function isNoCoinByTagIds(tagIds?: string[], allTags?: Tag[]): boolean {
  const pid = primaryTagId(tagIds);
  if (!pid) return false;
  return tagChain(pid, allTags).some((t) => t.noCoin === true);
}

export function sessionNoCoin(s: { tagIds?: string[]; cat1?: string }, allTags?: Tag[]): boolean {
  if (s.tagIds?.length) return isNoCoinByTagIds(s.tagIds, allTags);
  return CAT.isNoCoin(s.cat1 ?? "");
}

export function comboKey(tagIds: string[]): string {
  return tagIds.join("\u001f");
}

/** 去重、最新在前、上限 max */
export function pushRecentCombo(list: string[][], tagIds: string[], max = TAG_COMBO_MAX): string[][] {
  const ids = tagIds.filter((id) => typeof id === "string" && id.trim());
  if (!ids.length) return list.slice(0, max);
  const key = comboKey(ids);
  const rest = list.filter((c) => comboKey(c) !== key);
  return [[...ids], ...rest].slice(0, max);
}

export function loadTagCombos(): string[][] {
  const data = loadJSON<string[][]>(LS_KEYS.tagCombos, []);
  if (!Array.isArray(data)) return [];
  return data.filter((c) => Array.isArray(c) && c.length).slice(0, TAG_COMBO_MAX);
}

export function rememberTagCombo(tagIds: string[]): string[][] {
  const next = pushRecentCombo(loadTagCombos(), tagIds);
  saveJSON(LS_KEYS.tagCombos, next);
  return next;
}

export function primaryTagColor(tagIds?: string[], allTags?: Tag[]): string {
  const pid = primaryTagId(tagIds);
  if (!pid) return UNCATEGORIZED_COLOR;
  const chain = tagChain(pid, allTags);
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].color) return chain[i].color as string;
  }
  return UNCATEGORIZED_COLOR;
}

export function primaryTagEmoji(tagIds?: string[], allTags?: Tag[]): string {
  const pid = primaryTagId(tagIds);
  if (!pid) return "";
  const chain = tagChain(pid, allTags);
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].emoji) return chain[i].emoji as string;
  }
  return "";
}

export function tagPathLabel(tagId: string, allTags: Tag[]): string {
  const chain = tagChain(tagId, allTags);
  if (!chain.length) return DELETED_TAG_LABEL;
  return chain.map((t) => (t.deletedAt ? DELETED_TAG_LABEL : t.name)).join(" › ");
}

/** 主標籤鏈的最深一層名稱（例：學習›法律›勞健保 → 勞健保）。無標籤回「未分類」。 */
export function tagLeafLabel(tagIds?: string[], allTags?: Tag[]): string {
  const pid = primaryTagId(tagIds);
  if (!pid) return "未分類";
  const chain = tagChain(pid, allTags);
  if (!chain.length) return DELETED_TAG_LABEL;
  const last = chain[chain.length - 1];
  return last.deletedAt ? DELETED_TAG_LABEL : last.name;
}

/** 主標題（葉）＋完整路徑；無 tagIds 時 fallback cat1/2/3 */
export function sessionCatLabels(
  s: { tagIds?: string[]; cat1?: string; cat2?: string; cat3?: string },
  allTags?: Tag[],
): { leaf: string; path: string } {
  if (s.tagIds?.length) {
    const pid = primaryTagId(s.tagIds);
    const tags = allTags ?? [];
    return {
      leaf: tagLeafLabel(s.tagIds, tags),
      path: pid ? tagPathLabel(pid, tags) : "",
    };
  }
  const parts = [s.cat1, s.cat2, s.cat3].filter((x): x is string => !!x && !!x.trim());
  if (!parts.length) return { leaf: "未分類", path: "" };
  return { leaf: parts[parts.length - 1], path: parts.join(" › ") };
}

export function demoGroupHints(g: Pick<TagGroup, "required" | "selectMode" | "isTimeDestination">): {
  required: string;
  selectMode: string;
  timeDest: string;
} {
  return {
    required: g.required
      ? "💡 這個維度有打開『必填』，所以沒選就不能開始番茄"
      : "💡 這個維度沒有『必填』，可以不選",
    selectMode:
      g.selectMode === "multi"
        ? "💡 這個維度打開了『可多選』，所以能勾好幾個"
        : "💡 這個維度是單選，點另一個會換掉原本的",
    timeDest: g.isTimeDestination
      ? "💡 打開了『計時數』，時間會分攤給這個維度的標籤"
      : "💡 沒有『計時數』，時間不會分給它，但可以用來篩選",
  };
}

/** 多選：不自動選父。單選：同維度只留一個。領域（isTimeDestination）優先當主標籤以免 cat1 寫成屬性名。 */
export function addTagToSelection(
  tagIds: string[],
  id: string,
  tags: Tag[],
  groups: TagGroup[],
): string[] {
  const tag = tags.find((t) => t.id === id && !t.deletedAt);
  if (!tag) return tagIds;
  const g = groups.find((x) => x.id === tag.groupId);
  let next = tagIds.filter((x) => x !== id);
  if (g?.selectMode === "single") {
    next = next.filter((x) => tags.find((t) => t.id === x)?.groupId !== tag.groupId);
  }
  const dest = g?.isTimeDestination === true;
  const primary = tags.find((t) => t.id === next[0]);
  const primaryDest = primary ? groups.find((x) => x.id === primary.groupId)?.isTimeDestination === true : false;
  if (dest && !primaryDest) return [id, ...next];
  return [...next, id];
}

export function removeTagFromSelection(tagIds: string[], id: string): string[] {
  return tagIds.filter((x) => x !== id);
}

/** 多選／單選共用：已選再點＝取消 */
export function toggleTagInSelection(
  tagIds: string[],
  id: string,
  tags: Tag[],
  groups: TagGroup[],
): string[] {
  if (tagIds.includes(id)) return removeTagFromSelection(tagIds, id);
  return addTagToSelection(tagIds, id, tags, groups);
}

export function toggleSingleTag(tagIds: string[], id: string, tags: Tag[], groups: TagGroup[]): string[] {
  return toggleTagInSelection(tagIds, id, tags, groups);
}

export function promoteTagInSelection(tagIds: string[], id: string): string[] {
  if (!tagIds.includes(id)) return tagIds;
  return [id, ...tagIds.filter((x) => x !== id)];
}

export function tagsOfGroup(tagIds: string[], groupId: string, tags: Tag[]): string[] {
  return tagIds.filter((id) => tags.find((t) => t.id === id)?.groupId === groupId);
}

/** 最近組合分層：領域（或 isTimeDestination） vs 其他維度 */
export function splitComboLayers(
  tagIds: string[],
  tags: Tag[],
  groups: TagGroup[],
): { domain: string[]; rest: string[] } {
  const domain: string[] = [];
  const rest: string[] = [];
  const gById = new Map(groups.map((g) => [g.id, g]));
  for (const id of tagIds) {
    const tag = tags.find((t) => t.id === id);
    const g = tag ? gById.get(tag.groupId) : undefined;
    const isDomain = g?.id === TAG_GROUP_IDS.domain || g?.isTimeDestination === true;
    if (isDomain) domain.push(id);
    else rest.push(id);
  }
  return { domain, rest };
}

/** 專案維度＝計時數打開、且非必填（領域是必填＋計時數；不寫死名稱「專案」） */
export function isProjectGroup(g: TagGroup): boolean {
  return !g.deletedAt && g.isTimeDestination === true && g.required !== true;
}

export function projectGroups(groups: TagGroup[]): TagGroup[] {
  return liveGroups(groups).filter(isProjectGroup);
}

/** 專案維度底下未刪除的葉標籤（有子層的只顯示葉子） */
export function projectLeafTags(tags: Tag[], groups: TagGroup[]): Tag[] {
  const out: Tag[] = [];
  for (const g of projectGroups(groups)) {
    const walk = (parentId: string | undefined) => {
      const kids = childrenOf(tags, parentId, g.id);
      for (const k of kids) {
        const nested = childrenOf(tags, k.id, g.id);
        if (nested.length === 0) out.push(k);
        else walk(k.id);
      }
    };
    walk(undefined);
  }
  return out;
}

/** 最近組合裡最新一筆包含該標籤者；找不到回 null */
export function latestComboContaining(combos: string[][], tagId: string): string[] | null {
  for (const c of combos) {
    if (c.includes(tagId)) return [...c];
  }
  return null;
}

/** 有組合用整組；從未用過則只帶該專案標籤 */
export function tagIdsForProjectShortcut(combos: string[][], tagId: string): string[] {
  return latestComboContaining(combos, tagId) ?? [tagId];
}
