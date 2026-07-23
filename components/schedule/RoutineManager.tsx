"use client";

import { useState } from "react";
import { TH } from "@/lib/theme";
import {
  loadRoutine,
  saveRoutine,
  DEFAULT_ROUTINE,
  routineLabel,
  overlappingIndices,
  type RoutineBlock,
} from "@/lib/schedule";
import { SortableList } from "@/components/ui/SortableList";

export function RoutineManager({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<RoutineBlock[]>(() => loadRoutine());
  const persist = (next: RoutineBlock[]) => {
    const out = next.map((r) => ({ ...r, label: routineLabel(r.emoji, r.items ?? []) }));
    setRows(out);
    saveRoutine(out);
  };
  const updRow = (i: number, patch: Partial<RoutineBlock>) =>
    persist(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updItem = (ri: number, ii: number, patch: Partial<{ name: string; detail: string; hi: boolean }>) =>
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

  const conflicts = overlappingIndices(rows.map((r) => ({ start: r.start, end: r.end })));
  const hasConflict = conflicts.size > 0;

  const inp = {
    background: "#15151B",
    border: `1px solid ${TH.border}`,
    borderRadius: 6,
    color: TH.text,
    fontSize: 12,
    padding: "4px 6px",
    colorScheme: "dark" as const,
    boxSizing: "border-box" as const,
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
            onClick={() => {
              if (
                hasConflict &&
                !window.confirm("仍有作息時間重疊，可能造成課表/時間軸顯示異常。確定關閉？")
              )
                return;
              onClose();
            }}
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
      <div style={{ fontSize: 10, color: TH.muted, marginBottom: 10, lineHeight: 1.5 }}>
        💡 點一下小項可『點亮』成黃色，讓它在行程表更醒目（再點一下取消）
      </div>
      {hasConflict && (
        <div
          style={{
            border: `1px solid ${TH.red}66`,
            background: "#EF444418",
            borderRadius: 8,
            padding: "6px 10px",
            marginBottom: 8,
            fontSize: 10.5,
            color: TH.red,
            lineHeight: 1.5,
          }}
        >
          ⚠️ 有作息時間重疊（紅框標示），會導致課表/時間軸顯示異常，請調整成互不重疊
        </div>
      )}
      <SortableList
        items={rows}
        getId={(_, i) => `row-${i}`}
        gap={10}
        onReorder={(from, to) => {
          const next = [...rows];
          const [m] = next.splice(from, 1);
          next.splice(to, 0, m);
          persist(next);
        }}
        renderItem={(r, ri, handle) => (
          <div
            style={{
              border: conflicts.has(ri) ? `1.5px solid ${TH.red}` : `1px solid ${TH.border}`,
              borderRadius: 10,
              padding: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 6,
              }}
            >
              <span
                {...handle}
                style={{ ...handle.style, color: TH.muted, marginRight: 4, fontSize: 12 }}
              >
                ⋮⋮
              </span>
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
              {conflicts.has(ri) && (
                <span style={{ fontSize: 9, color: TH.red, width: "100%" }}>
                  ⚠️ 與其他作息時間重疊
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <SortableList
                items={r.items ?? []}
                getId={(_, i) => `item-${ri}-${i}`}
                gap={4}
                onReorder={(from, to) => {
                  const items = [...(rows[ri].items ?? [])];
                  const [m] = items.splice(from, 1);
                  items.splice(to, 0, m);
                  updRow(ri, { items });
                }}
                renderItem={(it, ii, itemHandle) => (
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      alignItems: "center",
                      borderRadius: 6,
                      border: `1px solid ${it.hi ? TH.yellow + "66" : "transparent"}`,
                      padding: "2px 4px",
                      minWidth: 0,
                    }}
                  >
                    <span
                      {...itemHandle}
                      style={{
                        ...itemHandle.style,
                        color: TH.muted,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      ⋮
                    </span>
                    <button
                      type="button"
                      title={it.hi ? "取消點亮" : "點亮"}
                      onClick={() => updItem(ri, ii, { hi: !it.hi })}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        padding: "0 2px",
                        color: it.hi ? TH.yellow : TH.muted,
                        flexShrink: 0,
                      }}
                    >
                      {it.hi ? "⭐" : "☆"}
                    </button>
                    <input
                      value={it.name}
                      onChange={(e) => updItem(ri, ii, { name: e.target.value })}
                      placeholder="小項名稱"
                      style={{
                        ...inp,
                        flex: 1,
                        minWidth: 0,
                        color: it.hi ? TH.yellow : TH.text,
                        fontWeight: it.hi ? 900 : 400,
                      }}
                    />
                    <input
                      value={it.detail ?? ""}
                      onChange={(e) => updItem(ri, ii, { detail: e.target.value })}
                      placeholder="細節（可留空）"
                      style={{ ...inp, flex: 1.4, minWidth: 0 }}
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
                        flexShrink: 0,
                        padding: "0 2px",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              />
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
        )}
      />
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
