import { CFG } from "@/lib/config";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gcTodoTombstones, mergeTodosWithTombstones, normalizeTodoList } from "@/lib/todosCloud";

function sb() {
  return createSupabaseBrowserClient();
}

async function getUid(): Promise<string | null> {
  const { data } = await sb().auth.getUser();
  return data.user?.id ?? null;
}

export const APP_STATE_KEYS = {
  coins: "coins",
  coinLog: "coin_income_log",
  categories: "categories",
  tagGroups: "tag_groups",
  tags: "tags",
  workplaces: "workplaces",
  dayPlans: "day_plans",
  dayOverrides: "day_overrides",
  weekSchedule: "week_schedule",
  trashedSessions: "trashed_sessions",
  deletedSessions: "deleted_session_uuids",
  shopItems: "shop_items",
  routine: "routine",
  scheduleNote: "schedule_note",
  deletedTodos: "deleted_todo_ids",
  todos: "todos",
} as const;

type AppStateKey = (typeof APP_STATE_KEYS)[keyof typeof APP_STATE_KEYS];

const LS_FOR_KEY: Record<AppStateKey, string> = {
  [APP_STATE_KEYS.coins]: LS_KEYS.coins,
  [APP_STATE_KEYS.coinLog]: LS_KEYS.coinIncomeLog,
  [APP_STATE_KEYS.categories]: LS_KEYS.categories,
  [APP_STATE_KEYS.tagGroups]: LS_KEYS.tagGroups,
  [APP_STATE_KEYS.tags]: LS_KEYS.tags,
  [APP_STATE_KEYS.workplaces]: LS_KEYS.workplaces,
  [APP_STATE_KEYS.dayPlans]: LS_KEYS.dayPlans,
  [APP_STATE_KEYS.dayOverrides]: LS_KEYS.dayOverrides,
  [APP_STATE_KEYS.weekSchedule]: LS_KEYS.weekSchedule,
  [APP_STATE_KEYS.trashedSessions]: LS_KEYS.trashedSessions,
  [APP_STATE_KEYS.deletedSessions]: LS_KEYS.deletedSessionUuids,
  [APP_STATE_KEYS.shopItems]: LS_KEYS.shopItems,
  [APP_STATE_KEYS.routine]: LS_KEYS.routine,
  [APP_STATE_KEYS.scheduleNote]: LS_KEYS.scheduleNote,
  [APP_STATE_KEYS.deletedTodos]: LS_KEYS.deletedTodoIds,
  [APP_STATE_KEYS.todos]: LS_KEYS.todos,
};

const DEFAULT_FOR_KEY: Record<AppStateKey, unknown> = {
  [APP_STATE_KEYS.coins]: 0,
  [APP_STATE_KEYS.coinLog]: [],
  [APP_STATE_KEYS.categories]: [],
  [APP_STATE_KEYS.tagGroups]: [],
  [APP_STATE_KEYS.tags]: [],
  [APP_STATE_KEYS.workplaces]: [], // 不 import DEFAULT_WORKPLACES 避循環；loadWorkplaces 已有 fail-safe 回退
  [APP_STATE_KEYS.dayPlans]: {}, // 空物件；loadDayPlans 讀取時會正規化/補預設
  [APP_STATE_KEYS.dayOverrides]: {}, // 空物件；loadDayOverrides 讀取時正規化
  [APP_STATE_KEYS.weekSchedule]: {}, // 空物件；normalizeSchedule 讀取時處理
  [APP_STATE_KEYS.trashedSessions]: [],
  [APP_STATE_KEYS.deletedSessions]: [],
  [APP_STATE_KEYS.shopItems]: [],
  [APP_STATE_KEYS.routine]: [], // 空陣列；loadRoutine 讀取時 fallback DEFAULT_ROUTINE
  [APP_STATE_KEYS.scheduleNote]: "",
  [APP_STATE_KEYS.deletedTodos]: [],
  [APP_STATE_KEYS.todos]: [],
};

