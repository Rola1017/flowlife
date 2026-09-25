import {
  APP_STATE_KEYS,
  fetchAppStateIndex,
  loadAppStateLocalValue,
  loadAppStateMeta,
  syncAppStateFromCloud,
  upsertAppStateBatch,
} from "@/lib/appStateCloud";
import { getLocalSession, isOnline } from "@/lib/authState";
import { resetCloudWriteFailures } from "@/lib/cloudWrite";
import { CFG } from "@/lib/config";
import {
  deleteReviewsByKeys,
  ensureLocalFreeUuids,
  fetchReviewsIndex,
  pushFreeReviewsBatch,
  pushSingletonReviews,
  reviewIndexKey,
  reviewLocalKey,
  syncReviewsFromCloud,
  type ReviewEntry,
  type ReviewIndexRow,
} from "@/lib/reviews";
import {
  deleteSessionsCloud,
  fetchSessionsIndex,
  loadLocalSessionTombstoneUuids,
  loadLocalSessions,
  syncSessionsFromCloud,
  upsertSessionsBatch,
} from "@/lib/sessionsCloud";
import { LS_KEYS, loadJSON } from "@/lib/storage";
import { loadSyncDirty } from "@/lib/syncDirty";
import { mergeTodosWithTombstones, normalizeTodoList } from "@/lib/todosCloud";
import type { Session, Todo } from "@/lib/types";

export const CLOUD_BATCH_SIZE = 100;
export const SYNC_TIMEOUT_MS = 30_000;

export const SYNC_TARGET_LABELS: Record<string, string> = {
  sessions: "番茄",
  app_state: "設定／待辦",
  reviews: "覆盤",
};

export type SyncTargetReport = {
  name: string;
  pushed: number;
  deleted: number;
  pending: number;
  failed: number;
  lastError: string | null;
};

export type SyncReport = {
  timedOut: boolean;
  loggedIn: boolean;
  allClear: boolean;
  offline: boolean;
  targets: SyncTargetReport[];
};

export type CloudTsRow = { uuid: string; updated_at?: string; deleted_at?: string | null };

/** 本機 dirty 或雲端缺 → 入列。墓碑／雲端已軟刪永不入列。時間比較不決定要不要推。 */
export function planPushSessions(
  local: { uuid?: string; updatedAt?: string }[],
  cloud: CloudTsRow[],
  tombstones: Iterable<string>,
  dirty: Iterable<string> = [],
): string[] {
  const dead = new Set<string>();
  for (const u of tombstones) if (u) dead.add(u);
  const dirtySet = new Set<string>();
  for (const u of dirty) if (u) dirtySet.add(u);
  const cloudMap = new Map<string, CloudTsRow>();
  for (const c of cloud) {
    if (c.uuid) cloudMap.set(c.uuid, c);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of local) {
    if (!s.uuid || seen.has(s.uuid) || dead.has(s.uuid)) continue;
    seen.add(s.uuid);
    const row = cloudMap.get(s.uuid);
    if (row?.deleted_at) continue;
    if (row === undefined || dirtySet.has(s.uuid)) out.push(s.uuid);
  }
  return out;
}

/**
 * 雲端 index 中、uuid 在本機墓碑且尚未軟刪 → stamp deleted_at。
 * 嚴禁「雲端有、本機沒有且無墓碑」就刪（他機新資料；E05／E06）。
 */
export function planDeleteSessions(cloud: CloudTsRow[], tombstones: Iterable<string>): string[] {
  const dead = new Set<string>();
  for (const u of tombstones) if (u) dead.add(u);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of cloud) {
    if (!c.uuid || seen.has(c.uuid) || !dead.has(c.uuid) || c.deleted_at) continue;
    seen.add(c.uuid);
    out.push(c.uuid);
  }
  return out;
}

