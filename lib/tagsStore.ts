import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { APP_STATE_KEYS, pushAppState } from "@/lib/appStateCloud";
import {
  TAG_GROUP_IDS,
  buildDomainTagsFromCategories,
  type CategoryTreeNode,
  type Tag,
  type TagGroup,
  withIsTimeDestination,
} from "@/lib/tags";

export function loadTagGroups(): TagGroup[] {
  const data = loadJSON<TagGroup[]>(LS_KEYS.tagGroups, []);
  if (!Array.isArray(data)) return [];
  return data.map(withIsTimeDestination);
}

export function loadTags(): Tag[] {
  const data = loadJSON<Tag[]>(LS_KEYS.tags, []);
  return Array.isArray(data) ? data : [];
}

export function saveTagGroups(data: TagGroup[]): void {
  saveJSON(LS_KEYS.tagGroups, data);
  void pushAppState(APP_STATE_KEYS.tagGroups, data);
}

export function saveTags(data: Tag[]): void {
  saveJSON(LS_KEYS.tags, data);
  void pushAppState(APP_STATE_KEYS.tags, data);
}

export function isDomainTagsMigrated(groups: TagGroup[] = loadTagGroups(), tags: Tag[] = loadTags()): boolean {
  const hasDomain = groups.some((g) => g.id === TAG_GROUP_IDS.domain && !g.deletedAt);
  const hasDomainTags = tags.some((t) => t.groupId === TAG_GROUP_IDS.domain && !t.deletedAt);
  return hasDomain && hasDomainTags;
}

/** CategoryManager 存檔時雙寫領域標籤（軟刪已不在樹上的舊 id）；尚未遷移則略過 */
export function syncDomainTagsFromCategories(data: CategoryTreeNode[], deletedAtIso: string): void {
  const groups = loadTagGroups();
  if (!groups.some((g) => g.id === TAG_GROUP_IDS.domain && !g.deletedAt)) return;

  const domainTags = buildDomainTagsFromCategories(data, TAG_GROUP_IDS.domain);
  const newIds = new Set(domainTags.map((t) => t.id));
  const prev = loadTags();
  const others = prev.filter((t) => t.groupId !== TAG_GROUP_IDS.domain);
  const keptDeleted = prev
    .filter((t) => t.groupId === TAG_GROUP_IDS.domain && !newIds.has(t.id))
    .map((t) => (t.deletedAt ? t : { ...t, deletedAt: deletedAtIso }));
  saveTags([...others, ...domainTags, ...keptDeleted]);
}
