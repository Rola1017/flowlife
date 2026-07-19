"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CFG } from "@/lib/config";
import { LS_KEYS, loadJSON, loadNumber, saveJSON } from "@/lib/storage";
import { APP_STATE_KEYS, pushAppState, subscribeAppState } from "@/lib/appStateCloud";
import type { CoinIncomeLogRow } from "@/components/pomodoro/usePomodoro";
import type { Session } from "@/lib/types";

const LEDGER_MIGRATED_KEY = "flowlife_coin_ledger_migrated";

/** 金幣明細帳＝單一真相；餘額＝明細 amount 加總 */
export function useCoinLog() {
  const [coinIncomeLog, setCoinIncomeLog] = useState<CoinIncomeLogRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const lastPushedRef = useRef<CoinIncomeLogRow[] | null>(null);

  useEffect(() => {
    const saved = loadJSON<unknown>(LS_KEYS.coinIncomeLog, []);
    const rows = Array.isArray(saved) ? (saved as CoinIncomeLogRow[]) : [];
    lastPushedRef.current = rows;

    const migrated = localStorage.getItem(LEDGER_MIGRATED_KEY) === "1";
    if (!migrated) {
      const stored = loadNumber(LS_KEYS.coins, 0);
      const sum = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
      const diff = stored - sum;
      const next =
        diff !== 0
          ? [
              {
                id: Date.now(),
                date: CFG.TODAY_STR,
                time: "00:00",
                at: `${CFG.TODAY_STR} 00:00`,
                taskName: "期初結餘（金幣制度升級）",
                amount: diff,
                kind: "opening" as const,
              },
              ...rows,
            ]
          : rows;
      localStorage.setItem(LEDGER_MIGRATED_KEY, "1");
      lastPushedRef.current = next;
      setCoinIncomeLog(next);
    } else {
      setCoinIncomeLog(rows);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(LS_KEYS.coinIncomeLog, coinIncomeLog);
  }, [coinIncomeLog, hydrated]);

  // 本地變動才推（lastPushedRef 擋掉遠端套用後回推）
  useEffect(() => {
    if (!hydrated) return;
    if (lastPushedRef.current === coinIncomeLog) return;
    lastPushedRef.current = coinIncomeLog;
    void pushAppState(APP_STATE_KEYS.coinLog, coinIncomeLog);
  }, [coinIncomeLog, hydrated]);

  // 遠端套用：雲端較新時讀回本地
  useEffect(
    () =>
      subscribeAppState(APP_STATE_KEYS.coinLog, () => {
        const v = loadJSON<CoinIncomeLogRow[]>(LS_KEYS.coinIncomeLog, []);
        lastPushedRef.current = v;
        setCoinIncomeLog(v);
      }),
    [],
  );

  const coins = useMemo(
    () => coinIncomeLog.reduce((s, r) => s + (r.amount ?? 0), 0),
    [coinIncomeLog],
  );

  const appendCoinRow = (row: CoinIncomeLogRow) => setCoinIncomeLog((l) => [row, ...l]);
  const removeCoinRowsBySession = (uuid: string) =>
    setCoinIncomeLog((l) => l.filter((r) => r.sessionUuid !== uuid));
  const bumpCoinAmountBySession = (uuid: string, delta: number) =>
    setCoinIncomeLog((l) =>
      l.map((r) => (r.sessionUuid === uuid ? { ...r, amount: Math.max(0, r.amount + delta) } : r)),
    );
  const resetCoinLog = () => setCoinIncomeLog([]);

  const spendCoins = (amount: number, label: string) => {
    if (amount <= 0) return false;
    if (coins < amount) return false;
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const d = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
    const t = `${p(now.getHours())}:${p(now.getMinutes())}`;
    appendCoinRow({
      id: Date.now(),
      date: d,
      time: t,
      at: `${d} ${t}`,
      taskName: label,
      amount: -amount,
      kind: "spend",
    });
    return true;
  };

  /** 番茄金額變動的唯一入口：有帳列就改、沒有就開一筆（改時長/改時間用） */
  const upsertCoinRowForSession = (
    s: {
      uuid?: string;
      date: string;
      name: string;
      cat1?: string;
      cat2?: string;
      cat3?: string;
      startTime?: string;
      endTime?: string;
    },
    amount: number,
  ) => {
    setCoinIncomeLog((l) => {
      const idx = l.findIndex((r) => s.uuid && r.sessionUuid === s.uuid && r.kind !== "bonus");
      if (idx >= 0) {
        if (amount <= 0) return l.filter((_, i) => i !== idx);
        const next = [...l];
        next[idx] = { ...next[idx], amount, startTime: s.startTime, endTime: s.endTime };
        return next;
      }
      if (amount <= 0) return l;
      const t = s.startTime ?? "";
      return [
        {
          id: Date.now(),
          date: s.date,
          time: t,
          at: `${s.date} ${t}`.trim(),
          taskName: s.name,
          amount,
          cat1: s.cat1,
          cat2: s.cat2,
          cat3: s.cat3,
          startTime: s.startTime,
          endTime: s.endTime,
          sessionUuid: s.uuid,
          kind: "session" as const,
        },
        ...l,
      ];
    });
  };

  /** 一次性回填：把無 sessionUuid 的舊金幣列依 date/起訖 對到舊番茄的 uuid */
  const linkRowsToSessions = (sessions: Session[]) =>
    setCoinIncomeLog((log) => {
      let changed = false;
      const next = log.map((r) => {
        if (r.sessionUuid) return r;
        if ((r.kind ?? "session") !== "session") return r;
        const m = sessions.find(
          (s) => s.uuid && s.date === r.date && s.startTime === r.startTime && s.endTime === r.endTime,
        );
        if (m?.uuid) {
          changed = true;
          return { ...r, sessionUuid: m.uuid };
        }
        return r;
      });
      return changed ? next : log;
    });

  /** 找出某顆番茄實際入帳的金幣列（先用 uuid，找不到再用 日期＋起訖 補比對，修舊資料斷鏈） */
  const findCoinRowsForSession = (s: {
    uuid?: string;
    date: string;
    startTime?: string;
    endTime?: string;
  }) =>
    coinIncomeLog.filter(
      (r) =>
        (s.uuid && r.sessionUuid === s.uuid) ||
        (!r.sessionUuid &&
          (r.kind ?? "session") === "session" &&
          r.date === s.date &&
          (r.startTime ?? "") === (s.startTime ?? "") &&
          (r.endTime ?? "") === (s.endTime ?? "")),
    );

  /** 移除某顆番茄的所有帳列，回傳被移除的總金額（＝當初實際入帳，含里程碑/寶箱） */
  const removeCoinRowsForSession = (s: {
    uuid?: string;
    date: string;
    startTime?: string;
    endTime?: string;
  }) => {
    const rows = findCoinRowsForSession(s);
    const total = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    if (rows.length) {
      const ids = new Set(rows.map((r) => r.id));
      setCoinIncomeLog((l) => l.filter((r) => !ids.has(r.id)));
    }
    return total;
  };

  /** 孤兒＝帳列對應的番茄已不存在（略過 opening/spend；uuid 對不到，且無 uuid 者以 日期＋起訖 也對不到） */
  const findOrphanCoinRows = (sessions: Session[]) =>
    coinIncomeLog.filter((r) => {
      const kind = r.kind ?? "session";
      if (kind === "opening" || kind === "spend") return false;
      if (r.sessionUuid) return !sessions.some((s) => s.uuid === r.sessionUuid);
      return !sessions.some(
        (s) =>
          s.date === r.date &&
          (s.startTime ?? "") === (r.startTime ?? "") &&
          (s.endTime ?? "") === (r.endTime ?? ""),
      );
    });

  /** 清掉指定 id 的帳列，回傳被清總金額 */
  const removeCoinRowsByIds = (ids: number[]) => {
    const set = new Set(ids);
    const total = coinIncomeLog
      .filter((r) => set.has(r.id))
      .reduce((s, r) => s + (r.amount ?? 0), 0);
    setCoinIncomeLog((l) => l.filter((r) => !set.has(r.id)));
    return total;
  };

  return {
    coinIncomeLog,
    setCoinIncomeLog,
    coinLogHydrated: hydrated,
    coins,
    spendCoins,
    upsertCoinRowForSession,
    appendCoinRow,
    removeCoinRowsBySession,
    removeCoinRowsForSession,
    findOrphanCoinRows,
    removeCoinRowsByIds,
    bumpCoinAmountBySession,
    resetCoinLog,
    linkRowsToSessions,
  };
}
