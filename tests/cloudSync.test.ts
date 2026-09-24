import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_STATE_KEYS } from "@/lib/appStateCloud";
import { resetCloudWriteFailures } from "@/lib/cloudWrite";
import {
  planDeleteReviews,
  planDeleteSessions,
  planPushAppStateKeys,
  planPushReviews,
  planPushSessions,
  planTodosValueForPush,
  syncNow,
} from "@/lib/cloudSync";
import { LS_KEYS, saveJSON } from "@/lib/storage";
import type { Session, Todo } from "@/lib/types";

/** 鎖死字串；禁止 Date.now()／new Date() */
const TS = [
  "2026-01-01T00:00:00.000Z",
  "2026-03-01T00:00:00.000Z",
  "2026-05-01T00:00:00.000Z",
  "2026-07-01T00:00:00.000Z",
  "2026-09-01T00:00:00.000Z",
  "2026-09-23T00:00:00.000Z",
] as const;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hoisted = vi.hoisted(() => {
  type Call = { table: string; op: string; count?: number };
  const state = {
    getUser: vi.fn(),
    calls: [] as Call[],
    sessions: new Map<string, { uuid: string; updated_at: string }>(),
    appState: new Map<string, { key: string; updated_at: string; value: unknown }>(),
    reviews: [] as { id: string; scope: string; period_key: string; updated_at: string }[],
    selectSessionsEmpty: false,
  };
  return { state };
});

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => {
    const st = hoisted.state;
    return {
      auth: { getUser: st.getUser },
      from(table: string) {
        const ctx: { op: string; payload: unknown; inVals?: unknown[] } = { op: "", payload: null };
        const run = () => {
          const op = ctx.op || "select";
          st.calls.push({
            table,
            op,
            count: Array.isArray(ctx.payload) ? ctx.payload.length : undefined,
          });
          if (table === "sessions") {
            if (op === "select") {
              if (st.selectSessionsEmpty) return Promise.resolve({ data: [], error: null });
              return Promise.resolve({ data: [...st.sessions.values()], error: null });
            }
            if (op === "upsert") {
              const rows = (Array.isArray(ctx.payload) ? ctx.payload : [ctx.payload]) as {
                uuid?: string;
                updated_at?: string;
              }[];
              for (const r of rows) {
                if (r?.uuid) st.sessions.set(r.uuid, { uuid: r.uuid, updated_at: r.updated_at ?? "" });
              }
              return Promise.resolve({ data: null, error: null });
            }
            if (op === "delete") {
              for (const id of (ctx.inVals ?? []) as string[]) st.sessions.delete(id);
              return Promise.resolve({ data: null, error: null });
            }
          }
          if (table === "app_state") {
            if (op === "select") {
              return Promise.resolve({ data: [...st.appState.values()], error: null });
            }
            if (op === "upsert") {
              const rows = (Array.isArray(ctx.payload) ? ctx.payload : [ctx.payload]) as {
                key?: string;
                updated_at?: string;
                value?: unknown;
              }[];
              for (const r of rows) {
                if (r?.key) {
                  st.appState.set(r.key, { key: r.key, updated_at: r.updated_at ?? "", value: r.value });
                }
              }
              return Promise.resolve({ data: null, error: null });
            }
          }
          if (table === "reviews") {
            if (op === "select") {
              return Promise.resolve({ data: st.reviews, error: null });
            }
            if (op === "upsert" || op === "insert") {
              const rows = (Array.isArray(ctx.payload) ? ctx.payload : [ctx.payload]) as {
                id?: string;
                scope?: string;
                period_key?: string;
                updated_at?: string;
              }[];
              for (const r of rows) {
                const id = r.id ?? `${r.scope}|${r.period_key}`;
                const row = {
                  id,
                  scope: r.scope ?? "free",
                  period_key: r.period_key ?? "",
                  updated_at: r.updated_at ?? "",
                };
                const i = st.reviews.findIndex((x) => x.id === id);
                if (i >= 0) st.reviews[i] = row;
                else st.reviews.push(row);
              }
              return Promise.resolve({ data: null, error: null });
            }
            if (op === "delete") {
              const ids = (ctx.inVals ?? []) as string[];
              if (ids.length) st.reviews = st.reviews.filter((r) => !ids.includes(r.id));
              return Promise.resolve({ data: null, error: null });
            }
          }
          return Promise.resolve({ data: [], error: null });
        };
        const chain = {
          select() {
            ctx.op = "select";
            return chain;
          },
          upsert(payload: unknown) {
            ctx.op = "upsert";
            ctx.payload = payload;
            return run();
          },
          insert(payload: unknown) {
            ctx.op = "insert";
            ctx.payload = payload;
            return run();
          },
          update(payload: unknown) {
            ctx.op = "update";
            ctx.payload = payload;
            return chain;
          },
          delete() {
            ctx.op = "delete";
            return chain;
          },
          eq() {
            return chain;
          },
          in(_col: string, vals: unknown[]) {
            ctx.inVals = vals;
            return chain;
          },
          neq() {
            return chain;
          },
          maybeSingle() {
            return run().then((r) => ({
              data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data,
              error: r.error,
            }));
          },
          then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (e: unknown) => unknown) {
            return run().then(onFulfilled, onRejected);
          },
        };
        return chain;
      },
    };
  },
}));

