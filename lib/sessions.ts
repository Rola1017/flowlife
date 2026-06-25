import type { Session } from "@/lib/types";
import { coinsForSecs } from "@/lib/utils";

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
