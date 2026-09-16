/**
 * 時段重疊共用檢查器（鐵律12）。
 * Span.start / Span.end 二擇一：
 *   - `HH:mm`（同日分鐘；`"24:00"` = 1440）
 *   - datetime-local `YYYY-MM-DDTHH:mm`（可跨日；`"T24:00"` 視為該日 1440）
 * 比較時兩端須同一格式家族（HH:mm 對 HH:mm，或 datetime 對 datetime）。
 * 相鄰（a.end === b.start）不算重疊。禁止 Date.now()／new Date()。
 */

export type Span = { start: string; end: string };

function hmToMin(hm: string): number {
  const raw = hm.length >= 5 ? hm.slice(0, 5) : hm;
  if (raw === "24:00") return 1440;
  const [h, m] = raw.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** 轉成可比較的絕對分鐘；HH:mm 為當日分鐘，datetime 為 epoch 日 × 1440 + 當日分鐘。 */
export function spanToAbsMin(s: string): number {
  const tIdx = s.indexOf("T");
  if (tIdx >= 0) {
    const date = s.slice(0, tIdx);
    const time = s.slice(tIdx + 1);
    const [y, mo, d] = date.split("-").map(Number);
    const dayIndex = Date.UTC(y, mo - 1, d) / 86400000;
    return dayIndex * 1440 + hmToMin(time);
  }
  return hmToMin(s);
}

/** 半開區間 [start, end)：碰邊不算。 */
export function spansOverlap(a: Span, b: Span): boolean {
  return spanToAbsMin(a.start) < spanToAbsMin(b.end) && spanToAbsMin(b.start) < spanToAbsMin(a.end);
}

export function findOverlaps(target: Span, existing: Span[]): Span[] {
  return existing.filter((e) => spansOverlap(target, e));
}

/** 番茄紀錄 → datetime Span；缺起迄回 null。`"24:00"` 留在當日 T24:00。 */
export function sessionToSpan(s: { date: string; startTime?: string; endTime?: string }): Span | null {
  if (!s.startTime || !s.endTime) return null;
  return { start: `${s.date}T${s.startTime}`, end: `${s.date}T${s.endTime}` };
}
