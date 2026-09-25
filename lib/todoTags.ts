import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { TAG_GROUP_IDS, UNCATEGORIZED_TAG_NAME, isUncategorizedRoot, type Tag } from "@/lib/tags";
import { legacyPath } from "@/lib/tagsCompat";
import { loadTags } from "@/lib/tagsStore";
import type { Todo } from "@/lib/types";

export function domainRootTags(allTags: Tag[]): Tag[] {
  return allTags.filter(
    (t) => t.groupId === TAG_GROUP_IDS.domain && !t.deletedAt && !t.parentId,
  );
}

/** 活著的領域根：名稱 → id。重名回 duplicate 名單。 */
export function domainRootNameMap(allTags: Tag[]): { map: Map<string, string>; duplicates: string[] } {
  const map = new Map<string, string>();
  const duplicates: string[] = [];
  for (const t of domainRootTags(allTags)) {
    if (map.has(t.name)) duplicates.push(t.name);
    else map.set(t.name, t.id);
  }
  return { map, duplicates };
}

export function hasDomainTag(tagIds: string[] | undefined, allTags: Tag[]): boolean {
  if (!tagIds?.length) return false;
  const byId = new Map(allTags.map((t) => [t.id, t]));
  return tagIds.some((id) => {
    const t = byId.get(id);
    return Boolean(t && !t.deletedAt && t.groupId === TAG_GROUP_IDS.domain);
  });
}

export function uncategorizedRootTagId(allTags: Tag[] = loadTags()): string {
  const hit = allTags.find(
    (t) => t.groupId === TAG_GROUP_IDS.domain && !t.deletedAt && isUncategorizedRoot(t),
  );
  if (hit) return hit.id;
  return DEFAULT_CATEGORIES.find((c) => c.name === UNCATEGORIZED_TAG_NAME)?.id ?? "";
}

/** 顯示／篩選用：有 tagIds 用它；否則用 cat 名對領域根。 */
export function resolveTodoTagIds(t: { tagIds?: string[]; cat?: string }, allTags: Tag[]): string[] {
  if (t.tagIds?.length) return t.tagIds.filter((id) => typeof id === "string" && id.trim());
  const { map } = domainRootNameMap(allTags);
  const id = map.get(t.cat ?? "");
  return id ? [id] : [];
}

/** 有 tagIds → 雙寫 cat（Z8 前）；無則不動。 */
export function stampTodoTags(t: Todo, allTags?: Tag[]): Todo {
  if (!t.tagIds?.length) return t;
  const path = legacyPath(t.tagIds, allTags);
  return {
    ...t,
    tagIds: t.tagIds,
    cat: path.cat1 || t.cat || UNCATEGORIZED_TAG_NAME,
  };
}
