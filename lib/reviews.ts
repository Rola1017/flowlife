import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { reportCloudWriteResult } from "@/lib/cloudWrite";
import { DELETED_AT_STAMP } from "@/lib/cloudStamp";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearSyncDirty, loadSyncDirty, markSyncDirty } from "@/lib/syncDirty";
import { tsNewer } from "@/lib/time";

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

/** 覆盤本機持久化：dirtyKeys=null 表示雲端套回，不標 dirty。 */
export function persistLocalReviews(next: ReviewEntry[], dirtyKeys: Iterable<string> | null): void {
  if (dirtyKeys) markSyncDirty("reviews", dirtyKeys);
  saveJSON(LS_KEYS.reviews, next);
}

function addReviewTombstone(key: string | null): void {
  if (!key) return;
  const cur = loadJSON<unknown>(LS_KEYS.deletedReviewKeys, []);
  const arr = Array.isArray(cur) ? cur.filter((x): x is string => typeof x === "string") : [];
  if (arr.includes(key)) return;
  saveJSON(LS_KEYS.deletedReviewKeys, [...arr, key]);
}

function applyReviewStamp(key: string | null, updatedAt: string): void {
  if (!key || !updatedAt) return;
  const list = loadReviews();
  const next = list.map((r) => {
    const k = reviewLocalKey(r);
    return k === key ? { ...r, updatedAt } : r;
  });
  persistLocalReviews(next, null);
  clearSyncDirty("reviews", [key]);
}

async function getUid(): Promise<string | null> {
  const { data } = await sb().auth.getUser();
  return data.user?.id ?? null;
}

/** 清掉雲端該使用者所有覆盤（重置全部資料用，避免下次同步被拉回） */
export async function clearReviewsCloud(): Promise<void> {
  const uid = await getUid();
  if (!uid) return;
  const { error } = await sb().from("reviews").update({ deleted_at: DELETED_AT_STAMP }).eq("user_id", uid);
  reportCloudWriteResult("reviews", "update", { error });
}

export type ReviewIndexRow = {
  id: string;
  scope: string;
  period_key: string;
  updated_at: string;
  deleted_at: string | null;
};

export function reviewLocalKey(r: ReviewEntry): string | null {
  if (r.scope === "free") return r.uuid ?? null;
  return `${r.scope}|${r.periodKey}`;
}

export function reviewIndexKey(row: ReviewIndexRow): string {
  return row.scope === "free" ? row.id : `${row.scope}|${row.period_key}`;
}

export async function fetchReviewsIndex(uid: string): Promise<ReviewIndexRow[] | null> {
  const { data, error } = await sb()
    .from("reviews")
    .select("id,scope,period_key,updated_at,deleted_at")
    .eq("user_id", uid);
  if (error) return null;
  const out: ReviewIndexRow[] = [];
  for (const r of (data ?? []) as Partial<ReviewIndexRow>[]) {
    if (!r.id || !r.scope) continue;
    out.push({
      id: r.id,
      scope: r.scope,
      period_key: r.period_key ?? "",
      updated_at: r.updated_at ?? "",
      deleted_at: r.deleted_at ?? null,
    });
  }
  return out;
}

/** 推單筆到雲端（手動 upsert，避開 partial-index onConflict）。次數＝待推數，不得全量。 */
async function pushSingletonCloud(uid: string, r: ReviewEntry): Promise<boolean> {
  if (r.scope === "free") return true;
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
    deleted_at: null,
  };
  if (ex) {
    const { data, error } = await sb().from("reviews").update(payload).eq("id", ex.id).select("id,updated_at").maybeSingle();
    const ok = reportCloudWriteResult("reviews", "update", { error }, String(ex.id));
    if (ok && data?.updated_at) applyReviewStamp(reviewLocalKey(r), data.updated_at);
    return ok;
  }
  const { data, error } = await sb().from("reviews").insert(payload).select("id,updated_at").maybeSingle();
  const ok = reportCloudWriteResult("reviews", "insert", { error }, `${r.scope}:${r.periodKey}`);
  if (ok && data?.updated_at) applyReviewStamp(reviewLocalKey(r), data.updated_at);
  return ok;
}

