import { describe, expect, it } from "vitest";
import { findOrphanCoinRows, isOrphanCoinRow } from "@/lib/coinOrphans";

const sess = {
  uuid: "sess-live",
  date: "2026-09-17",
  startTime: "10:00",
  endTime: "10:25",
};
const trashed = {
  uuid: "sess-trash",
  date: "2026-09-16",
  startTime: "09:00",
  endTime: "09:25",
};

describe("findOrphanCoinRows", () => {
  it("垃圾桶中的番茄，其金幣列不得被判為孤兒", () => {
    const row = { kind: "session" as const, sessionUuid: "sess-trash", date: "2026-09-16", startTime: "09:00", endTime: "09:25" };
    expect(isOrphanCoinRow(row, [sess], [trashed])).toBe(false);
    expect(findOrphanCoinRows([row], [sess], [trashed])).toEqual([]);
  });

  it("永久刪除（不在 sessions 也不在垃圾桶）才是孤兒", () => {
    const row = { kind: "session" as const, sessionUuid: "gone", date: "2026-09-15", startTime: "08:00", endTime: "08:25" };
    expect(isOrphanCoinRow(row, [sess], [trashed])).toBe(true);
  });

  it("opening／spend 永不視為孤兒；活著的番茄不是孤兒", () => {
    expect(isOrphanCoinRow({ kind: "opening", sessionUuid: "gone" }, [sess], [trashed])).toBe(false);
    expect(isOrphanCoinRow({ kind: "spend", sessionUuid: "gone" }, [sess], [trashed])).toBe(false);
    expect(isOrphanCoinRow({ kind: "session", sessionUuid: "sess-live" }, [sess], [trashed])).toBe(false);
  });

  it("無 uuid 時以日期＋起迄對垃圾桶也不算孤兒", () => {
    const row = { kind: "session" as const, date: "2026-09-16", startTime: "09:00", endTime: "09:25" };
    expect(isOrphanCoinRow(row, [sess], [trashed])).toBe(false);
    expect(isOrphanCoinRow(row, [sess], [])).toBe(true);
  });
});
