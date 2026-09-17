import { describe, expect, it } from "vitest";
import { DEFAULT_TAG_GROUPS, DELETED_TAG_LABEL, TAG_GROUP_IDS, type Tag, type TagGroup } from "@/lib/tags";
import { addChildTag } from "@/lib/tagTree";
import { legacyPath } from "@/lib/tagsCompat";
import {
  canStartWithTags,
  isNoCoinByTagIds,
  missingRequiredGroupNames,
  pushRecentCombo,
  tagLeafLabel,
  tagPathLabel,
  toggleTagInSelection,
} from "@/lib/tagSelect";

const G = TAG_GROUP_IDS.domain;

function t(partial: Partial<Tag> & Pick<Tag, "id" | "name" | "order">): Tag {
  return { groupId: G, ...partial };
}

const GROUPS: TagGroup[] = [
  { ...DEFAULT_TAG_GROUPS[0], required: true, selectMode: "multi" },
  { ...DEFAULT_TAG_GROUPS[1], required: false, selectMode: "single" },
  {
    id: "tg_must",
    name: "必填單選",
    selectMode: "single",
    required: true,
    isTimeDestination: false,
    order: 4,
  },
];

const TAGS: Tag[] = [
  t({ id: "learn", name: "學習", order: 0, noCoin: false }),
  t({ id: "en", name: "英文", parentId: "learn", order: 0 }),
  t({ id: "listen", name: "聽力", parentId: "en", order: 0 }),
  { id: "hard", groupId: TAG_GROUP_IDS.difficulty, name: "難", order: 0 },
  { id: "must", groupId: "tg_must", name: "R", order: 0 },
];

describe("canStartWithTags", () => {
  it("所有 required 維度都有選才為 true", () => {
    expect(canStartWithTags([], GROUPS, TAGS)).toBe(false);
    expect(missingRequiredGroupNames([], GROUPS, TAGS)).toEqual(["領域", "必填單選"]);

    expect(canStartWithTags(["learn"], GROUPS, TAGS)).toBe(false);
    expect(missingRequiredGroupNames(["learn"], GROUPS, TAGS)).toEqual(["必填單選"]);

    expect(canStartWithTags(["must"], GROUPS, TAGS)).toBe(false);
    expect(missingRequiredGroupNames(["must"], GROUPS, TAGS)).toEqual(["領域"]);

    expect(canStartWithTags(["learn", "must"], GROUPS, TAGS)).toBe(true);
    expect(canStartWithTags(["listen", "hard", "must"], GROUPS, TAGS)).toBe(true);
    expect(canStartWithTags(["learn", "hard"], GROUPS, TAGS)).toBe(false);
  });

  it("非必填維度不擋開始；已刪標籤不算已選", () => {
    const withDeleted: Tag[] = [...TAGS, { id: "dead", groupId: G, name: "死", order: 9, deletedAt: "x" }];
    expect(canStartWithTags(["dead", "must"], GROUPS, withDeleted)).toBe(false);
    expect(canStartWithTags(["learn", "must", "hard"], GROUPS, TAGS)).toBe(true);
  });
});

describe("legacyPath 超過三層", () => {
  it("第四層主標籤 cat3 取第三層、不報錯", () => {
    const tags = addChildTag(TAGS, { id: "l4", groupId: G, parentId: "listen", name: "精聽" });
    expect(legacyPath(["l4"], tags)).toEqual({ cat1: "學習", cat2: "英文", cat3: "聽力" });
    expect(legacyPath(["listen"], tags)).toEqual({ cat1: "學習", cat2: "英文", cat3: "聽力" });
  });
});

describe("isNoCoinByTagIds", () => {
  it("主標籤或其祖先任一帶 noCoin 即 true", () => {
    expect(isNoCoinByTagIds(["listen"], TAGS)).toBe(false);
    const onLeaf = TAGS.map((x) => (x.id === "listen" ? { ...x, noCoin: true } : x));
    expect(isNoCoinByTagIds(["listen"], onLeaf)).toBe(true);
    const onRoot = TAGS.map((x) => (x.id === "learn" ? { ...x, noCoin: true } : x));
    expect(isNoCoinByTagIds(["listen"], onRoot)).toBe(true);
    expect(isNoCoinByTagIds(["en"], onRoot)).toBe(true);
    const onSibling: Tag[] = [...TAGS, t({ id: "write", name: "寫作", parentId: "en", order: 1, noCoin: true })];
    expect(isNoCoinByTagIds(["listen"], onSibling)).toBe(false);
    expect(isNoCoinByTagIds([], TAGS)).toBe(false);
  });
});

