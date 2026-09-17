import { describe, expect, it } from "vitest";
import { DEFAULT_TAG_GROUPS, TAG_GROUP_IDS, type Tag, type TagGroup } from "@/lib/tags";
import {
  addChildTag,
  countTagUsage,
  demoteTag,
  guardedSoftDeleteGroup,
  promoteTag,
  reorderSiblings,
  setParent,
  softDeleteTagAndDescendants,
  wouldCreateCycle,
} from "@/lib/tagTree";

const G = TAG_GROUP_IDS.domain;

function t(partial: Partial<Tag> & Pick<Tag, "id" | "name" | "order">): Tag {
  return { groupId: G, ...partial };
}

const TREE: Tag[] = [
  t({ id: "a", name: "A", order: 0 }),
  t({ id: "b", name: "B", parentId: "a", order: 0 }),
  t({ id: "c", name: "C", parentId: "b", order: 0 }),
  t({ id: "d", name: "D", parentId: "c", order: 0 }),
  t({ id: "e", name: "E", order: 1 }),
];

describe("tagTree 操作", () => {
  it("新增子標籤接到指定父層，order 接在同層末尾", () => {
    const next = addChildTag(TREE, { id: "c2", groupId: G, parentId: "b", name: "C2" });
    const child = next.find((x) => x.id === "c2");
    expect(child?.parentId).toBe("b");
    expect(child?.order).toBe(1);
    expect(TREE.find((x) => x.id === "c2")).toBeUndefined();
  });

  it("同層 reorderSiblings 只改 order、不改 parentId", () => {
    const roots = [
      t({ id: "x", name: "X", order: 0 }),
      t({ id: "y", name: "Y", order: 1 }),
      t({ id: "z", name: "Z", order: 2 }),
    ];
    const next = reorderSiblings(roots, G, undefined, 0, 2);
    expect(next.map((n) => n.id)).toEqual(["x", "y", "z"]);
    expect(next.find((n) => n.id === "x")?.order).toBe(2);
    expect(next.find((n) => n.id === "y")?.order).toBe(0);
    expect(next.find((n) => n.id === "z")?.order).toBe(1);
    expect(next.every((n) => !n.parentId)).toBe(true);
  });

  it("promoteTag 升一層接到祖父；demoteTag 降為前一個兄弟的子項", () => {
    const promoted = promoteTag(TREE, "c");
    expect(promoted).not.toBeNull();
    expect(promoted!.find((x) => x.id === "c")?.parentId).toBe("a");

    const demoted = demoteTag(TREE, "e");
    expect(demoted).not.toBeNull();
    expect(demoted!.find((x) => x.id === "e")?.parentId).toBe("a");
  });

  it("根標籤無法再升；沒有前一個兄弟無法降", () => {
    expect(promoteTag(TREE, "a")).toBeNull();
    expect(demoteTag(TREE, "a")).toBeNull();
  });

  it("軟刪除含子樹：父與子孫都設 deletedAt，陣列長度不變", () => {
    const at = "2026-09-17T00:00:00.000Z";
    const next = softDeleteTagAndDescendants(TREE, "b", at);
    expect(next.length).toBe(TREE.length);
    expect(next.find((x) => x.id === "a")?.deletedAt).toBeUndefined();
    expect(next.find((x) => x.id === "b")?.deletedAt).toBe(at);
    expect(next.find((x) => x.id === "c")?.deletedAt).toBe(at);
    expect(next.find((x) => x.id === "d")?.deletedAt).toBe(at);
    expect(next.find((x) => x.id === "e")?.deletedAt).toBeUndefined();
  });
});

