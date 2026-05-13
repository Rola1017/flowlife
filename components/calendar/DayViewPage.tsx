"use client";

import { useState } from "react";
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
  onAddTodo,
  onEditTodo,
  onBack,
}: {
  date: string;
  label: string;
  todos: Record<string, unknown>[];
  onStart: (id: number) => void;
  onEnd: (id: number) => void;
  onToggleDone: (id: number) => void;
  onAddTodo: (todo: Record<string, unknown>) => void;
  onEditTodo: (id: number) => void;
  onBack: () => void;
}) {
  const [quickDraft, setQuickDraft] = useState<{ time: string; text: string } | null>(null);
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
  const submitQuickTodo = () => {
    const text = quickDraft?.text.trim();
    if (!quickDraft || !text) return;
    onAddTodo({
      text,
      startTime: quickDraft.time,
      endTime: "",
      cat: "未分類",
      mustDo: true,
    });
    setQuickDraft(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <BackBtn onBack={onBack} label={label} />

      <Card style={{ padding: "8px 12px" }}>
        <SL>📅 待辦事項</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {dateTodos.map((t) => (
            <TodoCard
              key={t.id as number}
              todo={t}
              onStart={onStart}
              onEnd={onEnd}
              onToggleDone={onToggleDone}
              onEdit={onEditTodo}
            />
          ))}
          {dateTodos.length === 0 && (
            <div style={{ fontSize: 11, color: TH.muted, textAlign: "center", padding: 12 }}>尚無待辦</div>
          )}
        </div>
      </Card>

      <VerticalTimeline
        nowPct={nowPct}
        pendingTodos={pendingTL}
        doneTodos={doneTL}
        date={date}
        onTimeClick={(time) => setQuickDraft({ time, text: "" })}
      />
      {quickDraft && (
        <Card style={{ padding: 10 }}>
          <SL>快速新增 {quickDraft.time}</SL>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              value={quickDraft.text}
              onChange={(e) => setQuickDraft((v) => (v ? { ...v, text: e.target.value } : v))}
              placeholder="輸入待辦名稱..."
              autoFocus
              style={{
                background: "#15151B",
                border: `1px solid ${TH.border}`,
                borderRadius: 8,
                padding: "8px 10px",
                color: TH.text,
                fontSize: 12,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="flowlife-pressable"
                type="button"
                onClick={submitQuickTodo}
                disabled={!quickDraft.text.trim()}
                style={{
                  flex: 1,
                  padding: "9px 10px",
                  borderRadius: 10,
                  border: "none",
                  background: quickDraft.text.trim() ? TH.accent : "#374151",
                  color: quickDraft.text.trim() ? "#fff" : "#6B7280",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: quickDraft.text.trim() ? "pointer" : "not-allowed",
                }}
              >
                新增待辦
              </button>
              <button
                type="button"
                onClick={() => setQuickDraft(null)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: `1px solid ${TH.border}`,
                  background: "transparent",
                  color: TH.muted,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                取消
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
