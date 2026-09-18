import { createElement, Fragment, type CSSProperties, type ReactNode } from "react";
import { TH } from "@/lib/theme";
import { toM } from "@/lib/utils";
import { loadRoutine, type RoutineItem, type RoutineBlock } from "@/lib/schedule";

export const SCHED_ROW_H = 26;
export const SCHED_GAP = 2;
export const SCHED_STEP = SCHED_ROW_H + SCHED_GAP;
export const SCHED_TIME_W = 44;
export const SCHED_HSCROLL_ATTR = "noWeekSwipe";

export type SchedCell = { t: string; n: string; cat1: string; cat2: string; cat3: string; color?: string };

export type ScheduleRowDef =
  | {
      kind: "fixed";
      times: string[];
      label: string;
      span: "all" | "weekday";
      emoji?: string;
      items?: RoutineItem[];
    }
  | { kind: "class"; time: string };

const fmtHM2 = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function buildScheduleRows(routine: RoutineBlock[], winStart: number, winEnd: number): ScheduleRowDef[] {
  const rows: ScheduleRowDef[] = [];
  let t = winStart;
  while (t < winEnd) {
    const blk = routine.find((b) => toM(b.start) <= t && t < toM(b.end));
    if (blk) {
      const blkEnd = Math.min(toM(blk.end), winEnd);
      const times: string[] = [];
      while (t < blkEnd) {
        times.push(fmtHM2(t));
        t += 30;
      }
      rows.push({
        kind: "fixed",
        times,
        label: blk.label,
        span: "all",
        emoji: blk.emoji,
        items: blk.items,
      });
    } else {
      rows.push({ kind: "class", time: fmtHM2(t) });
      t += 30;
    }
  }
  return rows;
}

export function halfSlotsOf(rows: ScheduleRowDef[]): string[] {
  const slots: string[] = [];
  for (const row of rows) {
    if (row.kind === "class") slots.push(row.time);
    else slots.push(...row.times);
  }
  return slots;
}

export function renderFixedRoutineText(row: Extract<ScheduleRowDef, { kind: "fixed" }>): ReactNode {
  if (row.items && row.items.length > 0) {
    return createElement(
      Fragment,
      null,
      row.emoji ? `${row.emoji} ` : "",
      ...row.items.map((it, j) =>
        createElement(
          "span",
          {
            key: j,
            style: {
              color: it.hi ? TH.yellow : TH.muted,
              fontWeight: it.hi ? 900 : 700,
            },
          },
          j > 0 ? "、" : "",
          it.name,
        ),
      ),
    );
  }
  return row.label;
}

const MEAL_TIMES = new Set(["07:00", "12:00", "17:00"]);

export function timeColStyleFor(t: string): CSSProperties {
  return {
    fontSize: t.endsWith(":00") ? 10 : 7,
    fontWeight: t.endsWith(":00") ? 800 : 400,
    color: MEAL_TIMES.has(t) ? "#FDE68A" : TH.muted,
    textAlign: "right",
    paddingRight: 4,
    alignSelf: "center",
    height: SCHED_ROW_H,
    lineHeight: `${SCHED_ROW_H}px`,
  };
}

export const timeBackdropStyle: CSSProperties = {
  position: "sticky",
  left: 0,
  zIndex: 20,
  background: TH.bg,
  height: "100%",
};

export const fixedCellStyle: CSSProperties = {
  height: SCHED_ROW_H,
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

export const wePlaceholderStyle: CSSProperties = {
  height: SCHED_ROW_H,
  background: "#0D0D0F",
  borderRadius: 5,
  boxSizing: "border-box",
};

export function inFixedSlot(t: string, routine = loadRoutine()) {
  return routine.some((b) => toM(b.start) <= toM(t) && toM(t) < toM(b.end));
}
