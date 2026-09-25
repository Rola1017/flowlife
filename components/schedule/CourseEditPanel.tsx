"use client";

import type { CSSProperties, ReactNode } from "react";
import { TH, withAlpha } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { Card, SL } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";

export type CourseDraft = { name: string; cat1: string; cat2: string; cat3: string; color: string };
export type CourseHistoryItem = { name: string; cat1: string; cat2: string; cat3: string; color?: string };

const fieldLabelStyle: CSSProperties = {
  fontSize: 11,
  color: TH.muted,
  marginBottom: 4,
};

const selectStyle: CSSProperties = {
  width: "100%",
  background: "#0A0A0C",
  border: `1px solid ${TH.border}`,
  borderRadius: 6,
  padding: "6px 10px",
  color: TH.text,
  fontSize: 11,
  outline: "none",
  boxSizing: "border-box",
  marginBottom: 7,
};

const PRESET_COLORS = [
  "#EF4444",
  "#F59E0B",
  "#FDE68A",
  "#22C55E",
  "#10B981",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#94A3B8",
];

function stopSwipe(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

export function CourseEditPanel({
  title,
  hint,
  draft,
  onChange,
  history = [],
  onShowCategoryManager,
  onSave,
  onClear,
  onCancel,
  saveLabel = "儲存",
}: {
  title: ReactNode;
  hint?: string;
  draft: CourseDraft;
  onChange: (next: CourseDraft) => void;
  history?: CourseHistoryItem[];
  onShowCategoryManager?: () => void;
  onSave: () => void;
  onClear: () => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const cat2Options = draft.cat1 ? CAT.cat2List(draft.cat1) : [];
  const cat3Options = draft.cat1 && draft.cat2 ? CAT.cat3List(draft.cat1, draft.cat2) : [];

  return (
    <Card tone="schedule">
      <div onPointerDown={stopSwipe}>
        <SL>{title}</SL>
        {hint ? <div style={{ fontSize: 10, color: TH.muted, marginBottom: 8, lineHeight: 1.4 }}>{hint}</div> : null}
        {history.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={fieldLabelStyle}>最近選過</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {history.slice(0, 5).map((h, i) => {
                const col = h.color || CAT.deepColorFull(h.cat1, h.cat2 || undefined, h.cat3 || undefined);
                const label = h.name || h.cat3 || h.cat2 || h.cat1;
                return (
                  <button
                    key={`hist-${i}`}
                    type="button"
                    onPointerDown={stopSwipe}
                    onClick={() =>
                      onChange({
                        name: h.name,
                        cat1: h.cat1,
                        cat2: h.cat2,
                        cat3: h.cat3,
                        color: h.color ?? "",
                      })
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      background: col + "22",
                      border: `1px solid ${col}55`,
                      borderRadius: 8,
                      padding: "4px 8px",
                      cursor: "pointer",
                      fontSize: 10,
                      color: col,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: col,
                        flexShrink: 0,
                      }}
                    />
                    {label}
                    <span style={{ fontSize: 8, color: TH.muted, fontWeight: 400 }}>
                      {[h.cat1, h.cat2, h.cat3].filter(Boolean).join("›")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          onPointerDown={stopSwipe}
          placeholder="活動名稱..."
          style={{
            width: "100%",
            background: "#0A0A0C",
            border: `1px solid ${TH.border}`,
            borderRadius: 6,
            padding: "6px 10px",
            color: TH.text,
            fontSize: 12,
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 7,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={fieldLabelStyle}>大分類</div>
          {onShowCategoryManager ? (
            <button
              type="button"
              onPointerDown={stopSwipe}
              onClick={onShowCategoryManager}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span style={{ fontSize: 9, color: TH.muted }}>新增/管理標籤</span>
              <span style={{ fontSize: 13 }}>⚙️</span>
            </button>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          {CAT.cat1List().map((c) => (
            <Chip
              key={c}
              label={CAT.cat1Display(c)}
              active={draft.cat1 === c}
              color={CAT.cat1Color(c)}
              onClick={() => onChange({ ...draft, cat1: c, cat2: "", cat3: "" })}
              style={{ fontSize: 9 }}
            />
          ))}
        </div>
        <div style={{ marginBottom: 7 }}>
          <div style={fieldLabelStyle}>中分類</div>
          <select
            value={draft.cat2}
            onChange={(e) => onChange({ ...draft, cat2: e.target.value, cat3: "" })}
            onPointerDown={stopSwipe}
            disabled={!draft.cat1}
            style={selectStyle}
          >
            <option value="">— 不選 —</option>
            {cat2Options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {draft.cat2 && cat3Options.length > 0 && (
          <div style={{ marginBottom: 7 }}>
            <div style={fieldLabelStyle}>小分類</div>
            <select
              value={draft.cat3}
              onChange={(e) => onChange({ ...draft, cat3: e.target.value })}
              onPointerDown={stopSwipe}
              style={selectStyle}
            >
              <option value="">— 不選 —</option>
              {cat3Options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={{ marginBottom: 8 }}>
          <div style={fieldLabelStyle}>顏色（同一分類下不同科目可各自上色）</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onPointerDown={stopSwipe}
              onClick={() => onChange({ ...draft, color: "" })}
              style={{
                fontSize: 9,
                padding: "4px 10px",
                borderRadius: 16,
                cursor: "pointer",
                border: `1px solid ${draft.color === "" ? TH.accent : TH.border}`,
                background: draft.color === "" ? TH.accent + "22" : "transparent",
                color: draft.color === "" ? TH.accent : TH.muted,
                fontWeight: 700,
              }}
            >
              跟隨分類
            </button>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onPointerDown={stopSwipe}
                onClick={() => onChange({ ...draft, color: c })}
                aria-label={c}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: c,
                  cursor: "pointer",
                  border: draft.color === c ? `2px solid ${TH.text}` : `1px solid ${TH.border}`,
                  boxShadow: draft.color === c ? `0 0 0 3px ${c}44` : "none",
                  padding: 0,
                }}
              />
            ))}
            <input
              type="color"
              value={draft.color || "#3B82F6"}
              onChange={(e) => onChange({ ...draft, color: e.target.value })}
              onPointerDown={stopSwipe}
              title="自訂顏色"
              style={{
                width: 28,
                height: 24,
                background: "transparent",
                border: `1px solid ${TH.border}`,
                borderRadius: 6,
                padding: 0,
                cursor: "pointer",
              }}
            />
          </div>
          <div style={{ fontSize: 9, color: TH.muted, marginTop: 4 }}>
            💡 不選＝跟著分類顏色走；選了顏色只影響這個科目，課表與時間軸都會套用
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onPointerDown={stopSwipe}
            onClick={onSave}
            style={{
              flex: 1,
              padding: "7px",
              minHeight: 44,
              borderRadius: 8,
              background: TH.green,
              border: "none",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {saveLabel}
          </button>
          <button
            type="button"
            onPointerDown={stopSwipe}
            onClick={onClear}
            style={{
              flex: 1,
              padding: "7px",
              minHeight: 44,
              borderRadius: 8,
              background: "#EF444422",
              border: `1px solid ${withAlpha(TH.red, 0.27)}`,
              color: TH.red,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            清除
          </button>
          <button
            type="button"
            onPointerDown={stopSwipe}
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "7px",
              minHeight: 44,
              borderRadius: 8,
              background: "transparent",
              border: `1px solid ${TH.border}`,
              color: TH.muted,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            取消
          </button>
        </div>
      </div>
    </Card>
  );
}
