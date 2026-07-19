"use client";

import { useEffect, useRef, useState } from "react";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { APP_STATE_KEYS, pushAppState, subscribeAppState } from "@/lib/appStateCloud";
import type { CoinIncomeLogRow } from "@/components/pomodoro/usePomodoro";
import type { Session } from "@/lib/types";

/** 金幣記錄單一來源（比照 useCoins 風格）：掛載讀檔、變動寫檔 */
export function useCoinLog() {
  const [coinIncomeLog, setCoinIncomeLog] = useState<CoinIncomeLogRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const lastPushedRef = useRef<CoinIncomeLogRow[] | null>(null);

  useEffect(() => {
    const saved = loadJSON<unknown>(LS_KEYS.coinIncomeLog, []);
    if (Array.isArray(saved)) {
      lastPushedRef.current = saved as CoinIncomeLogRow[];
      setCoinIncomeLog(saved as CoinIncomeLogRow[]);
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

  const appendCoinRow = (row: CoinIncomeLogRow) => setCoinIncomeLog((l) => [row, ...l]);
  const removeCoinRowsBySession = (uuid: string) =>
    setCoinIncomeLog((l) => l.filter((r) => r.sessionUuid !== uuid));
  const bumpCoinAmountBySession = (uuid: string, delta: number) =>
    setCoinIncomeLog((l) =>
      l.map((r) => (r.sessionUuid === uuid ? { ...r, amount: Math.max(0, r.amount + delta) } : r)),
    );
  const resetCoinLog = () => setCoinIncomeLog([]);

  /** 一次性回填：把無 sessionUuid 的舊金幣列依 date/起訖 對到舊番茄的 uuid */
  const linkRowsToSessions = (sessions: Session[]) =>
    setCoinIncomeLog((log) => {
      let changed = false;
      const next = log.map((r) => {
        if (r.sessionUuid) return r;
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

  return {
    coinIncomeLog,
    setCoinIncomeLog,
    coinLogHydrated: hydrated,
    appendCoinRow,
    removeCoinRowsBySession,
    removeCoinRowsForSession,
    bumpCoinAmountBySession,
    resetCoinLog,
    linkRowsToSessions,
  };
}
