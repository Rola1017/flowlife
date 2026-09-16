import { loadTags } from "@/lib/tagsStore";
import type { Tag } from "@/lib/tags";

/** 陣列第一個＝主標籤 */
export function primaryTagId(tagIds?: string[]): string | undefined {
  if (!tagIds?.length) return undefined;
  const first = tagIds.find((id) => typeof id === "string" && id.trim());
  return first || undefined;
}

/** 祖先鏈（由根到該標籤，含自己） */
export function tagAncestors(tagId: string, allTags: Tag[] = loadTags()): Tag[] {
  const live = allTags.filter((t) => !t.deletedAt);
  const byId = new Map(live.map((t) => [t.id, t]));
  const chain: Tag[] = [];
  const seen = new Set<string>();
  let cur = byId.get(tagId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push(cur);
    if (!cur.parentId) break;
    cur = byId.get(cur.parentId);
  }
  return chain.reverse();
}

/** 由主標籤祖先鏈推導三層名稱（供未改造頁面使用） */
export function legacyPath(tagIds?: string[], allTags?: Tag[]): { cat1: string; cat2: string; cat3: string } {
  const pid = primaryTagId(tagIds);
  if (!pid) return { cat1: "", cat2: "", cat3: "" };
  const anc = tagAncestors(pid, allTags ?? loadTags());
  return {
    cat1: anc[0]?.name ?? "",
    cat2: anc[1]?.name ?? "",
    cat3: anc[2]?.name ?? "",
  };
}

/** 祖先鏈比對：選父命中子孫；選子不命中父的其他子。空選取＝全通過 */
export function matchesTagSelection(sel: Set<string>, tagIds?: string[], allTags?: Tag[]): boolean {
  if (sel.size === 0) return true;
  const tags = allTags ?? loadTags();
  for (const id of tagIds ?? []) {
    const ancIds = new Set(tagAncestors(id, tags).map((t) => t.id));
    for (const s of sel) {
      if (ancIds.has(s)) return true;
    }
  }
  return false;
}
