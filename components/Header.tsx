"use client";

import { useState } from "react";
import { TH } from "@/lib/theme";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatTodayLabel(date = new Date()) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 週${WEEKDAYS[date.getDay()]}`;
}

export function Header({
  quote,
  setQuote,
  onShowSettings,
}: {
  quote: string;
  setQuote: (q: string) => void;
  onShowSettings: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(quote);
  const todayLabel = formatTodayLabel();
  return (
    <div
      style={{
        background: TH.card,
        borderBottom: `1px solid ${TH.border}`,
        padding: "12px 16px 8px",
        position: "sticky",
        top: 0,
        zIndex: 200,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div
            style={{
              fontSize: 19,
              fontWeight: 900,
              background: `linear-gradient(135deg,${TH.accent},#FBBF24)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1,
            }}
          >
            FlowLife
          </div>
          <div style={{ fontSize: 10, color: TH.muted, marginTop: 1 }}>{todayLabel}</div>
        </div>
        <button
          type="button"
          onClick={onShowSettings}
          style={{
            background: "#1C1C24",
            borderRadius: 20,
            border: `1px solid ${TH.border}`,
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            gap: 5,
            color: TH.text,
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ⚙️ 設定
        </button>
      </div>
      <div style={{ marginTop: 6, borderTop: `1px solid ${TH.border}`, paddingTop: 6 }}>
        {editing ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{
                flex: 1,
                background: "#1C1C22",
                border: `1px solid ${TH.accent}`,
                borderRadius: 8,
                padding: "4px 10px",
                color: TH.text,
                fontSize: 11,
                outline: "none",
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setQuote(draft);
                  setEditing(false);
                }
              }}
            />
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setQuote(draft);
                setEditing(false);
              }}
              style={{
                padding: "4px 14px",
                background: TH.accent,
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 12,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              ✓
            </button>
          </div>
        ) : (
          <div
            onClick={() => {
              setEditing(true);
              setDraft(quote);
            }}
            style={{ fontSize: 11, color: "#A78BFA", fontStyle: "italic", cursor: "pointer" }}
          >
            💬 {quote} <span style={{ fontSize: 9, color: TH.muted }}>點擊編輯</span>
          </div>
        )}
      </div>
    </div>
  );
}
