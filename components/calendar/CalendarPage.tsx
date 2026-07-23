"use client";

import { useEffect, useMemo, useState } from "react";
import { CFG } from "@/lib/config";
import { TH } from "@/lib/theme";
import { buildCalendarStats, datesInPeriod, periodRange } from "@/lib/analytics";
import { CAT, CAT_PATH_SEP, matchesCatSelection } from "@/lib/categories";
import { availableMinutesFor, loadDayPlans, planForDate } from "@/lib/schedule";
import { availableSegments, splitSessionsByAvailability } from "@/lib/idle";
import { idleSeries } from "@/lib/timelineActual";
import { weekKey, monthKey, quarterKey } from "@/lib/period";
import { getReview, subscribeReviews, upsertReview, type ReviewScope } from "@/lib/reviews";
import type { Session } from "@/lib/types";
import { fmt, getDaysInMonth, getFirstDow } from "@/lib/utils";
import { MultiCategoryFilter } from "@/components/ui/MultiCategoryFilter";
import { TriCharts } from "@/components/charts/TriCharts";
import { ReviewView } from "./ReviewView";
import { DayReview } from "./DayReview";
import { PeriodReview } from "./PeriodReview";

/** 未利用覆盤：沿用 reviews，periodKey 前綴 idle:；scope 對應時間範圍 */
function idleReviewMeta(
  period: string,
  curY: number,
  curM: number,
): { scope: ReviewScope; periodKey: string } {
  if (period === "月") {
    return { scope: "month", periodKey: `idle:${monthKey(new Date(curY, curM - 1, 1))}` };
  }
  if (period === "季") {
    return { scope: "quarter", periodKey: `idle:${quarterKey(CFG.TODAY)}` };
  }
  const { start, end } = periodRange(period, curY, curM);
  if (period === "3天") {
    return { scope: "day", periodKey: `idle:${start}_${end}` };
  }
  // 7天／14天 → week；7天額外可用 weekKey 對齊週覆盤語意，仍用 range 鍵以對齊圖表視窗
  if (period === "7天") {
    return { scope: "week", periodKey: `idle:${weekKey(CFG.TODAY)}` };
  }
  return { scope: "week", periodKey: `idle:${start}_${end}` };
}

const DOW = ["一", "二", "三", "四", "五", "六", "日"] as const;

const WEEK_SLOTS = [
  { id: "morning" as const, bg: "#F59E0B08" },
  { id: "noon" as const, bg: "#22C55E08" },
  { id: "evening" as const, bg: "#3B82F608" },
];

type WeekSlotId = (typeof WEEK_SLOTS)[number]["id"];

const WEEK_BORDER_PERIM = 214;
const WEEK_BORDER_SEG = [
  { x1: 5, y1: 0.75, x2: 9.25, y2: 0.75, len: 4.25 },
  { x1: 9.25, y1: 0.75, x2: 9.25, y2: 99.25, len: 98.5 },
  { x1: 9.25, y1: 99.25, x2: 0.75, y2: 99.25, len: 8.5 },
  { x1: 0.75, y1: 99.25, x2: 0.75, y2: 0.75, len: 98.5 },
  { x1: 0.75, y1: 0.75, x2: 5, y2: 0.75, len: 4.25 },
] as const;

const WEEK_BORDER_PERIM_OUTER = 218.4;
const WEEK_BORDER_SEG_OUTER = [
  { x1: 5, y1: 0.2, x2: 9.8, y2: 0.2, len: 4.8 },
  { x1: 9.8, y1: 0.2, x2: 9.8, y2: 99.8, len: 99.6 },
  { x1: 9.8, y1: 99.8, x2: 0.2, y2: 99.8, len: 9.6 },
  { x1: 0.2, y1: 99.8, x2: 0.2, y2: 0.2, len: 99.6 },
  { x1: 0.2, y1: 0.2, x2: 5, y2: 0.2, len: 4.8 },
] as const;

type ProgressLine = { x1: number; y1: number; x2: number; y2: number };

