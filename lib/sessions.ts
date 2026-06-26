import type { Session } from "@/lib/types";
import { coinsForSecs, toM } from "@/lib/utils";
import { resolveCatIds } from "@/lib/categories";

/** 依名字補上分類穩定編號（只補不覆蓋；找不到名字絕不清掉舊編號） */
export function stampSessionCatIds(s: Session): Session {
  if (!s.cat1) return s;
  const ids = resolveCatIds(s.cat1, s.cat2, s.cat3);
  return {
    ...s,
    cat1Id: ids.cat1Id ?? s.cat1Id,
    cat2Id: ids.cat2Id ?? s.cat2Id,
    cat3Id: ids.cat3Id ?? s.cat3Id,
  };
}

/** 覆盤寫入單一來源：依 id 更新 reflection（空白→undefined） */
export function patchReflection(sessions: Session[], id: number, text: string): Session[] {
  const trimmed = text.trim();
  return sessions.map((s) => (s.id === id ? { ...s, reflection: trimmed || undefined } : s));
}

/** 改某顆時長（單一寫入來源）；回傳新陣列＋基礎幣差額（為 Supabase S2 預留接縫） */
export function setSessionMins(sessions: Session[], id: number, newMins: number) {
  let coinDelta = 0;
  const next = sessions.map((s) => {
    if (s.id !== id) return s;
    const safe = Math.max(1, Math.round(newMins));
    const newBase = coinsForSecs(safe * 60);
    const oldBase = s.earnedCoins ?? 0;
    coinDelta = newBase - oldBase;
    return { ...s, mins: safe, earnedCoins: newBase, counted: safe > 1 };
  });
  return { sessions: next, coinDelta };
}

/** 刪某顆（單一寫入來源）；回傳新陣列＋應扣回的基礎幣（負值） */
export function removeSession(sessions: Session[], id: number) {
  const target = sessions.find((s) => s.id === id);
  const coinDelta = target ? -(target.earnedCoins ?? 0) : 0;
  return { sessions: sessions.filter((s) => s.id !== id), coinDelta };
}

/** 手動補一顆番茄（單一寫入來源）；必填起訖、依時長發基礎幣、標 manual */
export function buildManualSession(input: {
  date: string;
  name: string;
  cat1: string;
  cat2?: string;
  cat3?: string;
  startTime: string;
  endTime: string;
  rating?: string;
}): { session: Session; coinGain: number } {
  const mins = Math.max(1, toM(input.endTime) - toM(input.startTime));
  const earned = coinsForSecs(mins * 60);
  const session: Session = {
    id: Date.now(),
    date: input.date,
    name: input.name.trim() || input.cat3 || input.cat2 || input.cat1 || "手動番茄",
    cat1: input.cat1,
    cat2: input.cat2 ?? "",
    cat3: input.cat3 ?? "",
    mins,
    rating: input.rating || "",
    earnedCoins: earned,
    counted: mins > 1,
    startTime: input.startTime,
    endTime: input.endTime,
    manual: true,
  };
  return { session, coinGain: earned };
}
