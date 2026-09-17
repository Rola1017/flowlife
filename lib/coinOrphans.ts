/** 孤兒判定用的最小帳列／番茄形狀（不綁 React） */
export type CoinOrphanRow = {
  kind?: string;
  sessionUuid?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
};

export type CoinOrphanSession = {
  uuid?: string;
  date: string;
  startTime?: string;
  endTime?: string;
};

function timesMatch(a: CoinOrphanSession, r: CoinOrphanRow): boolean {
  return (
    a.date === r.date &&
    (a.startTime ?? "") === (r.startTime ?? "") &&
    (a.endTime ?? "") === (r.endTime ?? "")
  );
}

function belongsTo(s: CoinOrphanSession, r: CoinOrphanRow): boolean {
  if (r.sessionUuid) return s.uuid === r.sessionUuid;
  return timesMatch(s, r);
}

/**
 * 孤兒＝番茄已永久不存在的 session/bonus 帳列。
 * opening／spend 略過。
 * 垃圾桶中的番茄不算消失（可能復原），其金幣列不是孤兒。
 */
export function isOrphanCoinRow(
  r: CoinOrphanRow,
  sessions: CoinOrphanSession[],
  trashedSessions: CoinOrphanSession[] = [],
): boolean {
  const kind = r.kind ?? "session";
  if (kind === "opening" || kind === "spend") return false;
  const alive = sessions.some((s) => belongsTo(s, r));
  if (alive) return false;
  const inTrash = trashedSessions.some((s) => belongsTo(s, r));
  return !inTrash;
}

export function findOrphanCoinRows<T extends CoinOrphanRow>(
  log: T[],
  sessions: CoinOrphanSession[],
  trashedSessions: CoinOrphanSession[] = [],
): T[] {
  return log.filter((r) => isOrphanCoinRow(r, sessions, trashedSessions));
}
