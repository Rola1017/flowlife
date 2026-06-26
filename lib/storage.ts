/** localStorage key 前綴，v1 用來隔離未來資料格式變更 */
const STORAGE_PREFIX = "flowlife_v1_";
const LEGACY_STORAGE_PREFIX = "flowlife_";

export const LS_KEYS = {
  todos: `${STORAGE_PREFIX}todos`,
  coins: `${STORAGE_PREFIX}coins`,
  pomodoroSessions: `${STORAGE_PREFIX}pomodoro_sessions`,
  /** @alias pomodoroSessions */
  sessions: `${STORAGE_PREFIX}pomodoro_sessions`,
  ratingCounts: `${STORAGE_PREFIX}rating_counts`,
  idleTotalSecs: `${STORAGE_PREFIX}idle_total_secs`,
  purchaseLog: `${STORAGE_PREFIX}purchase_log`,
  coinIncomeLog: `${STORAGE_PREFIX}coin_income_log`,
  dailyOverride: `${STORAGE_PREFIX}daily_override_`,
  routineOverride: `${STORAGE_PREFIX}routine_override_`,
  categories: `${STORAGE_PREFIX}categories`,
  weekSchedule: `${STORAGE_PREFIX}week_schedule`,
  colorPalette: `${STORAGE_PREFIX}color_palette`,
  dayPlans: `${STORAGE_PREFIX}day_plans`,
  scheduleHistory: `${STORAGE_PREFIX}schedule_history`,
  timelineTodoView: `${STORAGE_PREFIX}timeline_todo_view`,
  reviews: `${STORAGE_PREFIX}reviews`,
  s2Backup: `${STORAGE_PREFIX}s2_backup`,
} as const;

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