// 本地 meta：每個 key 的最後修改時間 {key: iso}
function loadMeta(): Record<string, string> {
  return loadJSON<Record<string, string>>(LS_KEYS.appStateMeta, {});
}
function setMetaTs(key: string, iso: string) {
  const m = loadMeta();
  m[key] = iso;
  saveJSON(LS_KEYS.appStateMeta, m);
}

// 以 key 分組的監聽
const listeners = new Map<string, Set<() => void>>();
export function subscribeAppState(key: string, cb: () => void) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
  };
}
function emit(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

/** 本地寫入後通知訂閱者重讀（不經雲端） */
export function notifyAppState(key: string) {
  emit(key);
}

/** 推單包到雲端（(user_id,key) 為主鍵 upsert） */
export async function pushAppState(key: string, value: unknown) {
  const uid = await getUid();
  if (!uid) return;
  const iso = new Date().toISOString();
  setMetaTs(key, iso);
  await sb()
    .from("app_state")
    .upsert({ user_id: uid, key, value, updated_at: iso }, { onConflict: "user_id,key" });
}

type AppStateRow = { key: string; value: unknown; updated_at: string };

/** todos 走逐筆 LWW＋墓碑過濾；不得把已刪 id 整包推回。deletedTodos 須已先寫入 LS。 */
function reconcileTodos(cloud: AppStateRow | undefined, localTs: string) {
  const rawTombs = loadJSON<unknown>(LS_KEYS.deletedTodoIds, []);
  const tombs = gcTodoTombstones(rawTombs, Date.now());
  if (tombs.length !== (Array.isArray(rawTombs) ? rawTombs.length : 0)) {
    saveJSON(LS_KEYS.deletedTodoIds, tombs);
    void pushAppState(APP_STATE_KEYS.deletedTodos, tombs);
  }
  const local = normalizeTodoList(loadJSON(LS_KEYS.todos, []), CFG.TODAY_STR);
  const remote = cloud ? normalizeTodoList(cloud.value, CFG.TODAY_STR) : [];
  const { merged, toPush, strippedRemote } = mergeTodosWithTombstones(local, remote, tombs);

  if (!cloud) {
    saveJSON(LS_KEYS.todos, merged);
    void pushAppState(APP_STATE_KEYS.todos, merged);
    return;
  }
  const cloudTs = cloud.updated_at ?? "";
  if (cloudTs > localTs) {
    saveJSON(LS_KEYS.todos, merged);
    setMetaTs(APP_STATE_KEYS.todos, cloudTs);
    emit(APP_STATE_KEYS.todos);
    if (strippedRemote || toPush.length) void pushAppState(APP_STATE_KEYS.todos, merged);
    return;
  }
  if (localTs > cloudTs) {
    saveJSON(LS_KEYS.todos, merged);
    void pushAppState(APP_STATE_KEYS.todos, merged);
  }
}

/** 拉＋合併（last-write-wins by updated_at） */
export async function syncAppStateFromCloud() {
  const uid = await getUid();
  if (!uid) return; // 未登入＝純本地
  const { data, error } = await sb()
    .from("app_state")
    .select("key,value,updated_at")
    .eq("user_id", uid);
  if (error || !data) return;

  const rows = data as AppStateRow[];
  const meta = loadMeta();

  for (const key of Object.values(APP_STATE_KEYS)) {
    const ls = LS_FOR_KEY[key];
    const cloud = rows.find((r) => r.key === key);
    const localTs = meta[key] ?? "";

    if (key === APP_STATE_KEYS.todos) {
      reconcileTodos(cloud, localTs);
      continue;
    }

    if (!cloud) {
      // 雲端沒有 → 首次把本地值推上雲
      void pushAppState(key, loadJSON(ls, DEFAULT_FOR_KEY[key]));
      continue;
    }

    if ((cloud.updated_at ?? "") > localTs) {
      saveJSON(ls, cloud.value);
      setMetaTs(key, cloud.updated_at);
      emit(key);
    } else if (localTs > (cloud.updated_at ?? "")) {
      void pushAppState(key, loadJSON(ls, DEFAULT_FOR_KEY[key]));
    }
  }
}
