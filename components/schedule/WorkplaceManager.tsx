"use client";

import type { CSSProperties } from "react";
import { TH } from "@/lib/theme";
import { Card, SL } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import type { ShiftRangeDef, WorkplaceConfig } from "@/lib/schedule";

const DAYW = ["一", "二", "三", "四", "五", "六", "日"];

const timeInputStyle: CSSProperties = {
  background: "#15151B",
  border: `1px solid ${TH.border}`,
  borderRadius: 6,
  color: TH.text,
  fontSize: 12,
  padding: "4px 6px",
  outline: "none",
  colorScheme: "dark",
};

const nameInputStyle: CSSProperties = {
  background: "#15151B",
  border: `1px solid ${TH.border}`,
  borderRadius: 6,
  color: TH.text,
  fontSize: 13,
  fontWeight: 700,
  padding: "4px 8px",
  outline: "none",
  flex: 1,
};

export function WorkplaceManager({
  workplaces,
  onChange,
  onClose,
}: {
  workplaces: WorkplaceConfig[];
  onChange: (next: WorkplaceConfig[]) => void;
  onClose: () => void;
}) {
  const setName = (wpId: string, name: string) =>
    onChange(workplaces.map((w) => (w.id === wpId ? { ...w, name } : w)));
  const setColor = (wpId: string, color: string) =>
    onChange(workplaces.map((w) => (w.id === wpId ? { ...w, color } : w)));

  const patchRange = (
    wpId: string,
    shiftId: string,
    ri: number,
    patch: Partial<ShiftRangeDef>,
  ) =>
    onChange(
      workplaces.map((w) =>
        w.id !== wpId
          ? w
          : {
              ...w,
              shifts: w.shifts.map((s) =>
                s.id !== shiftId
                  ? s
                  : { ...s, ranges: s.ranges.map((r, i) => (i !== ri ? r : { ...r, ...patch })) },
              ),
            },
      ),
    );

  const toggleDay = (wpId: string, shiftId: string, ri: number, dw: string) => {
    onChange(
      workplaces.map((w) =>
        w.id !== wpId
          ? w
          : {
              ...w,
              shifts: w.shifts.map((s) => {
                if (s.id !== shiftId) return s;
                const target = s.ranges[ri];
                const has = (target?.days ?? []).includes(dw);
                const ranges = s.ranges.map((r, i) => {
                  if (i === ri) {
                    const cur = r.days ?? [];
                    const next = has ? cur.filter((d) => d !== dw) : [...cur, dw];
                    return { ...r, days: next.length ? next : null };
                  }
                  // 新增該日時，從其它「有指定日子」的段移除該日（互斥）
                  if (!has && r.days) {
                    const cleaned = r.days.filter((d) => d !== dw);
                    return { ...r, days: cleaned.length ? cleaned : null };
                  }
                  return r;
                });
                return { ...s, ranges };
              }),
            },
      ),
    );
  };

  const addRange = (wpId: string, shiftId: string) =>
    onChange(
      workplaces.map((w) =>
        w.id !== wpId
          ? w
          : {
              ...w,
              shifts: w.shifts.map((s) =>
                s.id !== shiftId
                  ? s
                  : {
                      ...s,
                      ranges: [
                        ...s.ranges,
                        {
                          days: null,
                          start: s.ranges[0]?.start ?? "09:00",
                          end: s.ranges[0]?.end ?? "18:00",
                        },
                      ],
                    },
              ),
            },
      ),
    );

  const removeRange = (wpId: string, shiftId: string, ri: number) =>
    onChange(
      workplaces.map((w) =>
        w.id !== wpId
          ? w
          : {
              ...w,
              shifts: w.shifts.map((s) =>
                s.id !== shiftId ? s : { ...s, ranges: s.ranges.filter((_, i) => i !== ri) },
              ),
            },
      ),
    );

  return (
    <Card style={{ border: `1px solid ${TH.accent}44` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SL>🏢 管理工作場所（時間）</SL>
        <button
          type="button"
          onClick={onClose}
          style={{
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 8,
            border: `1px solid ${TH.border}`,
            background: "transparent",
            color: TH.muted,
            cursor: "pointer",
          }}
        >
          完成
        </button>
      </div>

      {workplaces.map((w) => (
        <div key={w.id} style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              value={w.name}
              onChange={(e) => setName(w.id, e.target.value)}
              style={nameInputStyle}
            />
            <input
              type="color"
              value={w.color ?? "#888888"}
              onChange={(e) => setColor(w.id, e.target.value)}
              style={{
                width: 30,
                height: 26,
                padding: 0,
                border: `1px solid ${TH.border}`,
                borderRadius: 6,
                background: "transparent",
                cursor: "pointer",
              }}
            />
          </div>

          {w.shifts.map((s) => (
            <div
              key={s.id}
              style={{
                marginTop: 8,
                padding: 8,
                borderRadius: 8,
                border: `1px solid ${TH.border}`,
                background: "#0D0D0F",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: TH.text, marginBottom: 6 }}>
                {s.label} 班
              </div>

              {s.ranges.map((r, ri) => (
                <div
                  key={ri}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    marginBottom: 8,
                    paddingBottom: 8,
                    borderBottom:
                      ri < s.ranges.length - 1 ? `1px dashed ${TH.border}` : "none",
                  }}
                >
                  <div style={{ fontSize: 10, color: TH.muted }}>
                    {r.days && r.days.length ? `指定日子：${r.days.join("、")}` : "其它日子（預設）"}
                  </div>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {DAYW.map((dw) => (
                      <Chip
                        key={dw}
                        label={dw}
                        active={(r.days ?? []).includes(dw)}
                        color={TH.cyan}
                        onClick={() => toggleDay(w.id, s.id, ri, dw)}
                        style={{ fontSize: 9, padding: "2px 7px" }}
                      />
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="time"
                      value={r.start}
                      onChange={(e) => patchRange(w.id, s.id, ri, { start: e.target.value })}
                      style={timeInputStyle}
                    />
                    <span style={{ color: TH.muted, fontSize: 12 }}>~</span>
                    <input
                      type="time"
                      value={r.end}
                      onChange={(e) => patchRange(w.id, s.id, ri, { end: e.target.value })}
                      style={timeInputStyle}
                    />
                    {s.ranges.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRange(w.id, s.id, ri)}
                        style={{
                          marginLeft: "auto",
                          fontSize: 10,
                          padding: "4px 8px",
                          borderRadius: 8,
                          border: "1px solid #EF444444",
                          background: "#EF444422",
                          color: TH.red,
                          cursor: "pointer",
                        }}
                      >
                        刪除此段
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => addRange(w.id, s.id)}
                style={{
                  fontSize: 10,
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: `1px solid ${TH.border}`,
                  background: "transparent",
                  color: TH.muted,
                  cursor: "pointer",
                }}
              >
                ＋ 不同日子不同時間
              </button>
            </div>
          ))}
        </div>
      ))}
    </Card>
  );
}
