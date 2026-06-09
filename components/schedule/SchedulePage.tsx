"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { MOCK } from "@/lib/mock";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { Card, SL } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { BackBtn } from "@/components/ui/BackBtn";

type SchedRow = { t: string; n: string; cat1: string; cat2: string; cat3: string };
type Draft = { name: string; cat1: string; cat2: string; cat3: string };

type RawSchedRow = {
  t: string;
  n: string;
  c?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
};

type RowDef =
  | { kind: "fixed"; time: string; label: string; span: "all" | "weekday" }
  | { kind: "class"; time: string };

const ROWS: RowDef[] = [
  { kind: "fixed", time: "06:30", label: "😴 起床", span: "all" },
  { kind: "fixed", time: "07:00", label: "🍳 早餐", span: "all" },
  { kind: "class", time: "08:00" },
  { kind: "class", time: "09:00" },
  { kind: "class", time: "10:00" },
  { kind: "class", time: "11:00" },
  { kind: "fixed", time: "12:00", label: "🍱 午餐", span: "weekday" },
  { kind: "fixed", time: "13:00", label: "😴 午覺", span: "weekday" },
  { kind: "class", time: "13:30" },
  { kind: "class", time: "14:00" },
  { kind: "class", time: "15:00" },
  { kind: "class", time: "16:00" },
  { kind: "fixed", time: "17:00", label: "🍽️ 晚餐", span: "weekday" },
  { kind: "class", time: "18:00" },
  { kind: "class", time: "19:00" },
  { kind: "class", time: "20:00" },
  { kind: "class", time: "21:00" },
  { kind: "class", time: "22:00" },
  { kind: "fixed", time: "23:00", label: "😴 睡覺", span: "all" },
];

const ROW_H = 26;
const GAP = 2;
const STEP = ROW_H + GAP;

const SHIFT_TIMES: Record<string, string[]> = {
  早班: ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "13:30"],
  晚班: ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"],
};

const DAYS = ["一", "二", "三", "四", "五", "六", "日"] as const;
const COL_W = `calc((100% - 44px - ${7 * GAP}px) / 7)`;

function normalizeSchedule(raw: Record<string, RawSchedRow[]>): Record<string, SchedRow[]> {
  const out: Record<string, SchedRow[]> = {};
  for (const [day, rows] of Object.entries(raw)) {
    out[day] = rows.map((row) => ({
      t: row.t,
      n: row.n,
      cat1: row.cat1 ?? row.c ?? "學習",
      cat2: row.cat2 ?? "",
      cat3: row.cat3 ?? "",
    }));
  }
  return out;
}

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

