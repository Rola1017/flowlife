import { reportCloudWriteResult } from "@/lib/cloudWrite";
import { DELETED_AT_STAMP } from "@/lib/cloudStamp";
import { persistLocalSessions } from "@/lib/sessionPersist";

export { persistLocalSessions };
import { LS_KEYS, loadJSON } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearSyncDirty, loadSyncDirty } from "@/lib/syncDirty";
import { tsNewer } from "@/lib/time";
import type { Session } from "@/lib/types";

function sb() {
  return createSupabaseBrowserClient();
}

const listeners = new Set<() => void>();
export function subscribeSessions(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function emitSessions() {
  listeners.forEach((l) => l());
}

async function getUid(): Promise<string | null> {
  const { data } = await sb().auth.getUser();
  return data.user?.id ?? null;
}

function loadLocal(): Session[] {
  const v = loadJSON<Session[]>(LS_KEYS.sessions, []);
  return Array.isArray(v) ? v : [];
}

export function loadLocalSessions(): Session[] {
  return loadLocal();
}

/** 本機墓碑：垃圾桶 uuid ＋ deleted_session_uuids。不含「雲端有、本機沒有」。 */
export function loadLocalSessionTombstoneUuids(): Set<string> {
  const set = new Set<string>();
  for (const s of loadJSON<Session[]>(LS_KEYS.trashedSessions, [])) {
    if (s?.uuid) set.add(s.uuid);
  }
  for (const d of loadJSON<{ uuid?: string }[]>(LS_KEYS.deletedSessionUuids, [])) {
    if (d?.uuid) set.add(d.uuid);
  }
  return set;
}

export type SessionIndexRow = { uuid: string; updated_at: string; deleted_at: string | null };

export async function fetchSessionsIndex(uid: string): Promise<SessionIndexRow[] | null> {
  const { data, error } = await sb()
    .from("sessions")
    .select("uuid, updated_at, deleted_at")
    .eq("user_id", uid);
  if (error) return null;
  const out: SessionIndexRow[] = [];
  for (const r of (data ?? []) as { uuid?: string; updated_at?: string; deleted_at?: string | null }[]) {
    if (!r.uuid) continue;
    out.push({ uuid: r.uuid, updated_at: r.updated_at ?? "", deleted_at: r.deleted_at ?? null });
  }
  return out;
}

function applySessionStamps(stamps: { uuid: string; updated_at: string }[]): void {
  if (!stamps.length) return;
  const map = new Map(stamps.map((s) => [s.uuid, s.updated_at]));
  const local = loadLocal();
  const next = local.map((s) =>
    s.uuid && map.has(s.uuid) ? { ...s, updatedAt: map.get(s.uuid) } : s,
  );
  persistLocalSessions(next, undefined, "cloud");
  clearSyncDirty(
    "sessions",
    stamps.map((s) => s.uuid),
  );
}

/** 單批 upsert。不送 updated_at；select 取回雲端郵戳後才清 dirty。 */
export async function upsertSessionsBatch(uid: string, sessions: Session[]): Promise<boolean> {
  const rows = sessions.filter((s) => s.uuid).map((s) => toRow(uid, s));
  if (!rows.length) return true;
  const { data, error } = await sb().from("sessions").upsert(rows, { onConflict: "uuid" }).select("uuid,updated_at");
  const ok = reportCloudWriteResult("sessions", "upsert", { error });
  if (!ok) return false;
  const stamps = ((data ?? []) as { uuid?: string; updated_at?: string }[])
    .filter((r): r is { uuid: string; updated_at: string } => Boolean(r.uuid && r.updated_at));
  applySessionStamps(stamps);
  return true;
}

type SessionRow = {
  uuid: string;
  user_id: string;
  date: string;
  name: string;
  cat1: string;
  cat2: string;
  cat3: string;
  cat1_id: string | null;
  cat2_id: string | null;
  cat3_id: string | null;
  tag_ids?: string[] | null;
  mins: number;
  rating: string;
  earned_coins: number;
  counted: boolean | null;
  start_time: string | null;
  end_time: string | null;
  intention: string | null;
  reflection: string | null;
  manual: boolean | null;
  updated_at?: string;
  deleted_at?: string | null;
};

export type SessionWriteRow = Omit<SessionRow, "updated_at"> & { deleted_at: null };

export function sessionToRow(uid: string, s: Session): SessionWriteRow {
  return {
    uuid: s.uuid as string,
    user_id: uid,
    date: s.date,
    name: s.name,
    cat1: s.cat1,
    cat2: s.cat2,
    cat3: s.cat3,
    cat1_id: s.cat1Id ?? null,
    cat2_id: s.cat2Id ?? null,
    cat3_id: s.cat3Id ?? null,
    tag_ids: s.tagIds && s.tagIds.length ? [...s.tagIds] : null,
    mins: s.mins,
    rating: s.rating,
    earned_coins: s.earnedCoins,
    counted: s.counted ?? null,
    start_time: s.startTime ?? null,
    end_time: s.endTime ?? null,
    intention: s.intention ?? null,
    reflection: s.reflection ?? null,
    manual: s.manual ?? null,
    deleted_at: null,
  };
}

export function sessionFromRow(r: SessionRow, localId?: number): Session {
  return {
    id: localId ?? Date.now() + Math.floor(Math.random() * 1000),
    uuid: r.uuid,
    date: r.date,
    name: r.name,
    cat1: r.cat1,
    cat2: r.cat2,
    cat3: r.cat3,
    cat1Id: r.cat1_id ?? undefined,
    cat2Id: r.cat2_id ?? undefined,
    cat3Id: r.cat3_id ?? undefined,
    tagIds: Array.isArray(r.tag_ids) && r.tag_ids.length ? r.tag_ids : undefined,
    mins: r.mins,
    rating: r.rating,
    earnedCoins: r.earned_coins ?? 0,
    counted: r.counted ?? undefined,
    startTime: r.start_time ?? undefined,
    endTime: r.end_time ?? undefined,
    intention: r.intention ?? undefined,
    reflection: r.reflection ?? undefined,
    manual: r.manual ?? undefined,
    updatedAt: r.updated_at ?? undefined,
    // INV-1：雲端 deleted_at 不得寫入 Session.deletedAt（那是進垃圾桶事件時間）
  };
}

function toRow(uid: string, s: Session): SessionWriteRow {
  return sessionToRow(uid, s);
}

function fromRow(r: SessionRow, localId?: number): Session {
  return sessionFromRow(r, localId);
}

/** 推單顆番茄到雲端（uuid 為主鍵 upsert） */
export async function pushSessionCloud(uuid: string): Promise<boolean> {
  const uid = await getUid();
  if (!uid) return false;
  const s = loadLocal().find((x) => x.uuid === uuid);
  if (!s) return false;
  const { data, error } = await sb().from("sessions").upsert(toRow(uid, s), { onConflict: "uuid" }).select("uuid,updated_at");
  const ok = reportCloudWriteResult("sessions", "upsert", { error }, uuid);
  if (!ok) return false;
  const stamps = ((data ?? []) as { uuid?: string; updated_at?: string }[])
    .filter((r): r is { uuid: string; updated_at: string } => Boolean(r.uuid && r.updated_at));
  applySessionStamps(stamps);
  return true;
}

/** 軟刪：寫 deleted_at（trigger 蓋伺服器時間）。還原則 upsert deleted_at: null。 */
export async function deleteSessionCloud(uuid: string): Promise<boolean> {
  const uid = await getUid();
  if (!uid) return false;
  const { error } = await sb()
    .from("sessions")
    .update({ deleted_at: DELETED_AT_STAMP })
    .eq("user_id", uid)
    .eq("uuid", uuid);
  return reportCloudWriteResult("sessions", "update", { error }, uuid);
}

export function collectSessionUuids(rows: { uuid?: string }[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of rows) {
    if (!s.uuid || seen.has(s.uuid)) continue;
    seen.add(s.uuid);
    out.push(s.uuid);
  }
  return out;
}

/** 合併墓碑：已有的保留 at，新 uuid 補上。純函式。 */
export function mergeDeletedSessionUuids(
  existing: { uuid: string; at: string }[],
  uuids: string[],
  at: string,
): { uuid: string; at: string }[] {
  const map = new Map<string, { uuid: string; at: string }>();
  for (const d of existing) {
    if (d?.uuid) map.set(d.uuid, d);
  }
  for (const uuid of uuids) {
    if (!uuid || map.has(uuid)) continue;
    map.set(uuid, { uuid, at });
  }
  return [...map.values()];
}

/** 批次從雲端刪番茄（chunks of 100）。未登入＝沒有雲端可刪，視為成功。uid 可傳入以免再 getUid。 */
export async function deleteSessionsCloud(uuids: string[], uid?: string): Promise<boolean> {
  const uniq = collectSessionUuids(uuids.map((uuid) => ({ uuid })));
  if (!uniq.length) return true;
  const userId = uid ?? (await getUid());
  if (!userId) return true;
  let ok = true;
  for (let i = 0; i < uniq.length; i += 100) {
    const chunk = uniq.slice(i, i + 100);
    const { error } = await sb()
      .from("sessions")
      .update({ deleted_at: DELETED_AT_STAMP })
      .eq("user_id", userId)
      .in("uuid", chunk);
    if (!reportCloudWriteResult("sessions", "update", { error })) ok = false;
  }
  return ok;
}

/** 墓碑集合：本機＋雲端 trashed_sessions／deleted_session_uuids（自給自足，不依賴 app_state sync 先跑） */
async function tombstoneSet(uid: string): Promise<Set<string>> {
  const set = new Set<string>();
  for (const s of loadJSON<Session[]>(LS_KEYS.trashedSessions, [])) {
    if (s?.uuid) set.add(s.uuid);
  }
  for (const d of loadJSON<{ uuid?: string }[]>(LS_KEYS.deletedSessionUuids, [])) {
    if (d?.uuid) set.add(d.uuid);
  }
  const { data } = await sb()
    .from("app_state")
    .select("key,value")
    .eq("user_id", uid)
    .in("key", ["trashed_sessions", "deleted_session_uuids"]);
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    const arr = Array.isArray(row.value) ? (row.value as { uuid?: string }[]) : [];
    for (const it of arr) if (it?.uuid) set.add(it.uuid);
  }
  return set;
}

