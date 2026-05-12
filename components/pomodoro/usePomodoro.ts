"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CFG } from "@/lib/config";
import { MOCK } from "@/lib/mock";
import { coinsForSecs, playRestEnd } from "@/lib/utils";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";

export type PomodoroSessionRow = {
  mins: number;
  rating: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  name?: string;
  /** 是否列入累計（> 1 分鐘才會算） */
  counted?: boolean;
};

type CatSelection = { cat1: string; cat2: string; cat3: string };
type ConfirmedPomodoro = { name: string; cat1: string; cat2: string; cat3: string };
type RewardFx = { id: number; amount: number };
export type CoinIncomeLogRow = {
  id: number;
  date: string;
  time: string;
  at: string;
  taskName: string;
  amount: number;
};

function localDateParts(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${d}`, time: `${h}:${min}`, at: `${y}-${m}-${d} ${h}:${min}` };
}

export function usePomodoro({
  setCoins,
  setFocused,
  setNeutral,
  setDistracted,
  idleTrackStart,
  setIdleTrackStart,
  idleTotalSecs,
  setIdleTotalSecs,
  restEndAt,
  setRestEndAt,
  resetVersion,
}: {
  setCoins: Dispatch<SetStateAction<number>>;
  setFocused: Dispatch<SetStateAction<number>>;
  setNeutral: Dispatch<SetStateAction<number>>;
  setDistracted: Dispatch<SetStateAction<number>>;
  idleTrackStart: number | null;
  setIdleTrackStart: Dispatch<SetStateAction<number | null>>;
  idleTotalSecs: number;
  setIdleTotalSecs: Dispatch<SetStateAction<number>>;
  restEndAt: number | null;
  setRestEndAt: Dispatch<SetStateAction<number | null>>;
  resetVersion: number;
}) {
  const REWARD_FX_MS = 3700;

  const [dur, setDur] = useState(1);
  const [secs, setSecs] = useState(1 * 60);
  const [mode, setMode] = useState("idle");
  const [showRating, setShowRating] = useState(false);
  const [rated, setRated] = useState(false);
  const [restSecs, setRestSecs] = useState(0);
  const [restTotalSecs, setRestTotalSecs] = useState(0);
  const [sessions, setSessions] = useState<PomodoroSessionRow[]>([]);
  const [sessionsLsReady, setSessionsLsReady] = useState(false);
  const [linePeriod, setLinePeriod] = useState("7天");
  const [taskName, setTaskName] = useState("");
  const [catSel, setCatSel] = useState<CatSelection>({ cat1: "", cat2: "", cat3: "" });
  const [confirmed, setConfirmed] = useState<ConfirmedPomodoro | null>(null);
  const [idleSecs, setIdleSecs] = useState(0);
  const [rewardFx, setRewardFx] = useState<RewardFx | null>(null);
  const [coinIncomeLog, setCoinIncomeLog] = useState<CoinIncomeLogRow[]>([]);
  const [coinIncomeLogReady, setCoinIncomeLogReady] = useState(false);
  const [focusReadyToBreak, setFocusReadyToBreak] = useState(false);
  const [focusOverrunSecs, setFocusOverrunSecs] = useState(0);

  const intRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elRef = useRef(0);
  const hitRef = useRef(new Set<number>());
  const restWasActiveRef = useRef(false);
  const focusReadyToBreakRef = useRef(false);
  const lastHandledResetVersionRef = useRef(resetVersion);
  const canStart = catSel.cat1 !== "";

  const stopIdleAndAccumulate = () => {
    if (!idleTrackStart) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - idleTrackStart) / 1000));
    if (elapsed > 0) setIdleTotalSecs((v) => v + elapsed);
    setIdleTrackStart(null);
    setIdleSecs(0);
  };

  useEffect(() => {
    const saved = loadJSON<unknown>(LS_KEYS.pomodoroSessions, null);
    if (Array.isArray(saved)) {
      const rows = (saved as PomodoroSessionRow[]).map((r) => ({
        ...r,
        counted: typeof r.counted === "boolean" ? r.counted : (r.mins ?? 0) > 1,
      }));
      setSessions(rows);
      const tot = rows
        .filter((x) => x.counted)
        .reduce((s, x) => s + (typeof x.mins === "number" ? x.mins : 0), 0);
      CFG.MILESTONES.forEach((m) => {
        if (tot >= m.mins) hitRef.current.add(m.mins);
      });
    }
    setSessionsLsReady(true);
  }, []);

  useEffect(() => {
    if (!sessionsLsReady) return;
    saveJSON(LS_KEYS.pomodoroSessions, sessions);
  }, [sessions, sessionsLsReady]);

  useEffect(() => {
    const saved = loadJSON<unknown>(LS_KEYS.coinIncomeLog, []);
    if (Array.isArray(saved)) setCoinIncomeLog(saved as CoinIncomeLogRow[]);
    setCoinIncomeLogReady(true);
  }, []);

  useEffect(() => {
    if (!coinIncomeLogReady) return;
    saveJSON(LS_KEYS.coinIncomeLog, coinIncomeLog);
  }, [coinIncomeLog, coinIncomeLogReady]);

  useEffect(() => {
    if (resetVersion === lastHandledResetVersionRef.current) return;
    lastHandledResetVersionRef.current = resetVersion;
    if (intRef.current) clearInterval(intRef.current);
    setDur(1);
    setSecs(60);
    setMode("idle");
    setShowRating(false);
    setRated(false);
    setRestSecs(0);
    setRestTotalSecs(0);
    setSessions([]);
    setCoinIncomeLog([]);
    setTaskName("");
    setCatSel({ cat1: "", cat2: "", cat3: "" });
    setConfirmed(null);
    setIdleSecs(0);
    setRewardFx(null);
    setFocusReadyToBreak(false);
    setFocusOverrunSecs(0);
    elRef.current = 0;
    hitRef.current.clear();
    restWasActiveRef.current = false;
    focusReadyToBreakRef.current = false;
  }, [resetVersion]);

  useEffect(() => {
    if (!rewardFx) return;
    const t = setTimeout(() => setRewardFx(null), REWARD_FX_MS);
    return () => clearTimeout(t);
  }, [rewardFx]);

  useEffect(() => {
    focusReadyToBreakRef.current = focusReadyToBreak;
  }, [focusReadyToBreak]);

  useEffect(() => {
    if (mode === "focus") {
      intRef.current = setInterval(() => {
        elRef.current++;
        setSecs((s) => {
          if (s <= 1) {
            if (!focusReadyToBreakRef.current) {
              playRestEnd();
              setFocusReadyToBreak(true);
              setFocusOverrunSecs(0);
            } else {
              setFocusOverrunSecs((v) => v + 1);
            }
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (intRef.current) clearInterval(intRef.current);
    };
  }, [mode, dur]);

  const getRestSeconds = (pomoMins: number) => CFG.REST_SECONDS[pomoMins] ?? 5 * 60;

  useEffect(() => {
    const tick = () => {
      if (!restEndAt) {
        restWasActiveRef.current = false;
        setRestSecs(0);
        return;
      }
      const diff = restEndAt - Date.now();
      const s = Math.max(0, Math.ceil(diff / 1000));
      setRestSecs(s);

      const isActive = s > 0;
      if (restWasActiveRef.current && !isActive) {
        // 休息剛結束：啟動未利用時間（跨頁面）
        playRestEnd();
        queueMicrotask(() => setIdleTrackStart(Date.now()));
      }
      restWasActiveRef.current = isActive;
      if (!isActive) setRestEndAt(null);
    };

    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [restEndAt, setIdleTrackStart, setRestEndAt]);

  useEffect(() => {
    if (!idleTrackStart) {
      setIdleSecs(0);
      return;
    }
    setIdleSecs(Math.floor((Date.now() - idleTrackStart) / 1000));
    const t = setInterval(() => setIdleSecs(Math.floor((Date.now() - idleTrackStart) / 1000)), 1000);
    return () => clearInterval(t);
  }, [idleTrackStart]);

  const startFocus = () => {
    if (!canStart) return;
    setConfirmed({ name: taskName || catSel.cat1, ...catSel });
    setSecs(dur * 60);
    elRef.current = 0;
    setMode("focus");
    setShowRating(false);
    setRated(false);
    setFocusReadyToBreak(false);
    setFocusOverrunSecs(0);
    stopIdleAndAccumulate();
    setRestEndAt(null);
    setRestTotalSecs(0);
  };

  const endFocus = () => {
    if (intRef.current) clearInterval(intRef.current);
    setMode("rest");
    setShowRating(true);
    setFocusReadyToBreak(false);
    setFocusOverrunSecs(0);
    const baseRest = getRestSeconds(dur);
    setRestTotalSecs(baseRest);
    setRestEndAt(Date.now() + baseRest * 1000);
    stopIdleAndAccumulate();
  };

  const addRestTime = (mins: number) => {
    const addSecs = mins * 60;
    stopIdleAndAccumulate();
    setRestTotalSecs((prev) => {
      const stillResting = !!(restEndAt && restEndAt > Date.now());
      return (stillResting ? prev : 0) + addSecs;
    });
    setRestEndAt((prev) => {
      const base = prev && prev > Date.now() ? prev : Date.now();
      return base + addSecs * 1000;
    });
    if (mode !== "rest") setMode("rest");
  };

  const confirmRating = (r: string) => {
    setRated(true);

    const el = elRef.current;
    const mins = Math.max(1, Math.round(el / 60));
    const counted = mins > 1;
    const earned = coinsForSecs(el);
    const ns = [...sessions, { ...confirmed!, mins, rating: r, counted }];
    setSessions(ns);

    const tot = ns.filter((p) => p.counted).reduce((s, p) => s + p.mins, 0);
    let milestoneBonus = 0;
    CFG.MILESTONES.forEach((m) => {
      if (tot >= m.mins && !hitRef.current.has(m.mins)) {
        hitRef.current.add(m.mins);
        milestoneBonus += m.coins;
      }
    });

    const totalGain = earned + milestoneBonus;
    if (totalGain > 0) {
      setCoins((c) => c + totalGain);
      const now = localDateParts();
      setCoinIncomeLog((log) => [
        {
          id: Date.now(),
          ...now,
          taskName: confirmed?.name || "番茄鐘",
          amount: totalGain,
        },
        ...log,
      ]);
    }
    setRewardFx({ id: Date.now(), amount: totalGain });
  };

  const selectDuration = (nextDur: number) => {
    if (mode === "focus") return;
    setDur(nextDur);
    setSecs(nextDur * 60);
    // 未利用時間累計中時，切換時長不應打斷或重置累計流程
    if (!idleTrackStart) {
      setMode("idle");
      setShowRating(false);
      setFocusReadyToBreak(false);
      setFocusOverrunSecs(0);
    }
  };

  const abandonFocus = () => {
    if (intRef.current) clearInterval(intRef.current);
    setMode("idle");
    setShowRating(false);
    setFocusReadyToBreak(false);
    setFocusOverrunSecs(0);
    setRestEndAt(null);
    setRestTotalSecs(0);
    setIdleSecs(0);
    setIdleTrackStart(Date.now());
  };

  const countedSessions = sessions.filter((s) => s.counted);
  const tot = countedSessions.reduce((s, p) => s + p.mins, 0);
  const focusElapsedSecs = Math.max(0, dur * 60 - secs + focusOverrunSecs);
  const canShowRestBtn = focusElapsedSecs > 60;
  const ratingSummary = useMemo(
    () =>
      sessions.reduce(
        (acc, s) => {
          if (s.rating === "😤") acc.focused += 1;
          else if (s.rating === "🙂") acc.neutral += 1;
          else if (s.rating === "😴") acc.distracted += 1;
          return acc;
        },
        { focused: 0, neutral: 0, distracted: 0 },
      ),
    [sessions],
  );
  const yLearn = MOCK.yesterdayPomos.filter((p) => p.cat1 === "學習").reduce((s, p) => s + p.mins, 0);
  const lineD = MOCK.lineData[linePeriod as keyof typeof MOCK.lineData] || MOCK.lineData["7天"];
  const isRestActive = restSecs > 0;
  const effectiveMode = isRestActive ? "rest" : mode;
  const idleTotalToday = idleTotalSecs + (idleTrackStart ? idleSecs : 0);
  const todayDate = localDateParts().date;
  const todayCoinIncomeLog = coinIncomeLog
    .filter((row) => row.date === todayDate)
    .sort((a, b) => b.at.localeCompare(a.at));
  const todayCoinIncomeTotal = todayCoinIncomeLog.reduce((sum, row) => sum + row.amount, 0);
  const recentCoinIncomeLog = [...coinIncomeLog].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);

  useEffect(() => {
    setFocused(ratingSummary.focused);
    setNeutral(ratingSummary.neutral);
    setDistracted(ratingSummary.distracted);
  }, [ratingSummary, setFocused, setNeutral, setDistracted]);

  return {
    dur,
    secs,
    mode,
    showRating,
    rated,
    restSecs,
    restTotalSecs,
    sessions,
    linePeriod,
    setLinePeriod,
    taskName,
    setTaskName,
    catSel,
    setCatSel,
    confirmed,
    idleSecs,
    rewardFx,
    focusReadyToBreak,
    focusOverrunSecs,
    canStart,
    countedSessions,
    tot,
    canShowRestBtn,
    yLearn,
    lineD,
    effectiveMode,
    isRestActive,
    idleTotalToday,
    todayCoinIncomeTotal,
    recentCoinIncomeLog,
    startFocus,
    endFocus,
    addRestTime,
    confirmRating,
    selectDuration,
    abandonFocus,
  };
}