function session(i: number, updatedAt: string = TS[3]): Session {
  return {
    id: i + 1,
    uuid: `s-${String(i).padStart(3, "0")}`,
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

function todo(id: number): Todo {
  return {
    id,
    text: "取件",
    cat: "生活",
    date: "2026-09-23",
    phase: "pending",
    updatedAt: TS[4],
  };
}

beforeEach(() => {
  localStorage.clear();
  resetCloudWriteFailures();
  hoisted.state.calls = [];
  hoisted.state.sessions.clear();
  hoisted.state.appState.clear();
  hoisted.state.reviews = [];
  hoisted.state.selectSessionsEmpty = false;
  hoisted.state.getUser.mockReset();
  hoisted.state.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
});

describe("planPushSessions", () => {
  it("墓碑 uuid 永不列入 planPush", () => {
    expect(
      planPushSessions([{ uuid: "dead", updatedAt: TS[5] }], [], ["dead"]),
    ).toEqual([]);
  });

  it("雲端缺或本機較新才入列；相等／雲端較新不入列（property ≥500）", () => {
    const rnd = mulberry32(20260923);
    for (let i = 0; i < 500; i++) {
      const uuid = `u-${i}`;
      const inTomb = rnd() < 0.25;
      const cloudMissing = rnd() < 0.3;
      const localTs = TS[Math.floor(rnd() * TS.length)];
      const cloudTs = TS[Math.floor(rnd() * TS.length)];
      const local = [{ uuid, updatedAt: localTs }];
      const cloud = cloudMissing ? [] : [{ uuid, updated_at: cloudTs }];
      const tombs = inTomb ? [uuid] : [];
      const got = planPushSessions(local, cloud, tombs);
      let expectPush = false;
      if (!inTomb) {
        if (cloudMissing) expectPush = true;
        else if (localTs > cloudTs) expectPush = true;
      }
      expect(got.includes(uuid), `i=${i}`).toBe(expectPush);
    }
  });
});

describe("planDeleteSessions（E05／E06）", () => {
  it("(a) 墓碑 uuid 在雲端 index 中 → 必列入 planDelete", () => {
    expect(planDeleteSessions([{ uuid: "dead" }], ["dead"])).toEqual(["dead"]);
  });

  it("(b) 雲端有、本機無、無墓碑 → 永不列入 planDelete（property ≥500）", () => {
    const rnd = mulberry32(20260924);
    for (let i = 0; i < 500; i++) {
      const uuid = `c-${i}`;
      const inTomb = rnd() < 0.2;
      const localHas = rnd() < 0.5;
      const cloud = [{ uuid, updated_at: TS[2] }];
      const local = localHas ? [{ uuid, updatedAt: TS[1] }] : [];
      const tombs = inTomb ? [uuid] : [];
      const del = planDeleteSessions(cloud, tombs);
      const push = planPushSessions(local, cloud, tombs);
      if (inTomb) {
        expect(del, `i=${i}`).toEqual([uuid]);
        expect(push.includes(uuid), `i=${i} push`).toBe(false);
      } else {
        expect(del, `i=${i}`).toEqual([]);
      }
    }
  });

  it("(c) 墓碑 uuid 永不列入 planPush", () => {
    const local = [{ uuid: "dead", updatedAt: TS[5] }];
    const cloud = [{ uuid: "dead", updated_at: TS[0] }];
    expect(planPushSessions(local, cloud, ["dead"])).toEqual([]);
  });
});

describe("planPushAppStateKeys", () => {
  it("雲端缺或 meta 較新才入列，且不改 meta", () => {
    const meta = { coins: TS[5], tags: TS[1] };
    const snap = { ...meta };
    expect(planPushAppStateKeys(["coins", "tags"], meta, [{ key: "tags", updated_at: TS[3] }])).toEqual([
      "coins",
    ]);
    expect(meta).toEqual(snap);
  });

  it("相等或雲端較新不入列（property ≥500）", () => {
    const rnd = mulberry32(20260925);
    const keys = Object.values(APP_STATE_KEYS);
    for (let i = 0; i < 500; i++) {
      const key = keys[Math.floor(rnd() * keys.length)];
      const cloudMissing = rnd() < 0.3;
      const localTs = TS[Math.floor(rnd() * TS.length)];
      const cloudTs = TS[Math.floor(rnd() * TS.length)];
      const meta = { [key]: localTs };
      const snap = { ...meta };
      const cloud = cloudMissing ? [] : [{ key, updated_at: cloudTs }];
      const got = planPushAppStateKeys([key], meta, cloud);
      const expectPush = cloudMissing || localTs > cloudTs;
      expect(got.includes(key), `i=${i}`).toBe(expectPush);
      expect(meta).toEqual(snap);
    }
  });
});

describe("planTodosValueForPush", () => {
  it("墓碑 id 不得進入上傳 payload", () => {
    const local = [todo(1), todo(2)];
    const out = planTodosValueForPush(local, [{ id: 1 }]);
    expect(out.map((t) => t.id)).toEqual([2]);
  });
});

describe("planPush／planDelete reviews", () => {
  it("墓碑 key 永不 planPush；僅墓碑命中才 planDelete", () => {
    expect(
      planPushReviews([{ key: "dead-free", updatedAt: TS[5] }], [], ["dead-free"]),
    ).toEqual([]);
    expect(planDeleteReviews([{ key: "other", updated_at: TS[1] }], ["dead-free"])).toEqual([]);
    expect(planDeleteReviews([{ key: "dead-free", updated_at: TS[1] }], ["dead-free"])).toEqual([
      "dead-free",
    ]);
  });
});

describe("E27 時間格式：雲端 +00:00 vs 本機 Z", () => {
  /** 重現：字串比較會讓本機恆大於雲端，pending 永不歸零。 */
  it("同一時刻本機 Z、雲端 +00:00 → planPush 空", () => {
    const local = "2026-09-24T08:48:11.964Z";
    const cloud = "2026-09-24T08:48:11.964+00:00";
    expect(planPushSessions([{ uuid: "u1", updatedAt: local }], [{ uuid: "u1", updated_at: cloud }], [])).toEqual(
      [],
    );
    expect(planPushAppStateKeys(["coins"], { coins: local }, [{ key: "coins", updated_at: cloud }])).toEqual([]);
    expect(planPushReviews([{ key: "k", updatedAt: local }], [{ key: "k", updated_at: cloud }], [])).toEqual([]);
  });
});

describe("syncNow 網路對帳", () => {
  it("300 筆 sessions：拉後驗證 pending 為 0、allClear", async () => {
    saveJSON(
      LS_KEYS.sessions,
      Array.from({ length: 300 }, (_, i) => session(i)),
    );
    const report = await syncNow({ timeoutMs: 30_000 });
    expect(report.loggedIn).toBe(true);
    expect(report.timedOut).toBe(false);
    const sessionsTarget = report.targets.find((t) => t.name === "sessions");
    expect(sessionsTarget?.pending).toBe(0);
    expect(report.allClear).toBe(true);
  });

  it("驗證後 index 仍缺 → pending>0、allClear 為假", async () => {
    hoisted.state.selectSessionsEmpty = true;
    saveJSON(LS_KEYS.sessions, [session(0), session(1)]);
    const report = await syncNow({ timeoutMs: 30_000 });
    expect(report.allClear).toBe(false);
    const sessionsTarget = report.targets.find((t) => t.name === "sessions");
    expect(sessionsTarget?.pending ?? 0).toBeGreaterThan(0);
  });

  it("墓碑 uuid 會從雲端刪除，且驗證後 planDelete 為空", async () => {
    hoisted.state.sessions.set("dead", { uuid: "dead", updated_at: TS[0] });
    hoisted.state.sessions.set("keep", { uuid: "keep", updated_at: TS[4] });
    saveJSON(LS_KEYS.deletedSessionUuids, [{ uuid: "dead", at: TS[1] }]);
    saveJSON(LS_KEYS.sessions, [session(9, TS[4])]);
    const report = await syncNow({ timeoutMs: 30_000 });
    expect(hoisted.state.sessions.has("dead")).toBe(false);
    expect(hoisted.state.sessions.has("keep")).toBe(true);
    const sessionsTarget = report.targets.find((t) => t.name === "sessions");
    expect(sessionsTarget?.deleted).toBe(1);
    expect(sessionsTarget?.pending).toBe(0);
  });
});
