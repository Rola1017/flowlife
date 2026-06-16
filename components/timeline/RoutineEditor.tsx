"use client";

import { useState } from "react";
import { TH, readableTextOn } from "@/lib/theme";
import {
  routineFor,
  saveRoutineOverride,
  clearRoutineOverride,
  type RoutineBlock,
} from "@/lib/schedule";

const inputStyle = {
  background: "#15151B",
  border: `1px solid ${TH.border}`,
  borderRadius: 6,
  padding: "6px 8px",
  color: TH.text,
  fontSize: 11,
  outline: "none",
} as const;

function timeInputValue(t: string): string {
  return t === "24:00" ? "23:59" : t;
}

function blockEndValid(start: string, end: string): boolean {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return e > s || end === "24:00";
}

export function RoutineEditor({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [blocks, setBlocks] = useState<RoutineBlock[]>(() =>
    routineFor(date).map((b) => ({ ...b })),
  );

  const updateBlock = (i: number, patch: Partial<RoutineBlock>) => {
    setBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  };

  const removeBlock = (i: number) => {
    setBlocks((prev) => prev.filter((_, j) => j !== i));
  };

  const handleRestore = () => {
    clearRoutineOverride(date);
    onSaved();
    onClose();
  };

  const handleSave = () => {
    const valid = blocks.filter((b) => blockEndValid(b.start, b.end) && b.label.trim());
    saveRoutineOverride(date, valid);
    onSaved();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 360,
          maxHeight: "85vh",
          overflow: "auto",
          background: "#0A0A0C",
          border: `1px solid ${TH.accent}`,
          borderRadius: 12,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: TH.text, textAlign: "center" }}>
          今日作息調整
        </div>
        <div style={{ fontSize: 9, color: TH.muted, textAlign: "center" }}>{date}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {blocks.map((b, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: 8,
                background: TH.card,
                border: `1px solid ${TH.border}`,
                borderRadius: 8,
              }}
            >
              <input
                value={b.label}
                onChange={(e) => updateBlock(i, { label: e.target.value })}
                placeholder="標籤（如 😴 睡眠）"
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="time"
                  value={timeInputValue(b.start)}
                  onChange={(e) => updateBlock(i, { start: e.target.value })}
                  style={{ ...inputStyle, flex: 1, minWidth: 0, colorScheme: "dark" }}
                />
                <span style={{ fontSize: 10, color: TH.muted }}>→</span>
                <input
                  type="time"
                  value={timeInputValue(b.end)}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateBlock(i, { end: v === "23:59" && b.end === "24:00" ? "24:00" : v });
                  }}
                  style={{ ...inputStyle, flex: 1, minWidth: 0, colorScheme: "dark" }}
                />
                <button
                  type="button"
                  onClick={() => removeBlock(i)}
                  style={{
                    border: `1px solid ${TH.border}`,
                    borderRadius: 6,
                    padding: "4px 8px",
                    background: "transparent",
                    color: TH.red,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  刪
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setBlocks((prev) => [...prev, { start: "12:00", end: "13:00", label: "作息" }])
          }
          style={{
            border: `1px dashed ${TH.border}`,
            borderRadius: 8,
            padding: "7px",
            background: "transparent",
            color: TH.muted,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ＋ 新增作息
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            type="button"
            onClick={handleSave}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "8px",
              background: TH.accent,
              color: readableTextOn(TH.accent),
              fontSize: 12,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            儲存
          </button>
          <button
            type="button"
            onClick={handleRestore}
            style={{
              border: `1px solid ${TH.border}`,
              borderRadius: 8,
              padding: "7px",
              background: "transparent",
              color: TH.muted,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            恢復預設
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: `1px solid ${TH.border}`,
              borderRadius: 8,
              padding: "7px",
              background: "transparent",
              color: TH.muted,
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
