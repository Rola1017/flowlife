import type { Session } from "@/lib/types";
import { coinsForSecs, toLocalDateStr, toM } from "@/lib/utils";
import { resolveCatIds, CAT } from "@/lib/categories";

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

/** 補跨裝置唯一主鍵（只補不覆蓋、冪等） */
export function ensureSessionUuid(s: Session): Session {
  return s.uuid ? s : { ...s, uuid: crypto.randomUUID() };
}

/** 補分類編號＋補 uuid 的單一入口 */
export function stampSession(s: Session): Session {
  return stampSessionCatIds(ensureSessionUuid(s));
}

/** 覆盤寫入單一來源：依 id 更新 reflection（空白→undefined） */
export function patchReflection(sessions: Session[], id: number, text: string): Session[] {
  const trimmed = text.trim();
  return sessions.map((s) =>
    s.id === id ? { ...s, reflection: trimmed || undefined, updatedAt: new Date().toISOString() } : s,
  );
}

/** 改某顆時長（單一寫入來源）；回傳新陣列＋基礎幣差額（為 Supabase S2 預留接縫） */
export function setSessionMins(sessions: Session[], id: number, newMins: number) {
  let coinDelta = 0;
  const next = sessions.map((s) => {
    if (s.id !== id) return s;
    const safe = Math.max(1, Math.round(newMins));
    const newBase = CAT.isNoCoin(s.cat1) ? 0 : coinsForSecs(safe * 60);
    const oldBase = s.earnedCoins ?? 0;
    coinDelta = newBase - oldBase;
    return { ...s, mins: safe, earnedCoins: newBase, counted: safe > 1, updatedAt: new Date().toISOString() };
  });
  return { sessions: next, coinDelta };
}

/** 改某顆起訖時間（分鐘由系統算）；金幣重算規則與 setSessionMins 同套 */
export function setSessionTimes(
  sessions: Session[],
  id: number,
  startTime: string,
  endTime: string,
): { sessions: Session[]; coinDelta: number } {
  const s = sessions.find((x) => x.id === id);
  if (!s) return { sessions, coinDelta: 0 };
  const st = toM(startTime);
  const en = endTime === "24:00" ? 1440 : toM(endTime);
  const mins = Math.max(1, en - st);
  const oldBase = CAT.isNoCoin(s.cat1) ? 0 : coinsForSecs((s.mins ?? 0) * 60);
  const newBase = CAT.isNoCoin(s.cat1) ? 0 : coinsForSecs(mins * 60);
  const coinDelta = newBase - oldBase;
  const next = sessions.map((x) =>
    x.id === id
      ? {
          ...x,
          startTime,
          endTime,
          mins,
          earnedCoins: newBase,
          counted: mins > 1,
          updatedAt: new Date().toISOString(),
        }
      : x,
  );
  return { sessions: next, coinDelta };
}

/** 刪某顆（單一寫入來源）；回傳新陣列＋應扣回的基礎幣（負值） */
export function removeSession(sessions: Session[], id: number) {
  const target = sessions.find((s) => s.id === id);
  const coinDelta = target ? -(target.earnedCoins ?? 0) : 0;
  return { sessions: sessions.filter((s) => s.id !== id), coinDelta };
}

/** 手動補番茄（單一寫入來源）；開始/結束各含日期、可跨天自動切段、依時長發基礎幣（一次算在第一段）、標 manual */
export function buildManualSession(input: {
  startAt: string; // "YYYY-MM-DDTHH:MM"
  endAt: string;   // "YYYY-MM-DDTHH:MM"
  name: string;
  cat1: string;
  cat2?: string;
  cat3?: string;
  rating?: string;
}): { sessions: Session[]; coinGain: number } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const start = new Date(input.startAt);
  const end = new Date(input.endAt);
  const totalSecs = Math.max(60, Math.round((end.getTime() - start.getTime()) / 1000));
  const isNoCoin = CAT.isNoCoin(input.cat1);
  const earned = isNoCoin ? 0 : coinsForSecs(totalSecs);
  const name = input.name.trim() || input.cat3 || input.cat2 || input.cat1 || "手動番茄";
  const baseId = Date.now();

  const segs: { date: string; startTime: string; endTime: string; mins: number }[] = [];
  const cur = new Date(start);
  let guard = 0;
  while (cur < end && guard < 40) {
    guard++;
    const dayEnd = new Date(cur);
    dayEnd.setHours(24, 0, 0, 0); // 次日 00:00 = 本日 24:00
    const segEnd = dayEnd < end ? dayEnd : end;
    const endsAtMidnight = segEnd.getTime() === dayEnd.getTime();
    segs.push({
      date: toLocalDateStr(cur),
      startTime: hm(cur),
      endTime: endsAtMidnight ? "24:00" : hm(segEnd),
      mins: Math.max(1, Math.round((segEnd.getTime() - cur.getTime()) / 60000)),
    });
    cur.setTime(dayEnd.getTime());
  }

  const sessions: Session[] = segs.map((seg, i) => ({
    id: baseId + i,
    uuid: crypto.randomUUID(),
    date: seg.date,
    name,
    cat1: input.cat1,
    cat2: input.cat2 ?? "",
    cat3: input.cat3 ?? "",
    mins: seg.mins,
    rating: input.rating || "",
    earnedCoins: i === 0 ? earned : 0, // 金幣一次算在第一段
    counted: seg.mins > 1,
    startTime: seg.startTime,
    endTime: seg.endTime,
    manual: true,
    updatedAt: new Date().toISOString(),
  }));
  return { sessions, coinGain: earned };
}
