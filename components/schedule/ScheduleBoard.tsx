"use client";

import type { CSSProperties, ReactNode } from "react";
import { TH, labelOnDark } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { Chip } from "@/components/ui/Chip";
import type { DayPick, Place, WorkplaceConfig } from "@/lib/schedule";
import { placeName } from "@/lib/schedule";
import { rangeStrToSpan } from "@/lib/overlap";
import {
  SCHED_GAP,
  SCHED_ROW_H,
  SCHED_STEP,
  SCHED_TIME_W,
  type SchedCell,
  type ScheduleRowDef,
  fixedCellStyle,
  renderFixedRoutineText,
  timeBackdropStyle,
  timeColStyleFor,
  wePlaceholderStyle,
} from "./scheduleGridModel";

export type ScheduleBoardColumn = {
  key: string;
  title: string;
  subtitle?: string;
  weekend: boolean;
  marked?: boolean;
  onHeaderClick?: () => void;
};

export function ScheduleBoard({
  columns,
  rows,
  halfSlots,
  workplaces,
  dayColMin,
  getCell,
  isCoveredByShift,
  onCellClick,
  cellExtraStyle,
  picksFor,
  shiftTimesFor,
  shiftRangeFor,
  pickActive,
  pickDisabled,
  onTogglePick,
  showShift,
  placeColor,
  renderCell,
}: {
  columns: ScheduleBoardColumn[];
  rows: ScheduleRowDef[];
  halfSlots: string[];
  workplaces: WorkplaceConfig[];
  dayColMin: number;
  getCell: (colKey: string, time: string) => SchedCell | undefined;
  isCoveredByShift: (colKey: string, time: string) => boolean;
  onCellClick?: (colKey: string, time: string, cell: SchedCell | undefined) => void;
  cellExtraStyle?: (colKey: string, time: string) => CSSProperties | undefined;
  picksFor: (colKey: string) => DayPick[];
  shiftTimesFor: (colKey: string, place: Place, shift: string) => string[];
  shiftRangeFor: (colKey: string, place: Place, shift: string) => string;
  pickActive: (colKey: string, place: Place, shift: string) => boolean;
  pickDisabled: (colKey: string, place: Place, shift: string) => boolean;
  onTogglePick: (colKey: string, place: Place, shift: string) => void;
  showShift: (colKey: string, place: Place, shiftId: string) => boolean;
  placeColor: (place: Place) => string;
  renderCell?: (colKey: string, time: string) => ReactNode;
}) {
  const GRID_COLS = `${SCHED_TIME_W}px repeat(7, minmax(${dayColMin}px, 1fr))`;
  const COL_W = `calc((100% - ${SCHED_TIME_W}px - ${7 * SCHED_GAP}px) / 7)`;
  const SCHED_MIN_W = SCHED_TIME_W + 7 * dayColMin + 7 * SCHED_GAP;
  const rowGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: GRID_COLS,
    gap: SCHED_GAP,
    height: SCHED_ROW_H,
    marginBottom: SCHED_GAP,
  };
  const leftForDay = (dayColIndex: number) =>
    `calc(${SCHED_TIME_W}px + ${SCHED_GAP}px + (${COL_W} + ${SCHED_GAP}px) * ${dayColIndex})`;

  const defaultCell = (colKey: string, t: string) => {
    if (isCoveredByShift(colKey, t)) {
      return <div key={colKey} style={wePlaceholderStyle} />;
    }
    const cell = getCell(colKey, t);
    const col = cell
      ? cell.color || CAT.deepColorFull(cell.cat1, cell.cat2 || undefined, cell.cat3 || undefined)
      : null;
    const extra = cellExtraStyle?.(colKey, t);
    return (
      <div
        key={colKey}
        role={onCellClick ? "button" : undefined}
        tabIndex={onCellClick ? 0 : undefined}
        onClick={() => onCellClick?.(colKey, t, cell)}
        onKeyDown={(e) => {
          if (!onCellClick) return;
          if (e.key === "Enter" || e.key === " ") onCellClick(colKey, t, cell);
        }}
        style={{
          height: SCHED_ROW_H,
          background: col ? col + "33" : "#1C1C24",
          borderRadius: 5,
          padding: "2px 4px",
          border: `1px solid ${col ? col + "44" : TH.border}`,
          cursor: onCellClick ? "pointer" : "default",
          overflow: "hidden",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minHeight: 0,
          position: "relative",
          ...extra,
        }}
      >
        {cell && (
          <>
            <div
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: col ? labelOnDark(col) : undefined,
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                overflow: "hidden",
                lineHeight: 1.15,
              }}
            >
              {cell.n || cell.cat3 || cell.cat2 || cell.cat1}
            </div>
            {(cell.cat2 || cell.cat1) && (
              <div
                style={{
                  fontSize: 7,
                  fontWeight: 600,
                  color: TH.muted,
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  lineHeight: 1.1,
                }}
              >
                {cell.cat2 || cell.cat1}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div
      className="flowlife-hscroll"
      data-no-swipe="1"
      style={{
        overflowX: "auto",
        overflowY: "visible",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        touchAction: "pan-x pan-y",
      }}
    >
      <div style={{ minWidth: SCHED_MIN_W }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 21,
            background: TH.bg,
            paddingBottom: 2,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID_COLS,
              gap: SCHED_GAP,
              marginBottom: SCHED_GAP,
            }}
          >
            <div
              style={{
                ...timeBackdropStyle,
                zIndex: 22,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              }}
            >
              <div style={{ fontSize: 9, color: TH.muted, textAlign: "center" }}>時間</div>
            </div>
            {columns.map((c) => (
              <div
                key={c.key}
                role={c.onHeaderClick ? "button" : undefined}
                tabIndex={c.onHeaderClick ? 0 : undefined}
                onClick={c.onHeaderClick}
                onKeyDown={(e) => {
                  if (!c.onHeaderClick) return;
                  if (e.key === "Enter" || e.key === " ") c.onHeaderClick();
                }}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textAlign: "center",
                  padding: "4px 0",
                  background: c.weekend ? TH.cyan + "11" : TH.card,
                  borderRadius: 5,
                  color: c.weekend ? TH.cyan : TH.muted,
                  cursor: c.onHeaderClick ? "pointer" : "default",
                  position: "relative",
                  minWidth: 0,
                  boxSizing: "border-box",
                  border: c.marked ? `1px dashed ${TH.accent}` : "1px solid transparent",
                }}
              >
                {c.marked && (
                  <span
                    aria-label="此日已特別調整"
                    style={{
                      position: "absolute",
                      top: 3,
                      left: 3,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: TH.accent,
                    }}
                  />
                )}
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.title}
                  {c.onHeaderClick ? <span style={{ fontSize: 7, opacity: 0.5 }}> ⋯</span> : null}
                </div>
                {c.subtitle ? (
                  <div style={{ fontSize: 8, fontWeight: 600, opacity: 0.8 }}>{c.subtitle}</div>
                ) : null}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID_COLS,
              gap: SCHED_GAP,
              marginBottom: SCHED_GAP,
            }}
          >
            <div style={timeBackdropStyle} />
            {columns.map((c) => (
              <div
                key={`plan-${c.key}`}
                style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center", minWidth: 0 }}
              >
                {workplaces.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      alignItems: "center",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 7,
                        color: placeColor(w.id),
                        fontWeight: 700,
                        textAlign: "center",
                        lineHeight: 1.1,
                      }}
                    >
                      {w.name}
                    </div>
                    {w.shifts
                      .filter((s) => showShift(c.key, w.id, s.id))
                      .map((s) => {
                        const disabled = pickDisabled(c.key, w.id, s.id);
                        return (
                          <Chip
                            key={`${w.id}-${s.id}`}
                            label={s.label}
                            active={pickActive(c.key, w.id, s.id)}
                            color={placeColor(w.id)}
                            onClick={() => {
                              if (!disabled) onTogglePick(c.key, w.id, s.id);
                            }}
                            style={{
                              fontSize: 8,
                              padding: "2px 6px",
                              width: "100%",
                              textAlign: "center",
                              opacity: disabled ? 0.3 : 1,
                            }}
                          />
                        );
                      })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative" }}>
          {rows.map((row) => {
            if (row.kind === "fixed") {
              const fixedH = row.times.length * SCHED_ROW_H + (row.times.length - 1) * SCHED_GAP;
              const fixedRowStyle: CSSProperties = { ...rowGridStyle, height: fixedH };
              return (
                <div key={row.times.join("-")} style={fixedRowStyle}>
                  <div style={timeBackdropStyle}>
                    <div style={timeColStyleFor(row.times[0])}>{row.times[0]}</div>
                  </div>
                  <div style={{ ...fixedCellStyle, gridColumn: "2 / -1", height: "100%" }}>
                    {renderFixedRoutineText(row)}
                  </div>
                </div>
              );
            }
            return (
              <div key={row.time} style={rowGridStyle}>
                <div style={timeBackdropStyle}>
                  <div style={timeColStyleFor(row.time)}>{row.time}</div>
                </div>
                {columns.map((c) => (renderCell ? renderCell(c.key, row.time) : defaultCell(c.key, row.time)))}
              </div>
            );
          })}

          {columns.flatMap((col, dayColIndex) => {
            const plan = picksFor(col.key);
            return plan
              .map(({ place, shift }) => {
                const times = shiftTimesFor(col.key, place, shift);
                const coveredIdx = halfSlots.map((t, i) => (times.includes(t) ? i : -1)).filter((i) => i >= 0);
                if (coveredIdx.length === 0) return null;
                const firstIdx = coveredIdx[0];
                const count = coveredIdx.length;
                const top = firstIdx * SCHED_STEP;
                const height = count * SCHED_STEP - SCHED_GAP;
                const range = shiftRangeFor(col.key, place, shift);
                const span = rangeStrToSpan(range);
                if (!span) return null;
                const { start: rangeStart, end: rangeEnd } = span;
                const color = placeColor(place);
                return (
                  <div
                    key={`shift-${col.key}-${place}-${shift}`}
                    style={{
                      position: "absolute",
                      top: `${top}px`,
                      height: `${height}px`,
                      left: leftForDay(dayColIndex),
                      width: COL_W,
                      background: color + "33",
                      border: `1px solid ${color}44`,
                      borderRadius: 5,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1,
                      zIndex: 5,
                      pointerEvents: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <span style={{ color: labelOnDark(color), fontSize: 8, fontWeight: 700, lineHeight: 1.2 }}>
                      {`兼差:${placeName(place)}`}
                    </span>
                    <span style={{ color: labelOnDark(color), fontSize: 8, fontWeight: 700, lineHeight: 1.2 }}>
                      {rangeStart}
                    </span>
                    <span style={{ color: labelOnDark(color), fontSize: 7, lineHeight: 1 }}>～</span>
                    <span style={{ color: labelOnDark(color), fontSize: 8, fontWeight: 700, lineHeight: 1.2 }}>
                      {rangeEnd}
                    </span>
                  </div>
                );
              })
              .filter(Boolean);
          })}
        </div>
      </div>
    </div>
  );
}
