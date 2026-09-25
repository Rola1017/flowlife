import { beforeEach, describe, expect, it } from "vitest";
import { loadG1MigrateResult } from "@/lib/cloudMigrateG1";
import { LS_KEYS, saveJSON } from "@/lib/storage";

beforeEach(() => {
  localStorage.clear();
});

describe("G1 搬家結果列", () => {
  it("本機持久化結果可讀成設定頁文案數字", () => {
    saveJSON(LS_KEYS.g1MigrateResult, { marked: 12, clamped: 0, at: "2026-09-25T04:00:00.000Z" });
    expect(loadG1MigrateResult()).toEqual({
      marked: 12,
      clamped: 0,
      at: "2026-09-25T04:00:00.000Z",
    });
  });
});
