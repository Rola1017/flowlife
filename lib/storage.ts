/** localStorage key 前綴，v1 用來隔離未來資料格式變更 */
const STORAGE_PREFIX = "flowlife_v1_";
const LEGACY_STORAGE_PREFIX = "flowlife_";

export const LS_KEYS = {
  todos: `${STORAGE_PREFIX}todos`,
  deletedTodoIds: `${STORAGE_PREFIX}deleted_todo_ids`,
  coins: `${STORAGE_PREFIX}coins`,
  pomodoroSessions: `${STORAGE_PREFIX}pomodoro_sessions`,
  /** @alias pomodoroSessions */
  sessions: `${STORAGE_PREFIX}pomodoro_sessions`,
  ratingCounts: `${STORAGE_PREFIX}rating_counts`,
  coinIncomeLog: `${STORAGE_PREFIX}coin_income_log`,
  dailyOverride: `${STORAGE_PREFIX}daily_override_`,
  routineOverride: `${STORAGE_PREFIX}routine_override_`,
  categories: `${STORAGE_PREFIX}categories`,
  tagGroups: `${STORAGE_PREFIX}tag_groups`,
  tags: `${STORAGE_PREFIX}tags`,
  weekSchedule: `${STORAGE_PREFIX}week_schedule`,
  colorPalette: `${STORAGE_PREFIX}color_palette`,
  dayPlans: `${STORAGE_PREFIX}day_plans`,
  dayOverrides: `${STORAGE_PREFIX}day_overrides`,
  scheduleHistory: `${STORAGE_PREFIX}schedule_history`,
  timelineTodoView: `${STORAGE_PREFIX}timeline_todo_view`,
  tagManagerHelp: `${STORAGE_PREFIX}tag_manager_help`,
  /** 標籤管理「番茄面板預覽」是否展開（本機，預設收折） */
  tagPanelPreview: `${STORAGE_PREFIX}tag_panel_preview`,
  /** 番茄最近標籤組合（本機快捷，不上雲） */
  tagCombos: `${STORAGE_PREFIX}tag_combos`,
  reviews: `${STORAGE_PREFIX}reviews`,
  s2Backup: `${STORAGE_PREFIX}s2_backup`,
  appStateMeta: `${STORAGE_PREFIX}_appstate_meta`,
  workplaces: `${STORAGE_PREFIX}workplaces`,
  trashedSessions: `${STORAGE_PREFIX}trashed_sessions`,
  deletedSessionUuids: `${STORAGE_PREFIX}deleted_session_uuids`,
  shopItems: `${STORAGE_PREFIX}shop_items`,
  activeEnt: `${STORAGE_PREFIX}active_entertainment`,
  routine: `${STORAGE_PREFIX}routine`,
  scheduleNote: `${STORAGE_PREFIX}schedule_note`,
  /** 本機資料歸屬帳號（不走 v1 前綴／assertVersionedKey，避免與應用資料鍵混用） */
  ownerUserId: "flowlife_owner_user_id",
} as const;

/** 金幣帳本一次性遷移旗標（不在 LS_KEYS 內，清除時仍要刪） */
export const COIN_LEDGER_MIGRATED_KEY = "flowlife_coin_ledger_migrated";

/**
 * 應用資料精確鍵（不含 ownerUserId、不含日期後綴前綴）。
 * sessions 與 pomodoroSessions 同鍵，只列一次。
 */
export const APP_DATA_EXACT_KEYS: readonly string[] = [
  LS_KEYS.todos,
  LS_KEYS.deletedTodoIds,
  LS_KEYS.coins,
  LS_KEYS.pomodoroSessions,
  LS_KEYS.ratingCounts,
  LS_KEYS.coinIncomeLog,
  LS_KEYS.categories,
  LS_KEYS.tagGroups,
  LS_KEYS.tags,
  LS_KEYS.weekSchedule,
  LS_KEYS.colorPalette,
  LS_KEYS.dayPlans,
  LS_KEYS.dayOverrides,
  LS_KEYS.scheduleHistory,
  LS_KEYS.timelineTodoView,
  LS_KEYS.tagManagerHelp,
  LS_KEYS.tagPanelPreview,
  LS_KEYS.tagCombos,
  LS_KEYS.reviews,
  LS_KEYS.s2Backup,
  LS_KEYS.appStateMeta,
  LS_KEYS.workplaces,
  LS_KEYS.trashedSessions,
  LS_KEYS.deletedSessionUuids,
  LS_KEYS.shopItems,
  LS_KEYS.activeEnt,
  LS_KEYS.routine,
  LS_KEYS.scheduleNote,
];

/** 帶日期後綴的鍵前綴：只掃這兩條，禁止泛用 flowlife_ 迴圈 */
export const APP_DATA_PREFIXES: readonly string[] = [LS_KEYS.dailyOverride, LS_KEYS.routineOverride];

export const EXTRA_APP_KEYS: readonly string[] = [COIN_LEDGER_MIGRATED_KEY];

function assertVersionedKey(key: string): void {
  if (!key.startsWith(STORAGE_PREFIX)) {
    throw new Error(`localStorage key must start with ${STORAGE_PREFIX}: ${key}`);
  }
}

