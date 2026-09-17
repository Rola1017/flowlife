import {
  DELETED_TAG_LABEL,
  TAG_GROUP_IDS,
  type Tag,
  type TagGroup,
} from "@/lib/tags";
import { moveItem } from "@/lib/utils";

/** 走訪深度上限，防止成環時無限迴圈 */
export const TAG_WALK_MAX_DEPTH = 64;

/** UI 樹遞迴顯示上限（超過即停，避免成環把畫面卡死） */
export const TAG_TREE_RENDER_MAX_DEPTH = 20;

export { DELETED_TAG_LABEL };

export type CatRef = { cat1?: string; cat2?: string; cat3?: string; cat1Id?: string; cat2Id?: string; cat3Id?: string };

export type TagUsageCounts = { sessions: number; todos: number; schedule: number };

export function liveTags(tags: Tag[]): Tag[] {
  return tags.filter((t) => !t.deletedAt);
}

export function liveGroups(groups: TagGroup[]): TagGroup[] {
  return groups.filter((g) => !g.deletedAt).slice().sort((a, b) => a.order - b.order);
}

export function childrenOf(tags: Tag[], parentId: string | undefined, groupId: string): Tag[] {
  return liveTags(tags)
    .filter((t) => t.groupId === groupId && (parentId ? t.parentId === parentId : !t.parentId))
    .slice()
    .sort((a, b) => a.order - b.order);
}

function reindexSiblings(tags: Tag[], groupId: string, parentId: string | undefined): Tag[] {
  const sibs = childrenOf(tags, parentId, groupId);
  const order = new Map(sibs.map((t, i) => [t.id, i]));
  return tags.map((t) => (order.has(t.id) ? { ...t, order: order.get(t.id)! } : t));
}

/** 含自己與所有活著的子孫 id */
export function descendantIds(tags: Tag[], id: string): string[] {
  const byParent = new Map<string, Tag[]>();
  for (const t of liveTags(tags)) {
    if (!t.parentId) continue;
    const arr = byParent.get(t.parentId) ?? [];
    arr.push(t);
    byParent.set(t.parentId, arr);
  }
  const out: string[] = [];
  const walk = (pid: string, depth: number) => {
    if (depth > TAG_WALK_MAX_DEPTH) return;
    for (const c of byParent.get(pid) ?? []) {
      out.push(c.id);
      walk(c.id, depth + 1);
    }
  };
  walk(id, 0);
  return out;
}

export function subtreeIds(tags: Tag[], id: string): Set<string> {
  return new Set([id, ...descendantIds(tags, id)]);
}

/** 把 movingId 接到 newParentId 底下是否會成環（不變式 7） */
export function wouldCreateCycle(tags: Tag[], movingId: string, newParentId: string | undefined): boolean {
  if (!newParentId) return false;
  if (movingId === newParentId) return true;
  const byId = new Map(liveTags(tags).map((t) => [t.id, t]));
  let cur = byId.get(newParentId);
  let depth = 0;
  const seen = new Set<string>();
  while (cur && depth < TAG_WALK_MAX_DEPTH) {
    if (cur.id === movingId) return true;
    if (seen.has(cur.id)) return true;
    seen.add(cur.id);
    if (!cur.parentId) break;
    cur = byId.get(cur.parentId);
    depth += 1;
  }
  return false;
}

export function tagDepth(tags: Tag[], id: string): number {
  const byId = new Map(tags.map((t) => [t.id, t]));
  let cur = byId.get(id);
  let d = 0;
  const seen = new Set<string>();
  while (cur?.parentId && d < TAG_WALK_MAX_DEPTH) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    cur = byId.get(cur.parentId);
    d += 1;
  }
  return d;
}

export function tagDisplayName(tags: Tag[], id: string): string {
  const t = tags.find((x) => x.id === id);
  if (!t || t.deletedAt) return DELETED_TAG_LABEL;
  return t.name;
}

