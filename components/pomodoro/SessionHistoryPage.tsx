"use client";

import { useMemo } from "react";
import { CAT } from "@/lib/categories";
import { TH } from "@/lib/theme";
import { fmt } from "@/lib/utils";
import { BackBtn } from "@/components/ui/BackBtn";
import { Card, SL } from "@/components/ui/Card";
import type { Session } from "@/lib/types";

function formatDateLabel(date: string) {
  const [y, m, day] = date.split("-");
  return y && m && day ? `${y}/${m}/${day}` : date;
}

type IndexedSession = { session: Session; idx: number };

export function SessionHistoryPage({
  sessions,
  onBack,
}: {
  sessions: Session[];
  onBack: () => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, IndexedSession[]> = {};
    sessions.forEach((session, idx) => {
      if (!map[session.date]) map[session.date] = [];
      map[session.date].push({ session, idx });
    });
    return map;
  }, [sessions]);

  const sortedDates = useMemo(
    () => Object.keys(grouped).sort((a, b) => b.localeCompare(a)),
    [grouped],
  );

  const sortDayRows = (rows: IndexedSession[]) =>
    [...rows].sort((a, b) => {
      const sa = a.session.startTime;
      const sb = b.session.startTime;
      if (sa && sb) return sb.localeCompare(sa);
      if (sa) return -1;
      if (sb) return 1;
      return a.idx - b.idx;
    });

  const renderRow = (session: Session, key: string) => {
    const displayName = session.name?.trim() || session.cat1 || "未命名";
    const timeRange =
      session.startTime && session.endTime ? `${session.startTime}～${session.endTime}` : null;

    return (
      <div
        key={key}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#0A0A0C",
          borderRadius: 8,
          padding: "7px 9px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: TH.text }}>{displayName}</div>
          {session.cat1 && (
            <div
              style={{
                fontSize: 9,
                color: TH.muted,
                marginTop: 2,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: CAT.deepColorFull(
                    session.cat1,
                    session.cat2 || undefined,
                    session.cat3 || undefined,
                  ),
                  marginRight: 4,
                  flexShrink: 0,
                }}
              />
              {[session.cat1, session.cat2, session.cat3].filter(Boolean).join(" › ")}
            </div>
          )}
          {timeRange && (
            <div style={{ fontSize: 9, color: TH.muted, marginTop: 2 }}>{timeRange}</div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: TH.text }}>{session.mins}分</div>
          <div style={{ fontSize: 14, lineHeight: 1.2 }}>{session.rating}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <BackBtn onBack={onBack} label="番茄鐘歷史" />

      {sortedDates.length === 0 ? (
        <Card>
          <div style={{ fontSize: 10, color: TH.muted, textAlign: "center", padding: 16 }}>
            尚無番茄紀錄
          </div>
        </Card>
      ) : (
        sortedDates.map((date) => {
          const rows = sortDayRows(grouped[date]);
          const valid = rows.map((r) => r.session).filter((s) => s.mins >= 1);
          const dayCount = valid.length;
          const dayTotal = valid.reduce((sum, s) => sum + s.mins, 0);

          return (
            <Card key={date}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <SL style={{ marginBottom: 0 }}>{formatDateLabel(date)}</SL>
                <span style={{ fontSize: 9, color: TH.muted }}>
                  {dayCount} 顆 · 共 {fmt(dayTotal)}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {rows.map(({ session, idx }) => renderRow(session, `${date}-${idx}`))}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
