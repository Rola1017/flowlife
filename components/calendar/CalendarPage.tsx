"use client";

import { useMemo, useState } from "react";
import { CFG } from "@/lib/config";
import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { MOCK } from "@/lib/mock";
import { fmt, getDaysInMonth, getFirstDow, genMonthData } from "@/lib/utils";
import { Chip } from "@/components/ui/Chip";
import { TriCharts } from "@/components/charts/TriCharts";

const DOW = ["一", "二", "三", "四", "五", "六", "日"] as const;

const WEEK_SLOTS = [
  { id: "morning" as const, bg: "#F59E0B08" },
  { id: "noon" as const, bg: "#22C55E08" },
  { id: "evening" as const, bg: "#3B82F608" },
];

type WeekSlotId = (typeof WEEK_SLOTS)[number]["id"];

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
  onShowDay,
  onShowSchedule,
}: {
  todos: Record<string, unknown>[];
  onShowDay: (date: string, label: string) => void;
  onShowSchedule: () => void;
}) {
  const [calView, setCalView] = useState("month");
  const [selCat1, setSelCat1] = useState("");
  const [selCat2, setSelCat2] = useState("");
  const [monthOffset, setMonthOffset] = useState(1);
  const [weekOffset, setWeekOffset] = useState(0);
  const [period, setPeriod] = useState("月");
  const filterLevel = selCat2 ? "cat2" : selCat1 ? "cat1" : "all";
  const chartData = CAT.chartDataFor(filterLevel, selCat1, selCat2);
  const chartLabel = selCat2 ? selCat2 : selCat1 ? selCat1 : "全部分類";
  const activeColor = selCat1 ? CAT.cat1Color(selCat1) : TH.red;
  const totalM = 4 - 1 + monthOffset;
  const curY = 2026 + Math.floor(totalM / 12),
    curM = (totalM % 12) + 1;
  const dim = getDaysInMonth(curY, curM),
    fdow = getFirstDow(curY, curM);
  const mData = genMonthData(curY, curM, dim);
  const mTot = mData.reduce((s, v) => s + v, 0);
  const prevRaw = genMonthData(curY, curM === 1 ? 12 : curM - 1, getDaysInMonth(curY, curM === 1 ? 12 : curM - 1));
  const prevTot = prevRaw.reduce((s, v) => s + v, 0);
  const pctVsLast = prevTot ? Math.round(((mTot - prevTot) / prevTot) * 100) : 0;
  const dayCount = mData.filter((v) => v > 0).length,
    dayAvg = dayCount ? Math.round(mTot / dayCount) : 0;
  const lineD = MOCK.lineData[period as keyof typeof MOCK.lineData] || MOCK.lineData["月"];
  const MAX_AVAIL = (22.67 - 6.5) * 60;

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
        <button
          type="button"
          onClick={onShowSchedule}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: `2px solid ${TH.yellow}`,
            background: TH.yellow + "22",
            color: TH.yellow,
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          📋
        </button>
      </div>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
        <Chip label="全部" active={!selCat1} color={TH.red} onClick={() => { setSelCat1(""); setSelCat2(""); }} />
        {CAT.cat1List()
          .filter((c) => c !== "未分類")
          .map((c) => (
            <Chip
              key={c}
              label={c}
              active={selCat1 === c}
              color={CAT.cat1Color(c)}
              onClick={() => {
                setSelCat1(selCat1 === c ? "" : c);
                setSelCat2("");
              }}
            />
          ))}
      </div>
      {selCat1 && CAT.cat2List(selCat1).length > 0 && (
        <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
          <span style={{ fontSize: 9, color: TH.muted, flexShrink: 0, alignSelf: "center" }}>中分類：</span>
          {CAT.cat2List(selCat1).map((c) => (
            <Chip
              key={c}
              label={c}
              active={selCat2 === c}
              color={CAT.cat2Color(selCat1, c)}
              onClick={() => setSelCat2(selCat2 === c ? "" : c)}
              style={{ fontSize: 9, padding: "3px 8px" }}
            />
          ))}
        </div>
      )}
      {calView === "month" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
          {(
            [
              ["時長", fmt(mTot), activeColor],
              ["日均", fmt(dayAvg), TH.text],
              ["有效天", `${dayCount}天`, TH.text],
              ["番茄數", `${dayCount * 3}`, TH.text],
            ] as const
          ).map(([l, v, col]) => (
            <div key={l} style={{ background: TH.card, border: `1px solid ${TH.border}`, borderRadius: 10, padding: "6px 8px" }}>
              <div style={{ fontSize: 8, color: TH.muted }}>{l}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: col }}>{v}</div>
            </div>
          ))}
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
            {([["早", "06-12"], ["午", "12-18"], ["晚", "18-23"]] as const).map(([label, range]) => (
              <span key={label} style={{ fontSize: 9, color: TH.muted }}>
                {label} {range}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
            {weekDates.map((dateStr) => {
              const isToday = dateStr === CFG.TODAY_STR;
              const label = dayViewLabel(dateStr);
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
                    background: isToday ? TH.accent + "12" : TH.card,
                    border: isToday ? `1px solid ${TH.accent}` : `1px solid ${TH.border}`,
                  }}
                >
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
                  </div>
                  {WEEK_SLOTS.map((slot) => {
                    const slotTodos = todosByDateSlot[dateStr]?.[slot.id] ?? [];
                    const visible = slotTodos.slice(0, 3);
                    const extra = slotTodos.length - visible.length;
                    return (
                      <div
                        key={slot.id}
                        style={{
                          height: 60,
                          borderTop: `1px solid ${TH.border}`,
                          background: slot.bg,
                          padding: "2px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minHeight: 0 }}>
                          {visible.map((todo) => {
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
                          {extra > 0 && (
                            <div style={{ fontSize: 7, color: TH.muted, textAlign: "center", fontWeight: 800 }}>
                              +{extra}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                circ = 2 * Math.PI * 13,
                dash = circ * Math.min(mins / MAX_AVAIL, 1);
              const isToday =
                day === CFG.TODAY.getDate() && curM === CFG.TODAY.getMonth() + 1 && curY === CFG.TODAY.getFullYear();
              const dateStr = `${curY}-${String(curM).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
                      {mins > 0 && (
                        <circle
                          cx={16}
                          cy={16}
                          r={13}
                          fill="none"
                          stroke={activeColor}
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeDasharray={`${dash} ${circ}`}
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
        <TriCharts chartData={chartData} lineD={lineD} period={period} onPeriodChange={setPeriod} label={chartLabel} />
      )}
    </div>
  );
}