export function addChildTag(
  tags: Tag[],
  input: {
    id?: string;
    groupId: string;
    parentId?: string;
    name: string;
    color?: string;
    noCoin?: boolean;
  },
): Tag[] {
  if (input.parentId) {
    const parent = tags.find((t) => t.id === input.parentId && !t.deletedAt);
    if (!parent || parent.groupId !== input.groupId) return tags;
  }
  const sibs = childrenOf(tags, input.parentId, input.groupId);
  const tag: Tag = {
    id: input.id ?? crypto.randomUUID(),
    groupId: input.groupId,
    parentId: input.parentId,
    name: input.name,
    color: input.color,
    noCoin: input.noCoin,
    order: sibs.length,
  };
  return [...tags, tag];
}

export function patchTag(
  tags: Tag[],
  id: string,
  patch: Partial<Pick<Tag, "name" | "color" | "noCoin" | "emoji">>,
): Tag[] {
  return tags.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

export function reorderSiblings(
  tags: Tag[],
  groupId: string,
  parentId: string | undefined,
  from: number,
  to: number,
): Tag[] {
  const sibs = childrenOf(tags, parentId, groupId);
  const next = moveItem(sibs, from, to);
  const orderMap = new Map(next.map((t, i) => [t.id, i]));
  return tags.map((t) => (orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id)! } : t));
}

export function setParent(tags: Tag[], id: string, newParentId: string | undefined): Tag[] | null {
  const node = tags.find((t) => t.id === id && !t.deletedAt);
  if (!node) return null;
  const oldParent = node.parentId;
  const np = newParentId || undefined;
  if ((oldParent || undefined) === np) return tags;
  if (np) {
    const parent = tags.find((t) => t.id === np && !t.deletedAt);
    if (!parent || parent.groupId !== node.groupId) return null;
    if (wouldCreateCycle(tags, id, np)) return null;
  }
  const next = tags.map((t) => (t.id === id ? { ...t, parentId: np, order: Number.MAX_SAFE_INTEGER } : t));
  return reindexSiblings(reindexSiblings(next, node.groupId, oldParent), node.groupId, np);
}

/** 升一層：接到祖父底下（已是根則拒絕） */
export function promoteTag(tags: Tag[], id: string): Tag[] | null {
  const node = tags.find((t) => t.id === id && !t.deletedAt);
  if (!node?.parentId) return null;
  const parent = tags.find((t) => t.id === node.parentId);
  return setParent(tags, id, parent?.parentId);
}

/** 降一層：成為前一個兄弟的子項（沒有前一個兄弟則拒絕） */
export function demoteTag(tags: Tag[], id: string): Tag[] | null {
  const node = tags.find((t) => t.id === id && !t.deletedAt);
  if (!node) return null;
  const sibs = childrenOf(tags, node.parentId, node.groupId);
  const idx = sibs.findIndex((t) => t.id === id);
  if (idx <= 0) return null;
  return setParent(tags, id, sibs[idx - 1].id);
}

export function softDeleteTagAndDescendants(tags: Tag[], id: string, deletedAt: string): Tag[] {
  const ids = subtreeIds(tags, id);
  return tags.map((t) => (ids.has(t.id) && !t.deletedAt ? { ...t, deletedAt } : t));
}

export function addGroup(
  groups: TagGroup[],
  input: {
    id?: string;
    name: string;
    selectMode?: TagGroup["selectMode"];
    required?: boolean;
    isTimeDestination?: boolean;
  },
): TagGroup[] {
  const live = liveGroups(groups);
  const g: TagGroup = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name,
    selectMode: input.selectMode ?? "single",
    required: input.required ?? false,
    isTimeDestination: input.isTimeDestination ?? false,
    order: live.length,
  };
  return [...groups, g];
}

export function patchGroup(
  groups: TagGroup[],
  id: string,
  patch: Partial<Pick<TagGroup, "name" | "selectMode" | "required" | "isTimeDestination">>,
): TagGroup[] {
  return groups.map((g) => (g.id === id ? { ...g, ...patch } : g));
}

export function reorderGroups(groups: TagGroup[], from: number, to: number): TagGroup[] {
  const live = liveGroups(groups);
  const nextLive = moveItem(live, from, to).map((g, i) => ({ ...g, order: i }));
  const map = new Map(nextLive.map((g) => [g.id, g]));
  return groups.map((g) => map.get(g.id) ?? g);
}

