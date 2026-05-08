"use client";

import { useState } from "react";
import { TH } from "@/lib/theme";

export function Header({
  quote,
  setQuote,
  focused,
  neutral,
  distracted,
}: {
  quote: string;
  setQuote: (q: string) => void;
  focused: number;
  neutral: number;
  distracted: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(quote);
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
          <div style={{ fontSize: 10, color: TH.muted, marginTop: 1 }}>2026年5月2日 週六</div>
        </div>
        <div
          style={{
            background: "#1C1C24",
            borderRadius: 20,
            padding: "4px 10px",
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11 }}>
            😤 <b style={{ color: TH.text }}>{focused}</b>
          </span>
          <span style={{ fontSize: 11 }}>
            🙂 <b style={{ color: TH.text }}>{neutral}</b>
          </span>
          <span style={{ fontSize: 11 }}>
            😴 <b style={{ color: TH.text }}>{distracted}</b>
          </span>
        </div>
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
