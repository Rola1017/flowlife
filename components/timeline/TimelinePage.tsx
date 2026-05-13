"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Card, SL } from "@/components/ui/Card";
import { DateTimePicker, formatDateTimeDisplay, splitTodoDateTime } from "@/components/ui/DateTimePicker";
import { TodoCard } from "@/components/todo/TodoCard";
import { VerticalTimeline } from "@/components/timeline/VerticalTimeline";
import { CFG, TODO_REMINDER_OPTIONS, type TodoReminderId } from "@/lib/config";
import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { MOCK } from "@/lib/mock";
import { DS, DT, toM } from "@/lib/utils";

function normalizeTimelineTime(time: string): string {
  const m = time.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return "09:00";
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

const DATETIME_RANGE_ERR = "結束時間不能早於開始時間";

function isDateTimeRangeInvalid(start: string | null, end: string | null): boolean {
  return Boolean(start && end && end <= start);
}

const getCurrentMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

const selectFieldStyle: CSSProperties = {
  background: "#15151B",
  border: `1px solid ${TH.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: TH.text,
  fontSize: 12,
  outline: "none",
  colorScheme: "dark",
  width: "100%",
  boxSizing: "border-box",
};

export function TimelinePage({
  todos,
  onStart,
  onEnd,
  onToggleDone,
  onAddTodo,
  onEditTodo,
}: {
  todos: Record<string, unknown>[];
  onStart: (id: number) => void;
  onEnd: (id: number) => void;
  onToggleDone: (id: number) => void;
  onAddTodo: (todo: Record<string, unknown>) => void;
  onEditTodo: (id: number) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({
    text: "",
    startDateTime: null as string | null,
    endDateTime: null as string | null,
    cat: CAT.cat1List()[0] as string,
    mustDo: true,
    reminder: "none" as TodoReminderId,
    error: "",
  });
  const [quickDraft, setQuickDraft] = useState<{
    text: string;
    startDateTime: string | null;
    endDateTime: string | null;
    cat: string;
    mustDo: boolean;
    reminder: TodoReminderId;
    error: string;
  } | null>(null);
  const [now, setNow] = useState(getCurrentMinutes);
  const nowPct = ((now - DS) / DT) * 100;

  useEffect(() => {
    const syncNow = () => setNow(getCurrentMinutes());
    syncNow();
    const timer = setInterval(syncNow, 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  const active = todos.filter(
    (t: { date?: string; phase?: string }) => t.date === CFG.TODAY_STR && t.phase !== "done",
  );
  const done = todos.filter(
    (t: { date?: string; phase?: string }) => t.date === CFG.TODAY_STR && t.phase === "done",
  );
  const pendingTL = active.filter(
    (t: { startTime?: string }) => t.startTime,
  ) as { id: number; text: string; startTime: string; endTime: string }[];
  const doneTL = done.filter(
    (t: { endAt?: string }) => t.endAt,
  ) as { id: number; text: string; startTime: string; endTime: string; endAt?: string }[];
  const { ACT } = MOCK.schedule;

  const submitTodo = () => {
    const text = draft.text.trim();
    if (!text) return;
    if (isDateTimeRangeInvalid(draft.startDateTime, draft.endDateTime)) {
      setDraft((v) => ({ ...v, error: DATETIME_RANGE_ERR }));
      return;
    }
    const { date, startTime, endTime } = splitTodoDateTime(draft.startDateTime, draft.endDateTime);
    onAddTodo({
      text,
      date,
      startTime,
      endTime,
      cat: draft.cat,
      mustDo: draft.mustDo,
      reminder: draft.reminder,
    });
    setDraft({
      text: "",
      startDateTime: null,
      endDateTime: null,
      cat: CAT.cat1List()[0] as string,
      mustDo: true,
      reminder: "none",
      error: "",
    });
    setAddOpen(false);
  };
  const submitQuickTodo = () => {
    const text = quickDraft?.text.trim();
    if (!quickDraft || !text) return;
    if (isDateTimeRangeInvalid(quickDraft.startDateTime, quickDraft.endDateTime)) {
      setQuickDraft((v) => (v ? { ...v, error: DATETIME_RANGE_ERR } : v));
      return;
    }
    const { date, startTime, endTime } = splitTodoDateTime(quickDraft.startDateTime, quickDraft.endDateTime);
    onAddTodo({
      text,
      date,
      startTime,
      endTime,
      cat: quickDraft.cat,
      mustDo: quickDraft.mustDo,
      reminder: quickDraft.reminder,
    });
    setQuickDraft(null);
  };

  const quickHeader =
    quickDraft &&
    (() => {
      const a = quickDraft.startDateTime ? formatDateTimeDisplay(quickDraft.startDateTime) : "";
      const b = quickDraft.endDateTime ? formatDateTimeDisplay(quickDraft.endDateTime) : "";
      if (a && b) return `快速新增 ${a} ～ ${b}`;
      if (a) return `快速新增 ${a}`;
      if (b) return `快速新增 ${b}`;
      return "快速新增";
    })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
          {ACT.map((item, i) => {
            const l = ((toM(item.start) - DS) / DT) * 100,
              w = ((toM(item.end) - toM(item.start)) / DT) * 100;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${l}%`,
                  width: `${w}%`,
                  height: "100%",
                  background: item.deep ? "#1F2937" : item.idle ? "#374151" : CAT.cat1Color(item.cat1 ?? "") || "#6B7280",
                }}
              />
            );
          })}
        </div>
        <VerticalTimeline
          nowPct={nowPct}
          pendingTodos={pendingTL}
          doneTodos={doneTL}
          date={CFG.TODAY_STR}
          onTimeClick={(time) => {
            const hm = normalizeTimelineTime(time);
            setQuickDraft({
              text: "",
              startDateTime: `${CFG.TODAY_STR} ${hm}`,
              endDateTime: null,
              cat: "未分類",
              mustDo: true,
              reminder: "none",
              error: "",
            });
          }}
        />
      </div>
      <Card style={{ padding: "8px 12px" }}>
        <SL>今日待辦</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
          {active.map((t) => (
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
            />
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setAddOpen((o) => {
              if (!o) setDraft((d) => ({ ...d, error: "" }));
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
            }}
          >
            <input
              value={draft.text}
              onChange={(e) => setDraft((v) => ({ ...v, text: e.target.value }))}
              placeholder="事件名稱（必填）"
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
            <DateTimePicker
              label="開始時間"
              value={draft.startDateTime}
              enabled={draft.startDateTime !== null}
              onToggle={() =>
                setDraft((v) => ({
                  ...v,
                  error: "",
                  startDateTime:
                    v.startDateTime === null ? `${CFG.TODAY_STR} 09:00` : null,
                }))
              }
              onChange={(val) => setDraft((v) => ({ ...v, startDateTime: val, error: "" }))}
            />
            <DateTimePicker
              label="結束時間"
              value={draft.endDateTime}
              enabled={draft.endDateTime !== null}
              onToggle={() =>
                setDraft((v) => ({
                  ...v,
                  error: "",
                  endDateTime: v.endDateTime === null ? `${CFG.TODAY_STR} 10:00` : null,
                }))
              }
              onChange={(val) => setDraft((v) => ({ ...v, endDateTime: val, error: "" }))}
            />
            <label style={{ fontSize: 10, color: TH.muted, marginBottom: -4 }}>提醒</label>
            <select
              value={draft.reminder}
              onChange={(e) =>
                setDraft((v) => ({ ...v, reminder: e.target.value as TodoReminderId }))
              }
              style={selectFieldStyle}
            >
              {TODO_REMINDER_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={draft.cat}
              onChange={(e) => setDraft((v) => ({ ...v, cat: e.target.value }))}
              style={selectFieldStyle}
            >
              {CAT.cat1List().map((cat) => (
                <option key={cat as string} value={cat as string}>
                  {cat as string}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setDraft((v) => ({ ...v, mustDo: !v.mustDo }))}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${draft.mustDo ? TH.red : TH.border}`,
                background: draft.mustDo ? TH.red + "16" : "transparent",
                color: draft.mustDo ? TH.red : TH.muted,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {draft.mustDo ? "🔴 必做" : "⚪ 非必做"}
            </button>
            {draft.error && (
              <div style={{ fontSize: 11, color: TH.red, textAlign: "center" }}>⚠️ {draft.error}</div>
            )}
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
            <DateTimePicker
              label="開始時間"
              value={quickDraft.startDateTime}
              enabled={quickDraft.startDateTime !== null}
              onToggle={() =>
                setQuickDraft((v) =>
                  v
                    ? {
                        ...v,
                        error: "",
                        startDateTime:
                          v.startDateTime === null ? `${CFG.TODAY_STR} 09:00` : null,
                      }
                    : v,
                )
              }
              onChange={(val) =>
                setQuickDraft((v) => (v ? { ...v, startDateTime: val, error: "" } : v))
              }
            />
            <DateTimePicker
              label="結束時間"
              value={quickDraft.endDateTime}
              enabled={quickDraft.endDateTime !== null}
              onToggle={() =>
                setQuickDraft((v) =>
                  v
                    ? {
                        ...v,
                        error: "",
                        endDateTime: v.endDateTime === null ? `${CFG.TODAY_STR} 10:00` : null,
                      }
                    : v,
                )
              }
              onChange={(val) =>
                setQuickDraft((v) => (v ? { ...v, endDateTime: val, error: "" } : v))
              }
            />
            <label style={{ fontSize: 10, color: TH.muted, marginBottom: -4 }}>提醒</label>
            <select
              value={quickDraft.reminder}
              onChange={(e) =>
                setQuickDraft((v) =>
                  v ? { ...v, reminder: e.target.value as TodoReminderId } : v,
                )
              }
              style={selectFieldStyle}
            >
              {TODO_REMINDER_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={quickDraft.cat}
              onChange={(e) => setQuickDraft((v) => (v ? { ...v, cat: e.target.value } : v))}
              style={selectFieldStyle}
            >
              {CAT.cat1List().map((cat) => (
                <option key={cat as string} value={cat as string}>
                  {cat as string}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setQuickDraft((v) => (v ? { ...v, mustDo: !v.mustDo } : v))}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${quickDraft.mustDo ? TH.red : TH.border}`,
                background: quickDraft.mustDo ? TH.red + "16" : "transparent",
                color: quickDraft.mustDo ? TH.red : TH.muted,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {quickDraft.mustDo ? "🔴 必做" : "⚪ 非必做"}
            </button>
            {quickDraft.error && (
              <div style={{ fontSize: 11, color: TH.red, textAlign: "center" }}>⚠️ {quickDraft.error}</div>
            )}
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
