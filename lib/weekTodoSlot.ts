export const WEEK_TODO_SLOTS = ["untimed", "morning", "noon", "evening"] as const;
export type WeekTodoSlot = (typeof WEEK_TODO_SLOTS)[number];

/** 無時間或 06 點前 → 未排（週檢視仍要畫出來）。 */
export function weekTodoSlot(startTime?: string): WeekTodoSlot {
  if (!startTime?.trim()) return "untimed";
  const h = parseInt(startTime.split(":")[0], 10);
  if (!Number.isFinite(h) || h < 6) return "untimed";
  if (h < 12) return "morning";
  if (h < 18) return "noon";
  if (h <= 23) return "evening";
  return "untimed";
}
