"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, SL } from "@/components/ui/Card";
import { TodoCard } from "@/components/todo/TodoCard";
import {
  createTodoFormDraft,
  formDraftToTodoPatch,
  TodoFormFields,
  type TodoFormDraft,
} from "@/components/todo/TodoFormFields";
import { VerticalTimeline } from "@/components/timeline/VerticalTimeline";
import { RoutineEditor } from "@/components/timeline/RoutineEditor";
import { CFG } from "@/lib/config";
import { TH } from "@/lib/theme";
import { todoShowsOn } from "@/lib/todosCloud";
import { buildActualSegments } from "@/lib/timelineActual";
import { loadRoutineOverride } from "@/lib/schedule";
import { DS, DT, toM, nowHM, roundHM5, addMinHM } from "@/lib/utils";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import type { Todo } from "@/lib/types";

function defaultTodoStartTime() {
  return roundHM5(nowHM());
}

function defaultTodoEndTime() {
  return addMinHM(roundHM5(nowHM()), CFG.DEFAULT_TODO_DURATION_MIN);
}

function normalizeTimelineTime(time: string): string {
  const m = time.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return roundHM5(nowHM());
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

export function TimelinePage({
  todos,
  onStart,
  onEnd,
  onToggleDone,
  onAddTodo,
  onEditTodo,
  onDeleteTodo,
  onShowSchedule,
}: {
  todos: Todo[];
  onStart: (id: number) => void;
  onEnd: (id: number, doneDateHint?: string) => void;
  onToggleDone: (id: number) => void;
  onAddTodo: (todo: Partial<Todo>) => void;
  onEditTodo: (id: number) => void;
  onDeleteTodo: (id: number) => void;
  onShowSchedule: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(() => createTodoFormDraft(CFG.TODAY_STR));
  const [quickDraft, setQuickDraft] = useState<TodoFormDraft | null>(null);
  const [now, setNow] = useState(getCurrentMinutes);
  const nowPct = ((now - DS) / DT) * 100;

  useEffect(() => {
    const syncNow = () => setNow(getCurrentMinutes());
    syncNow();
    const timer = setInterval(syncNow, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const [showPending, setShowPending] = useState(true);
  const [showDone, setShowDone] = useState(true);
  const [todoViewLoaded, setTodoViewLoaded] = useState(false);
  const [editRoutineDate, setEditRoutineDate] = useState<string | null>(null);
  const [routineRev, setRoutineRev] = useState(0);

  useEffect(() => {
    const v = loadJSON<{ pending: boolean; done: boolean }>(LS_KEYS.timelineTodoView, {
      pending: true,
      done: true,
    });
    setShowPending(v.pending);
    setShowDone(v.done);
    setTodoViewLoaded(true);
  }, []);

  useEffect(() => {
    if (!todoViewLoaded) return;
    saveJSON(LS_KEYS.timelineTodoView, { pending: showPending, done: showDone });
  }, [showPending, showDone, todoViewLoaded]);

  const active = todos.filter((t) => todoShowsOn(t, CFG.TODAY_STR) && t.phase !== "done");
  const done = todos.filter((t) => todoShowsOn(t, CFG.TODAY_STR) && t.phase === "done");
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
    startAt?: string;
  }[];
  const { act: miniAct, idle: miniIdle } = useMemo(
    () => buildActualSegments(CFG.TODAY_STR, nowPct),
    [nowPct, routineRev],
  );
  const hasRoutineOverride = useMemo(
    () => loadRoutineOverride(CFG.TODAY_STR) != null,
    [routineRev],
  );

  const submitTodo = () => {
    const result = formDraftToTodoPatch(draft);
    if (!result.ok) {
      setDraft((v) => ({ ...v, error: result.error }));
      return;
    }
    onAddTodo(result.patch);
    setDraft(createTodoFormDraft(CFG.TODAY_STR));
    setAddOpen(false);
  };
  const submitQuickTodo = () => {
    if (!quickDraft) return;
    const result = formDraftToTodoPatch(quickDraft);
    if (!result.ok) {
      setQuickDraft((v) => (v ? { ...v, error: result.error } : v));
      return;
    }
    onAddTodo(result.patch);
    setQuickDraft(null);
  };

  const quickHeader = quickDraft ? rangeHeader(quickDraft, "快速新增") : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        type="button"
        onClick={onShowSchedule}
        style={{
          alignSelf: "flex-start",
          background: TH.card,
          border: `1px solid ${TH.border}`,
          borderRadius: 8,
          padding: "6px 12px",
          color: TH.text,
          fontSize: 12,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        📅 課表
      </button>
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
        {/* 待辦顯示開關（兼圖例）：兩顆獨立；都關＝時間軸只剩課表/班別/補登，可專心看課表 */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 6,
            marginTop: 2,
            marginBottom: 2,
          }}
        >
          {(
            [
              ["pending", showPending, setShowPending, TH.yellow, "未完成"],
              ["done", showDone, setShowDone, "#6B7280", "已完成"],
            ] as const
          ).map(([key, on, set, color, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => set((prev) => !prev)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 10px",
                borderRadius: 14,
                border: `1px solid ${on ? color + "66" : TH.border}`,
                background: on ? color + "14" : "transparent",
                color: on ? color : TH.muted,
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
                opacity: on ? 1 : 0.6,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: on ? color : "transparent",
                  border: `1px solid ${on ? color : TH.muted}`,
                  display: "inline-block",
                }}
              />
              {label}
              <span style={{ fontSize: 9 }}>{on ? "👁" : "🙈"}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 9, color: TH.muted, marginBottom: 4, lineHeight: 1.4 }}>
          💡 點右側「實際」欄空白，可直接補登做過的事（免跑番茄鐘）
          <br />
          💡 點左側灰色作息塊，可調整今天的睡眠／吃飯時間（如失眠晚起）
        </div>
        {hasRoutineOverride && (
          <div
            style={{
              fontSize: 9,
              color: TH.accent,
              fontWeight: 700,
              marginBottom: 4,
              textAlign: "right",
            }}
          >
            ✏️ 今日作息已調整
          </div>
        )}
        <VerticalTimeline
          nowPct={nowPct}
          pendingTodos={pendingTL}
          doneTodos={doneTL}
          showPending={showPending}
          showDone={showDone}
          date={CFG.TODAY_STR}
          routineRev={routineRev}
          onEditRoutine={(d) => setEditRoutineDate(d)}
          onEditTodo={onEditTodo}
          onTimeClick={(time) => {
            const hm = normalizeTimelineTime(time);
            setQuickDraft(
              createTodoFormDraft(CFG.TODAY_STR, {
                startTime: hm,
                endTime: addMinHM(hm, CFG.DEFAULT_TODO_DURATION_MIN),
                cat: "未分類",
                mustDo: true,
              }),
            );
          }}
        />
      </div>
      {editRoutineDate && (
        <RoutineEditor
          date={editRoutineDate}
          onClose={() => setEditRoutineDate(null)}
          onSaved={() => setRoutineRev((v) => v + 1)}
        />
      )}
      <Card style={{ padding: "8px 12px" }}>
        <SL>今日待辦</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
          {active.map((t) => (
            <TodoCard
              key={t.id as number}
              todo={t}
              viewDate={CFG.TODAY_STR}
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
                  viewDate={CFG.TODAY_STR}
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
              if (!o) setDraft(createTodoFormDraft(CFG.TODAY_STR));
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
              defaultStartTime={defaultTodoStartTime()}
              defaultEndTime={defaultTodoEndTime()}
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
              defaultStartTime={defaultTodoStartTime()}
              defaultEndTime={defaultTodoEndTime()}
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
