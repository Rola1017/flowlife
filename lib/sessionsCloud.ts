import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  mins: number;
  rating: string;
  earned_coins: number;
  counted: boolean | null;
  start_time: string | null;
  end_time: string | null;
  intention: string | null;
  reflection: string | null;
  manual: boolean | null;
  updated_at: string;
};

function toRow(uid: string, s: Session): SessionRow {
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
    mins: s.mins,
    rating: s.rating,
    earned_coins: s.earnedCoins,
    counted: s.counted ?? null,
    start_time: s.startTime ?? null,
    end_time: s.endTime ?? null,
    intention: s.intention ?? null,
    reflection: s.reflection ?? null,
    manual: s.manual ?? null,
    updated_at: s.updatedAt ?? new Date().toISOString(),
  };
}

function fromRow(r: SessionRow, localId?: number): Session {
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
  };
}

/** 推單顆番茄到雲端（uuid 為主鍵 upsert） */
export async function pushSessionCloud(uuid: string) {
  const uid = await getUid();
  if (!uid) return;
  const s = loadLocal().find((x) => x.uuid === uuid);
  if (!s) return;
  await sb().from("sessions").upsert(toRow(uid, s), { onConflict: "uuid" });
}

/** 從雲端刪除某顆番茄 */
export async function deleteSessionCloud(uuid: string) {
  const uid = await getUid();
  if (!uid) return;
  await sb().from("sessions").delete().eq("user_id", uid).eq("uuid", uuid);
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
 * 等價於 syncSessionsFromCloud 的合併＋墓碑過濾：跳過墓碑雲端列、墓碑本地改刪雲、最後過濾 merged。
 */
export function mergeSessionsWithTombstones(
  local: Session[],
  cloud: Session[],
  tombstones: Set<string>,
): { merged: Session[]; toPush: Session[]; toDeleteFromCloud: string[] } {
  const map = new Map<string, Session>();
  for (const s of local) if (s.uuid) map.set(s.uuid, s);

  const cloudUuids = new Set<string>();
  for (const c of cloud) {
    if (!c.uuid) continue;
    cloudUuids.add(c.uuid);
    if (tombstones.has(c.uuid)) continue; // 墓碑：不得寫回本地
    const cur = map.get(c.uuid);
    if (!cur) {
      map.set(c.uuid, c);
    } else if ((c.updatedAt ?? "") > (cur.updatedAt ?? "")) {
      map.set(c.uuid, { ...c, id: cur.id });
    }
  }

  const toPush: Session[] = [];
  const toDeleteFromCloud: string[] = [];
  for (const s of local) {
    if (!s.uuid) continue;
    if (tombstones.has(s.uuid)) {
      toDeleteFromCloud.push(s.uuid);
      continue;
    }
    const c = cloud.find((x) => x.uuid === s.uuid);
    if (!cloudUuids.has(s.uuid) || (s.updatedAt ?? "") > (c?.updatedAt ?? "")) {
      toPush.push(s);
    }
  }

  const merged = Array.from(map.values()).filter((s) => !s.uuid || !tombstones.has(s.uuid));
  return { merged, toPush, toDeleteFromCloud };
}

/** 拉＋合併（last-write-wins）＋自動把本地較新者上雲；墓碑 uuid 不得復活 */
export async function syncSessionsFromCloud() {
  const uid = await getUid();
  if (!uid) return; // 沒登入＝純本地
  const { data: cloud, error } = await sb().from("sessions").select("*").eq("user_id", uid);
  if (error || !cloud) return;

  const trashed = await tombstoneSet(uid);
  const local = loadLocal();
  const cloudSessions = (cloud as SessionRow[]).map((r) => {
    const cur = local.find((s) => s.uuid === r.uuid);
    return fromRow(r, cur?.id);
  });
  const { merged, toPush, toDeleteFromCloud } = mergeSessionsWithTombstones(local, cloudSessions, trashed);
  for (const uuid of toDeleteFromCloud) void deleteSessionCloud(uuid);
  for (const s of toPush) if (s.uuid) void pushSessionCloud(s.uuid);
  saveJSON(LS_KEYS.sessions, merged);
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