/** 對帳後逐筆 select/update/insert，次數＝待推數。 */
export async function pushSingletonReviews(uid: string, entries: ReviewEntry[]): Promise<boolean> {
  let ok = true;
  for (const r of entries) {
    if (!(await pushSingletonCloud(uid, r))) ok = false;
  }
  return ok;
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

/** 推一則 free 到雲端（以 uuid 為 reviews 表 id 主鍵 upsert）。uid 可傳入，不得每則再 getUid。 */
export async function pushFreeCloud(entry: ReviewEntry, uid?: string): Promise<boolean> {
  if (!entry.uuid) return true;
  const userId = uid ?? (await getUid());
  if (!userId) return false;
  const { data, error } = await sb()
    .from("reviews")
    .upsert(
      {
        id: entry.uuid,
        user_id: userId,
        scope: "free",
        period_key: entry.periodKey,
        text: entry.text,
        deleted_at: null,
      },
      { onConflict: "id" },
    )
    .select("id,updated_at")
    .maybeSingle();
  const ok = reportCloudWriteResult("reviews", "upsert", { error }, entry.uuid);
  if (ok && data?.updated_at) applyReviewStamp(entry.uuid, data.updated_at);
  return ok;
}

function freeRow(uid: string, entry: ReviewEntry) {
  return {
    id: entry.uuid,
    user_id: uid,
    scope: "free" as const,
    period_key: entry.periodKey,
    text: entry.text,
    deleted_at: null,
  };
}

/** index 對帳後批次 upsert（chunks of 100）。 */
export async function pushFreeReviewsBatch(uid: string, entries: ReviewEntry[]): Promise<boolean> {
  const rows = entries.filter((e) => e.uuid).map((e) => freeRow(uid, e));
  if (!rows.length) return true;
  let ok = true;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { data, error } = await sb().from("reviews").upsert(chunk, { onConflict: "id" }).select("id,updated_at");
    if (!reportCloudWriteResult("reviews", "upsert", { error })) ok = false;
    else {
      for (const row of (data ?? []) as { id?: string; updated_at?: string }[]) {
        if (row.id && row.updated_at) applyReviewStamp(row.id, row.updated_at);
      }
    }
  }
  return ok;
}

export async function deleteReviewsByKeys(uid: string, keys: string[]): Promise<boolean> {
  const freeIds: string[] = [];
  const singletons: { scope: string; periodKey: string }[] = [];
  for (const key of keys) {
    if (!key) continue;
    const i = key.indexOf("|");
    if (i < 0) freeIds.push(key);
    else singletons.push({ scope: key.slice(0, i), periodKey: key.slice(i + 1) });
  }
  let ok = true;
  for (let i = 0; i < freeIds.length; i += 100) {
    const chunk = freeIds.slice(i, i + 100);
    const { error } = await sb()
      .from("reviews")
      .update({ deleted_at: DELETED_AT_STAMP })
      .eq("user_id", uid)
      .in("id", chunk);
    if (!reportCloudWriteResult("reviews", "update", { error })) ok = false;
  }
  for (const s of singletons) {
    const { error } = await sb()
      .from("reviews")
      .update({ deleted_at: DELETED_AT_STAMP })
      .eq("user_id", uid)
      .eq("scope", s.scope)
      .eq("period_key", s.periodKey);
    if (!reportCloudWriteResult("reviews", "update", { error }, `${s.scope}:${s.periodKey}`)) ok = false;
  }
  return ok;
}

export function ensureLocalFreeUuids(): ReviewEntry[] {
  const list = loadReviews();
  const ensured = ensureFreeUuids(list);
  if (ensured.changed) {
    persistLocalReviews(
      ensured.list,
      ensured.list.filter((r) => r.scope === "free" && r.uuid).map((r) => r.uuid!),
    );
  }
  return ensured.list;
}

/** 從雲端刪除一則 free */
async function deleteFreeCloud(uuid: string) {
  const uid = await getUid();
  if (!uid) return;
  const { error } = await sb()
    .from("reviews")
    .update({ deleted_at: DELETED_AT_STAMP })
    .eq("user_id", uid)
    .eq("id", uuid);
  reportCloudWriteResult("reviews", "update", { error }, uuid);
}

async function deleteSingletonCloud(uid: string, scope: ReviewScope, periodKey: string) {
  if (scope === "free") return;
  const { error } = await sb()
    .from("reviews")
    .update({ deleted_at: DELETED_AT_STAMP })
    .eq("user_id", uid)
    .eq("scope", scope)
    .eq("period_key", periodKey);
  reportCloudWriteResult("reviews", "update", { error }, `${scope}:${periodKey}`);
}

