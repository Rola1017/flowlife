import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { planPushAppStateKeys, planPushReviews, planPushSessions } from "@/lib/cloudSync";
import { tsNewer } from "@/lib/time";

/**
 * 真實 Supabase 往返（紀律 §8-39）。未設 FLOWLIFE_TEST_EMAIL／PASSWORD 時 skip，
 * 並明確印出「契約測試已略過」，不得靜默跳過。
 */
const HAS_CREDS = Boolean(process.env.FLOWLIFE_TEST_EMAIL && process.env.FLOWLIFE_TEST_PASSWORD);
if (!HAS_CREDS) {
  console.log("契約測試已略過");
}

const APP_KEY = "_e27_roundtrip";
const created = {
  sessionUuids: [] as string[],
  reviewIds: [] as string[],
};

let sb: SupabaseClient | null = null;
let uid: string | null = null;

function sessionRow(userId: string, uuid: string, updatedAt: string) {
  return {
    uuid,
    user_id: userId,
    date: "2026-09-24",
    name: "e27-roundtrip",
    cat1: "學習",
    cat2: "",
    cat3: "",
    cat1_id: null,
    cat2_id: null,
    cat3_id: null,
    tag_ids: null,
    mins: 1,
    rating: "",
    earned_coins: 0,
    counted: null,
    start_time: null,
    end_time: null,
    intention: null,
    reflection: null,
    manual: true,
    updated_at: updatedAt,
  };
}

describe.skipIf(!HAS_CREDS)("契約：雲端時間往返", () => {
  beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const email = process.env.FLOWLIFE_TEST_EMAIL;
    const password = process.env.FLOWLIFE_TEST_PASSWORD;
    if (!url || !anon || !email || !password) return;
    sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.user?.id) throw new Error(error?.message ?? "signIn failed");
    uid = data.user.id;
  });

  afterAll(async () => {
    if (!sb || !uid) return;
    await sb.from("app_state").delete().eq("user_id", uid).eq("key", APP_KEY);
    for (let i = 0; i < created.sessionUuids.length; i += 100) {
      const chunk = created.sessionUuids.slice(i, i + 100);
      await sb.from("sessions").delete().eq("user_id", uid).in("uuid", chunk);
    }
    if (created.reviewIds.length) {
      await sb.from("reviews").delete().eq("user_id", uid).in("id", created.reviewIds);
    }
    await sb.auth.signOut();
  });

  it("(a)(b) app_state／sessions／reviews 寫入後 tsNewer 兩向 false，且不在 planPush", async () => {
    if (!sb || !uid) throw new Error("no client");
    const sent = "2026-09-24T08:48:11.964Z";

    const { error: aUp } = await sb.from("app_state").upsert(
      { user_id: uid, key: APP_KEY, value: { probe: true }, updated_at: sent },
      { onConflict: "user_id,key" },
    );
    expect(aUp).toBeNull();
    const aSel = await sb.from("app_state").select("updated_at").eq("user_id", uid).eq("key", APP_KEY).maybeSingle();
    const aGot = aSel.data?.updated_at ?? "";
    expect(tsNewer(sent, aGot)).toBe(false);
    expect(tsNewer(aGot, sent)).toBe(false);
    expect(planPushAppStateKeys([APP_KEY], { [APP_KEY]: sent }, [{ key: APP_KEY, updated_at: aGot }])).toEqual([]);

    const suuid = crypto.randomUUID();
    created.sessionUuids.push(suuid);
    const { error: sUp } = await sb.from("sessions").upsert(sessionRow(uid, suuid, sent), { onConflict: "uuid" });
    expect(sUp).toBeNull();
    const sSel = await sb.from("sessions").select("updated_at").eq("user_id", uid).eq("uuid", suuid).maybeSingle();
    const sGot = sSel.data?.updated_at ?? "";
    expect(tsNewer(sent, sGot)).toBe(false);
    expect(tsNewer(sGot, sent)).toBe(false);
    expect(planPushSessions([{ uuid: suuid, updatedAt: sent }], [{ uuid: suuid, updated_at: sGot }], [])).toEqual([]);

    const rid = crypto.randomUUID();
    created.reviewIds.push(rid);
    const { error: rUp } = await sb.from("reviews").upsert(
      { id: rid, user_id: uid, scope: "free", period_key: "e27-roundtrip", text: "e27", updated_at: sent },
      { onConflict: "id" },
    );
    expect(rUp).toBeNull();
    const rSel = await sb.from("reviews").select("updated_at").eq("user_id", uid).eq("id", rid).maybeSingle();
    const rGot = rSel.data?.updated_at ?? "";
    expect(tsNewer(sent, rGot)).toBe(false);
    expect(tsNewer(rGot, sent)).toBe(false);
    expect(planPushReviews([{ key: rid, updatedAt: sent }], [{ key: rid, updated_at: rGot }], [])).toEqual([]);
  });

  it("(c) 批次 upsert 100 筆後 index 筆數正確", async () => {
    if (!sb || !uid) throw new Error("no client");
    const userId = uid;
    const sent = "2026-09-24T08:48:11.964Z";
    const rows = Array.from({ length: 100 }, () => {
      const uuid = crypto.randomUUID();
      created.sessionUuids.push(uuid);
      return sessionRow(userId, uuid, sent);
    });
    const { error } = await sb.from("sessions").upsert(rows, { onConflict: "uuid" });
    expect(error).toBeNull();
    const ids = rows.map((r) => r.uuid);
    const { data, error: selErr } = await sb.from("sessions").select("uuid").eq("user_id", uid).in("uuid", ids);
    expect(selErr).toBeNull();
    expect((data ?? []).length).toBe(100);
  });
});
