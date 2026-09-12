"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { CFG, reminderLabel } from "@/lib/config";
import { TH } from "@/lib/theme";
import { CAT_COLOR } from "@/lib/categories";
import { fmtMs, fmtElapsed } from "@/lib/utils";
import { doneLabel } from "@/lib/todosCloud";
import type { Todo } from "@/lib/types";

const hit44: CSSProperties = {
  width: 26,
  height: 26,
  padding: 9,
  margin: -9,
  boxSizing: "content-box",
  flexShrink: 0,
};

function DeleteBtn({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title="刪除待辦"
      aria-label={`刪除待辦 ${text}`}
      onClick={(e) => {
        e.stopPropagation();
        if (window.confirm(`確定刪除待辦「${text}」？`)) onClick();
      }}
      style={{
        ...hit44,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 14,
        lineHeight: 1,
      }}
    >
      🗑
    </button>
  );
}

export function TodoCard({
  todo,
  viewDate,
  onStart,
  onEnd,
  onToggleDone,
  onEdit,
  onDelete,
}: {
  todo: Todo;
  /** 這張卡正在哪一天被顯示；用來區分「當天完成」vs「已於某日完成」 */
  viewDate?: string;
  onStart: (id: number) => void;
  onEnd: (id: number) => void;
  onToggleDone: (id: number) => void;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
}) {
  const { id, text, cat, startTime, endTime, mustDo, phase, startAt, startTs, deadline, date, endDate, estimateHours } = todo;
  const rangeLabel = endDate && endDate > date ? `${date}～${endDate}` : null;
  const estLabel =
    estimateHours === 0.5
      ? "30分"
      : estimateHours === 8
        ? "1天"
        : estimateHours === 4
          ? "半天"
          : estimateHours === 24
            ? "3天"
            : estimateHours
              ? `${estimateHours}小時`
              : null;
  const col = CAT_COLOR[cat] || TH.muted;
  const isStarted = phase === "started",
    isEnding = phase === "ending";
  const canEdit = Boolean(onEdit) && (phase === "pending" || phase === "done");
  const canDelete = Boolean(onDelete) && (phase === "pending" || phase === "done");
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
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone(id);
          }}
          title="點擊取消完成"
          style={{
            width: 26,
            height: 26,
            padding: 9,
            margin: -9,
            boxSizing: "content-box",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "transform .15s,opacity .15s",
          }}
          onPointerEnter={(e) => {
            e.currentTarget.style.transform = "scale(.85)";
            e.currentTarget.style.opacity = ".65";
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.opacity = "1";
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: TH.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "#fff",
              pointerEvents: "none",
              flexShrink: 0,
            }}
          >
            ✓
          </span>
        </button>
        <div
          role={canEdit ? "button" : undefined}
          tabIndex={canEdit ? 0 : undefined}
          onClick={() => canEdit && onEdit!(id)}
          onKeyDown={(e) => {
            if (!canEdit || !onEdit) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onEdit(id);
            }
          }}
          title={canEdit ? "點擊修改待辦" : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            cursor: canEdit ? "pointer" : undefined,
            borderRadius: 8,
            outline: "none",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#6B7280",
              textDecoration: "line-through",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
            {todo.startAt ? (
              <span style={{ fontSize: 9, color: "#4ADE80" }}>▶ {todo.startAt}</span>
            ) : null}
            <span style={{ fontSize: 9, color: "#60A5FA" }}>■ {todo.endAt}</span>
            <span style={{ fontSize: 9, color: TH.muted }}>{doneLabel(todo.doneDate, viewDate)}</span>
            {(todo.elapsed ?? 0) > 0 ? (
              <span style={{ fontSize: 9, color: TH.yellow, fontWeight: 700 }}>
                共 {fmtElapsed(todo.elapsed ?? 0)}
              </span>
            ) : (
              <span style={{ fontSize: 9, color: TH.muted }}>直接完成</span>
            )}
            {deadline ? (
              <span style={{ fontSize: 9, color: TH.muted }}>⏳ {deadline}</span>
            ) : null}
            {rangeLabel ? (
              <span style={{ fontSize: 9, color: TH.muted }}>📅 {rangeLabel}</span>
            ) : null}
            {estLabel ? (
              <span style={{ fontSize: 9, color: TH.muted }}>⏱ {estLabel}</span>
            ) : null}
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
        {canDelete ? <DeleteBtn text={text} onClick={() => onDelete!(id)} /> : null}
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
        <div
          role={canEdit ? "button" : undefined}
          tabIndex={canEdit ? 0 : undefined}
          onClick={() => canEdit && onEdit!(id)}
          onKeyDown={(e) => {
            if (!canEdit || !onEdit) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onEdit(id);
            }
          }}
          title={canEdit ? "點擊修改待辦" : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            cursor: canEdit ? "pointer" : undefined,
            borderRadius: 8,
            outline: "none",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: TH.text,
              marginBottom: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </div>
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
            {deadline ? (
              <span style={{ fontSize: 9, color: TH.muted }}>⏳ {deadline}</span>
            ) : null}
            {rangeLabel ? (
              <span style={{ fontSize: 9, color: TH.muted }}>📅 {rangeLabel}</span>
            ) : null}
            {estLabel ? (
              <span style={{ fontSize: 9, color: TH.muted }}>⏱ {estLabel}</span>
            ) : null}
          </div>
        </div>
        {isStarted && startTs && (
          <span style={{ fontSize: 13, fontWeight: 800, color: TH.green, flexShrink: 0 }}>{live}</span>
        )}
        {canDelete ? <DeleteBtn text={text} onClick={() => onDelete!(id)} /> : null}
      </div>
      <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
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
