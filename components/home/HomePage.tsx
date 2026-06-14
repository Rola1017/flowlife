"use client";

import { useMemo, useState } from "react";
import { Card, SL } from "@/components/ui/Card";
import { TodoCard } from "@/components/todo/TodoCard";
import { BattleCard } from "@/components/home/BattleCard";
import { CourseBanner } from "@/components/schedule/CourseBanner";
import { CFG } from "@/lib/config";
import { TH } from "@/lib/theme";
import { fmt, getPeriod } from "@/lib/utils";
import type { Session } from "@/lib/types";

export function HomePage({
  todos,
  todaySessions,
  yesterdaySessions,
  dayBeforeSessions,
  onStart,
  onEnd,
  onToggleDone,
  onEditTodo,
}: {
  todos: Record<string, unknown>[];
  todaySessions: Session[];
  yesterdaySessions: Session[];
  dayBeforeSessions: Session[];
  onStart: (id: number) => void;
  onEnd: (id: number) => void;
  onToggleDone: (id: number) => void;
  onEditTodo: (id: number) => void;
}) {
  const [expandReview, setExpandReview] = useState(false);
  const yTot = yesterdaySessions.reduce((s, p) => s + p.mins, 0);
  const ydbTot = dayBeforeSessions.reduce((s, p) => s + p.mins, 0);
  const mustDo = todos.filter(
    (t: { date?: string; mustDo?: boolean; phase?: string }) =>
      t.date === CFG.TODAY_STR && t.mustDo && t.phase !== "done",
  );
  const grouped: Record<string, Record<string, unknown>[]> = { 早: [], 午: [], 晚: [] };
  mustDo.forEach((t: { startTime?: string }) => {
    const h = t.startTime ? parseInt(t.startTime, 10) : 7;
    grouped[getPeriod(h)].push(t);
  });
  const PL = { 早: "🌅 早（6~12）", 午: "☀️ 午（12~18）", 晚: "🌆 晚（18~24）" };

  const nextTodo = useMemo(() => {
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const cand = (todos as Array<{ date?: string; phase?: string; startTime?: string; text?: string }>)
      .filter((t) => t.date === CFG.TODAY_STR && t.phase !== "done" && /^\d{1,2}:\d{2}/.test(t.startTime ?? ""))
      .map((t) => {
        const [h, m] = (t.startTime as string).split(":").map(Number);
        return { t, m: h * 60 + (m || 0) };
      })
      .filter((x) => x.m >= nowMin)
      .sort((a, b) => a.m - b.m);
    const top = cand[0];
    return top ? { text: top.t.text || "待辦", time: top.t.startTime } : null;
  }, [todos]);

  const intentionReview = useMemo(
    () => [...todaySessions].reverse().filter((s) => s.intention?.trim()),
    [todaySessions],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <CourseBanner fallback={nextTodo} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <BattleCard
            title="昨日"
            pomos={yesterdaySessions}
            prevMins={ydbTot}
            prevCount={dayBeforeSessions.length}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <BattleCard
            title="今日"
            pomos={todaySessions}
            prevMins={yTot}
            prevCount={yesterdaySessions.length}
          />
        </div>
      </div>
      <Card>
        <SL>🎯 今日意圖回顧</SL>
        {intentionReview.length === 0 ? (
          <div style={{ fontSize: 11, color: TH.muted, lineHeight: 1.5 }}>
            今天還沒有寫意圖的番茄。開始番茄前寫一句意圖，這裡會回顧「想專注什麼 vs 實際如何」。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(expandReview ? intentionReview : intentionReview.slice(0, 3)).map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#0A0A0C",
                  borderRadius: 8,
                  padding: "7px 9px",
                }}
              >
                <span style={{ fontSize: 14 }}>{s.rating || "🍅"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: TH.text,
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    🎯 {s.intention}
                  </div>
                  <div style={{ fontSize: 9, color: TH.muted }}>
                    {[s.name, s.cat1].filter(Boolean).join(" · ")} · {fmt(s.mins)}
                  </div>
                </div>
              </div>
            ))}
            {intentionReview.length > 3 && (
              <button
                type="button"
                onClick={() => setExpandReview(!expandReview)}
                style={{
                  background: "none",
                  border: "none",
                  color: TH.muted,
                  fontSize: 10,
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                {expandReview ? "收合 ▲" : `展開全部 ${intentionReview.length} 筆 ▼`}
              </button>
            )}
          </div>
        )}
      </Card>
      <Card>
        <SL>🔴 今日必做</SL>
        {mustDo.length === 0 && (
          <div style={{ fontSize: 11, color: TH.muted, textAlign: "center", padding: 8 }}>
            🎉 今日必做已全部完成！
          </div>
        )}
        {(["早", "午", "晚"] as const).map((p) => {
          const items = grouped[p];
          if (!items.length) return null;
          return (
            <div key={p} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: TH.muted, marginBottom: 6 }}>{PL[p]}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {items.map((t) => (
                  <TodoCard
                    key={t.id as number}
                    todo={t}
                    onStart={onStart}
                    onEnd={onEnd}
                    onToggleDone={onToggleDone}
                    onEdit={onEditTodo}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
