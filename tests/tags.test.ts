import { beforeEach, describe, expect, it } from "vitest";
import { CAT, DEFAULT_CATEGORIES } from "@/lib/categories";
import { LS_KEYS, saveJSON } from "@/lib/storage";
import { TAG_GROUP_IDS, countCategoryNodes, patchTagGroupFlags, type Tag, type TagGroup } from "@/lib/tags";
import { APP_STATE_KEYS, notifyAppState, subscribeAppState } from "@/lib/appStateCloud";
import { applyTagsMigration } from "@/lib/tagsMigrate";
import { loadTagGroups, loadTags } from "@/lib/tagsStore";
import { addChildTag } from "@/lib/tagTree";
import { legacyPath, matchesTagSelection, tagAncestors } from "@/lib/tagsCompat";
import { stampSessionCatIds } from "@/lib/sessions";
import { sessionFromRow, sessionToRow } from "@/lib/sessionsCloud";
import { normalizeTodo } from "@/lib/todosCloud";
import type { Session } from "@/lib/types";

const LEARN = DEFAULT_CATEGORIES[0];
const LAW = LEARN.mids[0];
const LAW_SUB = LAW.subs[0];
const EN = LEARN.mids[1];
const LISTEN = EN.subs[0];
const WRITE = EN.subs[1];

function persistMigration() {
  const result = applyTagsMigration(DEFAULT_CATEGORIES, loadTagGroups(), loadTags());
  saveJSON(LS_KEYS.tagGroups, result.groups);
  saveJSON(LS_KEYS.tags, result.tags);
  return result;
}

beforeEach(() => {
  localStorage.clear();
  saveJSON(LS_KEYS.categories, DEFAULT_CATEGORIES);
});

describe("tags migrate", () => {
  it("三層分類 → 標籤樹，id 沿用、parentId 正確、總數相等", () => {
    const result = persistMigration();
    expect(result.skipped).toBe(false);
    const domain = loadTags().filter((t) => t.groupId === TAG_GROUP_IDS.domain && !t.deletedAt);
    const oldCount = countCategoryNodes(DEFAULT_CATEGORIES);
    expect(domain.length).toBe(oldCount);
    expect(result.oldCount).toBe(oldCount);
    expect(result.newCount).toBe(oldCount);

    const byId = new Map(domain.map((t) => [t.id, t]));
    expect(byId.get(LEARN.id)?.parentId).toBeUndefined();
    expect(byId.get(LEARN.id)?.name).toBe("學習");
    expect(byId.get(LAW.id)?.parentId).toBe(LEARN.id);
    expect(byId.get(LAW_SUB.id)?.parentId).toBe(LAW.id);
    expect(byId.get(LAW_SUB.id)?.id).toBe(LAW_SUB.id);

    const groups = loadTagGroups();
    expect(groups.map((g) => g.name)).toEqual(["領域", "難易度", "重要性", "精力需求"]);
    expect(groups.find((g) => g.id === TAG_GROUP_IDS.domain)?.isTimeDestination).toBe(true);
    expect(groups.find((g) => g.id === TAG_GROUP_IDS.difficulty)?.isTimeDestination).toBe(false);
    expect(groups.find((g) => g.id === TAG_GROUP_IDS.importance)?.isTimeDestination).toBe(false);
    expect(groups.find((g) => g.id === TAG_GROUP_IDS.energy)?.isTimeDestination).toBe(false);
    expect(CAT.cat1List()).toEqual(DEFAULT_CATEGORIES.map((c) => c.name));
    expect(CAT.cat2List("學習")).toEqual(LEARN.mids.map((m) => m.name));
    expect(CAT.cat3List("學習", "英文")).toEqual(EN.subs.map((s) => s.name));
    expect(CAT.cat1Color("學習")).toBe(LEARN.color);
    expect(CAT.cat2Color("學習", "法律")).toBe(LAW.color);
  });

  it("遷移冪等：執行兩次結果相同，不重複建立", () => {
    const first = persistMigration();
    const g1 = loadTagGroups();
    const t1 = loadTags();
    const second = applyTagsMigration(DEFAULT_CATEGORIES, g1, t1);
    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(true);
    expect(second.groups).toEqual(g1);
    expect(second.tags).toEqual(t1);
    const domain = t1.filter((t) => t.groupId === TAG_GROUP_IDS.domain);
    expect(domain.length).toBe(countCategoryNodes(DEFAULT_CATEGORIES));
  });

  it("isTimeDestination 缺欄時補上且不覆寫既有值", () => {
    const missing = [
      {
        id: TAG_GROUP_IDS.domain,
        name: "領域",
        selectMode: "multi",
        required: true,
        order: 0,
      },
      {
        id: TAG_GROUP_IDS.difficulty,
        name: "難易度",
        selectMode: "single",
        required: false,
        order: 1,
        isTimeDestination: true,
      },
    ] as TagGroup[];
    const first = patchTagGroupFlags(missing);
    expect(first.changed).toBe(true);
    expect(first.groups[0].isTimeDestination).toBe(true);
    expect(first.groups[1].isTimeDestination).toBe(true);
    const second = patchTagGroupFlags(first.groups);
    expect(second.changed).toBe(false);
    expect(second.groups).toEqual(first.groups);
  });
});

