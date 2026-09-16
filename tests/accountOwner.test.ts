import { beforeEach, describe, expect, it } from "vitest";
import {
  APP_DATA_EXACT_KEYS,
  APP_DATA_PREFIXES,
  COIN_LEDGER_MIGRATED_KEY,
  EXTRA_APP_KEYS,
  LS_KEYS,
  clearAllAppData,
  hasLocalAppData,
  loadOwnerUserId,
  saveOwnerUserId,
} from "@/lib/storage";
import { shouldWipe } from "@/lib/accountOwner";

beforeEach(() => {
  localStorage.clear();
});

describe("clearAllAppData", () => {
  it("列出的應用鍵皆不存在；非 FlowLife 鍵與 ownerUserId 保留", () => {
    for (const key of APP_DATA_EXACT_KEYS) {
      localStorage.setItem(key, "1");
    }
    localStorage.setItem(`${LS_KEYS.dailyOverride}2026-09-13`, "{}");
    localStorage.setItem(`${LS_KEYS.routineOverride}2026-09-13`, "[]");
    localStorage.setItem(COIN_LEDGER_MIGRATED_KEY, "1");
    saveOwnerUserId("user-a");
    localStorage.setItem("other_app_keep_me", "ok");

    expect(hasLocalAppData()).toBe(true);
    clearAllAppData();

    for (const key of APP_DATA_EXACT_KEYS) {
      expect(localStorage.getItem(key), key).toBeNull();
    }
    for (const prefix of APP_DATA_PREFIXES) {
      expect(localStorage.getItem(`${prefix}2026-09-13`)).toBeNull();
    }
    for (const key of EXTRA_APP_KEYS) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    expect(loadOwnerUserId()).toBe("user-a");
    expect(localStorage.getItem("other_app_keep_me")).toBe("ok");
    expect(hasLocalAppData()).toBe(false);
  });
});

describe("shouldWipe", () => {
  it("相同 → false", () => {
    expect(shouldWipe("uid-a", "uid-a", true)).toBe(false);
  });

  it("不同且有資料 → true", () => {
    expect(shouldWipe("uid-a", "uid-b", true)).toBe(true);
  });

  it("未登入 → false", () => {
    expect(shouldWipe("uid-a", null, true)).toBe(false);
    expect(shouldWipe(null, null, true)).toBe(false);
  });

  it("首次登入且無資料 → false", () => {
    expect(shouldWipe(null, "uid-b", false)).toBe(false);
  });
});
