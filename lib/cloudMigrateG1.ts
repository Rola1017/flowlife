import { persistAppStateDirty } from "@/lib/appStateCloud";
import { getLocalSession } from "@/lib/authState";
import { CFG } from "@/lib/config";
import { persistLocalReviews, reviewLocalKey, type ReviewEntry } from "@/lib/reviews";
import { persistLocalSessions } from "@/lib/sessionPersist";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSyncDirty } from "@/lib/syncDirty";
import { tsMs } from "@/lib/time";
import type { Session } from "@/lib/types";

export type G1MigrateResult = {
  marked: number;
  clamped: number;
  at: string;
};

const FUTURE_SKEW_MS = 60_000;

function sb() {
  return createSupabaseBrowserClient();
}

function isFuture(iso: string | null | undefined, nowMs: number): boolean {
  const ms = tsMs(iso);
  if (ms == null) return false;
  return ms > nowMs + FUTURE_SKEW_MS;
}

function loadResult(): G1MigrateResult | null {
  const v = loadJSON<G1MigrateResult | null>(LS_KEYS.g1MigrateResult, null);
  if (!v || typeof v.marked !== "number" || typeof v.clamped !== "number") return null;
  return v;
}

export function loadG1MigrateResult(): G1MigrateResult | null {
  return loadResult();
}

function saveResult(r: G1MigrateResult): void {
  saveJSON(LS_KEYS.g1MigrateResult, r);
}

function appendLocalBackup(entry: unknown): void {
  const cur = loadJSON<unknown[]>(LS_KEYS.g1MigrateBackup, []);
  const arr = Array.isArray(cur) ? cur : [];
  arr.push(entry);
  saveJSON(LS_KEYS.g1MigrateBackup, arr);
}

async function backupRow(
  uid: string,
  tableName: string,
  rowId: string,
  payload: unknown,
): Promise<void> {
  appendLocalBackup({ tableName, rowId, payload });
  const { error } = await sb().from("g1_migrate_backup").insert({
    user_id: uid,
    table_name: tableName,
    row_id: rowId,
    payload,
  });
  if (error) {
    console.info("[FlowLife] g1_migrate_backup 寫入略過", error.message);
  }
}

/**
 * G1 搬家：壓回前先備份；標記＝dirty 以便推上去拿雲端郵戳；壓回＝未來時戳。
 * 正式環境 CFG.G1_MIGRATE=false。冪等：本機已有結果則不再跑。
 */
export async function runG1MigrateIfNeeded(): Promise<G1MigrateResult | null> {
  if (!CFG.G1_MIGRATE) return loadResult();
  const existing = loadResult();
  if (existing) return existing;
  const { uid } = await getLocalSession();
  if (!uid) return null;

  const nowMs = Date.now();
  let marked = 0;
  let clamped = 0;

  const { data: sessions, error: sErr } = await sb()
    .from("sessions")
    .select("*")
    .eq("user_id", uid);
  if (!sErr) {
    for (const row of (sessions ?? []) as { uuid?: string; updated_at?: string; date?: string }[]) {
      if (!row.uuid) continue;
      await backupRow(uid, "sessions", row.uuid, row);
      marked += 1;
      const future = isFuture(row.updated_at, nowMs);
      if (future) clamped += 1;
      if (isSyncDirty("sessions", row.uuid)) continue;
      await sb().from("sessions").update({ date: row.date }).eq("user_id", uid).eq("uuid", row.uuid);
    }
  }

  const { data: reviews, error: rErr } = await sb()
    .from("reviews")
    .select("*")
    .eq("user_id", uid);
  if (!rErr) {
    for (const row of (reviews ?? []) as {
      id?: string;
      updated_at?: string;
      text?: string;
    }[]) {
      if (!row.id) continue;
      await backupRow(uid, "reviews", row.id, row);
      marked += 1;
      const future = isFuture(row.updated_at, nowMs);
      if (future) clamped += 1;
      if (isSyncDirty("reviews", row.id)) continue;
      await sb().from("reviews").update({ text: row.text }).eq("user_id", uid).eq("id", row.id);
    }
  }

  const { data: appRows, error: aErr } = await sb()
    .from("app_state")
    .select("key,value,updated_at")
    .eq("user_id", uid);
  const appKeys: string[] = [];
  if (!aErr) {
    for (const row of (appRows ?? []) as { key?: string; value?: unknown; updated_at?: string }[]) {
      if (!row.key) continue;
      await backupRow(uid, "app_state", row.key, row);
      marked += 1;
      appKeys.push(row.key);
      const future = isFuture(row.updated_at, nowMs);
      if (future) clamped += 1;
      if (isSyncDirty("app_state", row.key)) continue;
      await sb().from("app_state").update({ value: row.value }).eq("user_id", uid).eq("key", row.key);
    }
  }

  const localSessions = loadJSON<Session[]>(LS_KEYS.sessions, []);
  const nextSessions = localSessions.map((s) =>
    s.updatedAt && isFuture(s.updatedAt, nowMs) ? { ...s, updatedAt: new Date(nowMs).toISOString() } : s,
  );
  persistLocalSessions(nextSessions, [], "local");

  const localReviews = loadJSON<ReviewEntry[]>(LS_KEYS.reviews, []);
  const reviewKeys = localReviews.map(reviewLocalKey).filter((k): k is string => Boolean(k));
  persistLocalReviews(localReviews, reviewKeys);

  if (appKeys.length) persistAppStateDirty(appKeys);

  const result: G1MigrateResult = {
    marked,
    clamped,
    at: new Date(nowMs).toISOString(),
  };
  saveResult(result);
  return result;
}
