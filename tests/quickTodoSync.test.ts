import { beforeEach, describe, expect, it } from "vitest";
import { createTodoFormDraft, formDraftToTodoPatch } from "@/components/todo/TodoFormFields";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { LS_KEYS, saveJSON } from "@/lib/storage";
import { DEFAULT_ATTR_TAGS, DEFAULT_TAG_GROUPS, TAG_GROUP_IDS, UNCATEGORIZED_TAG_NAME } from "@/lib/tags";
import { mergeTodosWithTombstones, normalizeTodo, todoShowsOn } from "@/lib/todosCloud";
import type { Todo } from "@/lib/types";

/** 防 Rola 真機：快捷新增他機看不到。合併路徑與底部新增必須等價。 */
const TODAY = "2026-09-26";

function seedTags() {
  saveJSON(LS_KEYS.tagGroups, DEFAULT_TAG_GROUPS);
  const uncatId = DEFAULT_CATEGORIES.find((c) => c.name === UNCATEGORIZED_TAG_NAME)!.id;
  saveJSON(LS_KEYS.tags, [
    { id: uncatId, groupId: TAG_GROUP_IDS.domain, name: UNCATEGORIZED_TAG_NAME, order: 0 },
    ...DEFAULT_ATTR_TAGS,
  ]);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function idsOf(list: Todo[]): number[] {
  return [...new Set(list.map((t) => t.id))].sort((a, b) => a - b);
}

function addViaPath(
  path: "quick" | "bottom",
  id: number,
  today: string,
  stamp: string,
): Todo {
  const extras =
    path === "quick"
      ? { text: `快捷${id}`, startTime: "09:00", endTime: "09:30", mustDo: true as const }
      : { text: `底部${id}` };
  const draft = createTodoFormDraft(today, extras);
  const result = formDraftToTodoPatch(draft);
  if (!result.ok) throw new Error(result.error);
  const todo = normalizeTodo({ ...result.patch, id, updatedAt: stamp }, today);
  if (!todo) throw new Error("normalize failed");
  return todo;
}

beforeEach(() => {
  localStorage.clear();
  seedTags();
});

describe("兩裝置：快捷路徑 vs 底部路徑合併後都看得到", () => {
  it("A 快捷（startTime/endTime/mustDo、date=今天）＋ B 底部 → 雙向都有兩筆", () => {
    const a = addViaPath("quick", 101, TODAY, "2026-09-26T10:00:00.000Z");
    const b = addViaPath("bottom", 202, TODAY, "2026-09-26T10:01:00.000Z");
    expect(a.date).toBe(TODAY);
    expect(a.startTime).toBe("09:00");
    expect(a.endTime).toBe("09:30");
    expect(a.mustDo).toBe(true);
    expect(b.date).toBe(TODAY);
    expect(b.startTime).toBeUndefined();

    const ab = mergeTodosWithTombstones([a], [b], []);
    const ba = mergeTodosWithTombstones([b], [a], []);
    expect(idsOf(ab.merged)).toEqual([101, 202]);
    expect(idsOf(ba.merged)).toEqual([101, 202]);
    for (const t of [...ab.merged, ...ba.merged]) {
      expect(todoShowsOn(t, TODAY)).toBe(true);
    }
  });

  it("對調：A 底部＋ B 快捷 → 雙向都有兩筆", () => {
    const a = addViaPath("bottom", 303, TODAY, "2026-09-26T11:00:00.000Z");
    const b = addViaPath("quick", 404, TODAY, "2026-09-26T11:01:00.000Z");
    const ab = mergeTodosWithTombstones([a], [b], []);
    const ba = mergeTodosWithTombstones([b], [a], []);
    expect(idsOf(ab.merged)).toEqual([303, 404]);
    expect(idsOf(ba.merged)).toEqual([303, 404]);
  });
});

describe("兩裝置快捷／底部 property ≥200：亂序合併後兩筆都在", () => {
  it("隨機哪台走快捷、亂序合併，非墓碑 id 雙向都在且今天看得到", () => {
    const rng = mulberry32(20260926);
    for (let i = 0; i < 200; i++) {
      const aQuick = rng() < 0.5;
      const a = addViaPath(aQuick ? "quick" : "bottom", i * 2 + 1, TODAY, `2026-09-26T08:00:00.${String(i).padStart(3, "0")}Z`);
      const b = addViaPath(aQuick ? "bottom" : "quick", i * 2 + 2, TODAY, `2026-09-26T09:00:00.${String(i).padStart(3, "0")}Z`);
      const extraLocal: Todo[] = rng() < 0.3 ? [a, addViaPath("bottom", i * 2 + 50, TODAY, "2026-09-26T07:00:00.000Z")] : [a];
      const extraRemote: Todo[] = rng() < 0.3 ? [b, addViaPath("quick", i * 2 + 60, TODAY, "2026-09-26T07:30:00.000Z")] : [b];
      const ab = mergeTodosWithTombstones(extraLocal, extraRemote, []);
      const ba = mergeTodosWithTombstones(extraRemote, extraLocal, []);
      const abIds = new Set(ab.merged.map((t) => t.id));
      const baIds = new Set(ba.merged.map((t) => t.id));
      for (const t of [...extraLocal, ...extraRemote]) {
        expect(abIds.has(t.id)).toBe(true);
        expect(baIds.has(t.id)).toBe(true);
        expect(todoShowsOn(t, TODAY)).toBe(true);
      }
    }
  });
});

describe("normalizeTodo／todoShowsOn 不因 mustDo／startTime 過濾", () => {
  it("有 mustDo＋startTime 仍 normalize 成功，今天看得到", () => {
    const t = normalizeTodo(
      { id: 7, text: "快捷", date: TODAY, mustDo: true, startTime: "14:00", endTime: "14:30" },
      TODAY,
    );
    expect(t).not.toBeNull();
    expect(t!.mustDo).toBe(true);
    expect(t!.startTime).toBe("14:00");
    expect(todoShowsOn(t!, TODAY)).toBe(true);
    expect(todoShowsOn(t!, "2026-09-25")).toBe(false);
  });

  it("無 mustDo、無 startTime 同樣只依 date／endDate", () => {
    const t = normalizeTodo({ id: 8, text: "底部", date: TODAY, mustDo: false }, TODAY)!;
    expect(t.mustDo).toBe(false);
    expect(t.startTime).toBeUndefined();
    expect(todoShowsOn(t, TODAY)).toBe(true);
  });
});
