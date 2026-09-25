"use client";

import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import { TH, normalizeHex } from "@/lib/theme";

export { normalizeHex };

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "#0A0A0C",
  border: `1px solid ${TH.border}`,
  borderRadius: 6,
  padding: "6px 8px",
  color: TH.text,
  fontSize: 12,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  outline: "none",
  boxSizing: "border-box",
};

function pickerValue(hex: string, fallback: string): string {
  return (normalizeHex(hex) ?? normalizeHex(fallback) ?? "#888888").toLowerCase();
}

export function ColorFieldTips() {
  return (
    <>
      <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4, marginTop: 8 }}>
        💡 定義：色碼是顏色的身分證，六位十六進位。
      </div>
      <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4, marginTop: 4 }}>
        💡 用法：可直接貼上別處複製的色碼。
      </div>
      <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4, marginTop: 4 }}>
        💡 範例：把待辦改成 #EC4899 會變成粉紅色。
      </div>
    </>
  );
}

export function ColorField({
  value,
  onChange,
  defaultValue,
  presets,
  showHint = false,
  fallback = "#888888",
  allowEmpty = false,
  onPointerDown,
}: {
  value: string;
  onChange: (hex: string) => void;
  defaultValue?: string;
  presets?: readonly string[];
  showHint?: boolean;
  fallback?: string;
  allowEmpty?: boolean;
  onPointerDown?: (e: { stopPropagation: () => void }) => void;
}) {
  const canonical = normalizeHex(value) ?? "";
  const [text, setText] = useState(canonical || value);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setText(normalizeHex(value) ?? value);
    setErr(false);
  }, [value]);

  const commit = (raw: string) => {
    if (allowEmpty && raw.trim() === "") {
      setErr(false);
      setText("");
      if (value !== "") onChange("");
      return;
    }
    const n = normalizeHex(raw);
    if (!n) {
      setText(canonical || value);
      setErr(true);
      return;
    }
    setErr(false);
    setText(n);
    if (n !== canonical) onChange(n);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(e.currentTarget.value);
      e.currentTarget.blur();
    }
  };

  const shown = normalizeHex(value) ?? normalizeHex(fallback) ?? "#888888";
  const def = defaultValue ? normalizeHex(defaultValue) : null;
  const canReset = def != null && canonical !== def;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }} onPointerDown={onPointerDown}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            background: shown,
            border: `1px solid ${TH.border}`,
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErr(false);
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={onKey}
          onFocus={(e) => e.currentTarget.select()}
          spellCheck={false}
          autoComplete="off"
          aria-label="色碼"
          style={inputStyle}
        />
        <input
          type="color"
          aria-label="取色器"
          value={pickerValue(value, fallback)}
          onChange={(e) => {
            const n = normalizeHex(e.target.value);
            if (!n) return;
            setErr(false);
            setText(n);
            onChange(n);
          }}
          style={{
            width: 28,
            height: 22,
            padding: 0,
            border: `1px solid ${TH.border}`,
            borderRadius: 6,
            background: "transparent",
            cursor: "pointer",
            flexShrink: 0,
          }}
        />
        {canReset ? (
          <button
            type="button"
            onClick={() => {
              if (!def) return;
              setErr(false);
              setText(def);
              onChange(def);
            }}
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: TH.muted,
              background: "transparent",
              border: `1px solid ${TH.border}`,
              borderRadius: 8,
              padding: "3px 8px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            恢復預設
          </button>
        ) : null}
      </div>
      {presets && presets.length > 0 ? (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          {presets.map((c, i) => {
            const hex = normalizeHex(c);
            if (!hex) return null;
            const on = canonical === hex;
            return (
              <button
                key={`${hex}-${i}`}
                type="button"
                aria-label={hex}
                onClick={() => {
                  setErr(false);
                  setText(hex);
                  onChange(hex);
                }}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: hex,
                  cursor: "pointer",
                  border: on ? `2px solid ${TH.text}` : `1px solid ${TH.border}`,
                  boxShadow: on ? `0 0 0 3px ${hex}44` : "none",
                  padding: 0,
                }}
              />
            );
          })}
        </div>
      ) : null}
      {err ? (
        <div style={{ fontSize: 10, color: TH.red, fontWeight: 700 }}>無效色碼，已恢復原值</div>
      ) : null}
      {showHint ? <ColorFieldTips /> : null}
    </div>
  );
}
