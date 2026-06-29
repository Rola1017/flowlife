import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type ReviewScope = "day" | "week" | "month" | "quarter" | "free";

export type ReviewEntry = {
  id: number;
  scope: ReviewScope;
  periodKey: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  /** free(靈感) 跨裝置唯一鍵（對應 reviews 表 id 欄；單筆覆盤不用） */
  uuid?: string;
};

function sb() {
  return createSupabaseBrowserClient();
}

const listeners = new Set<() => void>();
export function subscribeReviews(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function emitReviews() {
  listeners.forEach((l) => l());
}

async function getUid(): Promise<string | null> {
  const { data } = await sb().auth.getUser();
  return data.user?.id ?? null;
}

/** 清掉雲端該使用者所有覆盤（重置全部資料用，避免下次同步被拉回） */
export async function clearReviewsCloud(): Promise<void> {
  const uid = await getUid();
  if (!uid) return;
  await sb().from("reviews").delete().eq("user_id", uid);
}

/** 推單筆到雲端（手動 upsert，避開 partial-index onConflict） */
async function pushSingletonCloud(uid: string, r: ReviewEntry) {
  if (r.scope === "free") return;
  const { data: ex } = await sb()
    .from("reviews")
    .select("id")
    .eq("user_id", uid)
    .eq("scope", r.scope)
    .eq("period_key", r.periodKey)
    .maybeSingle();
  const payload = {
    user_id: uid,
    scope: r.scope,
    period_key: r.periodKey,
    text: r.text,
    updated_at: r.updatedAt ?? r.createdAt,
  };
  if (ex) await sb().from("reviews").update(payload).eq("id", ex.id);
  else await sb().from("reviews").insert(payload);
}

/** 對 free 且無 uuid 者補上 uuid（冪等） */
function ensureFreeUuids(list: ReviewEntry[]): { list: ReviewEntry[]; changed: boolean } {
  let changed = false;
  const next = list.map((r) => {
    if (r.scope === "free" && !r.uuid) {
      changed = true;
      return { ...r, uuid: crypto.randomUUID() };
    }
    return r;
  });
  return { list: changed ? next : list, changed };
}

/** 推一則 free 到雲端（以 uuid 為 reviews 表 id 主鍵 upsert） */
async function pushFreeCloud(entry: ReviewEntry) {
  if (!entry.uuid) return;
  const uid = await getUid();
  if (!uid) return;
  await sb()
    .from("reviews")
    .upsert(
      {
        id: entry.uuid,
        user_id: uid,
        scope: "free",
        period_key: entry.periodKey,
        text: entry.text,
        updated_at: entry.updatedAt ?? entry.createdAt,
      },
      { onConflict: "id" },
    );
}

/** 從雲端刪除一則 free */
async function deleteFreeCloud(uuid: string) {
  const uid = await getUid();
  if (!uid) return;
  await sb().from("reviews").delete().eq("user_id", uid).eq("id", uuid);
}

async function deleteSingletonCloud(uid: string, scope: ReviewScope, periodKey: string) {
  if (scope === "free") return;
  await sb()
    .from("reviews")
    .delete()
    .eq("user_id", uid)
    .eq("scope", scope)
    .eq("period_key", periodKey);
}

/** 拉＋合併（last-write-wins）＋自動遷移本地較新者上雲 */
export async function syncReviewsFromCloud() {
  const uid = await getUid();
  if (!uid) return; // 沒登入＝純本地
  const { data: cloud, error } = await sb()
    .from("reviews")
    .select("scope,period_key,text,created_at,updated_at")
    .eq("user_id", uid)
    .neq("scope", "free");
  if (error || !cloud) return;
  const local = loadReviews();
  const keyOf = (s: string, k: string) => `${s}|${k}`;
  const stamp = (c?: string, u?: string) => u ?? c ?? "";
  const localSingles = local.filter((r) => r.scope !== "free");
  let localFree = local.filter((r) => r.scope === "free");
  const map = new Map<string, ReviewEntry>();
  for (const r of localSingles) map.set(keyOf(r.scope, r.periodKey), r);
  for (const c of cloud) {
    const k = keyOf(c.scope, c.period_key);
    const cur = map.get(k);
    const cloudEntry: ReviewEntry = {
      id: cur?.id ?? Math.max(Date.now(), 1),
      scope: c.scope as ReviewScope,
      periodKey: c.period_key,
      text: c.text,
      createdAt: c.created_at,
      updatedAt: c.updated_at ?? undefined,
    };
    if (!cur) map.set(k, cloudEntry);
    else if (stamp(c.created_at, c.updated_at) > stamp(cur.createdAt, cur.updatedAt))
      map.set(k, cloudEntry);
  }
  const cloudKeys = new Set(cloud.map((c) => keyOf(c.scope, c.period_key)));
  for (const r of localSingles) {
    const k = keyOf(r.scope, r.periodKey);
    const c = cloud.find((x) => keyOf(x.scope, x.period_key) === k);
    if (!cloudKeys.has(k) || stamp(r.createdAt, r.updatedAt) > stamp(c?.created_at, c?.updated_at)) {
      await pushSingletonCloud(uid, r);
    }
  }
  // free(靈感) 以 uuid 為鍵做 last-write-wins 合併
  const ensured = ensureFreeUuids(localFree);
  if (ensured.changed) {
    localFree = ensured.list;
    saveJSON(LS_KEYS.reviews, [...localSingles, ...localFree]);
  }
  const { data: cloudFree } = await sb()
    .from("reviews")
    .select("id,period_key,text,created_at,updated_at")
    .eq("user_id", uid)
    .eq("scope", "free");
  const freeMap = new Map<string, ReviewEntry>();
  for (const r of localFree) if (r.uuid) freeMap.set(r.uuid, r);
  if (cloudFree) {
    for (const c of cloudFree) {
      const cur = freeMap.get(c.id);
      const cloudEntry: ReviewEntry = {
        id: cur?.id ?? Math.max(Date.now(), 1),
        scope: "free",
        periodKey: c.period_key,
        text: c.text,
        createdAt: c.created_at,
        updatedAt: c.updated_at ?? undefined,
        uuid: c.id,
      };
      if (!cur) freeMap.set(c.id, cloudEntry);
      else if (stamp(c.created_at, c.updated_at) > stamp(cur.createdAt, cur.updatedAt))
        freeMap.set(c.id, cloudEntry);
    }
    const cloudFreeIds = new Set(cloudFree.map((c) => c.id));
    for (const r of localFree) {
      if (!r.uuid) continue;
      const c = cloudFree.find((x) => x.id === r.uuid);
      if (!cloudFreeIds.has(r.uuid) || stamp(r.createdAt, r.updatedAt) > stamp(c?.created_at, c?.updated_at))
        void pushFreeCloud(r);
    }
  }
  const mergedFree = Array.from(freeMap.values());

  const merged = [...Array.from(map.values()), ...mergedFree];
  saveJSON(LS_KEYS.reviews, merged);
  emitReviews();
}

export function loadReviews(): ReviewEntry[] {
  const v = loadJSON<ReviewEntry[]>(LS_KEYS.reviews, []);
  return Array.isArray(v) ? v : [];
}

export function getReview(scope: ReviewScope, periodKey: string): ReviewEntry | undefined {
  return loadReviews().find((r) => r.scope === scope && r.periodKey === periodKey);
}

function nextId(existing: ReviewEntry[]): number {
  const maxId = existing.reduce((m, r) => Math.max(m, r.id), 0);
  return Math.max(Date.now(), maxId + 1);
}

/** 覆盤表寫入單一來源：空白 text 視為刪除該筆 */
export function upsertReview(scope: ReviewScope, periodKey: string, text: string): ReviewEntry[] {
  const trimmed = text.trim();
  const now = new Date().toISOString();
  const prev = loadReviews();
  const idx = prev.findIndex((r) => r.scope === scope && r.periodKey === periodKey);

  let next: ReviewEntry[];
  if (!trimmed) {
    next = prev.filter((r) => !(r.scope === scope && r.periodKey === periodKey));
  } else if (idx >= 0) {
    next = prev.map((r, i) =>
      i === idx ? { ...r, text: trimmed, updatedAt: now } : r,
    );
  } else {
    next = [
      ...prev,
      {
        id: nextId(prev),
        scope,
        periodKey,
        text: trimmed,
        createdAt: now,
      },
    ];
  }

  saveJSON(LS_KEYS.reviews, next);
  emitReviews();
  if (scope !== "free") {
    if (!trimmed) {
      void getUid().then((uid) => {
        if (uid) void deleteSingletonCloud(uid, scope, periodKey);
      });
    } else {
      const entry = next.find((r) => r.scope === scope && r.periodKey === periodKey);
      if (entry)
        void getUid().then((uid) => {
          if (uid) void pushSingletonCloud(uid, entry);
        });
    }
  }
  return next;
}

/** 追加一則（靈感等多則場景）；空白 text 不動 */
export function addReview(scope: ReviewScope, periodKey: string, text: string): ReviewEntry[] {
  const trimmed = text.trim();
  if (!trimmed) return loadReviews();
  const prev = loadReviews();
  const entry: ReviewEntry = {
    id: nextId(prev),
    scope,
    periodKey,
    text: trimmed,
    createdAt: new Date().toISOString(),
    ...(scope === "free" ? { uuid: crypto.randomUUID() } : {}),
  };
  const next = [...prev, entry];
  saveJSON(LS_KEYS.reviews, next);
  emitReviews();
  if (scope === "free") void pushFreeCloud(entry);
  return next;
}

export function removeReview(id: number): ReviewEntry[] {
  const prev = loadReviews();
  const target = prev.find((r) => r.id === id);
  const next = prev.filter((r) => r.id !== id);
  saveJSON(LS_KEYS.reviews, next);
  emitReviews();
  if (target && target.scope !== "free") {
    void getUid().then((uid) => {
      if (uid) void deleteSingletonCloud(uid, target.scope, target.periodKey);
    });
  } else if (target?.scope === "free" && target.uuid) {
    void deleteFreeCloud(target.uuid);
  }
  return next;
}