describe("不得成環", () => {
  it("把標籤拖到自己的子孫底下必須被拒絕", () => {
    expect(wouldCreateCycle(TREE, "a", "d")).toBe(true);
    expect(wouldCreateCycle(TREE, "a", "c")).toBe(true);
    expect(wouldCreateCycle(TREE, "a", "a")).toBe(true);
    expect(wouldCreateCycle(TREE, "e", "a")).toBe(false);
    expect(setParent(TREE, "a", "d")).toBeNull();
    expect(setParent(TREE, "a", "c")).toBeNull();
    expect(setParent(TREE, "e", "a")).not.toBeNull();
  });

  it("把 A 降級到自己的子孫底下必須被拒絕（demote／setParent 同一守衛）", () => {
    expect(setParent(TREE, "a", "b")).toBeNull();
    expect(setParent(TREE, "b", "d")).toBeNull();
    expect(wouldCreateCycle(TREE, "b", "c")).toBe(true);
    expect(demoteTag(TREE, "a")).toBeNull();
    const demoted = demoteTag(TREE, "e");
    expect(demoted).not.toBeNull();
    expect(demoted!.find((x) => x.id === "e")?.parentId).toBe("a");
  });
});

describe("必填群組守衛", () => {
  it("required 群組呼叫刪除時資料不變", () => {
    const groups: TagGroup[] = DEFAULT_TAG_GROUPS.map((g) => ({ ...g }));
    const tags: Tag[] = [
      t({ id: "learn", name: "學習", order: 0 }),
      t({ id: "hard", name: "難", order: 0, groupId: TAG_GROUP_IDS.difficulty }),
    ];
    const domain = groups.find((g) => g.id === TAG_GROUP_IDS.domain)!;
    expect(domain.required).toBe(true);
    const frozenGroups = JSON.stringify(groups);
    const frozenTags = JSON.stringify(tags);
    expect(guardedSoftDeleteGroup(groups, tags, domain.id, "2026-09-17T00:00:00.000Z")).toBeNull();
    expect(JSON.stringify(groups)).toBe(frozenGroups);
    expect(JSON.stringify(tags)).toBe(frozenTags);
    expect(groups.every((g) => !g.deletedAt)).toBe(true);
    expect(tags.every((x) => !x.deletedAt)).toBe(true);
  });

  it("關閉必填後可以軟刪", () => {
    const groups: TagGroup[] = DEFAULT_TAG_GROUPS.map((g) =>
      g.id === TAG_GROUP_IDS.difficulty ? { ...g, required: false } : { ...g },
    );
    const tags: Tag[] = [t({ id: "hard", name: "難", order: 0, groupId: TAG_GROUP_IDS.difficulty })];
    const out = guardedSoftDeleteGroup(groups, tags, TAG_GROUP_IDS.difficulty, "2026-09-17T00:00:00.000Z");
    expect(out).not.toBeNull();
    expect(out!.groups.find((g) => g.id === TAG_GROUP_IDS.difficulty)?.deletedAt).toBe("2026-09-17T00:00:00.000Z");
    expect(out!.tags.find((x) => x.id === "hard")?.deletedAt).toBe("2026-09-17T00:00:00.000Z");
    expect(groups.find((g) => g.id === TAG_GROUP_IDS.difficulty)?.deletedAt).toBeUndefined();
  });
});

describe("影響範圍計算", () => {
  it("給定標籤 id，正確算出使用它與其子孫的資料筆數", () => {
    const tags = TREE;
    const sessions = [
      { tagIds: ["d"] },
      { tagIds: ["c"] },
      { tagIds: ["e"] },
      { cat1: "A" },
      { tagIds: ["other"] },
    ];
    const todos = [{ tagIds: ["b"] }, { cat: "E" }, { cat: "A" }];
    const scheduleCells = [{ cat1: "A", cat2: "B", cat3: "C" }, { cat1: "E" }, { cat1: "Z" }];

    expect(countTagUsage("b", tags, { sessions, todos, scheduleCells })).toEqual({
      sessions: 2,
      todos: 1,
      schedule: 1,
    });
    expect(countTagUsage("e", tags, { sessions, todos, scheduleCells })).toEqual({
      sessions: 1,
      todos: 1,
      schedule: 1,
    });
    expect(countTagUsage("a", tags, { sessions, todos, scheduleCells })).toEqual({
      sessions: 3,
      todos: 2,
      schedule: 1,
    });
  });
});