export function softDeleteGroup(
  groups: TagGroup[],
  tags: Tag[],
  groupId: string,
  deletedAt: string,
): { groups: TagGroup[]; tags: Tag[] } {
  return {
    groups: groups.map((g) => (g.id === groupId && !g.deletedAt ? { ...g, deletedAt } : g)),
    tags: tags.map((t) => (t.groupId === groupId && !t.deletedAt ? { ...t, deletedAt } : t)),
  };
}

/** 必填群組不可刪。回 null＝拒絕，呼叫端不得改資料。 */
export function guardedSoftDeleteGroup(
  groups: TagGroup[],
  tags: Tag[],
  groupId: string,
  deletedAt: string,
): { groups: TagGroup[]; tags: Tag[] } | null {
  const g = groups.find((x) => x.id === groupId);
  if (!g || g.required) return null;
  return softDeleteGroup(groups, tags, groupId, deletedAt);
}

export function flattenScheduleCells(
  week: Record<string, CatRef[] | undefined>,
  overrides: Record<string, { courses?: CatRef[] } | undefined>,
): CatRef[] {
  const out: CatRef[] = [];
  for (const rows of Object.values(week)) {
    if (!Array.isArray(rows)) continue;
    out.push(...rows);
  }
  for (const ov of Object.values(overrides)) {
    if (ov?.courses) out.push(...ov.courses);
  }
  return out;
}

function collectIds(tags: Tag[], seedIds: string[]): Set<string> {
  const ids = new Set<string>();
  for (const id of seedIds) {
    ids.add(id);
    for (const d of descendantIds(tags, id)) ids.add(d);
  }
  return ids;
}

export function countTagsUsage(
  seedIds: string[],
  tags: Tag[],
  data: {
    sessions: Array<{ tagIds?: string[]; cat1?: string; cat2?: string; cat3?: string; cat1Id?: string; cat2Id?: string; cat3Id?: string }>;
    todos: Array<{ tagIds?: string[]; cat?: string }>;
    scheduleCells: CatRef[];
  },
): TagUsageCounts {
  const ids = collectIds(tags, seedIds);
  const names = new Set(tags.filter((t) => ids.has(t.id)).map((t) => t.name));

  const sessions = data.sessions.filter((s) => {
    if (s.tagIds?.some((id) => ids.has(id))) return true;
    if (s.cat1Id && ids.has(s.cat1Id)) return true;
    if (s.cat2Id && ids.has(s.cat2Id)) return true;
    if (s.cat3Id && ids.has(s.cat3Id)) return true;
    if (!s.tagIds?.length && !s.cat1Id && !s.cat2Id && !s.cat3Id) {
      return names.has(s.cat1 ?? "") || names.has(s.cat2 ?? "") || names.has(s.cat3 ?? "");
    }
    return false;
  }).length;

  const todos = data.todos.filter((t) => {
    if (t.tagIds?.some((id) => ids.has(id))) return true;
    if (!t.tagIds?.length && names.has(t.cat ?? "")) return true;
    return false;
  }).length;

  const schedule = data.scheduleCells.filter((c) => {
    if (c.cat1Id && ids.has(c.cat1Id)) return true;
    if (c.cat2Id && ids.has(c.cat2Id)) return true;
    if (c.cat3Id && ids.has(c.cat3Id)) return true;
    return names.has(c.cat1 ?? "") || names.has(c.cat2 ?? "") || names.has(c.cat3 ?? "");
  }).length;

  return { sessions, todos, schedule };
}

export function countTagUsage(
  tagId: string,
  tags: Tag[],
  data: Parameters<typeof countTagsUsage>[2],
): TagUsageCounts {
  return countTagsUsage([tagId], tags, data);
}

/** 領域群組根標籤（CAT.cat1 來源） */
export function domainRootTags(tags: Tag[]): Tag[] {
  return childrenOf(tags, undefined, TAG_GROUP_IDS.domain);
}
