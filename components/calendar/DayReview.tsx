"use client";

import { useMemo, useState } from "react";
import { CFG } from "@/lib/config";
import { TH, readableTextOn } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { fmt } from "@/lib/utils";
import { addReview, getReview, loadReviews, removeReview, upsertReview } from "@/lib/reviews";
import type { Session } from "@/lib/types";

function catPath(s: Session): string {
  return [s.cat1, s.cat2, s.cat3].filter(Boolean).join(" › ");
}

export function DayReview({ sessions }: { sessions: Session[] }) {
  const today = CFG.TODAY_STR;
  const [reviews, setReviews] = useState(() => loadReviews());
  const [summaryDraft, setSummaryDraft] = useState(() => getReview("day", today)?.text ?? "");
  const [inspirationOpen, setInspirationOpen] = useState(false);
  const [inspirationDraft, setInspirationDraft] = useState("");

  const material = useMemo(
    () =>
      sessions
        .filter((s) => s.date === today)
        .filter((s) => s.intention?.trim() || s.reflection?.trim())
        .sort((a, b) => (b.startTime ?? "").localeCompare(a.startTime ?? "")),
    [sessions, today],
  );

  const freeNotes = useMemo(
    () => reviews.filter((r) => r.scope === "free" && r.periodKey === today),
    [reviews, today],
  );

  const saveSummary = () => {
    setReviews(upsertReview("day", today, summaryDraft));
  };

  const saveInspiration = () => {
    if (!inspirationDraft.trim()) return;
    setReviews(addReview("free", today, inspirationDraft));
    setInspirationDraft("");
    setInspirationOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 9, color: TH.muted, paddingLeft: 2, lineHeight: 1.5 }}>
        💡 番茄覆盤是素材，這裡寫一句今天的總結；吃飯/通勤想到的也能用「＋靈感」記下
      </div>

      <div style={{ fontSize: 10, fontWeight: 800, color: TH.muted }}>📋 今日素材（唯讀）</div>

      {material.length === 0 ? (
        <div style={{ fontSize: 10, color: TH.muted, textAlign: "center", padding: 16, lineHeight: 1.6 }}>
          今天還沒有寫過意圖或覆盤的番茄。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {material.map((s, i) => {
            const key = s.id ?? `${s.date}-${s.startTime ?? ""}-${i}`;
            const col = CAT.cat1Color(s.cat1) || TH.muted;
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
                  {timeLabel ? `${timeLabel}` : ""}
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
                <div style={{ fontSize: 11, color: TH.text, lineHeight: 1.5 }}>
                  <span style={{ color: TH.muted }}>✍️ </span>
                  {s.reflection?.trim() ? (
                    s.reflection
                  ) : (
                    <span style={{ color: TH.muted }}>（未寫覆盤）</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {freeNotes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: TH.muted }}>💡 靈感</div>
          {freeNotes.map((r) => (
            <div
              key={r.id}
              style={{
                background: TH.card,
                border: `1px solid ${TH.border}`,
                borderRadius: 8,
                padding: "8px 10px",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <div style={{ flex: 1, fontSize: 11, color: TH.text, lineHeight: 1.5 }}>{r.text}</div>
              <button
                type="button"
                onClick={() => setReviews(removeReview(r.id))}
                style={{
                  border: `1px solid ${TH.border}`,
                  borderRadius: 6,
                  padding: "2px 8px",
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
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setInspirationOpen((o) => !o)}
        style={{
          alignSelf: "flex-start",
          border: `1px dashed ${TH.border}`,
          borderRadius: 8,
          padding: "5px 10px",
          background: "transparent",
          color: TH.accent,
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ＋ 靈感
      </button>

      {inspirationOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            value={inspirationDraft}
            onChange={(e) => setInspirationDraft(e.target.value)}
            autoFocus
            placeholder="吃飯、通勤突然想到的…"
            style={{
              width: "100%",
              minHeight: 48,
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
              onClick={() => {
                setInspirationOpen(false);
                setInspirationDraft("");
              }}
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
              onClick={saveInspiration}
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
      )}

      <div style={{ fontSize: 10, fontWeight: 800, color: TH.muted, marginTop: 4 }}>📝 今日總結</div>
      <textarea
        value={summaryDraft}
        onChange={(e) => setSummaryDraft(e.target.value)}
        onBlur={saveSummary}
        placeholder="今天整體學到什麼、明天要調整什麼？"
        style={{
          width: "100%",
          minHeight: 72,
          resize: "vertical",
          background: TH.bg,
          border: `1px solid ${TH.border}`,
          borderRadius: 8,
          color: TH.text,
          fontSize: 12,
          padding: "8px 10px",
          fontFamily: "inherit",
          boxSizing: "border-box",
          lineHeight: 1.5,
        }}
      />
      <button
        type="button"
        onClick={saveSummary}
        style={{
          alignSelf: "flex-end",
          fontSize: 10,
          fontWeight: 700,
          padding: "5px 14px",
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
  );
}
