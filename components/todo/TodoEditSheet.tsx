"use client";

import { useEffect, useState } from "react";
import { Card, SL } from "@/components/ui/Card";
import { formDraftToTodoPatch, TodoFormFields, todoToFormDraft } from "@/components/todo/TodoFormFields";
import { TH } from "@/lib/theme";
import type { Todo } from "@/lib/types";

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

  useEffect(() => {
    setDraft(todoToFormDraft(todo));
  }, [todo]);

  const id = todo.id;
  const canDelete = Boolean(onDelete) && (todo.phase === "pending" || todo.phase === "done");

  const submit = () => {
    const result = formDraftToTodoPatch(draft);
    if (!result.ok) {
      setDraft((v) => ({ ...v, error: result.error }));
      return;
    }
    onSave(id, result.patch);
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
        <Card style={{ padding: 12 }}>
          <SL>修改待辦</SL>
          <div style={{ marginTop: 10 }}>
            <TodoFormFields key={todo.id} draft={draft} setDraft={setDraft} />
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
                  disabled={!draft.text.trim()}
                  style={{
                    flex: 1,
                    minWidth: 0,
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
          </div>
        </Card>
      </div>
    </div>
  );
}
