"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Card, SL } from "@/components/ui/Card";
import { DateTimePicker, splitTodoDateTime } from "@/components/ui/DateTimePicker";
import { CFG, TODO_REMINDER_OPTIONS, type TodoReminderId } from "@/lib/config";
import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";

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

function padTime(t: string): string {
  const m = t.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return "00:00";
  return `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}`;
}

function normalizeReminder(r: unknown): TodoReminderId {
  const s = typeof r === "string" ? r : "none";
  return TODO_REMINDER_OPTIONS.some((o) => o.id === s) ? (s as TodoReminderId) : "none";
}

function draftFromTodo(todo: Record<string, unknown>) {
  const dateStr =
    typeof todo.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(todo.date)
      ? todo.date
      : CFG.TODAY_STR;
  const st = typeof todo.startTime === "string" && todo.startTime.trim() ? todo.startTime : "";
  const et = typeof todo.endTime === "string" && todo.endTime.trim() ? todo.endTime : "";
  return {
    text: String(todo.text ?? ""),
    startDateTime: st ? `${dateStr} ${padTime(st)}` : (null as string | null),
    endDateTime: et ? `${dateStr} ${padTime(et)}` : (null as string | null),
    cat: String(todo.cat ?? CAT.cat1List()[0]),
    mustDo: Boolean(todo.mustDo),
    reminder: normalizeReminder(todo.reminder),
  };
}

export function TodoEditSheet({
  todo,
  onClose,
  onSave,
}: {
  todo: Record<string, unknown>;
  onClose: () => void;
  onSave: (id: number, patch: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState(() => draftFromTodo(todo));

  useEffect(() => {
    setDraft(draftFromTodo(todo));
  }, [todo]);

  const id = todo.id as number;

  const submit = () => {
    const text = draft.text.trim();
    if (!text) return;
    const { date, startTime, endTime } = splitTodoDateTime(draft.startDateTime, draft.endDateTime);
    onSave(id, {
      text,
      date,
      startTime,
      endTime,
      cat: draft.cat,
      mustDo: draft.mustDo,
      reminder: draft.reminder,
    });
  };

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 12,
        paddingBottom: 24,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 430, maxHeight: "88vh", overflow: "auto" }}
      >
        <Card style={{ padding: 12 }}>
          <SL>修改待辦</SL>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            <input
              value={draft.text}
              onChange={(e) => setDraft((v) => ({ ...v, text: e.target.value }))}
              placeholder="事件名稱"
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
                  startDateTime:
                    v.startDateTime === null ? `${CFG.TODAY_STR} 09:00` : null,
                }))
              }
              onChange={(val) => setDraft((v) => ({ ...v, startDateTime: val }))}
            />
            <DateTimePicker
              label="結束時間"
              value={draft.endDateTime}
              enabled={draft.endDateTime !== null}
              onToggle={() =>
                setDraft((v) => ({
                  ...v,
                  endDateTime: v.endDateTime === null ? `${CFG.TODAY_STR} 10:00` : null,
                }))
              }
              onChange={(val) => setDraft((v) => ({ ...v, endDateTime: val }))}
            />
            <label style={{ fontSize: 10, color: TH.muted }}>提醒</label>
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
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "10px",
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
              <button
                className="flowlife-pressable"
                type="button"
                onClick={submit}
                disabled={!draft.text.trim()}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 10,
                  border: "none",
                  background: draft.text.trim() ? TH.accent : "#374151",
                  color: draft.text.trim() ? "#fff" : "#6B7280",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: draft.text.trim() ? "pointer" : "not-allowed",
                }}
              >
                儲存
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
