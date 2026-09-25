import { beforeEach, describe, expect, it } from "vitest";
import { planPushSessions } from "@/lib/cloudSync";
import { persistLocalSessions } from "@/lib/sessionPersist";
import { LS_KEYS } from "@/lib/storage";
import { clearSyncDirty, isSyncDirty, loadSyncDirty, markSyncDirty } from "@/lib/syncDirty";
import type { Session } from "@/lib/types";

const EARLY = "2026-01-01T00:00:00.000Z";
const LATE = "2026-09-25T00:00:00.000Z";

function sess(uuid: string, updatedAt: string): Session {
  return {
    id: 1,
    uuid,
    date: "2026-07-01",
    name: "t",
    cat1: "學習",
    cat2: "",
    cat3: "",
    mins: 25,
    rating: "",
    earnedCoins: 0,
    updatedAt,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("syncDirty 持久化與 planPush", () => {
  it("慢鐘 dirty 列必須進 planPush", () => {
    persistLocalSessions([sess("slow", EARLY)], [], "local");
    expect(
      planPushSessions(
        [{ uuid: "slow", updatedAt: EARLY }],
        [{ uuid: "slow", updated_at: LATE }],
        [],
        loadSyncDirty("sessions"),
      ),
    ).toEqual(["slow"]);
  });

  it("推送成功前 dirty 不得被清", () => {
    persistLocalSessions([sess("a", EARLY)], [], "local");
    expect(isSyncDirty("sessions", "a")).toBe(true);
    persistLocalSessions([sess("a", LATE)], undefined, "cloud");
    expect(isSyncDirty("sessions", "a")).toBe(true);
    clearSyncDirty("sessions", ["a"]);
    expect(isSyncDirty("sessions", "a")).toBe(false);
  });

  it("重載後 dirty 仍在", () => {
    markSyncDirty("sessions", ["keep-me"]);
    markSyncDirty("reviews", ["day|2026-09-25"]);
    markSyncDirty("app_state", ["coins"]);
    const rawS = localStorage.getItem(LS_KEYS.syncDirtySessions);
    const rawR = localStorage.getItem(LS_KEYS.syncDirtyReviews);
    const rawA = localStorage.getItem(LS_KEYS.syncDirtyAppState);
    expect(rawS).toBeTruthy();
    localStorage.clear();
    if (rawS) localStorage.setItem(LS_KEYS.syncDirtySessions, rawS);
    if (rawR) localStorage.setItem(LS_KEYS.syncDirtyReviews, rawR);
    if (rawA) localStorage.setItem(LS_KEYS.syncDirtyAppState, rawA);
    expect([...loadSyncDirty("sessions")]).toEqual(["keep-me"]);
    expect([...loadSyncDirty("reviews")]).toEqual(["day|2026-09-25"]);
    expect([...loadSyncDirty("app_state")]).toEqual(["coins"]);
  });

  it("source=cloud 的 persist 不標 dirty", () => {
    persistLocalSessions([sess("c", LATE)], [], "cloud");
    expect(isSyncDirty("sessions", "c")).toBe(false);
  });
});