/**
 * 同步合併純函式（無網路／無 localStorage）。
 * dirty 列不得被雲端值覆蓋（本機修改優先）。
 * cloudDeleted 視同墓碑（雲端 deleted_at），不得寫回 Session.deletedAt。
 */
export function mergeSessionsWithTombstones(
  local: Session[],
  cloud: Session[],
  tombstones: Set<string>,
  dirty: Iterable<string> = [],
  cloudDeleted: Iterable<string> = [],
): { merged: Session[]; toPush: Session[]; toDeleteFromCloud: string[] } {
  const dirtySet = new Set<string>();
  for (const id of dirty) if (id) dirtySet.add(id);
  const tombs = new Set<string>();
  for (const u of tombstones) if (u) tombs.add(u);
  for (const u of cloudDeleted) {
    if (u && !dirtySet.has(u)) tombs.add(u);
  }

  const map = new Map<string, Session>();
  for (const s of local) if (s.uuid) map.set(s.uuid, s);

  const cloudUuids = new Set<string>();
  for (const c of cloud) {
    if (!c.uuid) continue;
    cloudUuids.add(c.uuid);
    if (tombs.has(c.uuid)) continue;
    if (dirtySet.has(c.uuid)) continue;
    const cur = map.get(c.uuid);
    if (!cur) {
      map.set(c.uuid, c);
    } else if (tsNewer(c.updatedAt, cur.updatedAt)) {
      map.set(c.uuid, { ...c, id: cur.id });
    }
  }

  const toPush: Session[] = [];
  const toDeleteFromCloud: string[] = [];
  for (const s of local) {
    if (!s.uuid) continue;
    if (tombs.has(s.uuid)) {
      toDeleteFromCloud.push(s.uuid);
      continue;
    }
    const c = cloud.find((x) => x.uuid === s.uuid);
    if (
      dirtySet.has(s.uuid) ||
      !cloudUuids.has(s.uuid) ||
      tsNewer(s.updatedAt, c?.updatedAt)
    ) {
      toPush.push(s);
    }
  }

  const merged = Array.from(map.values()).filter((s) => !s.uuid || !tombs.has(s.uuid));
  return { merged, toPush, toDeleteFromCloud };
}