export function SchedulePage({ onBack }: { onBack: () => void }) {
  const [sched, setSched] = useState<Record<string, SchedRow[]>>(() =>
    normalizeSchedule(
      loadJSON(LS_KEYS.weekSchedule, MOCK.weekdaySchedule as Record<string, RawSchedRow[]>),
    ),
  );
  const [wkend, setWkend] = useState<{ 六: string; 日: string }>(() =>
    loadJSON(LS_KEYS.weekendShifts, { 六: "晚班", 日: "晚班" }),
  );
  const [editing, setEditing] = useState<{ d: string; t: string } | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", cat1: "學習", cat2: "", cat3: "" });

  const isWE = (d: string) => d === "六" || d === "日";
  const partTimeColor = CAT.cat1Color("兼差");

  useEffect(() => {
    saveJSON(LS_KEYS.weekSchedule, sched);
  }, [sched]);

  useEffect(() => {
    saveJSON(LS_KEYS.weekendShifts, wkend);
  }, [wkend]);

  const rowGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "44px repeat(7, 1fr)",
    gap: GAP,
    height: ROW_H,
    marginBottom: GAP,
  };

  const timeColStyle: CSSProperties = {
    fontSize: 7,
    color: TH.muted,
    textAlign: "right",
    paddingRight: 4,
    alignSelf: "center",
    height: ROW_H,
    lineHeight: `${ROW_H}px`,
  };

  const fixedCellStyle: CSSProperties = {
    height: ROW_H,
    background: TH.card,
    borderRadius: 5,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    fontWeight: 700,
    color: TH.muted,
    border: `1px solid ${TH.border}`,
    boxSizing: "border-box",
  };

  const wePlaceholderStyle: CSSProperties = {
    height: ROW_H,
    background: "#0D0D0F",
    borderRadius: 5,
    boxSizing: "border-box",
  };

  const getCell = (d: string, t: string) => (sched[d] || []).find((e) => e.t === t);
  const setCell = (d: string, t: string, data: Omit<SchedRow, "t"> | null) =>
    setSched((s) => {
      const prev = (s[d] || []).filter((e) => e.t !== t);
      return { ...s, [d]: data ? [...prev, { t, ...data }] : prev };
    });

  const openEdit = (d: string, t: string, cell: SchedRow | undefined) => {
    setEditing({ d, t });
    setDraft(
      cell
        ? { name: cell.n, cat1: cell.cat1, cat2: cell.cat2, cat3: cell.cat3 }
        : { name: "", cat1: "學習", cat2: "", cat3: "" },
    );
  };

  const cat2Options = draft.cat1 ? CAT.cat2List(draft.cat1) : [];
  const cat3Options =
    draft.cat1 && draft.cat2 ? CAT.cat3List(draft.cat1, draft.cat2) : [];

  const renderClassCell = (d: string, t: string) => {
    if (isWE(d)) {
      return <div key={d} style={wePlaceholderStyle} />;
    }
    const cell = getCell(d, t);
    const col = cell
      ? CAT.deepColorFull(cell.cat1, cell.cat2 || undefined, cell.cat3 || undefined)
      : null;
    return (
      <div
        key={d}
        role="button"
        tabIndex={0}
        onClick={() => openEdit(d, t, cell)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") openEdit(d, t, cell);
        }}
        style={{
          height: ROW_H,
          background: col ? col + "33" : "#1C1C24",
          borderRadius: 5,
          padding: "3px 4px",
          border: `1px solid ${col ? col + "44" : TH.border}`,
          cursor: "pointer",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {cell && (
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: col ?? undefined,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: `${ROW_H - 6}px`,
            }}
          >
            {cell.n || cell.cat3 || cell.cat2 || cell.cat1}
          </div>
        )}
      </div>
    );
  };

  const leftForDay = (dayColIndex: number) =>
    `calc(44px + ${GAP}px + (${COL_W} + ${GAP}px) * ${dayColIndex})`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <BackBtn onBack={onBack} label="課表" />
      {editing && (
        <Card style={{ border: `1px solid ${TH.accent}44` }}>
          <SL>
            ✏️ 編輯 週{editing.d} {editing.t}
          </SL>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="科目名稱..."
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
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {CAT.cat1List().map((c) => (
              <Chip
                key={c}
                label={c}
                active={draft.cat1 === c}
                color={CAT.cat1Color(c)}
                onClick={() => setDraft({ ...draft, cat1: c, cat2: "", cat3: "" })}
                style={{ fontSize: 9 }}
              />
            ))}
          </div>
          <div style={{ marginBottom: 7 }}>
            <div style={fieldLabelStyle}>中分類</div>
            <select
              value={draft.cat2}
              onChange={(e) => setDraft({ ...draft, cat2: e.target.value, cat3: "" })}
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
                onChange={(e) => setDraft({ ...draft, cat3: e.target.value })}
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
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => {
                setCell(
                  editing.d,
                  editing.t,
                  draft.cat1
                    ? { n: draft.name, cat1: draft.cat1, cat2: draft.cat2, cat3: draft.cat3 }
                    : null,
                );
                setEditing(null);
              }}
              style={{
                flex: 1,
                padding: "7px",
                borderRadius: 8,
                background: TH.green,
                border: "none",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              儲存
            </button>
            <button
              type="button"
              onClick={() => {
                setCell(editing.d, editing.t, null);
                setEditing(null);
              }}
              style={{
                flex: 1,
                padding: "7px",
                borderRadius: 8,
                background: "#EF444422",
                border: "1px solid #EF444444",
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
              onClick={() => setEditing(null)}
              style={{
                flex: 1,
                padding: "7px",
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
        </Card>
      )}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 700 }}>
        <div style={{ minWidth: 360 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "44px repeat(7, 1fr)",
              gap: GAP,
              marginBottom: GAP,
              position: "sticky",
              top: 0,
              zIndex: 10,
              background: TH.bg,
              paddingBottom: 2,
            }}
          >
            <div style={{ fontSize: 9, color: TH.muted, textAlign: "center", alignSelf: "end" }}>
              時間
            </div>
            {DAYS.map((d) => (
              <div
                key={d}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  alignItems: "center",
                }}
              >
                {isWE(d) && (
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                    {(["早班", "晚班"] as const).map((m) => (
                      <Chip
                        key={m}
                        label={m}
                        active={wkend[d] === m}
                        color={TH.cyan}
                        onClick={() => setWkend({ ...wkend, [d]: m })}
                        style={{ fontSize: 8, padding: "2px 5px" }}
                      />
                    ))}
                  </div>
                )}
                <div
                  style={{
                    width: "100%",
                    fontSize: 10,
                    fontWeight: 700,
                    textAlign: "center",
                    padding: "4px 0",
                    background: isWE(d) ? TH.cyan + "11" : TH.card,
                    borderRadius: 5,
                    color: isWE(d) ? TH.cyan : TH.muted,
                  }}
                >
                  {d}
                </div>
              </div>
            ))}
          </div>

          <div style={{ position: "relative" }}>
            {ROWS.map((row) => {
              if (row.kind === "fixed") {
                if (row.span === "all") {
                  return (
                    <div key={row.time} style={rowGridStyle}>
                      <div style={timeColStyle}>{row.time}</div>
                      <div style={{ ...fixedCellStyle, gridColumn: "2 / -1" }}>{row.label}</div>
                    </div>
                  );
                }
                return (
                  <div key={row.time} style={rowGridStyle}>
                    <div style={timeColStyle}>{row.time}</div>
                    <div style={{ ...fixedCellStyle, gridColumn: "span 5" }}>{row.label}</div>
                    <div style={wePlaceholderStyle} />
                    <div style={wePlaceholderStyle} />
                  </div>
                );
              }
              return (
                <div key={row.time} style={rowGridStyle}>
                  <div style={timeColStyle}>{row.time}</div>
                  {DAYS.map((d) => renderClassCell(d, row.time))}
                </div>
              );
            })}

            {(["六", "日"] as const).map((day) => {
              const shift = wkend[day];
              const times = SHIFT_TIMES[shift] ?? [];
              const coveredIdx = ROWS.map((r, i) => (times.includes(r.time) ? i : -1)).filter(
                (i) => i >= 0,
              );
              if (coveredIdx.length === 0) return null;
              const firstIdx = coveredIdx[0];
              const count = coveredIdx.length;
              const top = firstIdx * STEP;
              const height = count * STEP - GAP;
              const dayColIndex = day === "六" ? 5 : 6;
              const rangeLabel = shift === "早班" ? "08:00~14:00" : "14:00~22:00";

              return (
                <div
                  key={`shift-${day}`}
                  style={{
                    position: "absolute",
                    top: `${top}px`,
                    height: `${height}px`,
                    left: leftForDay(dayColIndex),
                    width: COL_W,
                    background: partTimeColor + "33",
                    border: `1px solid ${partTimeColor}44`,
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 5,
                    pointerEvents: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <span
                    style={{
                      color: partTimeColor,
                      fontSize: 9,
                      fontWeight: 700,
                      textAlign: "center",
                      padding: "0 4px",
                      lineHeight: 1.3,
                    }}
                  >
                    兼差 {rangeLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
