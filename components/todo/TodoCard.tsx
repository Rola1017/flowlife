"use client";

import { useState, useEffect } from "react";
import { CFG, reminderLabel } from "@/lib/config";
import { TH } from "@/lib/theme";
import { CAT_COLOR } from "@/lib/categories";
import { fmtMs, fmtElapsed } from "@/lib/utils";

export function TodoCard({
  todo,
  onStart,
  onEnd,
  onToggleDone,
}: {
  todo: Record<string, unknown>;
  onStart: (id: number) => void;
  onEnd: (id: number) => void;
  onToggleDone: (id: number) => void;
}) {
  const { id, text, cat, startTime, endTime, mustDo, phase, startAt, startTs } = todo as {
    id: number;
    text: string;
    cat: string;
    startTime: string;
    endTime: string;
    mustDo: boolean;
    phase: string;
    startAt: string | null;
    startTs: number | null;
  };
  const col = CAT_COLOR[cat] || TH.muted;
  const isStarted = phase === "started",
    isEnding = phase === "ending";
  const [live, setLive] = useState("00:00");

  useEffect(() => {
    if (!isStarted || !startTs) return;
    const t = setInterval(() => setLive(fmtMs(Date.now() - startTs)), CFG.LIVE_TICK);
    return () => clearInterval(t);
  }, [isStarted, startTs]);

  if (phase === "done") {
    return (
      <div
        style={{
          background: "#0A0A0C",
          border: `1px solid ${TH.border}`,
          borderRadius: 14,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={() => onToggleDone(id)}
          title="點擊取消完成"
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: TH.green,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "transform .15s,opacity .15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(.85)";
            e.currentTarget.style.opacity = ".65";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.opacity = "1";
          }}
        >
          <span style={{ fontSize: 12, color: "#fff", pointerEvents: "none" }}>✓</span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textDecoration: "line-through" }}>
            {text}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
            {todo.startAt ? (
              <span style={{ fontSize: 9, color: "#4ADE80" }}>▶ {String(todo.startAt)}</span>
            ) : null}
            <span style={{ fontSize: 9, color: "#60A5FA" }}>■ {String(todo.endAt)}</span>
            {(todo.elapsed as number) > 0 ? (
              <span style={{ fontSize: 9, color: TH.yellow, fontWeight: 700 }}>
                共 {fmtElapsed(todo.elapsed as number)}
              </span>
            ) : (
              <span style={{ fontSize: 9, color: TH.muted }}>直接完成</span>
            )}
          </div>
        </div>
        <span
          style={{
            fontSize: 9,
            color: col,
            background: col + "22",
            padding: "2px 7px",
            borderRadius: 6,
            flexShrink: 0,
          }}
        >
          {cat}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: TH.card,
        border: `1px solid ${isEnding ? TH.red + "55" : isStarted ? TH.green + "44" : TH.border}`,
        borderRadius: 14,
        padding: "12px 14px",
        transition: "border-color .25s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TH.text, marginBottom: 4 }}>{text}</div>
          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
            {startTime && (
              <span style={{ fontSize: 9, color: TH.muted }}>
                🕐 {startTime}
                {endTime && `~${endTime}`}
              </span>
            )}
            {typeof todo.reminder === "string" && todo.reminder !== "none" && (
              <span style={{ fontSize: 9, color: TH.muted }} title="提醒（尚未推播）">
                🔔 {reminderLabel(todo.reminder)}
              </span>
            )}
            <span style={{ fontSize: 9, color: col, background: col + "22", padding: "1px 6px", borderRadius: 8 }}>
              {cat}
            </span>
            {mustDo && (
              <span style={{ fontSize: 9, color: TH.red, fontWeight: 700 }}>
                必做
              </span>
            )}
          </div>
        </div>
        {isStarted && startTs && (
          <span style={{ fontSize: 13, fontWeight: 800, color: TH.green, flexShrink: 0 }}>{live}</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="flowlife-pressable"
          type="button"
          onClick={() => onStart(id)}
          style={{
            flex: 1,
            padding: "9px 0",
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
            border: `2px solid ${isStarted ? TH.green : "#4B5563"}`,
            background: isStarted ? TH.green + "1A" : "#1C1C24",
            color: isStarted ? TH.green : "#6B7280",
            transition: "all .2s, transform .12s, filter .12s",
          }}
        >
          {isStarted ? "▶ 進行中（取消）" : "▶ 開始"}
        </button>
        <button
          className="flowlife-pressable"
          type="button"
          onClick={() => onEnd(id)}
          style={{
            flex: 1,
            padding: "9px 0",
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
            border: `2px solid ${isEnding ? TH.red : TH.accent}`,
            background: isEnding ? TH.red + "1A" : TH.accent + "1A",
            color: isEnding ? TH.red : TH.accent,
            position: "relative",
            overflow: "hidden",
            transition: "border-color .2s,color .2s,transform .12s,filter .12s",
          }}
        >
          {isEnding && (
            <div
              id={`end-bar-${id}`}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                width: "100%",
                background: TH.red + "2A",
                pointerEvents: "none",
              }}
            />
          )}
          <span style={{ position: "relative", zIndex: 1 }}>{isEnding ? "■ 再點取消" : "■ 結束"}</span>
        </button>
      </div>
      {startAt && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 7,
            borderTop: `1px solid ${TH.border}`,
            fontSize: 9,
            color: TH.muted,
          }}
        >
          ▶ 開始：<span style={{ color: TH.green, fontWeight: 700 }}>{startAt}</span>
        </div>
      )}
    </div>
  );
}
