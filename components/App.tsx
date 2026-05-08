"use client";

import { useState, useEffect, type ReactNode } from "react";
import { TH } from "@/lib/theme";
import { MOCK } from "@/lib/mock";
import { TABS } from "@/lib/tabs";
import { LS_KEYS, loadJSON, loadNumber, saveJSON, saveNumber } from "@/lib/storage";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/Header";
import { HomePage } from "@/components/home/HomePage";
import { TimelinePage } from "@/components/timeline/TimelinePage";
import { PomodoroPage } from "@/components/pomodoro/PomodoroPage";
import { CalendarPage } from "@/components/calendar/CalendarPage";
import { DayViewPage } from "@/components/calendar/DayViewPage";
import { SchedulePage } from "@/components/schedule/SchedulePage";
import { ShopPage } from "@/components/shop/ShopPage";
import { useTodos } from "@/components/todo/useTodos";

const DEFAULT_COINS = 1240;
const DEFAULT_RATINGS = { focused: 4, neutral: 1, distracted: 0 };

export function App() {
  const [tab, setTab] = useState("home");
  const [subPage, setSubPage] = useState<{ type: string; props?: Record<string, unknown> } | null>(null);
  const [quote, setQuote] = useState("每一顆番茄鐘，都是打下江山的一刀。");
  const [coins, setCoins] = useState(DEFAULT_COINS);
  const [focused, setFocused] = useState(DEFAULT_RATINGS.focused);
  const [neutral, setNeutral] = useState(DEFAULT_RATINGS.neutral);
  const [distracted, setDistracted] = useState(DEFAULT_RATINGS.distracted);
  const [idleTrackStart, setIdleTrackStart] = useState<number | null>(null);
  const [restEndAt, setRestEndAt] = useState<number | null>(null);
  const [lsReady, setLsReady] = useState(false);

  const { todos, handleStart, handleEnd, handleToggleDone } = useTodos(MOCK.initTodos);

  useEffect(() => {
    setCoins(loadNumber(LS_KEYS.coins, DEFAULT_COINS));
    const r = loadJSON<Partial<typeof DEFAULT_RATINGS>>(LS_KEYS.ratingCounts, {});
    setFocused(typeof r.focused === "number" ? r.focused : DEFAULT_RATINGS.focused);
    setNeutral(typeof r.neutral === "number" ? r.neutral : DEFAULT_RATINGS.neutral);
    setDistracted(typeof r.distracted === "number" ? r.distracted : DEFAULT_RATINGS.distracted);
    setLsReady(true);
  }, []);

  useEffect(() => {
    if (!lsReady) return;
    saveNumber(LS_KEYS.coins, coins);
  }, [coins, lsReady]);

  useEffect(() => {
    if (!lsReady) return;
    saveJSON(LS_KEYS.ratingCounts, { focused, neutral, distracted });
  }, [focused, neutral, distracted, lsReady]);

  const push = (type: string, props: Record<string, unknown> = {}) => setSubPage({ type, props });
  const pop = () => setSubPage(null);

  const todoProps = {
    todos,
    onStart: handleStart,
    onEnd: handleEnd,
    onToggleDone: handleToggleDone,
  };

  const SUB_PAGE_MAP: Record<string, (props?: Record<string, unknown>) => ReactNode> = {
    schedule: () => <SchedulePage onBack={pop} />,
    shop: () => <ShopPage coins={coins} onSpend={(n) => setCoins((c) => c - n)} onBack={pop} />,
    dayView: (props = {}) => (
      <DayViewPage
        date={props.date as string}
        label={props.label as string}
        todos={todos}
        onStart={handleStart}
        onEnd={handleEnd}
        onToggleDone={handleToggleDone}
        onBack={pop}
      />
    ),
  };

  const MAIN_PAGE_MAP: Record<string, () => ReactNode> = {
    home: () => <HomePage {...todoProps} />,
    timeline: () => <TimelinePage {...todoProps} />,
    pomodoro: () => (
      <PomodoroPage
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
        restEndAt={restEndAt}
        setRestEndAt={setRestEndAt}
      />
    ),
    calendar: () => (
      <CalendarPage
        todos={todos}
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
      <Header quote={quote} setQuote={setQuote} focused={focused} neutral={neutral} distracted={distracted} />
      <div style={{ flex: 1, overflowY: "auto", padding: 14, paddingBottom: 90 }}>
        {subPage ? SUB_PAGE_MAP[subPage.type]?.(subPage.props) : MAIN_PAGE_MAP[tab]?.()}
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
    </div>
  );
}
