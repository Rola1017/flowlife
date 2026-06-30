"use client";

import type { CSSProperties } from "react";
import { TH } from "@/lib/theme";
import { Card, SL } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { DEFAULT_WORKPLACES, type ShiftRangeDef, type WorkplaceConfig } from "@/lib/schedule";

const DAYW = ["一", "二", "三", "四", "五", "六", "日"];

const genId = () => `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

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

const shiftLabelInputStyle: CSSProperties = {
  background: "#15151B",
  border: `1px solid ${TH.border}`,
  borderRadius: 6,
  color: TH.text,
  fontSize: 12,
  fontWeight: 700,
  padding: "4px 8px",
  outline: "none",
  width: 90,
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

  const setShiftLabel = (wpId: string, shiftId: string, label: string) =>
    onChange(
      workplaces.map((w) =>
        w.id !== wpId
          ? w
          : { ...w, shifts: w.shifts.map((s) => (s.id !== shiftId ? s : { ...s, label })) },
      ),
    );
  const setShiftDays = (wpId: string, shiftId: string, dw: string) =>
    onChange(
      workplaces.map((w) =>
        w.id !== wpId
          ? w
          : {
              ...w,
              shifts: w.shifts.map((s) => {
                if (s.id !== shiftId) return s;
                const has = s.days?.includes(dw);
                const days = has ? s.days.filter((d) => d !== dw) : [...(s.days ?? []), dw];
                return { ...s, days };
              }),
            },
      ),
    );
  const addShift = (wpId: string) =>
    onChange(
      workplaces.map((w) =>
        w.id !== wpId
          ? w
          : {
              ...w,
              shifts: [
                ...w.shifts,
                {
                  id: genId(),
                  label: "新班",
                  days: [],
                  ranges: [{ days: null, start: "09:00", end: "18:00" }],
                },
              ],
            },
      ),
    );
  const removeShift = (wpId: string, shiftId: string) =>
    onChange(
      workplaces.map((w) =>
        w.id !== wpId ? w : { ...w, shifts: w.shifts.filter((s) => s.id !== shiftId) },
      ),
    );
  const addWorkplace = () =>
    onChange([
      ...workplaces,
      {
        id: genId(),
        name: "新場所",
        color: "#64748B",
        shifts: [
          { id: genId(), label: "班", days: [], ranges: [{ days: null, start: "09:00", end: "18:00" }] },
        ],
      },
    ]);
  const removeWorkplace = (wpId: string) => {
    if (workplaces.length <= 1) return;
    onChange(workplaces.filter((w) => w.id !== wpId));
  };

  const deleteBtnStyle: CSSProperties = {
    fontSize: 10,
    padding: "4px 8px",
    borderRadius: 8,
    border: "1px solid #EF444444",
    background: "#EF444422",
    color: TH.red,
    cursor: "pointer",
  };

  return (
    <Card style={{ border: `1px solid ${TH.accent}44` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SL>🏢 管理工作場所（時間）</SL>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "重設工作場所為預設（診所/彩券行）？自訂場所/班別會清除，課表與番茄不受影響。",
                )
              )
                onChange(DEFAULT_WORKPLACES);
            }}
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
            ↺ 重設為預設
          </button>
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
      </div>
      <div style={{ fontSize: 10, color: TH.muted, marginTop: 4 }}>
        💡 「🟢 可上班日」＝這個班排在哪些天；下面設「幾點到幾點」。點亮可上班日後，去課表勾選即顯示。只有要「同一個班、不同日子用不同時間」時，才按「＋不同日子不同時間」。
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
            <button
              type="button"
              onClick={() => removeWorkplace(w.id)}
              disabled={workplaces.length <= 1}
              style={{
                ...deleteBtnStyle,
                marginLeft: "auto",
                opacity: workplaces.length <= 1 ? 0.35 : 1,
                cursor: workplaces.length <= 1 ? "not-allowed" : "pointer",
              }}
            >
              刪除此場所
            </button>
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <input
                  value={s.label}
                  onChange={(e) => setShiftLabel(w.id, s.id, e.target.value)}
                  style={shiftLabelInputStyle}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: TH.text }}>班</span>
                <button
                  type="button"
                  onClick={() => removeShift(w.id, s.id)}
                  style={{ ...deleteBtnStyle, marginLeft: "auto" }}
                >
                  刪除班別
                </button>
              </div>

              <div style={{ fontSize: 11, color: TH.cyan, fontWeight: 700, margin: "4px 0 2px" }}>
                🟢 可上班日（沒亮的日子，課表無法排這個班）
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                {DAYW.map((dw) => (
                  <Chip
                    key={dw}
                    label={dw}
                    active={s.days?.includes(dw)}
                    color={TH.cyan}
                    onClick={() => setShiftDays(w.id, s.id, dw)}
                    style={{ fontSize: 10, minWidth: 26, textAlign: "center" }}
                  />
                ))}
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
                  {s.ranges.length > 1 && (
                    <>
                      <div style={{ fontSize: 10, color: TH.muted }}>
                        {r.days && r.days.length
                          ? `指定日子：${r.days.join("、")}`
                          : "其它日子（預設）"}
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
                    </>
                  )}
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

          <button
            type="button"
            onClick={() => addShift(w.id)}
            style={{
              marginTop: 8,
              fontSize: 10,
              padding: "4px 10px",
              borderRadius: 8,
              border: `1px solid ${TH.border}`,
              background: "transparent",
              color: TH.muted,
              cursor: "pointer",
            }}
          >
            ＋ 新增班別
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addWorkplace}
        style={{
          marginTop: 16,
          fontSize: 11,
          padding: "6px 12px",
          borderRadius: 8,
          border: `1px solid ${TH.accent}44`,
          background: `${TH.accent}11`,
          color: TH.accent,
          cursor: "pointer",
          width: "100%",
        }}
      >
        ＋ 新增工作場所
      </button>
    </Card>
  );
}
