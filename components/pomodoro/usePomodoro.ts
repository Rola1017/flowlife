"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CFG } from "@/lib/config";
import { buildLineSeries } from "@/lib/analytics";
import { coinsForSecs, playRestEnd, toLocalDateStr } from "@/lib/utils";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { patchReflection } from "@/lib/sessions";
import type { Session } from "@/lib/types";

export type PomodoroSessionRow = Session;

type CatSelection = { cat1: string; cat2: string; cat3: string };
type ConfirmedPomodoro = { name: string; cat1: string; cat2: string; cat3: string; intention: string };
type RewardFx = { id: number; amount: number; big?: boolean; treasure?: boolean };
export type CoinIncomeLogRow = {
  id: number;
  date: string;
  time: string;
  at: string;
  taskName: string;
  amount: number;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  startTime?: string;
  endTime?: string;
};

// 日期與 toLocalDateStr / CFG.TODAY_STR 一致（本地 YYYY-MM-DD，非 UTC）
function localDateParts(date = new Date()) {
  const dateStr = toLocalDateStr(date);
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return { date: dateStr, time: `${h}:${min}`, at: `${dateStr} ${h}:${min}` };
}

export function usePomodoro({
  sessions,
  setSessions,
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
  sessions: Session[];
  setSessions: Dispatch<SetStateAction<Session[]>>;
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
  const [linePeriod, setLinePeriod] = useState("7天");
  const [taskName, setTaskName] = useState("");
  const [intention, setIntention] = useState("");
  const [catSel, setCatSel] = useState<CatSelection>({ cat1: "", cat2: "", cat3: "" });
  const [confirmed, setConfirmed] = useState<ConfirmedPomodoro | null>(null);
  const [idleSecs, setIdleSecs] = useState(0);
  const [rewardFx, setRewardFx] = useState<RewardFx | null>(null);
  const [coinIncomeLog, setCoinIncomeLog] = useState<CoinIncomeLogRow[]>([]);
  const [coinIncomeLogReady, setCoinIncomeLogReady] = useState(false);
  const [focusReadyToBreak, setFocusReadyToBreak] = useState(false);
  const [focusOverrunSecs, setFocusOverrunSecs] = useState(0);
  const [lastSessionId, setLastSessionId] = useState<number | null>(null);

  const intRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusStartRef = useRef<number | null>(null);
  const focusStartClockRef = useRef<string | null>(null);
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
    const tot = sessions
      .filter((x) => x.counted !== false && x.mins > 1)
      .reduce((s, x) => s + x.mins, 0);
    CFG.MILESTONES.forEach((m) => {
      if (tot >= m.mins) hitRef.current.add(m.mins);
    });
  }, [sessions]);

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
    setCoinIncomeLog([]);
    setTaskName("");
    setIntention("");
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
    setLastSessionId(null);
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
    if (intRef.current !== null) {
      clearInterval(intRef.current);
      intRef.current = null;
    }

    if (mode === "focus") {
      intRef.current = setInterval(() => {
        if (!focusStartRef.current) return;

        const elapsedMs = Date.now() - focusStartRef.current;
        const elapsedSec = Math.floor(elapsedMs / 1000);
        elRef.current = elapsedSec;

        const remaining = Math.max(0, dur * 60 - elapsedSec);
        setSecs(remaining);

        if (remaining === 0) {
          if (!focusReadyToBreakRef.current) {
            playRestEnd();
            setFocusReadyToBreak(true);
            setFocusOverrunSecs(0);
          } else {
            const overrun = elapsedSec - dur * 60;
            setFocusOverrunSecs(overrun);
          }
        }
      }, 500);
    }

    return () => {
      if (intRef.current !== null) {
        clearInterval(intRef.current);
        intRef.current = null;
      }
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

  const beginFocus = (sel: { name: string; cat1: string; cat2: string; cat3: string; intention?: string }) => {
    focusStartRef.current = Date.now();
    focusStartClockRef.current = localDateParts().time;
    setConfirmed({ ...sel, intention: sel.intention ?? "" });
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

  const startFocus = () => {
    if (!canStart) return;
    beginFocus({ name: taskName || catSel.cat1, ...catSel, intention });
  };

  const quickStart = (sel: { cat1: string; cat2?: string; cat3?: string; name?: string }) => {
    if (!sel.cat1) return;
    const norm = { cat1: sel.cat1, cat2: sel.cat2 || "", cat3: sel.cat3 || "" };
    setCatSel(norm);
    setTaskName(sel.name || "");
    setIntention("");
    beginFocus({ name: sel.name || sel.cat1, ...norm, intention: "" });
  };

  const endFocus = () => {
    if (intRef.current !== null) {
      clearInterval(intRef.current);
      intRef.current = null;
    }
    focusStartRef.current = null;
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
    const now = localDateParts();
    const sessionId = Date.now();
    const row: Session = {
      id: sessionId,
      date: now.date,
      name: confirmed!.name,
      cat1: confirmed!.cat1,
      cat2: confirmed!.cat2,
      cat3: confirmed!.cat3,
      mins,
      rating: r,
      earnedCoins: earned,
      counted,
      startTime: focusStartClockRef.current ?? undefined,
      endTime: now.time,
      intention: confirmed!.intention?.trim() || undefined,
    };
    const ns = [...sessions, row];
    setSessions(ns);
    setLastSessionId(sessionId);

    const tot = ns.filter((p) => p.counted).reduce((s, p) => s + p.mins, 0);
    let milestoneBonus = 0;
    CFG.MILESTONES.forEach((m) => {
      if (tot >= m.mins && !hitRef.current.has(m.mins)) {
        hitRef.current.add(m.mins);
        milestoneBonus += m.coins;
      }
    });

    // 大於1小時：30% 機率雙倍金幣
    let isTreasure = false;
    if (dur >= 60 && Math.random() < 0.3) {
      isTreasure = true;
    }
    const finalEarned = isTreasure ? earned * 2 : earned;
    const totalGain = finalEarned + milestoneBonus;
    if (totalGain > 0) {
      setCoins((c) => c + totalGain);
      setCoinIncomeLog((log) => [
        {
          id: Date.now(),
          ...now,
          taskName: confirmed?.name || "番茄鐘",
          amount: totalGain,
          cat1: confirmed?.cat1,
          cat2: confirmed?.cat2,
          cat3: confirmed?.cat3,
          startTime: focusStartClockRef.current ?? undefined,
          endTime: now.time,
        },
        ...log,
      ]);
    }
    setRewardFx({ id: Date.now(), amount: totalGain, big: dur > 25, treasure: isTreasure });
  };

  const updateReflection = (id: number, text: string) => {
    setSessions((prev) => patchReflection(prev, id, text));
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
    if (intRef.current !== null) {
      clearInterval(intRef.current);
      intRef.current = null;
    }
    focusStartRef.current = null;
    setMode("idle");
    setShowRating(false);
    setFocusReadyToBreak(false);
    setFocusOverrunSecs(0);
    setRestEndAt(null);
    setRestTotalSecs(0);
    setIdleSecs(0);
    setIdleTrackStart(Date.now());
  };

  const todayDate = localDateParts().date;
  const todaySessions = sessions.filter((s) => s.date === todayDate);

  // 第一層：滿 1 分鐘以上（含 1 分）
  const min1Sessions = todaySessions.filter((s) => s.mins >= 1);
  const min1Count = min1Sessions.length;
  const min1Total = min1Sessions.reduce((s, p) => s + p.mins, 0);

  // 第二層：25 分鐘以上（正式產出）
  const min25Sessions = todaySessions.filter((s) => s.mins >= 25);
  const min25Count = min25Sessions.length;
  const min25Total = min25Sessions.reduce((s, p) => s + p.mins, 0);

  // 第三層（進步）：10 分鐘以上
  const min10Sessions = todaySessions.filter((s) => s.mins >= 10);
  const min10Count = min10Sessions.length;
  const min10Total = min10Sessions.reduce((s, p) => s + p.mins, 0);

  const countedSessions = min1Sessions;
  const tot = min1Total;
  const todayCount = todaySessions.length;
  const focusElapsedSecs = Math.max(0, dur * 60 - secs + focusOverrunSecs);
  const canShowRestBtn = focusElapsedSecs > 60;
  const ratingSummary = useMemo(
    () =>
      todaySessions.reduce(
        (acc, s) => {
          if (s.rating === "😤") acc.focused += 1;
          else if (s.rating === "🙂") acc.neutral += 1;
          else if (s.rating === "😴") acc.distracted += 1;
          return acc;
        },
        { focused: 0, neutral: 0, distracted: 0 },
      ),
    [todaySessions],
  );
  const yLearn = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = toLocalDateStr(y);
    return sessions
      .filter((s) => s.date === yStr && s.cat1 === "學習")
      .reduce((sum, s) => sum + (s.mins ?? 0), 0);
  }, [sessions]);

  const lineD = useMemo(() => {
    const now = new Date();
    return buildLineSeries(sessions, linePeriod, now.getFullYear(), now.getMonth() + 1);
  }, [sessions, linePeriod]);

  const isRestActive = restSecs > 0;
  const effectiveMode = isRestActive ? "rest" : mode;
  const idleTotalToday = idleTotalSecs + (idleTrackStart ? idleSecs : 0);
  const todayCoinIncomeLog = coinIncomeLog
    .filter((row) => row.date === todayDate)
    .sort((a, b) => b.at.localeCompare(a.at));
  const todayCoinIncomeTotal = todayCoinIncomeLog.reduce((sum, row) => sum + row.amount, 0);
  const recentCoinIncomeLog = todayCoinIncomeLog.slice(0, 5);

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
    intention,
    setIntention,
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
    min1Count,
    min1Total,
    min10Count,
    min10Total,
    min25Count,
    min25Total,
    todayCount,
    canShowRestBtn,
    yLearn,
    lineD,
    effectiveMode,
    isRestActive,
    idleTotalToday,
    todayCoinIncomeTotal,
    recentCoinIncomeLog,
    setCoinIncomeLog,
    startFocus,
    quickStart,
    endFocus,
    addRestTime,
    confirmRating,
    selectDuration,
    abandonFocus,
    lastSessionId,
    updateReflection,
  };
}
