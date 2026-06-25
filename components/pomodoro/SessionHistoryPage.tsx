"use client";

import { useMemo, useState } from "react";
import { TH } from "@/lib/theme";
import { fmt, toM } from "@/lib/utils";
import { CFG } from "@/lib/config";
import { CAT } from "@/lib/categories";
import { BackBtn } from "@/components/ui/BackBtn";
import type { Session } from "@/lib/types";

type ManualInput = {
  date: string;
  name: string;
  cat1: string;
  startTime: string;
  endTime: string;
  rating?: string;
};

function formatDateLabel(date: string) {
  const [y, m, day] = date.split("-");
  return y && m && day ? `${y}/${m}/${day}` : date;
}

function dayStats(daySessions: Session[]) {
  const focused = daySessions.filter((s) => s.rating === "😤").length;
  const neutral = daySessions.filter((s) => s.rating === "🙂").length;
  const distracted = daySessions.filter((s) => s.rating === "😴").length;

  const min1 = daySessions.filter((s) => s.mins >= 1);
  const min1Count = min1.length;
  const min1Total = min1.reduce((sum, s) => sum + s.mins, 0);

  const min25 = daySessions.filter((s) => s.mins >= 25);
  const min25Count = min25.length;
  const min25Total = min25.reduce((sum, s) => sum + s.mins, 0);

  return { focused, neutral, distracted, min1Count, min1Total, min25Count, min25Total };
}

