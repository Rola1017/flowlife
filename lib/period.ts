import { toLocalDateStr } from "@/lib/dateStr";

/** 取得 d 所在週的週一（本地、午夜） */
export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0=一 … 6=日
  x.setDate(x.getDate() - dow);
  return x;
}

export function weekKey(d: Date): string {
  return toLocalDateStr(mondayOf(d));
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function quarterKey(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

/** ISO 8601 週四定錨：回 {年, 週}，顯示用 */
export function isoWeek(d: Date): { year: number; week: number } {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dow + 3); // 移到本週週四
  const isoYear = x.getUTCFullYear();
  const firstThu = new Date(Date.UTC(isoYear, 0, 4)); // 1/4 必在 W01
  const fDow = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - fDow + 3);
  const week = 1 + Math.round((x.getTime() - firstThu.getTime()) / (7 * 86400000));
  return { year: isoYear, week };
}

export function isoWeekLabel(d: Date): string {
  const { year, week } = isoWeek(d);
  return `${year} 第 ${week} 週`;
}

/** 某週 key（週一 YYYY-MM-DD）→ 該週 7 天的 YYYY-MM-DD 陣列 */
export function daysOfWeek(weekKeyStr: string): string[] {
  const [y, m, dd] = weekKeyStr.split("-").map(Number);
  const mon = new Date(y, m - 1, dd);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    return toLocalDateStr(x);
  });
}
