"use client";

import { Component, useState, useEffect, useMemo, useRef, type ErrorInfo, type ReactNode } from "react";
import { CFG } from "@/lib/config";
import { TH } from "@/lib/theme";
import { TABS } from "@/lib/tabs";
import { LS_KEYS, loadJSON, loadNumber, saveJSON, saveNumber } from "@/lib/storage";
import type { Session } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/Header";
import { HomePage } from "@/components/home/HomePage";
import { TimelinePage } from "@/components/timeline/TimelinePage";
import { PomodoroPage } from "@/components/pomodoro/PomodoroPage";
import { CalendarPage } from "@/components/calendar/CalendarPage";
import { DayViewPage } from "@/components/calendar/DayViewPage";
import { SchedulePage } from "@/components/schedule/SchedulePage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { CategoryManager } from "@/components/category/CategoryManager";
import { ShopPage } from "@/components/shop/ShopPage";
import { useCoins } from "@/components/useCoins";
import { useTodos } from "@/components/todo/useTodos";
import { TodoEditSheet } from "@/components/todo/TodoEditSheet";

const DEFAULT_RATINGS = { focused: 0, neutral: 0, distracted: 0 };
const DEFAULT_IDLE_TOTAL_SECS = 0;

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FlowLife crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: TH.bg,
            color: TH.text,
            fontFamily: "-apple-system,'Noto Sans TC',sans-serif",
            maxWidth: 430,
            margin: "0 auto",
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
          }}
        >
          <Card>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>出了點問題，請重新整理</div>
            <div style={{ color: TH.muted, fontSize: 12 }}>資料仍保存在本機，重新整理後會重新載入。</div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [tab, setTab] = useState("home");
  const [subPage, setSubPage] = useState<{ type: string; props?: Record<string, unknown> } | null>(null);
  const [quote, setQuote] = useState("每一顆番茄鐘，都是打下江山的一刀。");
  const { coins, setCoins, resetCoins, spendCoins } = useCoins();
  const [focused, setFocused] = useState(DEFAULT_RATINGS.focused);
  const [neutral, setNeutral] = useState(DEFAULT_RATINGS.neutral);
  const [distracted, setDistracted] = useState(DEFAULT_RATINGS.distracted);
  const [idleTrackStart, setIdleTrackStart] = useState<number | null>(null);
  const [idleTotalSecs, setIdleTotalSecs] = useState(DEFAULT_IDLE_TOTAL_SECS);
  const [restEndAt, setRestEndAt] = useState<number | null>(null);
  const [lsReady, setLsReady] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const lastAutoIdleKeyRef = useRef<string>("");

  const { todos, handleStart, handleEnd, handleToggleDone, addTodo, updateTodo, resetTodos } = useTodos([]);

  const [sessions, setSessions] = useState<Session[]>(() => loadJSON<Session[]>(LS_KEYS.sessions, []));

  useEffect(() => {
    saveJSON(LS_KEYS.sessions, sessions);
  }, [sessions]);

  const todaySessions = useMemo(
    () => sessions.filter((s) => s.date === CFG.TODAY_STR),
    [sessions],
  );

  const yesterdayStr = useMemo(() => {
    const yd = new Date(CFG.TODAY_STR + "T12:00:00");
    yd.setDate(yd.getDate() - 1);
    return `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, "0")}-${String(yd.getDate()).padStart(2, "0")}`;
  }, []);

  const yesterdaySessions = useMemo(
    () => sessions.filter((s) => s.date === yesterdayStr),
    [sessions, yesterdayStr],
  );

  const [editTodoId, setEditTodoId] = useState<number | null>(null);
  const editingTodo = editTodoId == null ? null : todos.find((x) => x.id === editTodoId);

  useEffect(() => {
    if (editTodoId != null && !todos.some((t) => t.id === editTodoId)) setEditTodoId(null);
  }, [todos, editTodoId]);

  useEffect(() => {
    const r = loadJSON<Partial<typeof DEFAULT_RATINGS>>(LS_KEYS.ratingCounts, {});
    setFocused(typeof r.focused === "number" ? r.focused : DEFAULT_RATINGS.focused);
    setNeutral(typeof r.neutral === "number" ? r.neutral : DEFAULT_RATINGS.neutral);
    setDistracted(typeof r.distracted === "number" ? r.distracted : DEFAULT_RATINGS.distracted);
    setIdleTotalSecs(loadNumber(LS_KEYS.idleTotalSecs, DEFAULT_IDLE_TOTAL_SECS));
    setLsReady(true);
  }, []);

  useEffect(() => {
    if (!lsReady) return;
    saveJSON(LS_KEYS.ratingCounts, { focused, neutral, distracted });
  }, [focused, neutral, distracted, lsReady]);

  useEffect(() => {
    if (!lsReady) return;
    saveNumber(LS_KEYS.idleTotalSecs, idleTotalSecs);
  }, [idleTotalSecs, lsReady]);

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      const dow = now.getDay(); // 1~5 => Mon~Fri
      if (dow < 1 || dow > 5) return;
      const h = now.getHours();
      const m = now.getMinutes();
      const isTargetTime = (h === 8 && m === 0) || (h === 13 && m === 30);
      if (!isTargetTime) return;

      const slot = `${h}:${String(m).padStart(2, "0")}`;
      const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${slot}`;
      if (lastAutoIdleKeyRef.current === dateKey) return;
      lastAutoIdleKeyRef.current = dateKey;

      setIdleTrackStart((prev) => prev ?? Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const push = (type: string, props: Record<string, unknown> = {}) => setSubPage({ type, props });
  const pop = () => setSubPage(null);

  const clearFlowLifeStorage = () => {
    if (typeof window === "undefined") return;
    Object.keys(localStorage)
      .filter((key) => key.startsWith("flowlife_"))
      .forEach((key) => localStorage.removeItem(key));
  };

  const handleResetAllData = () => {
    clearFlowLifeStorage();
    resetCoins();
    setFocused(DEFAULT_RATINGS.focused);
    setNeutral(DEFAULT_RATINGS.neutral);
    setDistracted(DEFAULT_RATINGS.distracted);
    setIdleTrackStart(null);
    setIdleTotalSecs(DEFAULT_IDLE_TOTAL_SECS);
    setRestEndAt(null);
    resetTodos([]);
    setSessions([]);
    setResetVersion((v) => v + 1);
    setTab("home");
    setSubPage(null);
    setEditTodoId(null);
  };

  const todoProps = {
    todos,
    onStart: handleStart,
    onEnd: handleEnd,
    onToggleDone: handleToggleDone,
    onAddTodo: addTodo,
    onEditTodo: (id: number) => setEditTodoId(id),
  };

  const SUB_PAGE_MAP: Record<string, (props?: Record<string, unknown>) => ReactNode> = {
    schedule: () => <SchedulePage onBack={pop} />,
    settings: () => (
      <SettingsPage
        onBack={pop}
        onShowCategoryManager={() => push("categoryManager")}
        onResetAllData={handleResetAllData}
        onResetTodos={resetTodos}
      />
    ),
    categoryManager: () => <CategoryManager onBack={pop} />,
    shop: () => <ShopPage coins={coins} onSpend={spendCoins} onBack={pop} />,
    dayView: (props = {}) => (
      <DayViewPage
        date={props.date as string}
        label={props.label as string}
        todos={todos}
        onStart={handleStart}
        onEnd={handleEnd}
        onToggleDone={handleToggleDone}
        onAddTodo={addTodo}
        onEditTodo={todoProps.onEditTodo}
        onBack={pop}
      />
    ),
  };

  const MAIN_PAGE_MAP: Record<string, () => ReactNode> = {
    home: () => <HomePage {...todoProps} todaySessions={todaySessions} yesterdaySessions={yesterdaySessions} />,
    timeline: () => <TimelinePage {...todoProps} />,
    calendar: () => (
      <CalendarPage
        todos={todos}
        sessions={sessions}
        onShowDay={(d, l) => push("dayView", { date: d, label: l })}
        onShowSchedule={() => push("schedule")}
      />
    ),
    health: () => (
      <Card>
        <div style={{ textAlign: "center", padding: 30, color: TH.muted }}>💪 健康模組 — v11 開發</div>
      </Card>
    ),
    reading: () => (
      <Card>
        <div style={{ textAlign: "center", padding: 30, color: TH.muted }}>📚 閱讀模組 — v11 開發</div>
      </Card>
    ),
  };

  const pomodoroPage = (
    <PomodoroPage
      sessions={sessions}
      setSessions={setSessions}
      coins={coins}
      setCoins={setCoins}
      onShowShop={() => push("shop")}
      focused={focused}
      setFocused={setFocused}
      neutral={neutral}
      setNeutral={setNeutral}
      distracted={distracted}
      setDistracted={setDistracted}
      idleTrackStart={idleTrackStart}
      setIdleTrackStart={setIdleTrackStart}
      idleTotalSecs={idleTotalSecs}
      setIdleTotalSecs={setIdleTotalSecs}
      restEndAt={restEndAt}
      setRestEndAt={setRestEndAt}
      resetVersion={resetVersion}
    />
  );

  return (
    <div
      style={{
        background: TH.bg,
        color: TH.text,
        fontFamily: "-apple-system,'Noto Sans TC',sans-serif",
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Header quote={quote} setQuote={setQuote} onShowSettings={() => push("settings")} />
      <div style={{ flex: 1, overflowY: "auto", padding: 14, paddingBottom: 90 }}>
        <div style={{ display: !subPage && tab === "pomodoro" ? "block" : "none" }}>{pomodoroPage}</div>
        {(subPage || tab !== "pomodoro") &&
          (subPage ? SUB_PAGE_MAP[subPage.type]?.(subPage.props) : MAIN_PAGE_MAP[tab]?.())}
      </div>
      <nav
        style={{
          position: "sticky",
          bottom: 0,
          background: TH.card,
          borderTop: `1px solid ${TH.border}`,
          display: "flex",
          padding: "6px 2px 12px",
          zIndex: 99,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSubPage(null);
            }}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              padding: "2px 3px",
            }}
          >
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span
              style={{
                fontSize: 8,
                color: tab === t.id && !subPage ? TH.accent : TH.muted,
                fontWeight: tab === t.id && !subPage ? 800 : 400,
              }}
            >
              {t.name}
            </span>
            {tab === t.id && !subPage && <div style={{ width: 14, height: 2, background: TH.accent, borderRadius: 1 }} />}
          </button>
        ))}
      </nav>
      {editingTodo && (
        <TodoEditSheet
          key={editTodoId}
          todo={editingTodo}
          onClose={() => setEditTodoId(null)}
          onSave={(id, patch) => {
            updateTodo(id, patch);
            setEditTodoId(null);
          }}
        />
      )}
    </div>
  );
}
