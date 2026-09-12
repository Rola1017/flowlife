"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { HOUR_OPTS, MINUTE_OPTS } from "@/components/ui/DateTimePicker";
import { TH } from "@/lib/theme";

export type TodoDateRangeValue = {
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
};

function Switch({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: TH.text, minWidth: 0 }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
        style={{
          width: 48,
          height: 28,
          borderRadius: 14,
          border: "none",
          padding: 0,
          cursor: "pointer",
          background: checked ? TH.accent : "#3A3A45",
          position: "relative",
          flexShrink: 0,
          transition: "background 0.2s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 23 : 3,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,.35)",
            transition: "left 0.2s",
            pointerEvents: "none",
          }}
        />
      </button>
    </div>
  );
}

const dateInput: CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  background: "#15151B",
  border: `1px solid ${TH.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: TH.text,
  fontSize: 12,
  outline: "none",
  colorScheme: "dark",
};

const selectInner: CSSProperties = {
  flex: 1,
  minWidth: 0,
  boxSizing: "border-box",
  background: "#15151B",
  border: `1px solid ${TH.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: TH.text,
  fontSize: 12,
  outline: "none",
  colorScheme: "dark",
};

function TimePair({
  label,
  hour,
  minute,
  onHour,
  onMinute,
}: {
  label: string;
  hour: string;
  minute: string;
  onHour: (h: string) => void;
  onMinute: (m: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
      <span style={{ fontSize: 10, color: TH.muted }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <select aria-label={`${label} 小時`} value={hour} onChange={(e) => onHour(e.target.value)} style={selectInner}>
          {HOUR_OPTS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 16, fontWeight: 800, color: TH.muted, flexShrink: 0 }}>:</span>
        <select aria-label={`${label} 分鐘`} value={minute} onChange={(e) => onMinute(e.target.value)} style={selectInner}>
          {MINUTE_OPTS.map((mm) => (
            <option key={mm} value={mm}>
              {mm}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function splitHm(t: string | undefined, fallback: string): { hour: string; minute: string } {
  const m = (t ?? fallback).trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) {
    const fb = fallback.match(/^(\d{1,2}):(\d{1,2})$/);
    return { hour: fb?.[1].padStart(2, "0") ?? "09", minute: fb?.[2].padStart(2, "0") ?? "00" };
  }
  return { hour: m[1].padStart(2, "0"), minute: m[2].padStart(2, "0") };
}

export function TodoDateRangePicker({
  value,
  onChange,
  defaultStartTime = "09:00",
  defaultEndTime = "10:00",
  hint,
}: {
  value: TodoDateRangeValue;
  onChange: (next: TodoDateRangeValue) => void;
  defaultStartTime?: string;
  defaultEndTime?: string;
  hint?: ReactNode;
}) {
  const [endOpen, setEndOpen] = useState(() => Boolean(value.endDate && value.endDate > value.date));
  const [endDraft, setEndDraft] = useState(() => value.endDate ?? value.date);
  const [timeOpen, setTimeOpen] = useState(() => Boolean(value.startTime || value.endTime));

  const emit = (next: {
    date?: string;
    endOpen?: boolean;
    endDraft?: string;
    timeOpen?: boolean;
    startTime?: string;
    endTime?: string;
  }) => {
    const date = next.date ?? value.date;
    const openEnd = next.endOpen ?? endOpen;
    const draft = next.endDraft ?? endDraft;
    const openTime = next.timeOpen ?? timeOpen;
    const startTime = openTime ? (next.startTime ?? value.startTime ?? defaultStartTime) : undefined;
    const endTime = openTime ? (next.endTime ?? value.endTime ?? defaultEndTime) : undefined;
    const rawEnd = openEnd ? draft : undefined;
    onChange({
      date,
      endDate: rawEnd && rawEnd !== date ? rawEnd : undefined,
      startTime,
      endTime,
    });
  };

  const endInvalid = endOpen && endDraft < value.date;
  const sh = splitHm(value.startTime, defaultStartTime);
  const eh = splitHm(value.endTime, defaultEndTime);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <label style={{ fontSize: 10, color: TH.muted }}>日期</label>
      <input
        type="date"
        value={value.date}
        onChange={(e) => {
          const date = e.target.value;
          const nextDraft = endDraft < date ? date : endDraft;
          setEndDraft(nextDraft);
          emit({ date, endDraft: nextDraft });
        }}
        style={dateInput}
      />
      <Switch
        label="結束日期"
        checked={endOpen}
        onToggle={() => {
          const next = !endOpen;
          setEndOpen(next);
          const draft = next ? (value.endDate ?? value.date) : value.date;
          setEndDraft(draft);
          emit({ endOpen: next, endDraft: draft });
        }}
      />
      {endOpen && (
        <input
          type="date"
          min={value.date}
          value={endDraft}
          onChange={(e) => {
            const d = e.target.value;
            setEndDraft(d);
            emit({ endDraft: d, endOpen: true });
          }}
          style={{
            ...dateInput,
            border: `1px solid ${endInvalid ? TH.red : TH.border}`,
          }}
        />
      )}
      {endInvalid && (
        <div style={{ fontSize: 11, color: TH.red }}>⚠️ 結束日期不能早於開始日期</div>
      )}
      {hint}
      <Switch
        label="包含時間"
        checked={timeOpen}
        onToggle={() => {
          const next = !timeOpen;
          setTimeOpen(next);
          emit({
            timeOpen: next,
            startTime: next ? (value.startTime ?? defaultStartTime) : undefined,
            endTime: next ? (value.endTime ?? defaultEndTime) : undefined,
          });
        }}
      />
      {timeOpen && (
        <div style={{ display: "flex", gap: 8, minWidth: 0, width: "100%", boxSizing: "border-box" }}>
          <TimePair
            label="開始"
            hour={sh.hour}
            minute={sh.minute}
            onHour={(h) => emit({ timeOpen: true, startTime: `${h}:${sh.minute}` })}
            onMinute={(m) => emit({ timeOpen: true, startTime: `${sh.hour}:${m}` })}
          />
          <TimePair
            label="結束"
            hour={eh.hour}
            minute={eh.minute}
            onHour={(h) => emit({ timeOpen: true, endTime: `${h}:${eh.minute}` })}
            onMinute={(m) => emit({ timeOpen: true, endTime: `${eh.hour}:${m}` })}
          />
        </div>
      )}
    </div>
  );
}
