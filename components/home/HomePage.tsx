"use client";

import { useState } from "react";
import { Card, SL } from "@/components/ui/Card";
import { TodoCard } from "@/components/todo/TodoCard";
import { BattleCard } from "@/components/home/BattleCard";
import { CFG } from "@/lib/config";
import { TH } from "@/lib/theme";
import { getPeriod } from "@/lib/utils";
import type { Session } from "@/lib/types";

export function HomePage({
  todos,
  todaySessions,
  yesterdaySessions,
  onStart,
  onEnd,
  onToggleDone,
  onEditTodo,
}: {
  todos: Record<string, unknown>[];
  todaySessions: Session[];
  yesterdaySessions: Session[];
  onStart: (id: number) => void;
  onEnd: (id: number) => void;
  onToggleDone: (id: number) => void;
  onEditTodo: (id: number) => void;
}) {
  const [expandReview, setExpandReview] = useState(false);
  const yTot = yesterdaySessions.reduce((s, p) => s + p.mins, 0);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <BattleCard title="昨日" pomos={yesterdaySessions} prevMins={350} prevCount={6} />
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
        <div onClick={() => setExpandReview(!expandReview)} style={{ cursor: "pointer" }}>
          <SL>
            💡 覆盤方針 {expandReview ? "▲" : "▼"}
          </SL>
          <div style={{ fontSize: 12, color: TH.text }}>「法律讀完一節再休息，不要中途滑手機」</div>
        </div>
        {expandReview && (
          <div style={{ marginTop: 8, borderTop: `1px solid ${TH.border}`, paddingTop: 8 }}>
            <div style={{ fontSize: 10, color: TH.muted, marginBottom: 4 }}>📚 閱讀筆記</div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>• 習慣堆疊可以跟晨間儀式結合</div>
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
