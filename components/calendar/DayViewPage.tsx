"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useHorizontalSwipe } from "@/components/hooks/useHorizontalSwipe";
import { Card, SL } from "@/components/ui/Card";
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
import { addMinHM, DS, DT, toM, shiftDateStr, formatYmdLabel } from "@/lib/utils";
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

const navHit: CSSProperties = {
  flexShrink: 0,
  width: 26,
  height: 26,
  padding: 9,
  margin: -9,
  boxSizing: "content-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  color: TH.muted,
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};

const navArrow: CSSProperties = {
  ...navHit,
  background: TH.card,
  borderRadius: 8,
  color: TH.text,
  fontSize: 20,
  fontWeight: 800,
};

export function DayViewPage({
  date,
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
  label?: string;
  todos: Todo[];
  onStart: (id: number) => void;
  onEnd: (id: number, doneDateHint?: string) => void;
  onToggleDone: (id: number) => void;
  onAddTodo: (todo: Partial<Todo>) => void;
  onEditTodo: (id: number) => void;
  onDeleteTodo: (id: number) => void;
  onBack: () => void;
}) {
  const [viewDate, setViewDate] = useState(date);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(() => createTodoFormDraft(date));
  const [quickDraft, setQuickDraft] = useState<TodoFormDraft | null>(null);
  const [now, setNow] = useState(getCurrentMinutes);
  const nowPct = ((now - DS) / DT) * 100;
  const swipe = useHorizontalSwipe((dir) => {
    setViewDate((d) => shiftDateStr(d, dir === "left" ? 1 : -1));
  });

  useEffect(() => {
    const syncNow = () => setNow(getCurrentMinutes());
    syncNow();
    const timer = setInterval(syncNow, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setViewDate(date);
  }, [date]);

  useEffect(() => {
    setDraft(createTodoFormDraft(viewDate));
    setAddOpen(false);
    setQuickDraft(null);
  }, [viewDate]);

  const active = todos.filter((t) => todoShowsOn(t, viewDate) && t.phase !== "done");
  const done = todos.filter((t) => todoShowsOn(t, viewDate) && t.phase === "done");
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
    () => buildActualSegments(viewDate, nowPct),
    [viewDate, nowPct],
  );

  const submitTodo = () => {
    const result = formDraftToTodoPatch(draft);
    if (!result.ok) {
      setDraft((v) => ({ ...v, error: result.error }));
      return;
    }
    onAddTodo({ ...result.patch, date: result.patch.date || viewDate });
    setDraft(createTodoFormDraft(viewDate));
    setAddOpen(false);
  };

  const submitQuickTodo = () => {
    if (!quickDraft) return;
    const result = formDraftToTodoPatch(quickDraft);
    if (!result.ok) {
      setQuickDraft((v) => (v ? { ...v, error: result.error } : v));
      return;
    }
    onAddTodo({ ...result.patch, date: result.patch.date || viewDate });
    setQuickDraft(null);
  };

  const quickHeader = quickDraft ? rangeHeader(quickDraft, "快速新增") : "";

  return (
    <div
      {...swipe.bind}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        ...swipe.bind.style,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          width: "100%",
          boxSizing: "border-box",
          paddingBottom: 4,
        }}
      >
        <button type="button" aria-label="返回" onClick={onBack} style={navHit}>
          ←
        </button>
        <button
          type="button"
          aria-label="前一天"
          onClick={() => setViewDate((d) => shiftDateStr(d, -1))}
          style={navArrow}
        >
          ‹
        </button>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: "center",
            fontSize: 13,
            fontWeight: 600,
            color: TH.muted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {formatYmdLabel(viewDate)}
        </div>
        <button
          type="button"
          aria-label="後一天"
          onClick={() => setViewDate((d) => shiftDateStr(d, 1))}
          style={navArrow}
        >
          ›
        </button>
      </div>
      <div style={{ fontSize: 9, color: TH.muted, textAlign: "center", lineHeight: 1.4 }}>
        💡 左右滑動或點箭頭可切換日期
      </div>
      </div>

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
        <div data-no-swipe="1">
        <VerticalTimeline
          nowPct={nowPct}
          showNowLine={viewDate === CFG.TODAY_STR}
          pendingTodos={pendingTL}
          doneTodos={doneTL}
          date={viewDate}
          onEditTodo={onEditTodo}
          onTimeClick={(time) => {
            const hm = normalizeTimelineTime(time);
            setQuickDraft(
              createTodoFormDraft(viewDate, {
                startTime: hm,
                endTime: addMinHM(hm, CFG.DEFAULT_TODO_DURATION_MIN),
                cat: "未分類",
                mustDo: true,
              }),
            );
          }}
        />
        </div>
      </div>

      <Card tone="todo" style={{ padding: "8px 12px" }}>
        <SL>待辦事項</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
          {active.map((t) => (
            <TodoCard
              key={t.id as number}
              todo={t}
              viewDate={viewDate}
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
                  viewDate={viewDate}
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
              if (!o) setDraft(createTodoFormDraft(viewDate));
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
        <Card tone="todo" style={{ padding: 10 }}>
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
