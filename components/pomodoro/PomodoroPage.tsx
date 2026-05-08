"use client";

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { CFG } from "@/lib/config";
import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { MOCK } from "@/lib/mock";
import {
  fmt,
  fmtIdleTime,
  coinsForSecs,
  playRestEnd,
} from "@/lib/utils";
import { LS_KEYS, saveJSON } from "@/lib/storage";
import { Card, SL } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { CategorySelector } from "@/components/pomodoro/CategorySelector";
import { CatBadge } from "@/components/pomodoro/CatBadge";
import { RingTimer } from "@/components/pomodoro/RingTimer";
import { WeekHeat } from "@/components/charts/WeekHeat";
import { LineChart } from "@/components/charts/LineChart";

export type PomodoroSessionRow = {
  mins: number;
  rating: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  name?: string;
};

export function PomodoroPage({
  coins,
  setCoins,
  onShowShop,
  focused,
  setFocused,
  neutral,
  setNeutral,
  distracted,
  setDistracted,
  idleTrackStart,
  setIdleTrackStart,
}: {
  coins: number;
  setCoins: Dispatch<SetStateAction<number>>;
  onShowShop: () => void;
  focused: number;
  setFocused: Dispatch<SetStateAction<number>>;
  neutral: number;
  setNeutral: Dispatch<SetStateAction<number>>;
  distracted: number;
  setDistracted: Dispatch<SetStateAction<number>>;
  idleTrackStart: number | null;
  setIdleTrackStart: Dispatch<SetStateAction<number | null>>;
}) {
  const [dur, setDur] = useState(25);
  const [secs, setSecs] = useState(25 * 60);
  const [mode, setMode] = useState("idle");
  const [showRating, setShowRating] = useState(false);
  const [rated, setRated] = useState(false);
  const [restSecs, setRestSecs] = useState(0);
  const [sessions, setSessions] = useState<PomodoroSessionRow[]>([]);
  const [sessionsLsReady, setSessionsLsReady] = useState(false);
  const [linePeriod, setLinePeriod] = useState("7天");
  const [taskName, setTaskName] = useState("");
  const [catSel, setCatSel] = useState({ cat1: "", cat2: "", cat3: "" });
  const [confirmed, setConfirmed] = useState<{ name: string; cat1: string; cat2: string; cat3: string } | null>(
    null,
  );
  const [idleSecs, setIdleSecs] = useState(0);
  const intRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elRef = useRef(0);
  const hitRef = useRef(new Set<number>());
  const canStart = catSel.cat1 !== "";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.pomodoroSessions);
      if (raw) {
        const p = JSON.parse(raw) as unknown;
        if (Array.isArray(p)) {
          const rows = p as PomodoroSessionRow[];
          setSessions(rows);
          const tot = rows.reduce((s, x) => s + (typeof x.mins === "number" ? x.mins : 0), 0);
          CFG.MILESTONES.forEach((m) => {
            if (tot >= m.mins) hitRef.current.add(m.mins);
          });
        }
      }
    } catch {
      /* ignore */
    }
    setSessionsLsReady(true);
  }, []);

  useEffect(() => {
    if (!sessionsLsReady) return;
    saveJSON(LS_KEYS.pomodoroSessions, sessions);
  }, [sessions, sessionsLsReady]);

  useEffect(() => {
    if (mode === "focus") {
      intRef.current = setInterval(() => {
        elRef.current++;
        setSecs((s) => {
          if (s <= 1) {
            if (intRef.current) clearInterval(intRef.current);
            setMode("rest");
            setShowRating(true);
            setRestSecs((CFG.REST_DURATIONS[dur as keyof typeof CFG.REST_DURATIONS] ?? 5) * 60);
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

  useEffect(() => {
    if (mode === "rest" && restSecs > 0) {
      restRef.current = setInterval(
        () =>
          setRestSecs((s) => {
            if (s <= 1) {
              if (restRef.current) clearInterval(restRef.current);
              playRestEnd();
              queueMicrotask(() => setIdleTrackStart(Date.now()));
              return 0;
            }
            return s - 1;
          }),
        1000,
      );
    }
    return () => {
      if (restRef.current) clearInterval(restRef.current);
    };
  }, [mode, restSecs, setIdleTrackStart]);

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
    setIdleTrackStart(null);
    setIdleSecs(0);
  };

  const endFocus = () => {
    if (intRef.current) clearInterval(intRef.current);
    setMode("rest");
    setShowRating(true);
    setRestSecs((CFG.REST_DURATIONS[dur as keyof typeof CFG.REST_DURATIONS] ?? 5) * 60);
    setIdleTrackStart(null);
  };

  const addRestTime = (mins: number) => {
    setIdleTrackStart(null);
    setIdleSecs(0);
    setRestSecs((s) => s + mins * 60);
    if (mode !== "rest") setMode("rest");
  };

  const confirmRating = (r: string) => {
    setRated(true);
    const el = elRef.current;
    if (el >= 5 * 60) {
      const mins = Math.round(el / 60),
        earned = coinsForSecs(el);
      const ns = [...sessions, { ...confirmed!, mins, rating: r }];
      setSessions(ns);
      if (r === "😤") setFocused((c) => c + 1);
      else if (r === "🙂") setNeutral((c) => c + 1);
      else setDistracted((c) => c + 1);
      setCoins((c) => c + earned);
      const tot = ns.reduce((s, p) => s + p.mins, 0);
      CFG.MILESTONES.forEach((m) => {
        if (tot >= m.mins && !hitRef.current.has(m.mins)) {
          hitRef.current.add(m.mins);
          setCoins((c) => c + m.coins);
        }
      });
    }
  };

  const tot = sessions.reduce((s, p) => s + p.mins, 0);
  const yLearn = MOCK.yesterdayPomos.filter((p) => p.cat1 === "學習").reduce((s, p) => s + p.mins, 0);
  const lineD = MOCK.lineData[linePeriod as keyof typeof MOCK.lineData] || MOCK.lineData["7天"];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {CFG.POMO_DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              if (mode !== "focus") {
                setDur(d);
                setSecs(d * 60);
                setMode("idle");
                setShowRating(false);
              }
            }}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              border: "none",
              background: dur === d ? TH.accent : TH.card,
              color: dur === d ? "#fff" : TH.muted,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {d < 60 ? `${d}分` : `${d / 60}h`}
          </button>
        ))}
      </div>
      <input
        value={taskName}
        onChange={(e) => setTaskName(e.target.value)}
        placeholder="輸入事件名稱（可選）..."
        disabled={mode === "focus"}
        style={{
          width: "100%",
          background: TH.card,
          border: `1px solid ${TH.border}`,
          borderRadius: 8,
          padding: "8px 12px",
          color: mode === "focus" ? TH.muted : TH.text,
          fontSize: 12,
          outline: "none",
          opacity: mode === "focus" ? 0.6 : 1,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 52 }}>
          <div style={{ fontSize: 20 }}>🪙</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: TH.gold }}>{coins.toLocaleString()}</div>
          <div style={{ fontSize: 8, color: TH.muted }}>金幣</div>
        </div>
        <RingTimer
          mode={mode}
          secs={secs}
          dur={dur}
          restSecs={restSecs}
          idleTrackStart={idleTrackStart}
          idleSecs={idleSecs}
          confirmed={confirmed}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 52 }}>
          <div style={{ fontSize: 18 }}>🍅</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: TH.text }}>{sessions.length}</div>
          <div style={{ fontSize: 8, color: TH.muted }}>今日顆數</div>
        </div>
      </div>

      {(mode === "rest" || idleTrackStart) && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
          <div
            style={{
              fontSize: 9,
              color: mode === "rest" && restSecs > 0 ? TH.green : TH.yellow,
              fontWeight: 700,
            }}
          >
            {mode === "rest" && restSecs > 0 ? "💤 休息加時" : "➕ 加時繼續休息"}
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
            {[1, 3, 5, 10, 20, 30].map((mn) => (
              <button
                key={mn}
                type="button"
                onClick={() => addRestTime(mn)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 16,
                  border: `1px solid ${TH.green}55`,
                  background: TH.green + "15",
                  color: TH.green,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                +{mn}分
              </button>
            ))}
          </div>
        </div>
      )}
      {mode !== "focus" && (
        <Card style={{ width: "100%", padding: 10 }}>
          <CategorySelector cat1={catSel.cat1} cat2={catSel.cat2} cat3={catSel.cat3} onChange={setCatSel} />
          {catSel.cat1 && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: `1px solid ${TH.border}`,
                fontSize: 10,
                color: TH.muted,
              }}
            >
              已選：
              <CatBadge cat1={catSel.cat1} cat2={catSel.cat2} cat3={catSel.cat3} />
            </div>
          )}
        </Card>
      )}
      {mode === "idle" && (
        <button
          type="button"
          onClick={startFocus}
          disabled={!canStart}
          style={{
            padding: "12px 36px",
            borderRadius: 24,
            border: "none",
            background: canStart ? `linear-gradient(135deg,${TH.accent},#EA580C)` : "#374151",
            color: canStart ? "#fff" : "#6B7280",
            fontSize: 15,
            fontWeight: 800,
            cursor: canStart ? "pointer" : "not-allowed",
            transition: "all .2s",
          }}
        >
          {canStart ? "開始專注 🍅" : "請先選擇大分類"}
        </button>
      )}
      {mode === "focus" && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={endFocus}
            style={{
              padding: "9px 14px",
              borderRadius: 20,
              border: `2px solid ${TH.border}`,
              background: "transparent",
              color: TH.muted,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            結束番茄鐘
          </button>
          <button
            type="button"
            onClick={() => {
              if (intRef.current) clearInterval(intRef.current);
              setMode("idle");
              setShowRating(false);
            }}
            style={{
              padding: "9px 14px",
              borderRadius: 20,
              border: "2px solid #EF444444",
              background: "#EF444411",
              color: TH.red,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            放棄
          </button>
        </div>
      )}
      {showRating && !rated && (
        <Card style={{ width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: TH.muted, marginBottom: 10 }}>這次的專注狀態？</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
            {(
              [
                ["😤", "專心"],
                ["🙂", "一般"],
                ["😴", "分心"],
              ] as const
            ).map(([e, l]) => (
              <button
                key={l}
                type="button"
                onClick={() => confirmRating(e)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: `2px solid ${TH.border}`,
                  background: "transparent",
                  color: TH.text,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <span style={{ fontSize: 24 }}>{e}</span>
                <span style={{ fontSize: 11 }}>{l}</span>
              </button>
            ))}
          </div>
        </Card>
      )}
      {rated && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: "100%" }}>
          <div style={{ fontSize: 11, color: TH.green }}>✓ 已記錄</div>
          <button
            type="button"
            onClick={startFocus}
            disabled={!canStart}
            style={{
              padding: "9px 20px",
              borderRadius: 20,
              border: `2px solid ${TH.accent}`,
              background: TH.accent + "22",
              color: TH.accent,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            開始番茄鐘 🍅
          </button>
        </div>
      )}
      {mode === "idle" && !idleTrackStart && (
        <>
          <div
            style={{
              fontSize: 11,
              color: TH.muted,
              background: TH.card,
              padding: "5px 14px",
              borderRadius: 20,
              border: `1px solid ${TH.border}`,
              textAlign: "center",
            }}
          >
            ⏸ 等待開始
          </div>
          <div
            style={{
              fontSize: 11,
              color: tot < yLearn ? TH.yellow : TH.green,
              background: tot < yLearn ? "#F59E0B11" : "#22C55E11",
              padding: "4px 12px",
              borderRadius: 20,
              textAlign: "center",
            }}
          >
            {tot < yLearn ? `🎯 再 ${fmt(yLearn - tot)} 超越昨天學習` : `✅ 已超越昨天！+${fmt(tot - yLearn)}`}
          </div>
        </>
      )}
      {idleTrackStart && (
        <div
          style={{
            width: "100%",
            background: "#1C1C22",
            border: `1px solid #2E2E38`,
            borderRadius: 14,
            padding: "12px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <div>
              <div style={{ fontSize: 10, color: TH.red, fontWeight: 700 }}>未利用時間累積中</div>
              <div style={{ fontSize: 9, color: TH.muted }}>距上次休息結束</div>
            </div>
            <div style={{ marginLeft: "auto", fontSize: 20, fontWeight: 900, color: TH.red }}>
              {fmtIdleTime(idleSecs)}
            </div>
          </div>
          <div style={{ height: 3, background: "#0D0D0F", borderRadius: 2, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min((idleSecs / 3600) * 100, 100)}%`,
                background: TH.red,
                borderRadius: 2,
                transition: "width 1s linear",
              }}
            />
          </div>
          <div style={{ fontSize: 9, color: TH.muted, marginTop: 5, textAlign: "center" }}>
            點擊「開始番茄鐘」即停止計算
          </div>
        </div>
      )}
      {!idleTrackStart && mode !== "focus" && tot > 0 && (
        <div
          style={{
            fontSize: 11,
            color: tot < yLearn ? TH.yellow : TH.green,
            background: tot < yLearn ? "#F59E0B11" : "#22C55E11",
            padding: "4px 12px",
            borderRadius: 20,
            textAlign: "center",
          }}
        >
          {tot < yLearn ? `🎯 再 ${fmt(yLearn - tot)} 超越昨天學習` : `✅ 已超越昨天！+${fmt(tot - yLearn)}`}
        </div>
      )}
      <Card style={{ width: "100%" }}>
        <SL>今日統計</SL>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {(
            [
              ["😤", "專心", focused],
              ["🙂", "一般", neutral],
              ["😴", "分心", distracted],
            ] as const
          ).map(([e, l, v], i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: "#0A0A0C",
                borderRadius: 10,
                padding: "8px 4px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 18 }}>{e}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: TH.text }}>{v}</div>
              <div style={{ fontSize: 9, color: TH.muted }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: TH.muted, textAlign: "center" }}>
          {sessions.length} 顆 · 共 {fmt(tot)}
        </div>
      </Card>
      <Card style={{ width: "100%" }}>
        <SL>番茄鐘分佈</SL>
        <WeekHeat days={7} />
      </Card>
      <Card style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <SL style={{ marginBottom: 0 }}>番茄鐘趨勢</SL>
          <div style={{ display: "flex", gap: 3 }}>
            {CFG.TIME_RANGES.map((p) => (
              <Chip
                key={p}
                label={p}
                active={linePeriod === p}
                onClick={() => setLinePeriod(p)}
                style={{ fontSize: 9, padding: "2px 7px" }}
              />
            ))}
          </div>
        </div>
        <LineChart data={lineD.pomos} labels={lineD.labels} color={TH.green} height={60} />
      </Card>
      <button
        type="button"
        onClick={onShowShop}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 12,
          border: `1px solid ${TH.gold}44`,
          background: TH.gold + "11",
          color: TH.gold,
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        🏪 商店 · 🪙 {coins.toLocaleString()} 金幣
      </button>
    </div>
  );
}