export function planPushAppStateKeys(
  keys: string[],
  meta: Record<string, string>,
  cloud: { key: string; updated_at?: string }[],
  dirty: Iterable<string> = [],
): string[] {
  void meta;
  const dirtySet = new Set<string>();
  for (const k of dirty) if (k) dirtySet.add(k);
  const cloudMap = new Map<string, string>();
  for (const c of cloud) cloudMap.set(c.key, c.updated_at ?? "");
  return keys.filter((k) => {
    const cts = cloudMap.get(k);
    if (cts === undefined) return true;
    return dirtySet.has(k);
  });
}

export type ReviewPlanLocal = { key: string; updatedAt: string };
export type ReviewPlanCloud = { key: string; updated_at: string; deleted_at?: string | null };

export function planPushReviews(
  local: ReviewPlanLocal[],
  cloud: ReviewPlanCloud[],
  tombstones: Iterable<string>,
  dirty: Iterable<string> = [],
): string[] {
  const dead = new Set<string>();
  for (const k of tombstones) if (k) dead.add(k);
  const dirtySet = new Set<string>();
  for (const k of dirty) if (k) dirtySet.add(k);
  const cloudMap = new Map<string, ReviewPlanCloud>();
  for (const c of cloud) if (c.key) cloudMap.set(c.key, c);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of local) {
    if (!r.key || seen.has(r.key) || dead.has(r.key)) continue;
    seen.add(r.key);
    const row = cloudMap.get(r.key);
    if (row?.deleted_at) continue;
    if (row === undefined || dirtySet.has(r.key)) out.push(r.key);
  }
  return out;
}

/** 僅 stamp 墓碑命中且尚未軟刪的雲端列。無墓碑的雲端獨有列一律不動。 */
export function planDeleteReviews(cloud: ReviewPlanCloud[], tombstones: Iterable<string>): string[] {
  const dead = new Set<string>();
  for (const k of tombstones) if (k) dead.add(k);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of cloud) {
    if (!c.key || seen.has(c.key) || !dead.has(c.key) || c.deleted_at) continue;
    seen.add(c.key);
    out.push(c.key);
  }
  return out;
}

/** 墓碑 id 不得進入上傳 payload（mergeTodosWithTombstones；不得整包盲推）。 */
export function planTodosValueForPush(local: Todo[], tombs: { id: number }[]): Todo[] {
  return mergeTodosWithTombstones(local, [], tombs).merged;
}

function loadLocalReviewTombstoneKeys(): Set<string> {
  const set = new Set<string>();
  const raw = loadJSON<unknown>(LS_KEYS.deletedReviewKeys, []);
  if (!Array.isArray(raw)) return set;
  for (const k of raw) {
    if (typeof k === "string" && k) set.add(k);
  }
  return set;
}

function reviewsToPlanLocal(list: ReviewEntry[]): ReviewPlanLocal[] {
  const out: ReviewPlanLocal[] = [];
  for (const r of list) {
    const key = reviewLocalKey(r);
    if (!key) continue;
    out.push({ key, updatedAt: r.updatedAt ?? r.createdAt ?? "" });
  }
  return out;
}

function reviewsToPlanCloud(rows: ReviewIndexRow[]): ReviewPlanCloud[] {
  return rows.map((row) => ({
    key: reviewIndexKey(row),
    updated_at: row.updated_at ?? "",
    deleted_at: row.deleted_at ?? null,
  }));
}