describe("tagsCompat", () => {
  let tags: Tag[];
  beforeEach(() => {
    persistMigration();
    tags = loadTags();
  });

  it("matchesTagSelection：選父標籤命中子孫；選子不命中父的其他子", () => {
    expect(matchesTagSelection(new Set(), [LISTEN.id], tags)).toBe(true);
    expect(matchesTagSelection(new Set([LEARN.id]), [LISTEN.id], tags)).toBe(true);
    expect(matchesTagSelection(new Set([EN.id]), [LISTEN.id], tags)).toBe(true);
    expect(matchesTagSelection(new Set([LISTEN.id]), [LISTEN.id], tags)).toBe(true);
    expect(matchesTagSelection(new Set([WRITE.id]), [LISTEN.id], tags)).toBe(false);
    expect(matchesTagSelection(new Set([LISTEN.id]), [LEARN.id], tags)).toBe(false);
    expect(matchesTagSelection(new Set([LISTEN.id]), [WRITE.id], tags)).toBe(false);
  });

  it("legacyPath：由主標籤祖先鏈正確推導三層名稱；主標籤為頂層時 cat2/cat3 為空", () => {
    expect(legacyPath([LISTEN.id], tags)).toEqual({ cat1: "學習", cat2: "英文", cat3: "聽力" });
    expect(legacyPath([EN.id], tags)).toEqual({ cat1: "學習", cat2: "英文", cat3: "" });
    expect(legacyPath([LEARN.id], tags)).toEqual({ cat1: "學習", cat2: "", cat3: "" });
    expect(tagAncestors(LISTEN.id, tags).map((t) => t.id)).toEqual([LEARN.id, EN.id, LISTEN.id]);
  });
});

describe("session / todo tagIds", () => {
  const UPDATED = "2026-09-13T08:00:00.000Z";

  function sess(partial: Partial<Session>): Session {
    return {
      id: 1,
      date: "2026-09-13",
      name: "x",
      cat1: "學習",
      cat2: "",
      cat3: "",
      mins: 25,
      rating: "",
      earnedCoins: 0,
      updatedAt: UPDATED,
      uuid: "sess-uuid-1",
      ...partial,
    };
  }

  it("stampSessionCatIds 取最深 catNId 寫入 tagIds；toRow/fromRow 對應 tag_ids", () => {
    const deep = stampSessionCatIds(sess({ cat2: "法律", cat3: LAW_SUB.name }));
    expect(deep.cat3Id).toBe(LAW_SUB.id);
    expect(deep.tagIds).toEqual([LAW_SUB.id]);

    const mid = stampSessionCatIds(sess({ cat2: "法律" }));
    expect(mid.tagIds).toEqual([LAW.id]);

    const top = stampSessionCatIds(sess({}));
    expect(top.tagIds).toEqual([LEARN.id]);

    const row = sessionToRow("user-1", deep);
    expect(row.tag_ids).toEqual([LAW_SUB.id]);
    const back = sessionFromRow(row, 1);
    expect(back.tagIds).toEqual([LAW_SUB.id]);
    expect(back.updatedAt).toBe(UPDATED);
  });

  it("normalizeTodo 由單層 cat 推導大分類標籤 id", () => {
    const t = normalizeTodo({ id: 7, text: "取件", cat: "學習" }, "2026-09-13");
    expect(t).not.toBeNull();
    expect(t!.tagIds).toEqual([LEARN.id]);
  });
});

describe("CAT 三層降級", () => {
  it("第四層標籤不進入 CAT.cat3List（其餘頁面先只顯示前三層）", () => {
    persistMigration();
    const tags = loadTags();
    const next = addChildTag(tags, {
      id: "layer4",
      groupId: TAG_GROUP_IDS.domain,
      parentId: LISTEN.id,
      name: "第四層",
    });
    saveJSON(LS_KEYS.tags, next);
    expect(CAT.cat3List("學習", "英文")).toEqual(EN.subs.map((s) => s.name));
    expect(CAT.cat3List("學習", "英文")).not.toContain("第四層");
    expect(next.some((t) => t.id === "layer4" && t.parentId === LISTEN.id)).toBe(true);
  });
});

describe("tags 雲端訂閱", () => {
  it("sync 清單含 tags／tag_groups；emit 後 state 重讀", () => {
    expect(Object.values(APP_STATE_KEYS)).toEqual(expect.arrayContaining(["tags", "tag_groups"]));
    persistMigration();
    let latest = loadTags();
    const unsub = subscribeAppState(APP_STATE_KEYS.tags, () => {
      latest = loadTags();
    });
    const next = [...loadTags(), { id: "sub-new", groupId: TAG_GROUP_IDS.domain, name: "訂閱新標籤", order: 99 }];
    saveJSON(LS_KEYS.tags, next);
    notifyAppState(APP_STATE_KEYS.tags);
    expect(latest.some((t) => t.id === "sub-new")).toBe(true);
    unsub();
  });
});
