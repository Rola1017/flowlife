import { beforeEach, describe, expect, it } from "vitest";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { TAG_GROUP_IDS, type Tag } from "@/lib/tags";
import { createTodoFormDraft } from "@/components/todo/TodoFormFields";
import { stampTodoTags, uncategorizedRootTagId } from "@/lib/todoTags";
import { applyTodoTagsMigration, ensureTodoTagsMigrated } from "@/lib/todoTagsMigrate";
import type { Todo } from "@/lib/types";

const AT = "2026-09-25T00:00:00.000Z";
const TODAY = "2026-09-13";

const LEARN: Tag = { id: "learn", groupId: TAG_GROUP_IDS.domain, name: "學習", order: 0 };
const WORK: Tag = { id: "work", groupId: TAG_GROUP_IDS.domain, name: "事業", order: 1 };
const UNCAT: Tag = { id: "uncat", groupId: TAG_GROUP_IDS.domain, name: "未分類", order: 2 };
const HARD: Tag = { id: "hard", groupId: TAG_GROUP_IDS.difficulty, name: "難", order: 0 };
const TAGS = [LEARN, WORK, UNCAT, HARD];

function todo(patch: Partial<Todo> & Pick<Todo, "id" | "cat">): Todo {
  return { text: "取件", date: TODAY, phase: "pending", ...patch };
}

beforeEach(() => {
  localStorage.clear();
});

describe("applyTodoTagsMigration", () => {
  it("對得上的分類筆數＝沿用＋寫入；報告列 cat 排序", () => {
    const todos = [
      todo({ id: 1, cat: "學習" }),
      todo({ id: 2, cat: "學習" }),
      todo({ id: 3, cat: "事業" }),
    ];
    const r = applyTodoTagsMigration(todos, TAGS, AT);
    expect(r.ok).toBe(true);
    expect(r.written).toBe(3);
    expect(r.kept).toBe(0);
    expect(r.written + r.kept).toBe(todos.length);
    expect(r.rows.map((row) => row.cat)).toEqual(["事業", "學習"]);
    expect(r.rows.every((row) => row.count === row.kept + row.written)).toBe(true);
    expect(r.todos[0].tagIds).toEqual([LEARN.id]);
    expect(r.todos[0].cat).toBe("學習");
    expect(r.message).toBe("待辦標籤遷移：已完成，寫入 3 筆、沿用 0 筆");
  });

  it("孤兒 cat「生活」整批 abort、零寫入、列出每筆", () => {
    const todos = [
      todo({ id: 1, cat: "學習" }),
      todo({ id: 2, cat: "生活", text: "買菜" }),
    ];
    const r = applyTodoTagsMigration(todos, TAGS, AT);
    expect(r.ok).toBe(false);
    expect(r.written).toBe(0);
    expect(r.todos).toBe(todos);
    expect(r.todos[0].tagIds).toBeUndefined();
    expect(r.orphans).toEqual([{ id: 2, text: "買菜", cat: "生活" }]);
    expect(r.message).toBe("待辦標籤遷移：已停止，有 1 筆分類對不上，資料未變更");
  });

  it("孤兒明細含完整文字與舊分類名（截斷只在 UI）", () => {
    const long = "買菜要記得帶環保袋而且文字很長超過二十四字";
    const r = applyTodoTagsMigration([todo({ id: 9, cat: "生活", text: long })], TAGS, AT);
    expect(r.orphans).toEqual([{ id: 9, text: long, cat: "生活" }]);
  });

  it("第二次跑全部沿用、written=0", () => {
    const first = applyTodoTagsMigration([todo({ id: 1, cat: "學習" })], TAGS, AT);
    expect(first.written).toBe(1);
    const second = applyTodoTagsMigration(first.todos, TAGS, AT);
    expect(second.ok).toBe(true);
    expect(second.written).toBe(0);
    expect(second.kept).toBe(1);
    expect(second.todos[0].tagIds).toEqual([LEARN.id]);
  });

  it("已有 tagIds 但沒領域 → 補領域根、其餘保留", () => {
    const src = todo({ id: 1, cat: "學習", tagIds: [HARD.id] });
    const r = applyTodoTagsMigration([src], TAGS, AT);
    expect(r.ok).toBe(true);
    expect(r.written).toBe(1);
    expect(r.todos[0].tagIds).toEqual([LEARN.id, HARD.id]);
    expect(r.todos[0].cat).toBe("學習");
  });

  it("已有任一領域標籤 → 完全不動", () => {
    const src = todo({ id: 1, cat: "學習", tagIds: [LEARN.id, HARD.id] });
    const r = applyTodoTagsMigration([src], TAGS, AT);
    expect(r.ok).toBe(true);
    expect(r.written).toBe(0);
    expect(r.kept).toBe(1);
    expect(r.todos[0]).toBe(src);
  });
});

describe("stampTodoTags", () => {
  it("有 tagIds 雙寫 cat＝主標籤祖先 cat1", () => {
    const stamped = stampTodoTags(todo({ id: 1, cat: "x", tagIds: [LEARN.id] }), TAGS);
    expect(stamped.cat).toBe("學習");
    expect(stamped.tagIds).toEqual([LEARN.id]);
  });

  it("無 tagIds 不動 cat", () => {
    const src = todo({ id: 1, cat: "生活" });
    expect(stampTodoTags(src, TAGS)).toBe(src);
  });
});

describe("createTodoFormDraft 快捷預設", () => {
  it("tagIds＝未分類根，不得空陣列", () => {
    saveJSON(LS_KEYS.tags, TAGS);
    expect(uncategorizedRootTagId(TAGS)).toBe(UNCAT.id);
    const d = createTodoFormDraft(TODAY);
    expect(d.tagIds).toEqual([UNCAT.id]);
    expect(d.tagIds).not.toEqual([]);
  });
});

describe("ensureTodoTagsMigrated", () => {
  it("成功寫入才改 LS；孤兒零寫入", () => {
    saveJSON(LS_KEYS.tags, TAGS);
    const original = [todo({ id: 1, cat: "學習" }), todo({ id: 2, cat: "生活", text: "買菜" })];
    saveJSON(LS_KEYS.todos, original);
    const r = ensureTodoTagsMigrated();
    expect(r.ok).toBe(false);
    expect(r.orphans).toEqual([{ id: 2, text: "買菜", cat: "生活" }]);
    const stored = loadJSON<Todo[]>(LS_KEYS.todos, []);
    expect(stored).toEqual(original);
  });

  it("可對上則寫入並冪等", () => {
    saveJSON(LS_KEYS.tags, TAGS);
    saveJSON(LS_KEYS.todos, [todo({ id: 1, cat: "學習" })]);
    const first = ensureTodoTagsMigrated();
    expect(first.ok).toBe(true);
    expect(first.written).toBe(1);
    expect(loadJSON<Todo[]>(LS_KEYS.todos, [])[0].tagIds).toEqual([LEARN.id]);
    const second = ensureTodoTagsMigrated();
    expect(second.ok).toBe(true);
    expect(second.written).toBe(1);
    expect(second.message).toContain("寫入 1 筆");
  });
});
