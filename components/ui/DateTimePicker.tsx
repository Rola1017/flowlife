"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { CFG } from "@/lib/config";
import { TH } from "@/lib/theme";

const HOUR_OPTS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTE_OPTS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export function parseDateTime(v: string | null): { date: string; hour: string; minute: string } | null {
  if (!v || typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  return {
    date: m[1],
    hour: m[2].padStart(2, "0"),
    minute: m[3].padStart(2, "0"),
  };
}

export function formatDateTimeDisplay(v: string): string {
  const p = parseDateTime(v);
  if (!p) return "";
  const slash = p.date.replace(/-/g, "/");
  return `${slash}  ${p.hour}:${p.minute}`;
}

export function buildDateTime(date: string, hour: string, minute: string): string {
  return `${date} ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function splitTodoDateTime(startDateTime: string | null, endDateTime: string | null): {
  date: string;
  startTime: string;
  endTime: string;
} {
  const sp = parseDateTime(startDateTime);
  const ep = parseDateTime(endDateTime);
  const date = sp?.date ?? ep?.date ?? CFG.TODAY_STR;
  const startTime = sp ? `${sp.hour}:${sp.minute}` : "";
  const endTime = ep ? `${ep.hour}:${ep.minute}` : "";
  return { date, startTime, endTime };
}

type DateTimePickerProps = {
  value: string | null;
  onChange: (val: string | null) => void;
  label: string;
  enabled: boolean;
  onToggle: () => void;
};

export function DateTimePicker({ value, onChange, label, enabled, onToggle }: DateTimePickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [innerFocus, setInnerFocus] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setExpanded(false);
      setInnerFocus(false);
    }
  }, [enabled]);

  const p = parseDateTime(value);
  const date = p?.date ?? CFG.TODAY_STR;
  const hour = p?.hour ?? "09";
  const minute = p?.minute ?? "00";

  const setPart = (next: { date?: string; hour?: string; minute?: string }) => {
    const d = next.date ?? date;
    const h = next.hour ?? hour;
    const mm = next.minute ?? minute;
    onChange(buildDateTime(d, h, mm));
  };

  const selectInner: CSSProperties = {
    flex: 1,
    minWidth: 0,
    background: "#15151B",
    border: `1px solid ${TH.border}`,
    borderRadius: 8,
    padding: "8px 10px",
    color: TH.text,
    fontSize: 12,
    outline: "none",
    colorScheme: "dark",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: TH.text }}>{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
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
            background: enabled ? TH.accent : "#3A3A45",
            position: "relative",
            flexShrink: 0,
            transition: "background 0.2s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: enabled ? 23 : 3,
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

      {enabled && value && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            style={{
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
              background: "#15151B",
              border: `1px solid ${expanded || innerFocus ? TH.accent : TH.border}`,
              borderRadius: 12,
              padding: "10px 12px",
              color: TH.text,
              fontSize: 13,
              fontWeight: 600,
              colorScheme: "dark",
              transition: "border-color 0.15s",
            }}
          >
            {formatDateTimeDisplay(value)}
          </button>
          <div
            style={{
              maxHeight: expanded ? 220 : 0,
              overflow: "hidden",
              transition: "max-height 0.2s ease",
            }}
            onFocusCapture={() => setInnerFocus(true)}
            onBlurCapture={() => setInnerFocus(false)}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
              <input
                type="date"
                value={date}
                onChange={(e) => setPart({ date: e.target.value })}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#15151B",
                  border: `1px solid ${TH.border}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: TH.text,
                  fontSize: 12,
                  outline: "none",
                  colorScheme: "dark",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <select
                  aria-label={`${label} 小時`}
                  value={hour}
                  onChange={(e) => setPart({ hour: e.target.value })}
                  style={selectInner}
                >
                  {HOUR_OPTS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 16, fontWeight: 800, color: TH.muted, flexShrink: 0 }}>:</span>
                <select
                  aria-label={`${label} 分鐘`}
                  value={minute}
                  onChange={(e) => setPart({ minute: e.target.value })}
                  style={selectInner}
                >
                  {MINUTE_OPTS.map((mm) => (
                    <option key={mm} value={mm}>
                      {mm}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
