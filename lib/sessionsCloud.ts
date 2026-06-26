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

/** 拉＋合併（last-write-wins）＋自動把本地較新者上雲 */
export async function syncSessionsFromCloud() {
  const uid = await getUid();
  if (!uid) return; // 沒登入＝純本地
  const { data: cloud, error } = await sb().from("sessions").select("*").eq("user_id", uid);
  if (error || !cloud) return;

  const local = loadLocal();
  const map = new Map<string, Session>();
  for (const s of local) if (s.uuid) map.set(s.uuid, s);

  const cloudUuids = new Set<string>();
  for (const r of cloud as SessionRow[]) {
    cloudUuids.add(r.uuid);
    const cur = map.get(r.uuid);
    if (!cur) {
      map.set(r.uuid, fromRow(r));
    } else if ((r.updated_at ?? "") > (cur.updatedAt ?? "")) {
      map.set(r.uuid, fromRow(r, cur.id));
    }
  }

  // 本地較新或雲端沒有者 → 推上雲
  for (const s of local) {
    if (!s.uuid) continue;
    const r = (cloud as SessionRow[]).find((x) => x.uuid === s.uuid);
    if (!cloudUuids.has(s.uuid) || (s.updatedAt ?? "") > (r?.updated_at ?? "")) {
      void pushSessionCloud(s.uuid);
    }
  }

  const merged = Array.from(map.values());
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