describe("pushRecentCombo", () => {
  it("去重、最新在前、上限 5", () => {
    let list: string[][] = [];
    list = pushRecentCombo(list, ["a"]);
    list = pushRecentCombo(list, ["b"]);
    list = pushRecentCombo(list, ["c"]);
    list = pushRecentCombo(list, ["a"]);
    expect(list).toEqual([["a"], ["c"], ["b"]]);
    list = pushRecentCombo(list, ["d"]);
    list = pushRecentCombo(list, ["e"]);
    list = pushRecentCombo(list, ["f"]);
    expect(list).toHaveLength(5);
    expect(list[0]).toEqual(["f"]);
    expect(list.map((c) => c[0])).toEqual(["f", "e", "d", "a", "c"]);
    expect(pushRecentCombo([["a"]], [])).toEqual([["a"]]);
  });
});

describe("tagLeafLabel", () => {
  it("三層回最深名稱；單層回該名稱；空陣列回未分類；已刪回 DELETED_TAG_LABEL", () => {
    expect(tagLeafLabel(["listen"], TAGS)).toBe("聽力");
    expect(tagLeafLabel(["learn"], TAGS)).toBe("學習");
    expect(tagLeafLabel([], TAGS)).toBe("未分類");
    expect(tagLeafLabel(undefined, TAGS)).toBe("未分類");
    const dead: Tag[] = TAGS.map((x) => (x.id === "listen" ? { ...x, deletedAt: "x" } : x));
    expect(tagLeafLabel(["listen"], dead)).toBe(DELETED_TAG_LABEL);
    expect(tagLeafLabel(["missing"], TAGS)).toBe(DELETED_TAG_LABEL);
    const allDead: Tag[] = [
      { id: "ghost", groupId: G, name: "鬼", order: 0, deletedAt: "x" },
    ];
    expect(tagLeafLabel(["ghost"], allDead)).toBe(DELETED_TAG_LABEL);
  });
});

describe("tagPathLabel", () => {
  it("已刪顯示「已刪除的標籤」", () => {
    const tags: Tag[] = [
      t({ id: "a", name: "事業", order: 0 }),
      t({ id: "b", name: "開發", parentId: "a", order: 0, deletedAt: "x" }),
    ];
    expect(tagPathLabel("b", tags)).toBe("事業 › 已刪除的標籤");
    expect(tagPathLabel("missing", tags)).toBe("已刪除的標籤");
  });
});

describe("toggleTagInSelection", () => {
  it("多選維度 toggle 兩次回到未選", () => {
    const once = toggleTagInSelection([], "learn", TAGS, GROUPS);
    expect(once).toEqual(["learn"]);
    const twice = toggleTagInSelection(once, "learn", TAGS, GROUPS);
    expect(twice).toEqual([]);
    const two = toggleTagInSelection(["learn"], "listen", TAGS, GROUPS);
    expect(two).toEqual(["learn", "listen"]);
    expect(toggleTagInSelection(two, "listen", TAGS, GROUPS)).toEqual(["learn"]);
  });

  it("單選維度點已選即取消", () => {
    const on = toggleTagInSelection(["learn"], "hard", TAGS, GROUPS);
    expect(on).toEqual(["learn", "hard"]);
    expect(toggleTagInSelection(on, "hard", TAGS, GROUPS)).toEqual(["learn"]);
  });

  it("required 維度取消後 canStart 為 false", () => {
    const full = ["learn", "must"];
    expect(canStartWithTags(full, GROUPS, TAGS)).toBe(true);
    const droppedDomain = toggleTagInSelection(full, "learn", TAGS, GROUPS);
    expect(canStartWithTags(droppedDomain, GROUPS, TAGS)).toBe(false);
    const droppedMust = toggleTagInSelection(full, "must", TAGS, GROUPS);
    expect(canStartWithTags(droppedMust, GROUPS, TAGS)).toBe(false);
  });
});
