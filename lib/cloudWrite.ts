/**
 * 雲端寫入錯誤單一入口：所有 supabase upsert/insert/update/delete 必須走這。
 * 失敗才累加；成功不累加、也不自動遞減（flush 成功才 reset）。
 */

export type CloudWriteOp = "upsert" | "insert" | "update" | "delete";

export type CloudWriteFailures = { count: number; lastError: string | null };

let count = 0;
let lastError: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeCloudWriteFailures(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getCloudWriteFailures(): CloudWriteFailures {
  return { count, lastError };
}

/** push 回 false 且失敗計數有增加 → 真的寫入失敗（未登入不算）。必須被使用者看見。 */
export function alertIfPushFailed(ok: boolean, beforeCount: number, what = "資料"): void {
  if (ok) return;
  if (typeof window === "undefined") return;
  const fail = getCloudWriteFailures();
  if (fail.count <= beforeCount) return;
  window.alert(
    `雲端寫入失敗${fail.lastError ? `：${fail.lastError}` : ""}。${what}已存本機，請檢查網路；設定頁可看同步狀態。`,
  );
}

export function resetCloudWriteFailures() {
  count = 0;
  lastError = null;
  emit();
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return String(error ?? "unknown");
}

/** 模擬／真實 Supabase `{ error }` 回傳。error 為 null／undefined → 成功不累加。 */
export function reportCloudWriteResult(
  table: string,
  op: CloudWriteOp,
  result: { error?: unknown },
  uuid?: string,
): boolean {
  if (!result.error) return true;
  count += 1;
  lastError = errorMessage(result.error);
  console.error("[FlowLife] 雲端寫入失敗", { table, op, uuid, error: result.error });
  emit();
  return false;
}

/** 本機有、雲端沒有的 uuid（順序跟 local 走）。缺 uuid 不算。 */
export function uuidsOnlyInLocal(localUuids: string[], cloudUuids: string[]): string[] {
  const cloud = new Set(cloudUuids.filter(Boolean));
  return localUuids.filter((u) => Boolean(u) && !cloud.has(u));
}
