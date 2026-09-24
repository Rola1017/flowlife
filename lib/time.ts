/** 時間比較唯一來源。跨系統 timestamptz 可能是 Z 或 +00:00，禁止字串直接比。 */

export function tsMs(v: string | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : 0;
}

export function tsNewer(a: string | null | undefined, b: string | null | undefined): boolean {
  return tsMs(a) > tsMs(b);
}