function SessionRow({
  s,
  onEditMins,
  onDelete,
}: {
  s: Session;
  onEditMins: (id: number, newMins: number) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftMins, setDraftMins] = useState(s.mins);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editable = s.id != null;
  const timeLabel = s.startTime && s.endTime ? `${s.startTime}~${s.endTime}` : "";

  return (
    <div
      style={{
        background: "#0A0A0C",
        borderRadius: 8,
        padding: "6px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 13 }}>{s.rating || "🍅"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: TH.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {s.name || "番茄"}
            {s.manual && (
              <span style={{ fontSize: 8, color: TH.muted, fontWeight: 600, marginLeft: 4 }}>手動</span>
            )}
          </div>
          {timeLabel && <div style={{ fontSize: 8, color: TH.muted }}>{timeLabel}</div>}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: TH.text }}>{fmt(s.mins)}</span>
        <button
          type="button"
          disabled={!editable}
          onClick={() => {
            setDraftMins(s.mins);
            setEditing((v) => !v);
          }}
          style={{
            border: `1px solid ${TH.border}`,
            borderRadius: 6,
            padding: "2px 7px",
            background: "transparent",
            color: editable ? TH.muted : TH.border,
            fontSize: 9,
            fontWeight: 700,
            cursor: editable ? "pointer" : "not-allowed",
          }}
        >
          ✏️分鐘
        </button>
        <button
          type="button"
          disabled={!editable}
          onClick={() => setConfirmDelete(true)}
          style={{
            border: `1px solid ${TH.border}`,
            borderRadius: 6,
            padding: "2px 7px",
            background: "transparent",
            color: editable ? TH.red : TH.border,
            fontSize: 9,
            cursor: editable ? "pointer" : "not-allowed",
          }}
        >
          🗑
        </button>
      </div>

      {editing && editable && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="number"
            min={1}
            value={draftMins}
            onChange={(e) => setDraftMins(Number(e.target.value))}
            style={{
              width: 70,
              background: "#15151B",
              border: `1px solid ${TH.border}`,
              borderRadius: 6,
              padding: "4px 6px",
              color: TH.text,
              fontSize: 11,
              outline: "none",
            }}
          />
          <span style={{ fontSize: 9, color: TH.muted }}>分鐘</span>
          <button
            type="button"
            onClick={() => {
              onEditMins(s.id as number, draftMins);
              setEditing(false);
            }}
            style={{
              border: "none",
              borderRadius: 6,
              padding: "4px 12px",
              background: TH.accent,
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            儲存
          </button>
        </div>
      )}

      {confirmDelete && editable && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
          <span style={{ fontSize: 10, color: TH.red, fontWeight: 700 }}>確認刪除這顆？</span>
          <button
            type="button"
            onClick={() => {
              onDelete(s.id as number);
              setConfirmDelete(false);
            }}
            style={{
              border: "none",
              borderRadius: 6,
              padding: "4px 12px",
              background: TH.red,
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            確認刪除
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            style={{
              border: `1px solid ${TH.border}`,
              borderRadius: 6,
              padding: "4px 10px",
              background: "transparent",
              color: TH.muted,
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
}

const manualInputStyle = {
  background: "#15151B",
  border: `1px solid ${TH.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: TH.text,
  fontSize: 12,
  outline: "none",
  colorScheme: "dark",
  width: "100%",
  boxSizing: "border-box",
} as const;

function ManualForm({ onAddManual }: { onAddManual: (input: ManualInput) => void }) {
  const [open, setOpen] = useState(false);
  const cat1List = CAT.cat1List();
  const [draft, setDraft] = useState<ManualInput>({
    date: CFG.TODAY_STR,
    name: "",
    cat1: (cat1List[0] as string) ?? "",
    startTime: "",
    endTime: "",
    rating: "",
  });
  const [error, setError] = useState("");

  const reset = () => {
    setDraft({
      date: CFG.TODAY_STR,
      name: "",
      cat1: (cat1List[0] as string) ?? "",
      startTime: "",
      endTime: "",
      rating: "",
    });
    setError("");
  };

  const submit = () => {
    if (!draft.name.trim()) {
      setError("請填名稱");
      return;
    }
    if (!draft.startTime || !draft.endTime) {
      setError("請填起訖時間");
      return;
    }
    if (toM(draft.endTime) <= toM(draft.startTime)) {
      setError("結束需晚於開始");
      return;
    }
    onAddManual({ ...draft, name: draft.name.trim() });
    reset();
    setOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "8px",
          borderRadius: 10,
          border: `1px dashed ${TH.accent}`,
          background: open ? TH.accent + "12" : "transparent",
          color: TH.accent,
          fontSize: 12,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        ＋ 手動補番茄
      </button>
      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 10,
            borderRadius: 12,
            border: `1px solid ${TH.border}`,
            background: "#0A0A0C",
          }}
        >
          <input
            value={draft.name}
            onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))}
            placeholder="名稱（必填）"
            style={manualInputStyle}
          />
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((v) => ({ ...v, date: e.target.value }))}
            style={manualInputStyle}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="time"
              value={draft.startTime}
              onChange={(e) => setDraft((v) => ({ ...v, startTime: e.target.value }))}
              style={manualInputStyle}
            />
            <input
              type="time"
              value={draft.endTime}
              onChange={(e) => setDraft((v) => ({ ...v, endTime: e.target.value }))}
              style={manualInputStyle}
            />
          </div>
          <select
            value={draft.cat1}
            onChange={(e) => setDraft((v) => ({ ...v, cat1: e.target.value }))}
            style={manualInputStyle}
          >
            {cat1List.map((c) => (
              <option key={c as string} value={c as string}>
                {c as string}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 6 }}>
            {(["😤", "🙂", "😴"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDraft((v) => ({ ...v, rating: v.rating === r ? "" : r }))}
                style={{
                  flex: 1,
                  padding: "6px",
                  borderRadius: 8,
                  border: `1px solid ${draft.rating === r ? TH.accent : TH.border}`,
                  background: draft.rating === r ? TH.accent + "22" : "transparent",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                {r}
              </button>
            ))}
          </div>
          {error && (
            <div style={{ fontSize: 11, color: TH.red, textAlign: "center" }}>⚠️ {error}</div>
          )}
          <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4 }}>
            💡 手動補的番茄會依時長發金幣，並自動標記在時間軸、扣掉該段未利用
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={submit}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: 10,
                border: "none",
                background: TH.accent,
                color: "#fff",
                fontSize: 12,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              新增番茄
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              style={{
                padding: "9px 12px",
                borderRadius: 10,
                border: `1px solid ${TH.border}`,
                background: "transparent",
                color: TH.muted,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SessionHistoryPage({
  sessions,
  onBack,
  onEditMins,
  onDelete,
  onAddManual,
}: {
  sessions: Session[];
  onBack: () => void;
  onEditMins: (id: number, newMins: number) => void;
  onDelete: (id: number) => void;
  onAddManual: (input: ManualInput) => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, Session[]> = {};
    for (const session of sessions) {
      if (!map[session.date]) map[session.date] = [];
      map[session.date].push(session);
    }
    return map;
  }, [sessions]);

  const sortedDates = useMemo(
    () => Object.keys(grouped).sort((a, b) => b.localeCompare(a)),
    [grouped],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <BackBtn onBack={onBack} label="番茄鐘歷史" />

      <ManualForm onAddManual={onAddManual} />

      {sortedDates.length === 0 ? (
        <div style={{ fontSize: 10, color: TH.muted, textAlign: "center", padding: 16 }}>
          尚無番茄紀錄
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sortedDates.map((date) => {
            const stats = dayStats(grouped[date]);
            return (
              <div key={date}>
                <div style={{ fontSize: 9, color: TH.muted, marginBottom: 6 }}>
                  {formatDateLabel(date)}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  {(
                    [
                      ["😤", stats.focused],
                      ["🙂", stats.neutral],
                      ["😴", stats.distracted],
                    ] as const
                  ).map(([emoji, count]) => (
                    <div
                      key={emoji}
                      style={{
                        flex: 1,
                        background: "#0A0A0C",
                        borderRadius: 8,
                        padding: "6px 4px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 16 }}>{emoji}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: TH.text }}>{count}</div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: TH.text,
                    marginBottom: 2,
                  }}
                >
                  <span>🍅 有效（滿1分）</span>
                  <span style={{ fontWeight: 700 }}>
                    {stats.min1Count} 顆 · 共 {fmt(stats.min1Total)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: TH.green,
                  }}
                >
                  <span>💪 紮實（滿25分）</span>
                  <span style={{ fontWeight: 700 }}>
                    {stats.min25Count} 顆 · 共 {fmt(stats.min25Total)}
                  </span>
                </div>
                <div style={{ fontSize: 9, color: TH.muted, margin: "6px 0 4px", lineHeight: 1.4 }}>
                  💡 改時長會同步重算基礎金幣；里程碑/寶箱獎勵不回溯
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[...grouped[date]]
                    .sort((a, b) => (b.endTime ?? "").localeCompare(a.endTime ?? ""))
                    .map((s, i) => (
                      <SessionRow
                        key={s.id ?? `${date}-${i}`}
                        s={s}
                        onEditMins={onEditMins}
                        onDelete={onDelete}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