/** 拉＋合併（last-write-wins）＋自動把本地較新者上雲；墓碑 uuid 不得復活 */
export async function syncSessionsFromCloud() {
  const uid = await getUid();
  if (!uid) return;
  const { data: cloud, error } = await sb().from("sessions").select("*").eq("user_id", uid);
  if (error || !cloud) return;

  const trashed = await tombstoneSet(uid);
  const local = loadLocal();
  const dirty = loadSyncDirty("sessions");
  const cloudDeleted: string[] = [];
  const cloudSessions = (cloud as SessionRow[]).map((r) => {
    if (r.deleted_at && r.uuid) cloudDeleted.push(r.uuid);
    const cur = local.find((s) => s.uuid === r.uuid);
    return fromRow(r, cur?.id);
  });
  const { merged, toPush, toDeleteFromCloud } = mergeSessionsWithTombstones(
    local,
    cloudSessions,
    trashed,
    dirty,
    cloudDeleted,
  );
  for (const uuid of toDeleteFromCloud) void deleteSessionCloud(uuid);
  for (const s of toPush) if (s.uuid) void pushSessionCloud(s.uuid);
  persistLocalSessions(merged, undefined, "cloud");
  emitSessions();
}

/** 背景增量同步：依 prev→next 差異推送/刪除（全 fire-and-forget） */
export async function syncSessionDiffToCloud(prev: Session[], next: Session[]) {
  const prevByUuid = new Map<string, Session>();
  for (const s of prev) if (s.uuid) prevByUuid.set(s.uuid, s);
  const nextUuids = new Set<string>();

  for (const s of next) {
    if (!s.uuid) continue;
    nextUuids.add(s.uuid);
    const old = prevByUuid.get(s.uuid);
    if (!old || (old.updatedAt ?? "") !== (s.updatedAt ?? "")) {
      void pushSessionCloud(s.uuid);
    }
  }
  for (const s of prev) {
    if (s.uuid && !nextUuids.has(s.uuid)) {
      void deleteSessionCloud(s.uuid);
    }
  }
}

