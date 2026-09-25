import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { planPushAppStateKeys, planPushReviews, planPushSessions } from "@/lib/cloudSync";
import { tsMs, tsNewer } from "@/lib/time";

/**
 * 真實 Supabase 往返（紀律 §8-39）。未設 FLOWLIFE_TEST_EMAIL／PASSWORD 時 skip，
 * 並明確印出「契約測試已略過」，不得靜默跳過。
 * 契約測試只刪自己建立的探測列。G1 schema（deleted_at）未上線時，該組 skip 並印原因。
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
let g1Schema = false;

function sessionRow(userId: string, uuid: string) {
  return {
    uuid,
    user_id: userId,
    date: "2026-09-24",
    name: "e27-roundtrip",
    cat1: "學習",
    cat2: "",
    cat3: "",
    cat1_id: null,
    cat3_id: null,
    cat2_id: null,
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
    const probe = await sb.from("sessions").select("deleted_at").limit(1);
    g1Schema = !probe.error;
    if (!g1Schema) console.log("契約測試已略過：G1 schema 未上線（無 deleted_at）");
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
    await sb.auth.signOut({ scope: "local" });
  });

  it("寫入後雲端有列則不在 planPush（不dirty）；不要求裝置時間等於雲端郵戳", async () => {
    if (!sb || !uid) throw new Error("no client");
    const { error: aUp } = await sb.from("app_state").upsert(
      { user_id: uid, key: APP_KEY, value: { probe: true } },
      { onConflict: "user_id,key" },
    );
    expect(aUp).toBeNull();
    const aSel = await sb.from("app_state").select("updated_at").eq("user_id", uid).eq("key", APP_KEY).maybeSingle();
    const aGot = aSel.data?.updated_at ?? "";
    expect(tsMs(aGot)).not.toBeNull();
    expect(planPushAppStateKeys([APP_KEY], { [APP_KEY]: aGot }, [{ key: APP_KEY, updated_at: aGot }])).toEqual([]);

    const suuid = crypto.randomUUID();
    created.sessionUuids.push(suuid);
    const { error: sUp } = await sb.from("sessions").upsert(sessionRow(uid, suuid), { onConflict: "uuid" });
    expect(sUp).toBeNull();
    const sSel = await sb.from("sessions").select("updated_at").eq("user_id", uid).eq("uuid", suuid).maybeSingle();
    const sGot = sSel.data?.updated_at ?? "";
    expect(tsMs(sGot)).not.toBeNull();
    expect(planPushSessions([{ uuid: suuid, updatedAt: sGot }], [{ uuid: suuid, updated_at: sGot }], [])).toEqual([]);

    const rid = crypto.randomUUID();
    created.reviewIds.push(rid);
    const { error: rUp } = await sb.from("reviews").upsert(
      { id: rid, user_id: uid, scope: "free", period_key: "e27-roundtrip", text: "e27" },
      { onConflict: "id" },
    );
    expect(rUp).toBeNull();
    const rSel = await sb.from("reviews").select("updated_at").eq("user_id", uid).eq("id", rid).maybeSingle();
    const rGot = rSel.data?.updated_at ?? "";
    expect(tsMs(rGot)).not.toBeNull();
    expect(planPushReviews([{ key: rid, updatedAt: rGot }], [{ key: rid, updated_at: rGot }], [])).toEqual([]);
  });

  it("(c) 批次 upsert 100 筆後 index 筆數正確", async () => {
    if (!sb || !uid) throw new Error("no client");
    const userId = uid;
    const rows = Array.from({ length: 100 }, () => {
      const uuid = crypto.randomUUID();
      created.sessionUuids.push(uuid);
      return sessionRow(userId, uuid);
    });
    const { error } = await sb.from("sessions").upsert(rows, { onConflict: "uuid" });
    expect(error).toBeNull();
    const ids = rows.map((r) => r.uuid);
    const { data, error: selErr } = await sb.from("sessions").select("uuid").eq("user_id", uid).in("uuid", ids);
    expect(selErr).toBeNull();
    expect((data ?? []).length).toBe(100);
  });
});

describe.skipIf(!HAS_CREDS)("契約：G1 deleted_at trigger", () => {
  it("送非 null 的 deleted_at → 雲端存伺服器時間；送 null → 清除（還原）", async () => {
    if (!g1Schema) {
      console.log("契約測試已略過：G1 schema 未上線（無 deleted_at）");
      return;
    }
    if (!sb || !uid) throw new Error("no client");
    const suuid = crypto.randomUUID();
    created.sessionUuids.push(suuid);
    const fake = "2001-01-01T00:00:00.000Z";
    const { error: up } = await sb.from("sessions").upsert(sessionRow(uid, suuid), { onConflict: "uuid" });
    expect(up).toBeNull();
    const { error: delErr } = await sb.from("sessions").update({ deleted_at: fake }).eq("user_id", uid).eq("uuid", suuid);
    expect(delErr).toBeNull();
    const afterDel = await sb.from("sessions").select("deleted_at").eq("user_id", uid).eq("uuid", suuid).maybeSingle();
    const got = afterDel.data?.deleted_at ?? "";
    expect(tsMs(got)).not.toBeNull();
    expect(tsNewer(got, fake)).toBe(true);

    const { error: restErr } = await sb.from("sessions").update({ deleted_at: null }).eq("user_id", uid).eq("uuid", suuid);
    expect(restErr).toBeNull();
    const afterRest = await sb.from("sessions").select("deleted_at").eq("user_id", uid).eq("uuid", suuid).maybeSingle();
    expect(afterRest.data?.deleted_at).toBeNull();
  });
});