function calcRangeOn(
  segs: readonly { x1: number; y1: number; x2: number; y2: number; len: number }[],
  startLen: number,
  endLen: number,
): ProgressLine[] {
  const out: ProgressLine[] = [];
  let pos = 0;
  for (const seg of segs) {
    const a = Math.max(startLen, pos),
      b = Math.min(endLen, pos + seg.len);
    if (b > a) {
      const r1 = (a - pos) / seg.len,
        r2 = (b - pos) / seg.len;
      out.push({
        x1: seg.x1 + (seg.x2 - seg.x1) * r1,
        y1: seg.y1 + (seg.y2 - seg.y1) * r1,
        x2: seg.x1 + (seg.x2 - seg.x1) * r2,
        y2: seg.y1 + (seg.y2 - seg.y1) * r2,
      });
    }
    pos += seg.len;
  }
  return out;
}

function getWeekDates(weekOffset: number): string[] {
  const anchor = new Date();
  anchor.setDate(anchor.getDate() + weekOffset * 7);
  const dow = anchor.getDay();
  const toMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + toMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

function formatWeekNavRange(weekDates: string[]): string {
  const [sy, sm, sd] = weekDates[0].split("-");
  const [, em, ed] = weekDates[6].split("-");
  return `${sy}/${sm}/${sd}（一）～ ${em}/${ed}（日）`;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  const dowLabel = dow === 0 ? "日" : DOW[dow - 1];
  return `${d.getDate()} ${dowLabel}`;
}

function dayViewLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

function sessionsInMonth(sessions: Session[], y: number, m: number) {
  return sessions.filter((s) => {
    if (!s.date) return false;
    const [sy, sm] = s.date.split("-").map(Number);
    return sy === y && sm === m;
  });
}

function getWeekSlot(startTime: string): WeekSlotId | null {
  if (!startTime?.trim()) return null;
  const h = parseInt(startTime.split(":")[0], 10);
  if (Number.isNaN(h)) return null;
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "noon";
  if (h >= 18 && h <= 23) return "evening";
  return null;
}

export function CalendarPage({
  todos,
  sessions,
  onShowDay,
  onPatchReflection,
  intent,
  onIntentConsumed,
}: {
  todos: Record<string, unknown>[];
  sessions: Session[];
  onShowDay: (date: string, label: string) => void;
  onPatchReflection: (id: number, text: string) => void;
  intent?: { review: "day" } | null;
  onIntentConsumed?: () => void;
}) {
  const [calMode, setCalMode] = useState<"calendar" | "review">("calendar");
  const [reviewSubMode, setReviewSubMode] = useState<
    "detail" | "day" | "week" | "month" | "quarter"
  >("day");

  useEffect(() => {
    if (!intent) return;
    setCalMode("review");
    setReviewSubMode(intent.review);
    onIntentConsumed?.();
  }, [intent, onIntentConsumed]);
  const [calView, setCalView] = useState("month");
  const [selPaths, setSelPaths] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [period, setPeriod] = useState("月");
  const [idleReviewOpen, setIdleReviewOpen] = useState(false);
  const [idleReviewDraft, setIdleReviewDraft] = useState("");
  const [reviewRev, setReviewRev] = useState(0);
  const [nowMins, setNowMins] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMins(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => subscribeReviews(() => setReviewRev((n) => n + 1)), []);
  const baseM0 = CFG.TODAY.getFullYear() * 12 + CFG.TODAY.getMonth(); // 真實今天的絕對月索引
  const totalM0 = baseM0 + monthOffset;
  const curY = Math.floor(totalM0 / 12);
  const curM = (totalM0 % 12) + 1;
  const dim = getDaysInMonth(curY, curM),
    fdow = getFirstDow(curY, curM);
  const prevM = curM === 1 ? 12 : curM - 1;
  const prevY = curM === 1 ? curY - 1 : curY;
  const selArr = [...selPaths];
  const singleColor =
    selPaths.size === 1
      ? (() => {
          const [c1, c2, c3] = selArr[0].split(CAT_PATH_SEP);
          return CAT.deepColorFull(c1, c2 || undefined, c3 || undefined);
        })()
      : "";
  const activeColor = singleColor || TH.red;
  const chartLabel =
    selPaths.size === 0
      ? "全部分類"
      : selPaths.size === 1
        ? (() => {
            const [c1, c2, c3] = selArr[0].split(CAT_PATH_SEP);
            return c3 || c2 || c1;
          })()
        : `已選 ${selPaths.size} 項`;
  const { chartData, lineD } = useMemo(
    () =>
      buildCalendarStats({
        sessions,
        sel: selPaths,
        period,
        anchorY: curY,
        anchorM: curM,
      }),
    [sessions, selPaths, period, curY, curM],
  );
  const [dayPlans] = useState(loadDayPlans);

  const focusByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sessions) {
      if (!s.date) continue;
      if (!matchesCatSelection(selPaths, s.cat1, s.cat2, s.cat3)) continue;
      map[s.date] = (map[s.date] ?? 0) + (s.mins ?? 0);
    }
    return map;
  }, [sessions, selPaths]);

  const sessionsByDate = useMemo(() => {
    const map: Record<string, Session[]> = {};
    for (const s of sessions) {
      if (!s.date || !matchesCatSelection(selPaths, s.cat1, s.cat2, s.cat3)) continue;
      (map[s.date] ??= []).push(s);
    }
    return map;
  }, [sessions, selPaths]);

  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sessions) {
      if (!s.date) continue;
      if (!matchesCatSelection(selPaths, s.cat1, s.cat2, s.cat3)) continue;
      map[s.date] = (map[s.date] ?? 0) + 1;
    }
    return map;
  }, [sessions, selPaths]);

  const mData = useMemo(
    () =>
      Array.from({ length: dim }, (_, i) => {
        const ds = `${curY}-${String(curM).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
        return focusByDate[ds] ?? 0;
      }),
    [dim, curY, curM, focusByDate],
  );

  const monthSessions = useMemo(
    () =>
      sessionsInMonth(sessions, curY, curM).filter((s) =>
        matchesCatSelection(selPaths, s.cat1, s.cat2, s.cat3),
      ),
    [sessions, curY, curM, selPaths],
  );
  const mTot = useMemo(() => monthSessions.reduce((s, x) => s + (x.mins ?? 0), 0), [monthSessions]);
  const dayCount = useMemo(() => new Set(monthSessions.map((s) => s.date).filter(Boolean)).size, [monthSessions]);
  const dayAvg = dayCount ? Math.round(mTot / dayCount) : 0;
  const pomo10 = useMemo(() => monthSessions.filter((s) => (s.mins ?? 0) >= 10).length, [monthSessions]);
  const pomo25 = useMemo(() => monthSessions.filter((s) => (s.mins ?? 0) >= 25).length, [monthSessions]);
  const prevTot = useMemo(() => {
    return sessionsInMonth(sessions, prevY, prevM)
      .filter((s) => matchesCatSelection(selPaths, s.cat1, s.cat2, s.cat3))
      .reduce((s, x) => s + (x.mins ?? 0), 0);
  }, [sessions, prevY, prevM, selPaths]);
  const pctVsLast = prevTot ? Math.round(((mTot - prevTot) / prevTot) * 100) : 0;

  const periodDates = useMemo(() => datesInPeriod(period, curY, curM), [period, curY, curM]);
  const idlePeriodSeries = useMemo(() => idleSeries(periodDates, nowMins), [periodDates, nowMins]);
  const idlePeriodTot = useMemo(
    () => idlePeriodSeries.reduce((s, x) => s + x.mins, 0),
    [idlePeriodSeries],
  );
  const idleLine = useMemo(
    () => ({
      labels: idlePeriodSeries.map((x) => {
        const [, m, d] = x.date.split("-");
        return `${m}/${d}`;
      }),
      data: idlePeriodSeries.map((x) => x.mins),
    }),
    [idlePeriodSeries],
  );

  const { scope: idleScope, periodKey: idlePeriodKey } = useMemo(
    () => idleReviewMeta(period, curY, curM),
    [period, curY, curM],
  );
  const idleReview = useMemo(
    () => getReview(idleScope, idlePeriodKey),
    [idleScope, idlePeriodKey, reviewRev],
  );
  useEffect(() => {
    setIdleReviewOpen(false);
  }, [idleScope, idlePeriodKey]);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekNavLabel = useMemo(() => formatWeekNavRange(weekDates), [weekDates]);

  const todosByDateSlot = useMemo(() => {
    const map: Record<string, Record<WeekSlotId, Record<string, unknown>[]>> = {};
    for (const dateStr of weekDates) {
      map[dateStr] = { morning: [], noon: [], evening: [] };
    }
    for (const todo of todos) {
      const t = todo as { date?: string; startTime?: string };
      if (!t.date || !map[t.date]) continue;
      const slot = getWeekSlot(t.startTime ?? "");
      if (!slot) continue;
      map[t.date][slot].push(todo);
    }
    return map;
  }, [todos, weekDates]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 5 }}>
        {(
          [
            ["calendar", "📆 行事曆"],
            ["review", "🔍 覆盤"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setCalMode(v)}
            style={{
              flex: 1,
              padding: "7px",
              borderRadius: 10,
              border: `1px solid ${calMode === v ? TH.accent : TH.border}`,
              background: calMode === v ? TH.accent + "22" : "transparent",
              color: calMode === v ? TH.accent : TH.muted,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: `1px solid ${filterOpen || selPaths.size > 0 ? TH.accent : TH.border}`,
              background: filterOpen || selPaths.size > 0 ? TH.accent + "22" : "transparent",
              color: filterOpen || selPaths.size > 0 ? TH.accent : TH.muted,
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🔎 分類篩選
          </button>
          <span style={{ fontSize: 11, color: TH.text, fontWeight: 700 }}>{chartLabel}</span>
          {selPaths.size > 0 && (
            <button
              type="button"
              onClick={() => setSelPaths(new Set())}
              style={{
                padding: "4px 8px",
                borderRadius: 8,
                border: `1px solid ${TH.border}`,
                background: "transparent",
                color: TH.muted,
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              全部
            </button>
          )}
        </div>
        <div style={{ fontSize: 9, color: TH.muted, paddingLeft: 2 }}>
          💡 可跨大分類複選中／小分類做加總；不選＝看全部
        </div>
        {filterOpen && (
          <div
            style={{
              background: TH.card,
              border: `1px solid ${TH.border}`,
              borderRadius: 12,
              padding: 10,
            }}
          >
            <MultiCategoryFilter selected={selPaths} onChange={setSelPaths} />
          </div>
        )}
      </div>
      {calMode === "review" && (
        <>
          <div style={{ display: "flex", gap: 5 }}>
            {(
              [
                ["detail", "明細"],
                ["day", "日"],
                ["week", "週"],
                ["month", "月"],
                ["quarter", "季"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setReviewSubMode(v)}
                style={{
                  flex: 1,
                  padding: "7px 4px",
                  borderRadius: 10,
                  border: `1px solid ${reviewSubMode === v ? TH.accent : TH.border}`,
                  background: reviewSubMode === v ? TH.accent + "22" : "transparent",
                  color: reviewSubMode === v ? TH.accent : TH.muted,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {l}
              </button>
            ))}
          </div>
          {reviewSubMode === "detail" && (
            <ReviewView
              sessions={sessions}
              sel={selPaths}
              onPatchReflection={onPatchReflection}
            />
          )}
          {reviewSubMode === "day" && <DayReview sessions={sessions} />}
          {reviewSubMode === "week" && <PeriodReview scope="week" />}
          {reviewSubMode === "month" && <PeriodReview scope="month" />}
          {reviewSubMode === "quarter" && <PeriodReview scope="quarter" />}
        </>
      )}
      {calMode === "calendar" && (
        <>
          <div style={{ display: "flex", gap: 5 }}>
            {(
              [
                ["week", "週曆"],
                ["month", "月曆"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setCalView(v)}
                style={{
                  flex: 1,
                  padding: "6px",
                  borderRadius: 10,
                  border: `1px solid ${calView === v ? activeColor : TH.border}`,
                  background: calView === v ? activeColor + "22" : "transparent",
                  color: calView === v ? activeColor : TH.muted,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {l}
              </button>
            ))}
          </div>
      {calView === "month" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
          {(
            [
              ["時長", fmt(mTot), activeColor],
              ["日均", fmt(dayAvg), TH.text],
              ["有效天", `${dayCount}天`, TH.text],
            ] as const
          ).map(([l, v, col]) => (
            <div key={l} style={{ background: TH.card, border: `1px solid ${TH.border}`, borderRadius: 10, padding: "6px 8px" }}>
              <div style={{ fontSize: 8, color: TH.muted }}>{l}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: col }}>{v}</div>
            </div>
          ))}
          <div style={{ background: TH.card, border: `1px solid ${TH.border}`, borderRadius: 10, padding: "6px 8px" }}>
            <div style={{ fontSize: 8, color: TH.muted }}>番茄數</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: TH.text }}>
              {pomo10}/{pomo25}
              <span style={{ fontSize: 7, color: TH.muted, fontWeight: 600, marginLeft: 3 }}>滿10/25分</span>
            </div>
          </div>
        </div>
      )}
      {calView === "month" && (
        <div
          style={{
            background: TH.card,
            border: `1px solid ${TH.border}`,
            borderRadius: 10,
            padding: "8px 10px",
            marginTop: 5,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setIdleReviewDraft(idleReview?.text ?? "");
              setIdleReviewOpen((v) => !v);
            }}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              padding: 0,
              margin: 0,
              textAlign: "left",
              cursor: "pointer",
              color: "inherit",
              font: "inherit",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <div>
                <div style={{ fontSize: 8, color: TH.muted }}>未利用（{period}）</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: TH.muted }}>{fmt(idlePeriodTot)}</div>
              </div>
              <span style={{ fontSize: 12, lineHeight: 1 }} aria-hidden>
                {idleReview ? "📝" : "＋"}
              </span>
            </div>
            {idleReview?.text && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: TH.yellow,
                  fontWeight: 700,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                📝 {idleReview.text}
              </div>
            )}
          </button>
          {idleReviewOpen ? (
            <div
              style={{
                marginTop: 8,
                border: `1px solid ${TH.border}`,
                borderRadius: 10,
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 10, color: TH.muted }}>
                💡 寫下這段期間未利用時間的原因與下一步方針（會跟著上面的時間範圍走）
              </div>
              <textarea
                value={idleReviewDraft}
                onChange={(e) => setIdleReviewDraft(e.target.value)}
                rows={4}
                placeholder="例：週三下午常被雜事打斷；下週改成先做 25 分番茄再處理雜務"
                style={{
                  background: "#15151B",
                  border: `1px solid ${TH.border}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: TH.text,
                  fontSize: 12,
                  outline: "none",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    upsertReview(idleScope, idlePeriodKey, idleReviewDraft);
                    setIdleReviewOpen(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: 8,
                    border: "none",
                    background: TH.accent,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  儲存
                </button>
                <button
                  type="button"
                  onClick={() => setIdleReviewOpen(false)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${TH.border}`,
                    background: "transparent",
                    color: TH.muted,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 9, color: TH.muted, marginTop: 4, lineHeight: 1.4 }}>
              💡 今天的未利用會即時累積（不必等今天結束）
            </div>
          )}
        </div>
      )}
      {calView !== "week" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" onClick={() => setMonthOffset((m) => m - 1)} style={{ background: "none", border: "none", color: TH.muted, fontSize: 22, cursor: "pointer" }}>
            ‹
          </button>
          <div style={{ fontSize: 13, fontWeight: 700, color: TH.text }}>
            {curY}年 {curM}月
          </div>
          <button type="button" onClick={() => setMonthOffset((m) => m + 1)} style={{ background: "none", border: "none", color: TH.muted, fontSize: 22, cursor: "pointer" }}>
            ›
          </button>
        </div>
      )}
      {calView === "week" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              style={{ background: "none", border: "none", color: TH.muted, fontSize: 22, cursor: "pointer" }}
            >
              ‹
            </button>
            <div style={{ fontSize: 12, fontWeight: 700, color: TH.text, textAlign: "center", flex: 1 }}>
              {weekNavLabel}
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              style={{ background: "none", border: "none", color: TH.muted, fontSize: 22, cursor: "pointer" }}
            >
              ›
            </button>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              padding: "2px 0 4px",
            }}
          >
            {([["早", "06-12"], ["午", "12-18"], ["晚", "18-24"]] as const).map(([label, range]) => (
              <span key={label} style={{ fontSize: 9, color: TH.muted }}>
                {label} {range}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
            {weekDates.map((dateStr) => {
              const isToday = dateStr === CFG.TODAY_STR;
              const label = dayViewLabel(dateStr);
              const dayFocus = focusByDate[dateStr] ?? 0;
              const availMins = availableMinutesFor(dateStr, dayPlans);
              const availSegs = availableSegments(dateStr, 0, 1440, dayPlans);
              const { within, off, withinByCat1 } = splitSessionsByAvailability(
                sessionsByDate[dateStr] ?? [],
                availSegs,
              );
              const totalPct = availMins > 0 ? Math.round(((within + off) / availMins) * 100) : 0;
              const dayPlan = planForDate(dateStr, dayPlans);
              const shiftLabel =
                dayPlan && dayPlan.picks.length
                  ? dayPlan.picks.map((p) => `${p.place}${p.shift}`).join("")
                  : "";
              const dayPomos = countByDate[dateStr] ?? 0;

              // 第一圈：可用內讀書（依分類上色）→ 接「未利用」灰色，剛好一圈
              const catSegs: { lines: ProgressLine[]; color: string }[] = [];
              let segAcc = 0;
              for (const c1 of CAT.cat1List()) {
                const m = withinByCat1[c1];
                if (!m) continue;
                const segLen = availMins > 0 ? (m / availMins) * WEEK_BORDER_PERIM : 0;
                const end = Math.min(segAcc + segLen, WEEK_BORDER_PERIM);
                if (end > segAcc) catSegs.push({ lines: calcRangeOn(WEEK_BORDER_SEG, segAcc, end), color: CAT.cat1Color(c1) });
                segAcc += segLen;
                if (segAcc >= WEEK_BORDER_PERIM) break;
              }
              const idleLines =
                segAcc < WEEK_BORDER_PERIM ? calcRangeOn(WEEK_BORDER_SEG, segAcc, WEEK_BORDER_PERIM) : [];

              // 第二圈：加碼（吃睡上班時間讀書）走獨立外圈，不與第一圈重疊
              const offLen = availMins > 0 ? Math.min(off / availMins, 1) * WEEK_BORDER_PERIM_OUTER : 0;
              const blueLines = offLen > 0 ? calcRangeOn(WEEK_BORDER_SEG_OUTER, 0, offLen) : [];
              return (
                <div
                  key={dateStr}
                  role="button"
                  tabIndex={0}
                  onClick={() => onShowDay(dateStr, label)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onShowDay(dateStr, label);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 44,
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 8,
                    overflow: "hidden",
                    cursor: "pointer",
                    position: "relative",
                    background: isToday ? TH.accent + "12" : TH.card,
                  }}
                >
                  <svg
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      pointerEvents: "none",
                      zIndex: 10,
                    }}
                    viewBox="0 0 10 100"
                    preserveAspectRatio="none"
                  >
                    {WEEK_BORDER_SEG.map((seg, i) => (
                      <line
                        key={`bg-${i}`}
                        x1={seg.x1}
                        y1={seg.y1}
                        x2={seg.x2}
                        y2={seg.y2}
                        stroke={TH.border}
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    {catSegs.map((seg, si) =>
                      seg.lines.map((ln, i) => (
                        <line
                          key={`cat-${si}-${i}`}
                          x1={ln.x1}
                          y1={ln.y1}
                          x2={ln.x2}
                          y2={ln.y2}
                          stroke={seg.color}
                          strokeWidth={isToday ? 1.5 : 1.2}
                          vectorEffect="non-scaling-stroke"
                        />
                      )),
                    )}
                    {idleLines.map((ln, i) => (
                      <line
                        key={`idle-${i}`}
                        x1={ln.x1}
                        y1={ln.y1}
                        x2={ln.x2}
                        y2={ln.y2}
                        stroke="#4B5563"
                        strokeWidth={isToday ? 1.5 : 1.2}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    {blueLines.map((ln, i) => (
                      <line
                        key={`ov-${i}`}
                        x1={ln.x1}
                        y1={ln.y1}
                        x2={ln.x2}
                        y2={ln.y2}
                        stroke="#3B82F6"
                        strokeWidth={isToday ? 1.5 : 1}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>
                  <div
                    style={{
                      padding: "6px 4px",
                      textAlign: "center",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: isToday ? 900 : 600,
                        color: isToday ? TH.accent : TH.text,
                      }}
                    >
                      {dayLabel(dateStr)}
                    </div>
                    {isToday && (
                      <div
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: TH.accent,
                          margin: "2px auto 0",
                        }}
                      />
                    )}
                    {shiftLabel && (
                      <div style={{ marginTop: 2, fontSize: 8, fontWeight: 700, color: TH.muted }}>
                        {shiftLabel}
                      </div>
                    )}
                  </div>
                  {WEEK_SLOTS.map((slot) => {
                    const slotTodos = todosByDateSlot[dateStr]?.[slot.id] ?? [];
                    return (
                      <div
                        key={slot.id}
                        style={{
                          minHeight: 40,
                          borderTop: `1px solid ${TH.border}`,
                          background: slot.bg,
                          padding: "2px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minHeight: 0 }}>
                          {slotTodos.map((todo) => {
                            const t = todo as {
                              id?: number;
                              text?: string;
                              cat?: string;
                              phase?: string;
                            };
                            const done = t.phase === "done";
                            const col = CAT.cat1Color(t.cat ?? "") || TH.muted;
                            return (
                              <div
                                key={t.id ?? `${dateStr}-${slot.id}-${t.text}`}
                                title={t.text}
                                style={{
                                  height: 20,
                                  borderRadius: 3,
                                  background: col,
                                  opacity: done ? 0.4 : 1,
                                  padding: "0 3px",
                                  display: "flex",
                                  alignItems: "center",
                                  overflow: "hidden",
                                  flexShrink: 0,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 7,
                                    color: "#111111",
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    width: "100%",
                                  }}
                                >
                                  {t.text}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <div
                    style={{
                      borderTop: `1px solid ${TH.border}`,
                      padding: "3px 2px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 800, color: dayFocus > 0 ? activeColor : TH.muted }}>
                      {fmt(dayFocus)}
                    </span>
                    <span style={{ fontSize: 8, color: TH.muted }}>🍅 {dayPomos}</span>
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: totalPct >= 100 ? "#3B82F6" : dayFocus > 0 ? activeColor : TH.muted,
                      }}
                    >
                      {totalPct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {calView === "month" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
            {DOW.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 9, color: TH.muted }}>
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
            {Array.from({ length: fdow }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {mData.map((mins, i) => {
              const day = i + 1,
                circ = 2 * Math.PI * 13;
              const isToday =
                day === CFG.TODAY.getDate() && curM === CFG.TODAY.getMonth() + 1 && curY === CFG.TODAY.getFullYear();
              const dateStr = `${curY}-${String(curM).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const availMins = availableMinutesFor(dateStr, dayPlans);
              const availSegs = availableSegments(dateStr, 0, 1440, dayPlans);
              const { within, off } = splitSessionsByAvailability(sessionsByDate[dateStr] ?? [], availSegs);
              const circOuter = 2 * Math.PI * 15;
              const withinDash = availMins > 0 ? circ * Math.min(within / availMins, 1) : 0;
              const offDash = availMins > 0 ? circOuter * Math.min(off / availMins, 1) : 0;
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => onShowDay(dateStr, `${curY}年${curM}月${day}日`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onShowDay(dateStr, `${curY}年${curM}月${day}日`);
                  }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
                >
                  <div style={{ position: "relative", width: 32, height: 32 }}>
                    <svg width={32} height={32} style={{ transform: "rotate(-90deg)" }}>
                      <circle cx={16} cy={16} r={13} fill="none" stroke={TH.border} strokeWidth={2.5} />
                      {withinDash > 0 && (
                        <circle
                          cx={16}
                          cy={16}
                          r={13}
                          fill="none"
                          stroke={activeColor}
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeDasharray={`${withinDash} ${circ}`}
                        />
                      )}
                      {offDash > 0 && (
                        <circle
                          cx={16}
                          cy={16}
                          r={15}
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          strokeDasharray={`${offDash} ${circOuter}`}
                        />
                      )}
                    </svg>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: isToday ? 900 : 600,
                        color: isToday ? activeColor : mins > 0 ? TH.text : TH.muted,
                      }}
                    >
                      {day}
                    </div>
                    {isToday && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: -1,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: activeColor,
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {pctVsLast !== 0 && (
            <div style={{ fontSize: 11, color: pctVsLast >= 0 ? TH.green : TH.red, textAlign: "center", fontWeight: 700 }}>
              vs 上月 {pctVsLast >= 0 ? "+" : ""}
              {pctVsLast}%
            </div>
          )}
        </>
      )}
      {calView === "month" && (
        <TriCharts
          chartData={chartData}
          lineD={lineD}
          period={period}
          onPeriodChange={setPeriod}
          label={chartLabel}
          idleLine={idleLine}
        />
      )}
        </>
      )}
    </div>
  );
}
