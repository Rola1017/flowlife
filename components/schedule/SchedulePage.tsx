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
  const [wkend, setWkend] = useState({ 六: "晚班", 日: "晚班" });
  const [editing, setEditing] = useState<{ d: string; t: string } | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", cat1: "學習", cat2: "", cat3: "" });
  const DAYS = ["一", "二", "三", "四", "五", "六", "日"];
  const SLOTS = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
  const isWE = (d: string) => d === "六" || d === "日";

  useEffect(() => {
    saveJSON(LS_KEYS.weekSchedule, sched);
  }, [sched]);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <BackBtn onBack={onBack} label="課表" />
      <div style={{ display: "flex", gap: 8 }}>
        {(["六", "日"] as const).map((d) => (
          <div key={d} style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: TH.muted }}>週{d}：</span>
            {(["早班", "晚班"] as const).map((m) => (
              <Chip key={m} label={m} active={wkend[d] === m} color={TH.cyan} onClick={() => setWkend({ ...wkend, [d]: m })} style={{ fontSize: 9 }} />
            ))}
          </div>
        ))}
      </div>
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
              style={{ flex: 1, padding: "7px", borderRadius: 8, background: TH.green, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              儲存
            </button>
            <button
              type="button"
              onClick={() => {
                setCell(editing.d, editing.t, null);
                setEditing(null);
              }}
              style={{ flex: 1, padding: "7px", borderRadius: 8, background: "#EF444422", border: "1px solid #EF444444", color: TH.red, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
            >
              清除
            </button>
            <button type="button" onClick={() => setEditing(null)} style={{ flex: 1, padding: "7px", borderRadius: 8, background: "transparent", border: `1px solid ${TH.border}`, color: TH.muted, fontSize: 11, cursor: "pointer" }}>
              取消
            </button>
          </div>
        </Card>
      )}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 360 }}>
          <div style={{ display: "grid", gridTemplateColumns: "44px repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
            <div style={{ fontSize: 9, color: TH.muted, textAlign: "center" }}>時間</div>
            {DAYS.map((d) => (
              <div
                key={d}
                style={{
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
            ))}
          </div>
          {SLOTS.map((t) => (
            <div key={t} style={{ display: "grid", gridTemplateColumns: "44px repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
              <div style={{ fontSize: 7, color: TH.muted, textAlign: "right", paddingRight: 4, alignSelf: "center" }}>{t}</div>
              {DAYS.map((d) => {
                if (isWE(d)) {
                  const tn = parseInt(t, 10),
                    slots = wkend[d] === "晚班" ? [14, 15, 16, 17] : [8, 9, 10, 11];
                  const inS = slots.includes(tn);
                  return (
                    <div
                      key={d}
                      style={{
                        background: inS ? "#8B5CF644" : "#0D0D0F",
                        borderRadius: 5,
                        minHeight: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {inS && slots[0] === tn && (
                        <span style={{ fontSize: 8, color: "#8B5CF6", fontWeight: 700 }}>兼差</span>
                      )}
                    </div>
                  );
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
                      background: col ? col + "33" : "#1C1C24",
                      borderRadius: 5,
                      padding: "3px 4px",
                      minHeight: 24,
                      border: `1px solid ${col ? col + "44" : TH.border}`,
                      cursor: "pointer",
                    }}
                  >
                    {cell && (
                      <div style={{ fontSize: 8, fontWeight: 700, color: col ?? undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cell.n || cell.cat3 || cell.cat2 || cell.cat1}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
