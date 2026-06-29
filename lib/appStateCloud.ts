import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
  workplaces: "workplaces",
} as const;

type AppStateKey = (typeof APP_STATE_KEYS)[keyof typeof APP_STATE_KEYS];

const LS_FOR_KEY: Record<AppStateKey, string> = {
  [APP_STATE_KEYS.coins]: LS_KEYS.coins,
  [APP_STATE_KEYS.coinLog]: LS_KEYS.coinIncomeLog,
  [APP_STATE_KEYS.categories]: LS_KEYS.categories,
  [APP_STATE_KEYS.workplaces]: LS_KEYS.workplaces,
};

const DEFAULT_FOR_KEY: Record<AppStateKey, unknown> = {
  [APP_STATE_KEYS.coins]: 0,
  [APP_STATE_KEYS.coinLog]: [],
  [APP_STATE_KEYS.categories]: [],
  [APP_STATE_KEYS.workplaces]: [], // 不 import DEFAULT_WORKPLACES 避循環；loadWorkplaces 已有 fail-safe 回退
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
