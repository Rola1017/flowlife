import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";

export type ReviewScope = "day" | "week" | "month" | "quarter" | "free";

export type ReviewEntry = {
  id: number;
  scope: ReviewScope;
  periodKey: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
};

export function loadReviews(): ReviewEntry[] {
  const v = loadJSON<ReviewEntry[]>(LS_KEYS.reviews, []);
  return Array.isArray(v) ? v : [];
}

export function getReview(scope: ReviewScope, periodKey: string): ReviewEntry | undefined {
  return loadReviews().find((r) => r.scope === scope && r.periodKey === periodKey);
}

/** 覆盤表寫入單一來源：空白 text 視為刪除該筆 */
export function upsertReview(scope: ReviewScope, periodKey: string, text: string): ReviewEntry[] {
  const trimmed = text.trim();
  const now = new Date().toISOString();
  const prev = loadReviews();
  const idx = prev.findIndex((r) => r.scope === scope && r.periodKey === periodKey);

  let next: ReviewEntry[];
  if (!trimmed) {
    next = prev.filter((r) => !(r.scope === scope && r.periodKey === periodKey));
  } else if (idx >= 0) {
    next = prev.map((r, i) =>
      i === idx ? { ...r, text: trimmed, updatedAt: now } : r,
    );
  } else {
    next = [
      ...prev,
      {
        id: Date.now(),
        scope,
        periodKey,
        text: trimmed,
        createdAt: now,
      },
    ];
  }

  saveJSON(LS_KEYS.reviews, next);
  return next;
}

/** 追加一則（靈感等多則場景）；空白 text 不動 */
export function addReview(scope: ReviewScope, periodKey: string, text: string): ReviewEntry[] {
  const trimmed = text.trim();
  if (!trimmed) return loadReviews();
  const next = [
    ...loadReviews(),
    {
      id: Date.now(),
      scope,
      periodKey,
      text: trimmed,
      createdAt: new Date().toISOString(),
    },
  ];
  saveJSON(LS_KEYS.reviews, next);
  return next;
}

export function removeReview(id: number): ReviewEntry[] {
  const next = loadReviews().filter((r) => r.id !== id);
  saveJSON(LS_KEYS.reviews, next);
  return next;
}
