"use client";

import { useMemo, useState } from "react";
import { TH, readableTextOn } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { fmt } from "@/lib/utils";
import { periodRange, sessionMatches } from "@/lib/analytics";
import type { Session } from "@/lib/types";

const PERIODS = ["3天", "7天", "14天", "月", "季"] as const;

function catPath(s: Session): string {
  return [s.cat1, s.cat2, s.cat3].filter(Boolean).join(" › ");
}

export function ReviewView({
  sessions,
  cats,
  cat2,
  onPatchReflection,
}: {
  sessions: Session[];
  cats: string[];
  cat2: string;
  onPatchReflection: (id: number, text: string) => void;
}) {
  const [period, setPeriod] = useState<string>("7天");
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const { start, end } = useMemo(() => {
    const now = new Date();
    return periodRange(period, now.getFullYear(), now.getMonth() + 1);
  }, [period]);

  const pairs = useMemo(() => {
    return sessions
      .filter((s) => sessionMatches(s, cats, cat2))
      .filter((s) => s.date && s.date >= start && s.date <= end)
      .filter((s) => s.intention?.trim() || s.reflection?.trim())
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.startTime ?? "").localeCompare(a.startTime ?? "");
      });
  }, [sessions, cats, cat2, start, end]);

  const startEdit = (s: Session) => {
    if (s.id == null) return;
    setEditId(s.id);
    setDraft(s.reflection ?? "");
  };
  const cancelEdit = () => {
    setEditId(null);
    setDraft("");
  };
  const saveEdit = (id: number) => {
    onPatchReflection(id, draft);
    setEditId(null);
    setDraft("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 5 }}>
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            style={{
              flex: 1,
              padding: "6px",
              borderRadius: 10,
              border: `1px solid ${period === p ? TH.accent : TH.border}`,
              background: period === p ? TH.accent + "22" : "transparent",
              color: period === p ? TH.accent : TH.muted,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 9, color: TH.muted, paddingLeft: 2 }}>
        🎯 意圖 vs ✍️ 覆盤 — 點任一張卡可補/改覆盤
      </div>

      {pairs.length === 0 ? (
        <div style={{ fontSize: 10, color: TH.muted, textAlign: "center", padding: 24, lineHeight: 1.6 }}>
          這段期間還沒有寫過意圖或覆盤的番茄。
          <br />
          開始番茄前寫下「想弄懂的小概念」，結束後回來補覆盤吧。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pairs.map((s, i) => {
            const key = s.id ?? `${s.date}-${s.startTime ?? ""}-${i}`;
            const col = CAT.cat1Color(s.cat1) || TH.muted;
            const editable = s.id != null;
            const isEditing = editable && editId === s.id;
            const timeLabel = s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : "";
            const path = catPath(s);
            return (
              <div
                key={key}
                style={{
                  background: TH.card,
                  border: `1px solid ${TH.border}`,
                  borderLeft: `3px solid ${col}`,
                  borderRadius: 10,
                  padding: "8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 15 }}>{s.rating || "·"}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: TH.text,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.name || path || "番茄"}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: col }}>{fmt(s.mins)}</span>
                </div>

                <div style={{ fontSize: 8, color: TH.muted }}>
                  {s.date}
                  {timeLabel ? ` · ${timeLabel}` : ""}
                  {path ? ` · ${path}` : ""}
                </div>

                <div style={{ fontSize: 11, color: TH.text, lineHeight: 1.5 }}>
                  <span style={{ color: TH.muted }}>🎯 </span>
                  {s.intention?.trim() ? (
                    s.intention
                  ) : (
                    <span style={{ color: TH.muted }}>（未填意圖）</span>
                  )}
                </div>

                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      autoFocus
                      placeholder="這次學到什麼／下次怎麼調整？"
                      style={{
                        width: "100%",
                        minHeight: 56,
                        resize: "vertical",
                        background: TH.bg,
                        border: `1px solid ${TH.border}`,
                        borderRadius: 8,
                        color: TH.text,
                        fontSize: 11,
                        padding: "6px 8px",
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={{
                          fontSize: 10,
                          padding: "4px 12px",
                          borderRadius: 8,
                          border: `1px solid ${TH.border}`,
                          background: "transparent",
                          color: TH.muted,
                          cursor: "pointer",
                        }}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(s.id as number)}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "4px 12px",
                          borderRadius: 8,
                          border: "none",
                          background: TH.accent,
                          color: readableTextOn(TH.accent),
                          cursor: "pointer",
                        }}
                      >
                        儲存
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    role={editable ? "button" : undefined}
                    tabIndex={editable ? 0 : undefined}
                    onClick={editable ? () => startEdit(s) : undefined}
                    onKeyDown={
                      editable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") startEdit(s);
                          }
                        : undefined
                    }
                    style={{
                      fontSize: 11,
                      lineHeight: 1.5,
                      cursor: editable ? "pointer" : "default",
                      color: s.reflection?.trim() ? TH.text : TH.muted,
                    }}
                  >
                    {s.reflection?.trim() ? (
                      <>
                        <span style={{ color: TH.muted }}>✍️ </span>
                        {s.reflection}
                      </>
                    ) : editable ? (
                      <span style={{ color: TH.accent }}>＋ 補覆盤</span>
                    ) : (
                      <span style={{ color: TH.muted }}>✍️ （舊資料無 id，無法補覆盤）</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
