"use client";

import { useMemo } from "react";
import { TH } from "@/lib/theme";
import { fmt } from "@/lib/utils";
import { BackBtn } from "@/components/ui/BackBtn";
import type { Session } from "@/lib/types";

function formatDateLabel(date: string) {
  const [y, m, day] = date.split("-");
  return y && m && day ? `${y}/${m}/${day}` : date;
}

function dayStats(daySessions: Session[]) {
  const focused = daySessions.filter((s) => s.rating === "😤").length;
  const neutral = daySessions.filter((s) => s.rating === "🙂").length;
  const distracted = daySessions.filter((s) => s.rating === "😴").length;

  const min1 = daySessions.filter((s) => s.mins >= 1);
  const min1Count = min1.length;
  const min1Total = min1.reduce((sum, s) => sum + s.mins, 0);

  const min25 = daySessions.filter((s) => s.mins >= 25);
  const min25Count = min25.length;
  const min25Total = min25.reduce((sum, s) => sum + s.mins, 0);

  return { focused, neutral, distracted, min1Count, min1Total, min25Count, min25Total };
}

export function SessionHistoryPage({
  sessions,
  onBack,
}: {
  sessions: Session[];
  onBack: () => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, Session[]> = {};
    for (const session of sessions) {
      if (!map[session.date]) map[session.date] = [];
      map[session.date].push(session);
    }
    return map;
  }, [sessions]);

  const sortedDates = useMemo(
    () => Object.keys(grouped).sort((a, b) => b.localeCompare(a)),
    [grouped],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <BackBtn onBack={onBack} label="番茄鐘歷史" />

      {sortedDates.length === 0 ? (
        <div style={{ fontSize: 10, color: TH.muted, textAlign: "center", padding: 16 }}>
          尚無番茄紀錄
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sortedDates.map((date) => {
            const stats = dayStats(grouped[date]);
            return (
              <div key={date}>
                <div style={{ fontSize: 9, color: TH.muted, marginBottom: 6 }}>
                  {formatDateLabel(date)}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  {(
                    [
                      ["😤", stats.focused],
                      ["🙂", stats.neutral],
                      ["😴", stats.distracted],
                    ] as const
                  ).map(([emoji, count]) => (
                    <div
                      key={emoji}
                      style={{
                        flex: 1,
                        background: "#0A0A0C",
                        borderRadius: 8,
                        padding: "6px 4px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 16 }}>{emoji}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: TH.text }}>{count}</div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: TH.text,
                    marginBottom: 2,
                  }}
                >
                  <span>🍅 有效（滿1分）</span>
                  <span style={{ fontWeight: 700 }}>
                    {stats.min1Count} 顆 · 共 {fmt(stats.min1Total)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: TH.green,
                  }}
                >
                  <span>💪 紮實（滿25分）</span>
                  <span style={{ fontWeight: 700 }}>
                    {stats.min25Count} 顆 · 共 {fmt(stats.min25Total)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
