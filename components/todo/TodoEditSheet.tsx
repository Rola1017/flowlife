"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Card, SL } from "@/components/ui/Card";
import { formDraftToTodoPatch, todoDraftCanSubmit, TodoFormFields, todoToFormDraft } from "@/components/todo/TodoFormFields";
import { TH } from "@/lib/theme";
import type { Todo } from "@/lib/types";

const fieldStyle: CSSProperties = {
  background: "#15151B",
  border: `1px solid ${TH.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: TH.text,
  fontSize: 12,
  outline: "none",
  colorScheme: "dark",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

export function TodoEditSheet({
  todo,
  onClose,
  onSave,
  onDelete,
}: {
  todo: Todo;
  onClose: () => void;
  onSave: (id: number, patch: Partial<Todo>) => void;
  onDelete?: (id: number) => void;
}) {
  const [draft, setDraft] = useState(() => todoToFormDraft(todo));
  const [doneDate, setDoneDate] = useState(todo.doneDate ?? "");
  const [doneTime, setDoneTime] = useState(todo.doneTime ?? "");

  useEffect(() => {
    setDraft(todoToFormDraft(todo));
    setDoneDate(todo.doneDate ?? "");
    setDoneTime(todo.doneTime ?? "");
  }, [todo]);

  const id = todo.id;
  const canDelete = Boolean(onDelete) && (todo.phase === "pending" || todo.phase === "done");
  const isDone = todo.phase === "done";
  const canSave = todoDraftCanSubmit(draft);

  const submit = () => {
    const result = formDraftToTodoPatch(draft);
    if (!result.ok) {
      setDraft((v) => ({ ...v, error: result.error }));
      return;
    }
    const patch = { ...result.patch };
    if (isDone) {
      patch.doneDate = doneDate.trim() || undefined;
      patch.doneTime = doneTime.trim() ? doneTime.trim().slice(0, 5) : undefined;
    }
    onSave(id, patch);
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
        style={{ width: "100%", maxWidth: 430, maxHeight: "88vh", overflow: "auto", minWidth: 0, boxSizing: "border-box" }}
      >
        <Card tone="todo" style={{ padding: 12 }}>
          <SL>修改待辦</SL>
          <div style={{ marginTop: 10 }}>
            <TodoFormFields key={todo.id} draft={draft} setDraft={setDraft} />
            {isDone ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                <label style={{ fontSize: 10, color: TH.muted }}>✅ 完成於</label>
                <div style={{ display: "flex", gap: 8, minWidth: 0 }}>
                  <input
                    type="date"
                    value={doneDate}
                    onChange={(e) => setDoneDate(e.target.value)}
                    style={{ ...fieldStyle, flex: 1 }}
                    aria-label="完成日期"
                  />
                  <input
                    type="time"
                    value={doneTime}
                    onChange={(e) => setDoneTime(e.target.value.slice(0, 5))}
                    style={{ ...fieldStyle, flex: 1 }}
                    aria-label="完成時間"
                  />
                </div>
                <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4 }}>
                  💡 在哪一天的頁面按完成，就記在那一天。若不是今天完成的，時間可在這裡自行補上
                </div>
              </div>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`確定刪除待辦「${todo.text}」？`)) onDelete!(id);
                  }}
                  style={{
                    padding: "12px 10px",
                    minHeight: 44,
                    borderRadius: 10,
                    border: `1px solid ${TH.red}`,
                    background: "transparent",
                    color: TH.red,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  🗑 刪除這則待辦
                </button>
              ) : null}
              <div style={{ display: "flex", gap: 8, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1,
                    minWidth: 0,
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
                  disabled={!canSave}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "10px",
                    borderRadius: 10,
                    border: "none",
                    background: canSave ? TH.accent : "#374151",
                    color: canSave ? "#fff" : "#6B7280",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: canSave ? "pointer" : "not-allowed",
                  }}
                >
                  儲存
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
