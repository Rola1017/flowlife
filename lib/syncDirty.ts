import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";

/**
 * 本機 dirty 單一寫入口（§8-12）。
 * 衝突政策：兩台同時改同一筆＝後送達雲端者勝。單人雙裝置可接受；G2 佇列再評估是否細化。
 */
export type DirtyTarget = "sessions" | "reviews" | "app_state";

const KEY: Record<DirtyTarget, string> = {
  sessions: LS_KEYS.syncDirtySessions,
  reviews: LS_KEYS.syncDirtyReviews,
  app_state: LS_KEYS.syncDirtyAppState,
};

function loadSet(target: DirtyTarget): Set<string> {
  const raw = loadJSON<unknown>(KEY[target], []);
  const set = new Set<string>();
  if (!Array.isArray(raw)) return set;
  for (const x of raw) if (typeof x === "string" && x) set.add(x);
  return set;
}

function saveSet(target: DirtyTarget, set: Set<string>): void {
  saveJSON(KEY[target], [...set]);
}

export function loadSyncDirty(target: DirtyTarget): Set<string> {
  return loadSet(target);
}

export function isSyncDirty(target: DirtyTarget, id: string): boolean {
  if (!id) return false;
  return loadSet(target).has(id);
}

/** 任何本機寫入只准走這裡標 dirty。禁止各處 saveJSON dirty 鍵。 */
export function markSyncDirty(target: DirtyTarget, ids: Iterable<string>): void {
  const set = loadSet(target);
  let n = 0;
  for (const id of ids) {
    if (!id || set.has(id)) continue;
    set.add(id);
    n += 1;
  }
  if (n) saveSet(target, set);
}

/** 只在推送成功且已用 select 取回雲端郵戳寫回本機之後呼叫。 */
export function clearSyncDirty(target: DirtyTarget, ids: Iterable<string>): void {
  const set = loadSet(target);
  let n = 0;
  for (const id of ids) {
    if (!id || !set.has(id)) continue;
    set.delete(id);
    n += 1;
  }
  if (n) saveSet(target, set);
}
