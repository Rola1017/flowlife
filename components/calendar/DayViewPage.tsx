"use client";

import { Card, SL } from "@/components/ui/Card";
import { BackBtn } from "@/components/ui/BackBtn";
import { TodoCard } from "@/components/todo/TodoCard";
import { VerticalTimeline } from "@/components/timeline/VerticalTimeline";
import { TH } from "@/lib/theme";
import { DS, DT } from "@/lib/utils";

export function DayViewPage({
  date,
  label,
  todos,
  onStart,
  onEnd,
  onToggleDone,
  onBack,
}: {
  date: string;
  label: string;
  todos: Record<string, unknown>[];
  onStart: (id: number) => void;
  onEnd: (id: number) => void;
  onToggleDone: (id: number) => void;
  onBack: () => void;
}) {
  const dateTodos = todos.filter((t: { date?: string }) => t.date === date);
  const pendingTL = dateTodos.filter(
    (t: { phase?: string; startTime?: string }) => t.phase !== "done" && t.startTime,
  ) as { id: number; text: string; startTime: string; endTime: string }[];
  const doneTL = dateTodos.filter(
    (t: { phase?: string; endAt?: string }) => t.phase === "done" && t.endAt,
  ) as { id: number; text: string; startTime: string; endTime: string; endAt?: string }[];

  const now = new Date(),
    nowMins = now.getHours() * 60 + now.getMinutes();
  const nowPct = ((nowMins - DS) / DT) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <BackBtn onBack={onBack} label={label} />

      <Card style={{ padding: "8px 12px" }}>
        <SL>📅 待辦事項</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {dateTodos.map((t) => (
            <TodoCard key={t.id as number} todo={t} onStart={onStart} onEnd={onEnd} onToggleDone={onToggleDone} />
          ))}
          {dateTodos.length === 0 && (
            <div style={{ fontSize: 11, color: TH.muted, textAlign: "center", padding: 12 }}>尚無待辦</div>
          )}
        </div>
      </Card>

      <VerticalTimeline nowPct={nowPct} pendingTodos={pendingTL} doneTodos={doneTL} />
    </div>
  );
}
