"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, SL } from "@/components/ui/Card";
import { BackBtn } from "@/components/ui/BackBtn";
import { TodoCard } from "@/components/todo/TodoCard";
import {
  createTodoFormDraft,
  formDraftToTodoPatch,
  TodoFormFields,
  type TodoFormDraft,
} from "@/components/todo/TodoFormFields";
import { VerticalTimeline } from "@/components/timeline/VerticalTimeline";
import { CFG } from "@/lib/config";
import { TH } from "@/lib/theme";
import { todoShowsOn } from "@/lib/todosCloud";
import { buildActualSegments } from "@/lib/timelineActual";
import { addMinHM, DS, DT, toM } from "@/lib/utils";
import type { Todo } from "@/lib/types";

function normalizeTimelineTime(time: string): string {
  const m = time.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return "09:00";
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function rangeHeader(d: TodoFormDraft, prefix: string) {
  const end = d.endDate && d.endDate > d.date ? `～${d.endDate}` : "";
  const tm = d.startTime ? ` ${d.startTime}${d.endTime ? `～${d.endTime}` : ""}` : "";
  return `${prefix} ${d.date}${end}${tm}`;
}

const getCurrentMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export function DayViewPage({
  date,
  label,
  todos,
  onStart,
  onEnd,
  onToggleDone,
  onAddTodo,
  onEditTodo,
  onDeleteTodo,
  onBack,
}: {
  date: string;
  label: string;
  todos: Todo[];
  onStart: (id: number) => void;
  onEnd: (id: number) => void;
  onToggleDone: (id: number) => void;
  onAddTodo: (todo: Partial<Todo>) => void;
  onEditTodo: (id: number) => void;
  onDeleteTodo: (id: number) => void;
  onBack: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(() => createTodoFormDraft(date));
  const [quickDraft, setQuickDraft] = useState<TodoFormDraft | null>(null);
  const [now, setNow] = useState(getCurrentMinutes);
  const nowPct = ((now - DS) / DT) * 100;

  useEffect(() => {
    const syncNow = () => setNow(getCurrentMinutes());
    syncNow();
    const timer = setInterval(syncNow, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setDraft(createTodoFormDraft(date));
    setAddOpen(false);
    setQuickDraft(null);
  }, [date]);

  const active = todos.filter((t) => todoShowsOn(t, date) && t.phase !== "done");
  const done = todos.filter((t) => todoShowsOn(t, date) && t.phase === "done");
  const pendingTL = active.filter((t) => t.startTime) as {
    id: number;
    text: string;
    startTime: string;
    endTime: string;
  }[];
  const doneTL = done.filter((t) => t.endAt) as {
    id: number;
    text: string;
    startTime: string;
    endTime: string;
    endAt?: string;
  }[];
  const { act: miniAct, idle: miniIdle } = useMemo(
    () => buildActualSegments(date, nowPct),
    [date, nowPct],
  );

  const submitTodo = () => {
    const result = formDraftToTodoPatch(draft);
    if (!result.ok) {
      setDraft((v) => ({ ...v, error: result.error }));
      return;
    }
    onAddTodo({ ...result.patch, date: result.patch.date || date });
    setDraft(createTodoFormDraft(date));
    setAddOpen(false);
  };

  const submitQuickTodo = () => {
    if (!quickDraft) return;
    const result = formDraftToTodoPatch(quickDraft);
    if (!result.ok) {
      setQuickDraft((v) => (v ? { ...v, error: result.error } : v));
      return;
    }
    onAddTodo({ ...result.patch, date: result.patch.date || date });
    setQuickDraft(null);
  };

  const quickHeader = quickDraft ? rangeHeader(quickDraft, "快速新增") : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <BackBtn onBack={onBack} label={label} />

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            height: 10,
            borderRadius: 5,
            overflow: "hidden",
            background: "#1C1C22",
            position: "relative",
            marginTop: 8,
          }}
        >
          {miniIdle.map((item, i) => {
            const l = ((toM(item.start) - DS) / DT) * 100,
              w = ((toM(item.end) - toM(item.start)) / DT) * 100;
            return (
              <div
                key={`idle-${i}`}
                style={{
                  position: "absolute",
                  left: `${l}%`,
                  width: `${w}%`,
                  height: "100%",
                  background: "#374151",
                }}
              />
            );
          })}
          {miniAct.map((item, i) => {
            const l = ((toM(item.start) - DS) / DT) * 100,
              w = ((toM(item.end) - toM(item.start)) / DT) * 100;
            return (
              <div
                key={`act-${i}`}
                style={{
                  position: "absolute",
                  left: `${l}%`,
                  width: `${w}%`,
                  height: "100%",
                  background: item.color,
                }}
              />
            );
          })}
        </div>
        <VerticalTimeline
          nowPct={nowPct}
          showNowLine={date === CFG.TODAY_STR}
          pendingTodos={pendingTL}
          doneTodos={doneTL}
          date={date}
          onEditTodo={onEditTodo}
          onTimeClick={(time) => {
            const hm = normalizeTimelineTime(time);
            setQuickDraft(
              createTodoFormDraft(date, {
                startTime: hm,
                endTime: addMinHM(hm, CFG.DEFAULT_TODO_DURATION_MIN),
                cat: "未分類",
                mustDo: true,
              }),
            );
          }}
        />
      </div>

      <Card style={{ padding: "8px 12px" }}>
        <SL>待辦事項</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
          {active.map((t) => (
            <TodoCard
              key={t.id as number}
              todo={t}
              onStart={onStart}
              onEnd={onEnd}
              onToggleDone={onToggleDone}
              onEdit={onEditTodo}
              onDelete={onDeleteTodo}
            />
          ))}
        </div>
        {done.length > 0 && (
          <>
            <div style={{ fontSize: 9, color: TH.muted, marginBottom: 4 }}>✅ 已完成</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {done.map((t) => (
                <TodoCard
                  key={t.id as number}
                  todo={t}
                  onStart={onStart}
                  onEnd={onEnd}
                  onToggleDone={onToggleDone}
                  onEdit={onEditTodo}
                  onDelete={onDeleteTodo}
                />
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setAddOpen((o) => {
              if (!o) setDraft(createTodoFormDraft(date));
              return !o;
            });
          }}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "8px",
            borderRadius: 10,
            border: `1px dashed ${TH.accent}`,
            background: addOpen ? TH.accent + "12" : "transparent",
            color: TH.accent,
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ＋ 新增待辦
        </button>
        {addOpen && (
          <div
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 12,
              border: `1px solid ${TH.border}`,
              background: "#0A0A0C",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            <TodoFormFields
              draft={draft}
              setDraft={setDraft}
              defaultStartTime="09:00"
              defaultEndTime={addMinHM("09:00", CFG.DEFAULT_TODO_DURATION_MIN)}
            />
            <button
              className="flowlife-pressable"
              type="button"
              onClick={submitTodo}
              disabled={!draft.text.trim()}
              style={{
                padding: "10px",
                borderRadius: 10,
                border: "none",
                background: draft.text.trim() ? TH.accent : "#374151",
                color: draft.text.trim() ? "#fff" : "#6B7280",
                fontSize: 12,
                fontWeight: 900,
                cursor: draft.text.trim() ? "pointer" : "not-allowed",
                transition: "transform .12s, filter .12s",
              }}
            >
              確認新增
            </button>
          </div>
        )}
      </Card>
      {quickDraft && (
        <Card style={{ padding: 10 }}>
          <SL>{quickHeader}</SL>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <TodoFormFields
              draft={quickDraft}
              setDraft={(fn) => setQuickDraft((v) => (v ? fn(v) : v))}
              defaultStartTime="09:00"
              defaultEndTime={addMinHM("09:00", CFG.DEFAULT_TODO_DURATION_MIN)}
              autoFocusName
            />
            <div style={{ display: "flex", gap: 8, minWidth: 0 }}>
              <button
                className="flowlife-pressable"
                type="button"
                onClick={submitQuickTodo}
                disabled={!quickDraft.text.trim()}
                style={{
                  flex: 1,
                  minWidth: 0,
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
                  flexShrink: 0,
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
