"use client";

import { useState } from "react";
import { TH } from "@/lib/theme";
import {
  loadRoutine,
  saveRoutine,
  DEFAULT_ROUTINE,
  routineLabel,
  type RoutineBlock,
} from "@/lib/schedule";

export function RoutineManager({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<RoutineBlock[]>(() => loadRoutine());
  const persist = (next: RoutineBlock[]) => {
    const out = [...next]
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((r) => ({ ...r, label: routineLabel(r.emoji, r.items ?? []) }));
    setRows(out);
    saveRoutine(out);
  };
  const updRow = (i: number, patch: Partial<RoutineBlock>) =>
    persist(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updItem = (ri: number, ii: number, patch: Partial<{ name: string; detail: string }>) =>
    updRow(ri, {
      items: (rows[ri].items ?? []).map((it, idx) => (idx === ii ? { ...it, ...patch } : it)),
    });
  const addItem = (ri: number) =>
    updRow(ri, { items: [...(rows[ri].items ?? []), { name: "" }] });
  const delItem = (ri: number, ii: number) =>
    updRow(ri, { items: (rows[ri].items ?? []).filter((_, idx) => idx !== ii) });
  const addRow = () =>
    persist([
      ...rows,
      { start: "22:30", end: "23:00", emoji: "🧖", items: [{ name: "" }], label: "" },
    ]);
  const delRow = (i: number) => {
    if (window.confirm("刪除這一行作息？")) persist(rows.filter((_, idx) => idx !== i));
  };
  const reset = () => {
    if (window.confirm("重設為預設作息？自訂內容會消失。")) {
      persist(DEFAULT_ROUTINE.map((r) => ({ ...r, items: (r.items ?? []).map((it) => ({ ...it })) })));
    }
  };

  const inp = {
    background: "#15151B",
    border: `1px solid ${TH.border}`,
    borderRadius: 6,
    color: TH.text,
    fontSize: 12,
    padding: "4px 6px",
    colorScheme: "dark" as const,
  };
  return (
    <div style={{ background: TH.card, border: `1px solid ${TH.border}`, borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>🛏 管理固定作息</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              fontSize: 10,
              padding: "4px 8px",
              borderRadius: 8,
              border: `1px solid ${TH.border}`,
              background: "transparent",
              color: TH.muted,
              cursor: "pointer",
            }}
          >
            ↺ 重設
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "5px 14px",
              borderRadius: 8,
              border: "none",
              background: TH.accent,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            ✓ 完成
          </button>
        </div>
      </div>
      <div style={{ fontSize: 10, color: TH.muted, marginBottom: 8 }}>
        💡 每行可放多個小項，小項可填「細節」（之後點小項會看到）；行上顯示的字＝小項名稱串起來
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r, ri) => (
          <div key={ri} style={{ border: `1px solid ${TH.border}`, borderRadius: 10, padding: 8 }}>
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 6,
              }}
            >
              <input
                value={r.emoji ?? ""}
                onChange={(e) => updRow(ri, { emoji: e.target.value })}
                placeholder="🙂"
                style={{ ...inp, width: 46, textAlign: "center" }}
              />
              <input
                type="time"
                value={r.start}
                onChange={(e) => updRow(ri, { start: e.target.value })}
                style={inp}
              />
              <span style={{ color: TH.muted, fontSize: 11 }}>～</span>
              <input
                type="time"
                value={r.end === "24:00" ? "23:59" : r.end}
                onChange={(e) => updRow(ri, { end: e.target.value })}
                style={inp}
              />
              <button
                type="button"
                onClick={() => delRow(ri)}
                style={{
                  marginLeft: "auto",
                  fontSize: 10,
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: `1px solid ${TH.red}44`,
                  background: "#EF444422",
                  color: TH.red,
                  cursor: "pointer",
                }}
              >
                🗑 刪行
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(r.items ?? []).map((it, ii) => (
                <div key={ii} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    value={it.name}
                    onChange={(e) => updItem(ri, ii, { name: e.target.value })}
                    placeholder="小項名稱"
                    style={{ ...inp, flex: 1 }}
                  />
                  <input
                    value={it.detail ?? ""}
                    onChange={(e) => updItem(ri, ii, { detail: e.target.value })}
                    placeholder="細節（可留空）"
                    style={{ ...inp, flex: 1.4 }}
                  />
                  <button
                    type="button"
                    onClick={() => delItem(ri, ii)}
                    style={{
                      background: "none",
                      border: "none",
                      color: TH.red,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addItem(ri)}
                style={{
                  alignSelf: "flex-start",
                  fontSize: 10,
                  padding: "3px 10px",
                  borderRadius: 8,
                  border: `1px dashed ${TH.border}`,
                  background: "transparent",
                  color: TH.muted,
                  cursor: "pointer",
                }}
              >
                ＋ 小項
              </button>
            </div>
            <div style={{ fontSize: 9, color: TH.muted, marginTop: 6 }}>
              顯示：{routineLabel(r.emoji, r.items ?? [])}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        style={{
          width: "100%",
          marginTop: 10,
          padding: "8px",
          borderRadius: 8,
          border: `1px dashed ${TH.accent}66`,
          background: "transparent",
          color: TH.accent,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ＋ 新增作息行
      </button>
    </div>
  );
}
