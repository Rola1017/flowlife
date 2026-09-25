import { markSyncDirty } from "@/lib/syncDirty";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import type { Session } from "@/lib/types";

function changedSessionUuids(prev: Session[], next: Session[]): string[] {
  const prevMap = new Map<string, string>();
  for (const s of prev) {
    if (!s.uuid) continue;
    prevMap.set(s.uuid, JSON.stringify(s));
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of next) {
    if (!s.uuid || seen.has(s.uuid)) continue;
    seen.add(s.uuid);
    const old = prevMap.get(s.uuid);
    if (old !== JSON.stringify(s)) out.push(s.uuid);
  }
  return out;
}

/** 本機 sessions 持久化：source=local 才標 dirty；cloud 套回不得標。 */
export function persistLocalSessions(next: Session[], prev: Session[] | undefined, source: "local" | "cloud"): void {
  if (source === "local") {
    const ids = prev ? changedSessionUuids(prev, next) : next.map((s) => s.uuid).filter((u): u is string => Boolean(u));
    markSyncDirty("sessions", ids);
  }
  saveJSON(LS_KEYS.sessions, next);
}

export function loadPersistedSessions(): Session[] {
  const v = loadJSON<Session[]>(LS_KEYS.sessions, []);
  return Array.isArray(v) ? v : [];
}
