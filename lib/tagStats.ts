import type { Tag } from "@/lib/tags";

/**
 * 同群組內平均分攤。只分攤指定群組內的標籤；餘數依 tagIds 順序補給前面幾個各 +1。
 * nowIso 等時間相關一律由呼叫端傳入，禁止在此使用 new Date()。
 */
export function splitMinutesByGroup(
  minutes: number,
  tagIds: string[],
  groupId: string,
  allTags: Tag[],
): { tagId: string; minutes: number }[] {
  const inGroup = new Set(
    allTags.filter((t) => t.groupId === groupId && !t.deletedAt).map((t) => t.id),
  );
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of tagIds) {
    if (!inGroup.has(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (ids.length === 0) return [];
  const n = ids.length;
  const base = Math.floor(minutes / n);
  const rem = minutes % n;
  return ids.map((tagId, i) => ({ tagId, minutes: base + (i < rem ? 1 : 0) }));
}
