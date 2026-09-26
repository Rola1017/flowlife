import { describe, expect, it } from "vitest";
import { mergeTodoTombstones, mergeTodosWithTombstones } from "@/lib/todosCloud";
import type { Todo, TodoTombstone } from "@/lib/types";

const TODAY = "2026-09-13";

function todo(patch: Partial<Todo> & Pick<Todo, "id">): Todo {
  return {
    text: "取件",
    cat: "生活",
    date: TODAY,
    phase: "pending",
    ...patch,
  };
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

describe("清單型 todos：dirty 情境下仍合併（防靜默覆蓋）", () => {
  it("本機有新筆＋雲端有另一台新筆 → 雙向合併都含兩邊", () => {
    const localOnly = todo({ id: 11, text: "本機新", updatedAt: "2026-09-13T10:00:00.000Z" });
    const remoteOnly = todo({ id: 22, text: "雲端新", updatedAt: "2026-09-13T11:00:00.000Z" });
    const ab = mergeTodosWithTombstones([localOnly], [remoteOnly], []);
    const ba = mergeTodosWithTombstones([remoteOnly], [localOnly], []);
    expect(idsOf(ab.merged)).toEqual([11, 22]);
    expect(idsOf(ba.merged)).toEqual([11, 22]);
    expect(ab.merged.find((t) => t.id === 11)?.text).toBe("本機新");
    expect(ab.merged.find((t) => t.id === 22)?.text).toBe("雲端新");
  });

  it("墓碑中的 id 永不因合併復活", () => {
    const local = todo({ id: 1, text: "本機復活", updatedAt: "2026-09-13T12:00:00.000Z" });
    const remote = todo({ id: 1, text: "雲端復活", updatedAt: "2026-09-13T13:00:00.000Z" });
    const extra = todo({ id: 9, text: "活著", updatedAt: "2026-09-13T09:00:00.000Z" });
    const { merged, toPush } = mergeTodosWithTombstones([local, extra], [remote], [{ id: 1 }]);
    expect(merged.map((t) => t.id)).toEqual([9]);
    expect(toPush.map((t) => t.id)).not.toContain(1);
  });
});

describe("清單型 deleted_todo_ids：墓碑聯集", () => {
  it("兩台各有不同墓碑 → 合併為聯集", () => {
    const a: TodoTombstone[] = [{ id: 1, at: "2026-09-13T08:00:00.000Z" }];
    const b: TodoTombstone[] = [{ id: 2, at: "2026-09-13T09:00:00.000Z" }];
    const ab = mergeTodoTombstones(a, b);
    const ba = mergeTodoTombstones(b, a);
    expect(ab.map((t) => t.id).sort()).toEqual([1, 2]);
    expect(ba.map((t) => t.id).sort()).toEqual([1, 2]);
  });

  it("同 id 取較早 at；雙向相同", () => {
    const early: TodoTombstone = { id: 7, at: "2026-09-13T01:00:00.000Z" };
    const late: TodoTombstone = { id: 7, at: "2026-09-13T23:00:00.000Z" };
    expect(mergeTodoTombstones([late], [early])).toEqual([early]);
    expect(mergeTodoTombstones([early], [late])).toEqual([early]);
  });
});

describe("清單型合併 property ≥500：任一邊新增合併後不消失", () => {
  it("隨機雙向：非墓碑 id 都還在", () => {
    const rng = mulberry32(20260926);
    for (let i = 0; i < 500; i++) {
      const nLocal = 1 + Math.floor(rng() * 4);
      const nRemote = 1 + Math.floor(rng() * 4);
      const local: Todo[] = [];
      const remote: Todo[] = [];
      const tombs: { id: number }[] = [];
      for (let k = 0; k < nLocal; k++) {
        const id = i * 20 + k;
        local.push(todo({ id, text: `L${id}`, updatedAt: `2026-09-13T0${k}:00:00.000Z` }));
        if (rng() < 0.15) tombs.push({ id });
      }
      for (let k = 0; k < nRemote; k++) {
        const id = i * 20 + 10 + k;
        remote.push(todo({ id, text: `R${id}`, updatedAt: `2026-09-13T1${k}:00:00.000Z` }));
        if (rng() < 0.15) tombs.push({ id });
      }
      const dead = new Set(tombs.map((t) => t.id));
      const ab = mergeTodosWithTombstones(local, remote, tombs);
      const ba = mergeTodosWithTombstones(remote, local, tombs);
      const abIds = new Set(ab.merged.map((t) => t.id));
      const baIds = new Set(ba.merged.map((t) => t.id));
      for (const t of [...local, ...remote]) {
        if (dead.has(t.id)) {
          expect(abIds.has(t.id)).toBe(false);
          expect(baIds.has(t.id)).toBe(false);
        } else {
          expect(abIds.has(t.id)).toBe(true);
          expect(baIds.has(t.id)).toBe(true);
        }
      }
    }
  });
});