function legacyKeyFor(key: string): string {
  return key.replace(STORAGE_PREFIX, LEGACY_STORAGE_PREFIX);
}

function loadRawWithMigration(key: string): string | null {
  if (typeof window === "undefined") return null;
  assertVersionedKey(key);

  const current = localStorage.getItem(key);
  if (current != null) return current;

  const legacyKey = legacyKeyFor(key);
  const legacy = localStorage.getItem(legacyKey);
  if (legacy == null) return null;

  localStorage.setItem(key, legacy);
  localStorage.removeItem(legacyKey);
  return legacy;
}

function removeLegacyKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(legacyKeyFor(key));
}

export function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = loadRawWithMigration(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    assertVersionedKey(key);
    localStorage.setItem(key, JSON.stringify(value));
    removeLegacyKey(key);
  } catch {
    /* quota / private mode */
  }
}

export function removeKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    assertVersionedKey(key);
    localStorage.removeItem(key);
    removeLegacyKey(key);
  } catch {}
}

export function loadNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = loadRawWithMigration(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function saveNumber(key: string, value: number): void {
  if (typeof window === "undefined") return;
  try {
    assertVersionedKey(key);
    localStorage.setItem(key, String(value));
    removeLegacyKey(key);
  } catch {
    /* ignore */
  }
}

export function hasS2Backup(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_KEYS.s2Backup) != null;
}

/** S2 一次性全量備份（冪等）：已存在備份就不覆蓋，只在首次遷移前留底 */
export function snapshotForS2(): void {
  if (typeof window === "undefined") return;
  if (hasS2Backup()) return;
  try {
    const backup = {
      takenAt: new Date().toISOString(),
      data: {
        categories: localStorage.getItem(LS_KEYS.categories),
        pomodoroSessions: localStorage.getItem(LS_KEYS.pomodoroSessions),
        coinIncomeLog: localStorage.getItem(LS_KEYS.coinIncomeLog),
        weekSchedule: localStorage.getItem(LS_KEYS.weekSchedule),
      },
    };
    localStorage.setItem(LS_KEYS.s2Backup, JSON.stringify(backup));
  } catch {
    /* quota / private mode */
  }
}

/** 一鍵還原 S2 備份：把備份中非 null 的四鍵原始字串寫回；無備份回 false */
export function restoreFromS2Backup(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(LS_KEYS.s2Backup);
    if (raw == null) return false;
    type BackupField = "categories" | "pomodoroSessions" | "coinIncomeLog" | "weekSchedule";
    const backup = JSON.parse(raw) as {
      data?: Partial<Record<BackupField, string | null>>;
    };
    const map: Record<BackupField, string> = {
      categories: LS_KEYS.categories,
      pomodoroSessions: LS_KEYS.pomodoroSessions,
      coinIncomeLog: LS_KEYS.coinIncomeLog,
      weekSchedule: LS_KEYS.weekSchedule,
    };
    for (const field of Object.keys(map) as BackupField[]) {
      const val = backup.data?.[field];
      if (val != null) localStorage.setItem(map[field], val);
    }
    return true;
  } catch {
    return false;
  }
}

export function loadOwnerUserId(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(LS_KEYS.ownerUserId);
  return v && v.trim() ? v : null;
}

export function saveOwnerUserId(uid: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEYS.ownerUserId, uid);
}

export function clearOwnerUserId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_KEYS.ownerUserId);
}

function collectPrefixKeys(prefixes: readonly string[]): string[] {
  if (typeof window === "undefined") return [];
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && prefixes.some((p) => k.startsWith(p))) out.push(k);
  }
  return out;
}

export function hasLocalAppData(): boolean {
  if (typeof window === "undefined") return false;
  for (const key of APP_DATA_EXACT_KEYS) {
    if (localStorage.getItem(key) != null) return true;
    if (localStorage.getItem(legacyKeyFor(key)) != null) return true;
  }
  for (const key of EXTRA_APP_KEYS) {
    if (localStorage.getItem(key) != null) return true;
  }
  const prefixes = [
    ...APP_DATA_PREFIXES,
    ...APP_DATA_PREFIXES.map((p) => p.replace(STORAGE_PREFIX, LEGACY_STORAGE_PREFIX)),
  ];
  return collectPrefixKeys(prefixes).length > 0;
}

/** 清除所有應用資料鍵。不含 ownerUserId。禁止泛用前綴亂刪。 */
export function clearAllAppData(): void {
  if (typeof window === "undefined") return;
  let n = 0;
  const drop = (key: string) => {
    if (localStorage.getItem(key) == null) return;
    localStorage.removeItem(key);
    n += 1;
  };
  for (const key of APP_DATA_EXACT_KEYS) {
    drop(key);
    drop(legacyKeyFor(key));
  }
  for (const key of EXTRA_APP_KEYS) drop(key);
  const prefixes = [
    ...APP_DATA_PREFIXES,
    ...APP_DATA_PREFIXES.map((p) => p.replace(STORAGE_PREFIX, LEGACY_STORAGE_PREFIX)),
  ];
  for (const key of collectPrefixKeys(prefixes)) drop(key);
  console.info(`[FlowLife] clearAllAppData: 已清除 ${n} 個本機鍵`);
}