function chunk<T>(items: T[], size = CLOUD_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function getUidOnce(): Promise<string | null> {
  const s = await getLocalSession();
  return s.uid;
}

function emptyTarget(name: string): SyncTargetReport {
  return { name, pushed: 0, deleted: 0, pending: 0, failed: 0, lastError: null };
}

function markFail(tr: SyncTargetReport, err: string, pending: number) {
  tr.failed += 1;
  tr.lastError = err;
  tr.pending = pending;
}

async function runSessions(
  uid: string,
  tr: SyncTargetReport,
  onProgress?: (msg: string) => void,
): Promise<void> {
  const index = await fetchSessionsIndex(uid);
  const local = loadLocalSessions();
  const tombs = loadLocalSessionTombstoneUuids();
  const dirty = loadSyncDirty("sessions");
  if (index == null) {
    markFail(tr, "sessions index 讀取失敗", local.length);
    return;
  }
  const pushIds = planPushSessions(local, index, tombs, dirty);
  const delIds = planDeleteSessions(index, tombs);
  const byUuid = new Map<string, Session>();
  for (const s of local) if (s.uuid) byUuid.set(s.uuid, s);
  const toPush = pushIds.map((id) => byUuid.get(id)).filter((s): s is Session => Boolean(s));

  onProgress?.(`同步中…（番茄 0/${toPush.length}）`);
  let pushed = 0;
  for (const part of chunk(toPush)) {
    const ok = await upsertSessionsBatch(uid, part);
    if (!ok) {
      tr.failed += 1;
      tr.lastError = "sessions 上傳失敗";
    } else {
      pushed += part.length;
    }
    onProgress?.(`同步中…（番茄 ${Math.min(pushed, toPush.length)}/${toPush.length}）`);
  }
  tr.pushed = pushed;

  if (delIds.length) {
    const ok = await deleteSessionsCloud(delIds, uid);
    if (!ok) {
      tr.failed += 1;
      tr.lastError = "sessions 刪除失敗";
    } else {
      tr.deleted = delIds.length;
    }
  }

  const verify = await fetchSessionsIndex(uid);
  if (verify == null) {
    markFail(tr, "sessions 驗證讀取失敗", pushIds.length + delIds.length);
    return;
  }
  tr.pending =
    planPushSessions(loadLocalSessions(), verify, tombs, loadSyncDirty("sessions")).length +
    planDeleteSessions(verify, tombs).length;
}

function todosValueForPush(): unknown {
  const rawTombs = loadJSON<unknown>(LS_KEYS.deletedTodoIds, []);
  const tombs = Array.isArray(rawTombs) ? (rawTombs as { id?: unknown }[]) : [];
  const ids = tombs.filter((t): t is { id: number } => Boolean(t) && typeof t.id === "number");
  const local = normalizeTodoList(loadJSON(LS_KEYS.todos, []), CFG.TODAY_STR);
  return planTodosValueForPush(local, ids);
}

async function runAppState(uid: string, tr: SyncTargetReport): Promise<void> {
  const index = await fetchAppStateIndex(uid);
  const keys = Object.values(APP_STATE_KEYS);
  const meta = loadAppStateMeta();
  if (index == null) {
    markFail(tr, "app_state index 讀取失敗", keys.length);
    return;
  }
  const pushKeys = planPushAppStateKeys(keys, meta, index, loadSyncDirty("app_state"));
  const items = pushKeys.map((key) => ({
    key,
    value: key === APP_STATE_KEYS.todos ? todosValueForPush() : loadAppStateLocalValue(key),
    updatedAt: meta[key] || "1970-01-01T00:00:00.000Z",
  }));

  let pushed = 0;
  for (const part of chunk(items)) {
    const ok = await upsertAppStateBatch(uid, part);
    if (!ok) {
      tr.failed += 1;
      tr.lastError = "app_state 上傳失敗";
    } else {
      pushed += part.length;
    }
  }
  tr.pushed = pushed;

  const verify = await fetchAppStateIndex(uid);
  if (verify == null) {
    markFail(tr, "app_state 驗證讀取失敗", pushKeys.length);
    return;
  }
  tr.pending = planPushAppStateKeys(keys, loadAppStateMeta(), verify, loadSyncDirty("app_state")).length;
}

async function runReviews(uid: string, tr: SyncTargetReport): Promise<void> {
  const localList = ensureLocalFreeUuids();
  const index = await fetchReviewsIndex(uid);
  const tombs = loadLocalReviewTombstoneKeys();
  if (index == null) {
    markFail(tr, "reviews index 讀取失敗", localList.length);
    return;
  }
  const localPlan = reviewsToPlanLocal(localList);
  const cloudPlan = reviewsToPlanCloud(index);
  const pushKeys = planPushReviews(localPlan, cloudPlan, tombs, loadSyncDirty("reviews"));
  const delKeys = planDeleteReviews(cloudPlan, tombs);

  const byKey = new Map<string, ReviewEntry>();
  for (const r of localList) {
    const k = reviewLocalKey(r);
    if (k) byKey.set(k, r);
  }
  const toPush = pushKeys.map((k) => byKey.get(k)).filter((r): r is ReviewEntry => Boolean(r));
  const free = toPush.filter((r) => r.scope === "free");
  const singles = toPush.filter((r) => r.scope !== "free");

  if (free.length) {
    const ok = await pushFreeReviewsBatch(uid, free);
    if (!ok) {
      tr.failed += 1;
      tr.lastError = "reviews free 上傳失敗";
    } else {
      tr.pushed += free.length;
    }
  }
  if (singles.length) {
    const ok = await pushSingletonReviews(uid, singles);
    if (!ok) {
      tr.failed += 1;
      tr.lastError = "reviews singleton 上傳失敗";
    } else {
      tr.pushed += singles.length;
    }
  }

  if (delKeys.length) {
    const ok = await deleteReviewsByKeys(uid, delKeys);
    if (!ok) {
      tr.failed += 1;
      tr.lastError = "reviews 刪除失敗";
    } else {
      tr.deleted = delKeys.length;
    }
  }

  const verify = await fetchReviewsIndex(uid);
  if (verify == null) {
    markFail(tr, "reviews 驗證讀取失敗", pushKeys.length + delKeys.length);
    return;
  }
  const vCloud = reviewsToPlanCloud(verify);
  const vLocal = reviewsToPlanLocal(ensureLocalFreeUuids());
  tr.pending =
    planPushReviews(vLocal, vCloud, loadLocalReviewTombstoneKeys(), loadSyncDirty("reviews")).length +
    planDeleteReviews(vCloud, loadLocalReviewTombstoneKeys()).length;
}

async function runSync(report: SyncReport, onProgress?: (msg: string) => void): Promise<void> {
  const uid = await getUidOnce();
  if (!uid) {
    report.loggedIn = false;
    report.allClear = true;
    report.targets = [];
    return;
  }
  report.loggedIn = true;
  const sessions = emptyTarget("sessions");
  const appState = emptyTarget("app_state");
  const reviews = emptyTarget("reviews");
  report.targets = [sessions, appState, reviews];

  await syncSessionsFromCloud();
  await syncAppStateFromCloud();
  await syncReviewsFromCloud();

  await runSessions(uid, sessions, onProgress);
  onProgress?.("同步中…");
  await runAppState(uid, appState);
  await runReviews(uid, reviews);

  report.allClear =
    report.loggedIn &&
    report.targets.every((t) => t.pending === 0 && t.failed === 0);
  if (report.allClear) resetCloudWriteFailures();
}

function snapshotReport(report: SyncReport, timedOut: boolean): SyncReport {
  return {
    timedOut,
    loggedIn: report.loggedIn,
    allClear: timedOut ? false : report.allClear,
    offline: report.offline,
    targets: report.targets.map((t) => ({ ...t })),
  };
}

/**
 * 登出／設定頁同步唯一入口。拉→推→刪→驗證。增量對帳：上傳＋刪除＋不動。
 * 拉重用 sync*FromCloud（不得另寫合併）。不得提供 force。
 * 離線立即回傳，不得空轉到逾時。
 */
export async function syncNow(opts?: {
  timeoutMs?: number;
  onProgress?: (msg: string) => void;
}): Promise<SyncReport> {
  const timeoutMs = opts?.timeoutMs ?? SYNC_TIMEOUT_MS;
  const report: SyncReport = {
    timedOut: false,
    loggedIn: false,
    allClear: false,
    offline: false,
    targets: [],
  };

  if (!isOnline()) {
    const local = await getLocalSession();
    report.loggedIn = Boolean(local.uid);
    report.offline = true;
    report.allClear = false;
    return snapshotReport(report, false);
  }

  const work = runSync(report, opts?.onProgress).then(() => snapshotReport(report, false));
  const raced = await Promise.race([
    work,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
  if (raced) return raced;
  return snapshotReport(report, true);
}