/** 拉＋合併（last-write-wins）＋自動遷移本地較新者上雲 */
export async function syncReviewsFromCloud() {
  const uid = await getUid();
  if (!uid) return; // 沒登入＝純本地
  const { data: cloud, error } = await sb()
    .from("reviews")
    .select("id,scope,period_key,text,created_at,updated_at,deleted_at")
    .eq("user_id", uid)
    .neq("scope", "free");
  if (error || !cloud) return;
  const local = loadReviews();
  const keyOf = (s: string, k: string) => `${s}|${k}`;
  const stamp = (c?: string, u?: string) => u ?? c ?? "";
  const dirty = loadSyncDirty("reviews");
  const localSingles = local.filter((r) => r.scope !== "free");
  let localFree = local.filter((r) => r.scope === "free");
  const map = new Map<string, ReviewEntry>();
  for (const r of localSingles) map.set(keyOf(r.scope, r.periodKey), r);
  for (const c of cloud) {
    const k = keyOf(c.scope, c.period_key);
    if (c.deleted_at) {
      addReviewTombstone(k);
      map.delete(k);
      continue;
    }
    if (dirty.has(k)) continue;
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
    else if (tsNewer(stamp(c.created_at, c.updated_at), stamp(cur.createdAt, cur.updatedAt)))
      map.set(k, cloudEntry);
  }
  const cloudKeys = new Set(
    cloud.filter((c) => !c.deleted_at).map((c) => keyOf(c.scope, c.period_key)),
  );
  for (const r of localSingles) {
    const k = keyOf(r.scope, r.periodKey);
    const c = cloud.find((x) => keyOf(x.scope, x.period_key) === k);
    if (c?.deleted_at && !dirty.has(k)) continue;
    if (dirty.has(k) || !cloudKeys.has(k) || tsNewer(stamp(r.createdAt, r.updatedAt), stamp(c?.created_at, c?.updated_at))) {
      await pushSingletonCloud(uid, r);
    }
  }
  // free(靈感) 以 uuid 為鍵做 last-write-wins 合併
  const ensured = ensureFreeUuids(localFree);
  if (ensured.changed) {
    localFree = ensured.list;
    persistLocalReviews([...localSingles, ...localFree], localFree.filter((r) => r.uuid).map((r) => r.uuid!));
  }
  const { data: cloudFree } = await sb()
    .from("reviews")
    .select("id,period_key,text,created_at,updated_at,deleted_at")
    .eq("user_id", uid)
    .eq("scope", "free");
  const freeMap = new Map<string, ReviewEntry>();
  for (const r of localFree) if (r.uuid) freeMap.set(r.uuid, r);
  if (cloudFree) {
    for (const c of cloudFree) {
      if (c.deleted_at) {
        addReviewTombstone(c.id);
        freeMap.delete(c.id);
        continue;
      }
      if (dirty.has(c.id)) continue;
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
      else if (tsNewer(stamp(c.created_at, c.updated_at), stamp(cur.createdAt, cur.updatedAt)))
        freeMap.set(c.id, cloudEntry);
    }
    const cloudFreeIds = new Set(cloudFree.filter((c) => !c.deleted_at).map((c) => c.id));
    for (const r of localFree) {
      if (!r.uuid) continue;
      const c = cloudFree.find((x) => x.id === r.uuid);
      if (c?.deleted_at && !dirty.has(r.uuid)) continue;
      if (dirty.has(r.uuid) || !cloudFreeIds.has(r.uuid) || tsNewer(stamp(r.createdAt, r.updatedAt), stamp(c?.created_at, c?.updated_at)))
        void pushFreeCloud(r);
    }
  }
  const mergedFree = Array.from(freeMap.values());

  const merged = [...Array.from(map.values()), ...mergedFree];
  persistLocalReviews(merged, null);
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

  const entry = next.find((r) => r.scope === scope && r.periodKey === periodKey);
  persistLocalReviews(next, trimmed ? [reviewLocalKey(entry ?? { id: 0, scope, periodKey, text: "", createdAt: now })].filter((k): k is string => Boolean(k)) : null);
  if (!trimmed) addReviewTombstone(scope === "free" ? prev[idx]?.uuid ?? `${scope}|${periodKey}` : `${scope}|${periodKey}`);
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
  persistLocalReviews(next, [reviewLocalKey(entry)].filter((k): k is string => Boolean(k)));
  emitReviews();
  if (scope === "free") void pushFreeCloud(entry);
  return next;
}

export function removeReview(id: number): ReviewEntry[] {
  const prev = loadReviews();
  const target = prev.find((r) => r.id === id);
  const next = prev.filter((r) => r.id !== id);
  persistLocalReviews(next, null);
  if (target) addReviewTombstone(reviewLocalKey(target));
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
