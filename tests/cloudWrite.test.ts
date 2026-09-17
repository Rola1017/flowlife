import { beforeEach, describe, expect, it } from "vitest";
import {
  getCloudWriteFailures,
  reportCloudWriteResult,
  resetCloudWriteFailures,
  uuidsOnlyInLocal,
} from "@/lib/cloudWrite";

beforeEach(() => {
  resetCloudWriteFailures();
});

describe("reportCloudWriteResult（mock Supabase 回傳）", () => {
  it("error 為 null → 成功、計數不累加", () => {
    expect(reportCloudWriteResult("sessions", "upsert", { error: null }, "u1")).toBe(true);
    expect(getCloudWriteFailures()).toEqual({ count: 0, lastError: null });
  });

  it("error 有值 → 失敗、計數累加、記下 lastError", () => {
    expect(
      reportCloudWriteResult("sessions", "upsert", { error: { message: "permission denied" } }, "u1"),
    ).toBe(false);
    expect(getCloudWriteFailures()).toEqual({ count: 1, lastError: "permission denied" });
    reportCloudWriteResult("app_state", "delete", { error: { message: "network" } }, "k");
    expect(getCloudWriteFailures()).toEqual({ count: 2, lastError: "network" });
  });
});

describe("uuidsOnlyInLocal", () => {
  it("找出只在本機的 uuid；兩邊都有的排除；空字串不算", () => {
    expect(uuidsOnlyInLocal(["a", "b", "c"], ["b", "d"])).toEqual(["a", "c"]);
    expect(uuidsOnlyInLocal(["a", ""], ["a"])).toEqual([]);
    expect(uuidsOnlyInLocal([], ["x"])).toEqual([]);
    expect(uuidsOnlyInLocal(["only"], [])).toEqual(["only"]);
  });
});
