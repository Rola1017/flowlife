import { describe, expect, it } from "vitest";
import { mergeSessionsWithTombstones } from "@/lib/sessionsCloud";
import type { Session } from "@/lib/types";

function s(partial: Partial<Session> & { uuid: string }): Session {
  return {
    id: partial.id ?? 1,
    date: "2026-07-25",
    name: partial.name ?? "x",
    cat1: "學習",
    cat2: "",
    cat3: "",
    mins: 25,
    rating: "",
    earnedCoins: 0,
    updatedAt: partial.updatedAt ?? "2026-07-25T10:00:00.000Z",
    ...partial,
  };
}

describe("mergeSessionsWithTombstones（防復活）", () => {
  it("墓碑內的 uuid 不得出現在 merged（歷史 bug：跨副本刪除復活）", () => {
    const tomb = new Set(["dead-1"]);
    const local = [s({ uuid: "dead-1", id: 1 }), s({ uuid: "alive", id: 2 })];
    const cloud = [s({ uuid: "dead-1", id: 9, updatedAt: "2026-07-26T00:00:00.000Z" })];
    const { merged } = mergeSessionsWithTombstones(local, cloud, tomb);
    expect(merged.every((x) => x.uuid !== "dead-1")).toBe(true);
    expect(merged.map((x) => x.uuid)).toContain("alive");
  });

  it("墓碑內的本地資料要進 toDeleteFromCloud，且不得進 toPush", () => {
    const tomb = new Set(["dead-1"]);
    const local = [s({ uuid: "dead-1" })];
    const { toPush, toDeleteFromCloud } = mergeSessionsWithTombstones(local, [], tomb);
    expect(toDeleteFromCloud).toEqual(["dead-1"]);
    expect(toPush.find((x) => x.uuid === "dead-1")).toBeUndefined();
  });

  it("雲端較新（updatedAt 較大）時以雲端為準", () => {
    const local = [s({ uuid: "u1", id: 1, name: "本地", updatedAt: "2026-07-01T00:00:00.000Z" })];
    const cloud = [s({ uuid: "u1", id: 99, name: "雲端", updatedAt: "2026-07-20T00:00:00.000Z" })];
    const { merged, toPush } = mergeSessionsWithTombstones(local, cloud, new Set());
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("雲端");
    expect(merged[0].id).toBe(1); // 保留本地 id
    expect(toPush.find((x) => x.uuid === "u1")).toBeUndefined();
  });

  it("本地較新時進 toPush", () => {
    const local = [s({ uuid: "u1", name: "本地新", updatedAt: "2026-07-25T00:00:00.000Z" })];
    const cloud = [s({ uuid: "u1", name: "雲端舊", updatedAt: "2026-07-01T00:00:00.000Z" })];
    const { merged, toPush } = mergeSessionsWithTombstones(local, cloud, new Set());
    expect(merged[0].name).toBe("本地新");
    expect(toPush.map((x) => x.uuid)).toContain("u1");
  });

  it("本地有、雲端沒有、且不在墓碑內 → 進 toPush（正常新增同步不可被誤殺）", () => {
    const local = [s({ uuid: "new-local" })];
    const { toPush, toDeleteFromCloud, merged } = mergeSessionsWithTombstones(local, [], new Set());
    expect(toPush.map((x) => x.uuid)).toContain("new-local");
    expect(toDeleteFromCloud).toEqual([]);
    expect(merged.map((x) => x.uuid)).toContain("new-local");
  });
});
