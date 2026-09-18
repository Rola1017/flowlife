/** 本地日曆 YYYY-MM-DD（勿用 toISOString，避免 UTC 跨日） */
export function toLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 以本地日曆加減天（YYYY-MM-DD）。用 y/m/d 建構，避免 UTC 跨日。 */
export function shiftDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toLocalDateStr(new Date(y, m - 1, d + days));
}

export function formatYmdLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/** `2026-09-16` → `9/16` */
export function formatMd(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function splitYmd(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split("-").map(Number);
  return [y, m, d];
}

function padYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  return m === 2 ? (isLeap(y) ? 29 : 28) : [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m] ?? 30;
}

/** 0=週一 … 6=週日。Sakamoto，不碰 Date／時區。 */
export function weekdayMon0(dateStr: string): number {
  let [y, m, d] = splitYmd(dateStr);
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  if (m < 3) y -= 1;
  const sun0 = (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m - 1] + d) % 7;
  return (sun0 + 6) % 7;
}

/** 以 YYYY-MM-DD 加減天，不經 Date。 */
export function addDaysYmd(dateStr: string, days: number): string {
  let [y, m, d] = splitYmd(dateStr);
  d += days;
  while (d > daysInMonth(y, m)) {
    d -= daysInMonth(y, m);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  while (d < 1) {
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    d += daysInMonth(y, m);
  }
  return padYmd(y, m, d);
}

/** 該日所在週的週一（週一為首） */
export function mondayOfDateStr(dateStr: string): string {
  return addDaysYmd(dateStr, -weekdayMon0(dateStr));
}

export function weekDatesFromMonday(mondayStr: string): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDaysYmd(mondayStr, i));
}

/** 例 `9/14 ~ 9/20` */
export function weekRangeMd(mondayStr: string): string {
  return `${formatMd(mondayStr)} ~ ${formatMd(addDaysYmd(mondayStr, 6))}`;
}
