/** localStorage key 前綴，v1 用來隔離未來資料格式變更 */
const STORAGE_PREFIX = "flowlife_v1_";
const LEGACY_STORAGE_PREFIX = "flowlife_";

export const LS_KEYS = {
  todos: `${STORAGE_PREFIX}todos`,
  coins: `${STORAGE_PREFIX}coins`,
  pomodoroSessions: `${STORAGE_PREFIX}pomodoro_sessions`,
  ratingCounts: `${STORAGE_PREFIX}rating_counts`,
  idleTotalSecs: `${STORAGE_PREFIX}idle_total_secs`,
  purchaseLog: `${STORAGE_PREFIX}purchase_log`,
  coinIncomeLog: `${STORAGE_PREFIX}coin_income_log`,
  dailyOverride: `${STORAGE_PREFIX}daily_override_`,
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
