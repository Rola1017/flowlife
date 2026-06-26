"use client";

import { useEffect, useState } from "react";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import type { CoinIncomeLogRow } from "@/components/pomodoro/usePomodoro";
import type { Session } from "@/lib/types";

/** 金幣記錄單一來源（比照 useCoins 風格）：掛載讀檔、變動寫檔 */
export function useCoinLog() {
  const [coinIncomeLog, setCoinIncomeLog] = useState<CoinIncomeLogRow[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadJSON<unknown>(LS_KEYS.coinIncomeLog, []);
    if (Array.isArray(saved)) setCoinIncomeLog(saved as CoinIncomeLogRow[]);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(LS_KEYS.coinIncomeLog, coinIncomeLog);
  }, [coinIncomeLog, hydrated]);

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

  return {
    coinIncomeLog,
    setCoinIncomeLog,
    coinLogHydrated: hydrated,
    appendCoinRow,
    removeCoinRowsBySession,
    bumpCoinAmountBySession,
    resetCoinLog,
    linkRowsToSessions,
  };
}
