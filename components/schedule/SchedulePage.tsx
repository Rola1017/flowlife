"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { TH, labelOnDark } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import {
  type Place,
  type DayPlan,
  type DayPick,
  type DayOverride,
  type WorkplaceConfig,
  placeName,
  pickOverlaps,
  shiftTimes,
  shiftRange,
  weekdayOf,
  loadDayPlans,
  saveDayPlans,
  loadDayOverrides,
  saveDayOverrides,
  shiftRangeOn,
  shiftTimesOn,
  coursesForDate,
  loadScheduleCourses,
  loadWorkplaces,
  saveWorkplaces,
  loadRoutine,
  type RoutineBlock,
  type RoutineItem,
} from "@/lib/schedule";
import { subscribeAppState, pushAppState, APP_STATE_KEYS } from "@/lib/appStateCloud";
import { CFG } from "@/lib/config";
import { WorkplaceManager } from "./WorkplaceManager";
import { RoutineManager } from "./RoutineManager";
import { toM } from "@/lib/utils";
import { Card, SL } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { BackBtn } from "@/components/ui/BackBtn";

type SchedRow = { t: string; n: string; cat1: string; cat2: string; cat3: string; color?: string };
type Draft = { name: string; cat1: string; cat2: string; cat3: string; color: string };

type RawSchedRow = {
  t: string;
  n: string;
  c?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  color?: string;
};

type RowDef =
  | {
      kind: "fixed";
      times: string[];
      label: string;
      span: "all" | "weekday";
      emoji?: string;
      items?: RoutineItem[];
    }
  | { kind: "class"; time: string };

const CORE_START_MIN = toM("06:00");
const CORE_END_MIN = toM("23:00");
const FULL_START_MIN = 0;
const FULL_END_MIN = 24 * 60;
const fmtHM2 = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function renderFixedRoutineText(row: Extract<RowDef, { kind: "fixed" }>) {
  if (row.items && row.items.length > 0) {
    return (
      <>
        {row.emoji ? `${row.emoji} ` : ""}
        {row.items.map((it, j) => (
          <span
            key={j}
            style={{
              color: it.hi ? TH.yellow : TH.muted,
              fontWeight: it.hi ? 900 : 700,
            }}
          >
            {j > 0 ? "、" : ""}
            {it.name}
          </span>
        ))}
      </>
    );
  }
  return row.label;
}

// 課表固定列由 loadRoutine() 衍生（單一來源）；視窗起訖決定顯示範圍
function buildRows(routine: RoutineBlock[], winStart: number, winEnd: number): RowDef[] {
  const rows: RowDef[] = [];
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

function halfSlotsOf(rows: RowDef[]): string[] {
  const slots: string[] = [];
  for (const row of rows) {
    if (row.kind === "class") slots.push(row.time);
    else slots.push(...row.times);
  }
  return slots;
}

const ROW_H = 26;
const GAP = 2;
const STEP = ROW_H + GAP;

const DAYS = ["一", "二", "三", "四", "五", "六", "日"] as const;

const inFixedSlot = (t: string, routine = loadRoutine()) =>
  routine.some((b) => toM(b.start) <= toM(t) && toM(t) < toM(b.end));

function normalizeSchedule(raw: Record<string, RawSchedRow[]>): Record<string, SchedRow[]> {
  const out: Record<string, SchedRow[]> = {};
  for (const [day, rows] of Object.entries(raw)) {
    out[day] = rows
      .map((row) => ({
        t: row.t,
        n: row.n,
        cat1: row.cat1 ?? row.c ?? "學習",
        cat2: row.cat2 ?? "",
        cat3: row.cat3 ?? "",
        color: row.color,
      }))
      .filter((r) => !inFixedSlot(r.t));
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

export function SchedulePage({
  onBack,
  onShowCategoryManager,
}: {
  onBack: () => void;
  onShowCategoryManager: () => void;
}) {
  const [sched, setSched] = useState<Record<string, SchedRow[]>>(() =>
    normalizeSchedule(
      loadJSON<Record<string, RawSchedRow[]>>(LS_KEYS.weekSchedule, {}),
    ),
  );
  const [dayPlans, setDayPlans] = useState<Record<string, DayPlan>>(loadDayPlans);
  const [workplaces, setWorkplaces] = useState<WorkplaceConfig[]>(loadWorkplaces);
  const [showWpMgr, setShowWpMgr] = useState(false);
  const [showRoutineMgr, setShowRoutineMgr] = useState(false);
  const [routineRev, setRoutineRev] = useState(0);
  const [expandEarly, setExpandEarly] = useState(false);
  const [expandLate, setExpandLate] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    setNote(loadJSON<string>(LS_KEYS.scheduleNote, ""));
  }, []);
  useEffect(
    () =>
      subscribeAppState(APP_STATE_KEYS.scheduleNote, () =>
        setNote(loadJSON<string>(LS_KEYS.scheduleNote, "")),
      ),
    [],
  );
  const saveNote = (v: string) => {
    setNote(v);
    saveJSON(LS_KEYS.scheduleNote, v);
    void pushAppState(APP_STATE_KEYS.scheduleNote, v);
  };
  useEffect(
    () => subscribeAppState(APP_STATE_KEYS.routine, () => setRoutineRev((n) => n + 1)),
    [],
  );
  const winStart = expandEarly ? FULL_START_MIN : CORE_START_MIN;
  const winEnd = expandLate ? FULL_END_MIN : CORE_END_MIN;
  const ROWS = useMemo(
    () => buildRows(loadRoutine(), winStart, winEnd),
    [routineRev, winStart, winEnd],
  );
  const HALF_SLOTS = useMemo(() => halfSlotsOf(ROWS), [ROWS]);
  const reconcileDayPlans = (wps: WorkplaceConfig[]) => {
    setDayPlans((prev) => {
      let changed = false;
      const next: Record<string, DayPlan> = {};
      for (const [day, plan] of Object.entries(prev)) {
        const picks: DayPick[] = [];
        for (const p of plan.picks ?? []) {
          const wp = wps.find((w) => w.id === p.place);
          if (!wp) {
            changed = true;
            continue;
          }
          if (wp.shifts.some((s) => s.id === p.shift)) {
            picks.push(p);
            continue;
          }
          const byLabel = wp.shifts.find((s) => s.label === p.shift);
          if (byLabel) {
            picks.push({ place: p.place, shift: byLabel.id });
            changed = true;
            continue;
          }
          changed = true;
        }
        next[day] = { picks };
      }
      return changed ? next : prev;
    });
  };
  const handleWpChange = (next: WorkplaceConfig[]) => {
    setWorkplaces(next);
    saveWorkplaces(next);
    reconcileDayPlans(next);
  };
  const orphanPrunedOnce = useRef(false);
  useEffect(() => {
    if (orphanPrunedOnce.current) return;
    orphanPrunedOnce.current = true;
    reconcileDayPlans(workplaces);
  }, [workplaces]);
  type EditTarget = { d: string; t: string };
  const [editTargets, setEditTargets] = useState<EditTarget[] | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", cat1: "學習", cat2: "", cat3: "", color: "" });
  type HistoryItem = { name: string; cat1: string; cat2: string; cat3: string; color?: string };
  const [history, setHistory] = useState<HistoryItem[]>(() =>
    loadJSON<HistoryItem[]>(LS_KEYS.scheduleHistory, []),
  );
  const [, setMounted] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selKey = (d: string, t: string) => `${d}__${t}`;
  const [clip, setClip] = useState<{
    from: string;
    courses: SchedRow[];
    plan: DayPlan | null;
    mode: "courses" | "full";
  } | null>(null);
  const [dayMenu, setDayMenu] = useState<string | null>(null);
  const [pasteTargets, setPasteTargets] = useState<Set<string>>(new Set());
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const [showDateOv, setShowDateOv] = useState(false);
  const [dayOverrides, setDayOverrides] = useState<Record<string, DayOverride>>(loadDayOverrides);
  const [ovDate, setOvDate] = useState<string>(CFG.TODAY_STR);
  const [ovEnd, setOvEnd] = useState<string>("");
  const [ovPicks, setOvPicks] = useState<DayPick[]>([]);
  const [ovCourses, setOvCourses] = useState<SchedRow[] | null>(null);
  const [ovSlotEdit, setOvSlotEdit] = useState<string | null>(null);
  const [ovCourseWarn, setOvCourseWarn] = useState<string | null>(null);
  const [ovConflictSlots, setOvConflictSlots] = useState<Set<string>>(new Set());
  const [ovPendingPick, setOvPendingPick] = useState<DayPick | null>(null);

  /** 依目前所有課名量測最長寬度決定欄寬（單行不換行）；SSR 或無資料時用預設 */
  const dayColMin = useMemo(() => {
    const labels: string[] = [];
    for (const rows of Object.values(sched)) {
      for (const r of rows) labels.push(r.n || r.cat3 || r.cat2 || r.cat1 || "");
    }
    for (const ov of Object.values(dayOverrides)) {
      for (const c of ov.courses ?? []) labels.push(c.n || c.cat3 || c.cat2 || c.cat1 || "");
    }
    const FALLBACK = 85;
    if (labels.length === 0) return FALLBACK;
    if (typeof document === "undefined") return FALLBACK;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return FALLBACK;
    ctx.font = "700 8px system-ui, -apple-system, 'Noto Sans TC', sans-serif";
    let max = 0;
    for (const l of labels) max = Math.max(max, ctx.measureText(l).width);
    // 左右 padding 4+4、邊框 2、保險 6
    return Math.round(Math.min(240, Math.max(60, max + 16)));
  }, [sched, dayOverrides]);

  const GRID_COLS = useMemo(() => `44px repeat(7, minmax(${dayColMin}px, 1fr))`, [dayColMin]);
  const COL_W = `calc((100% - 44px - ${7 * GAP}px) / 7)`;
  const SCHED_MIN_W = useMemo(() => 44 + 7 * dayColMin + 7 * GAP, [dayColMin]);

  const shiftLabelOf = (place: Place, shiftId: string) =>
    workplaces.find((w) => w.id === place)?.shifts.find((s) => s.id === shiftId)?.label ?? shiftId;
  const describePick = (pk: DayPick) => `${placeName(pk.place)}·${shiftLabelOf(pk.place, pk.shift)}`;

  useEffect(
    () => subscribeAppState(APP_STATE_KEYS.dayOverrides, () => setDayOverrides(loadDayOverrides())),
    [],
  );

  const rangeOverlap = (r1: string, r2: string) => {
    if (!r1 || !r2) return false;
    const m = (t: string) => {
      const [h, mm] = t.split(":").map(Number);
      return h * 60 + mm;
    };
    const [a1, b1] = r1.split("~");
    const [a2, b2] = r2.split("~");
    return m(a1) < m(b2) && m(a2) < m(b1);
  };
  const effectivePicksFor = (date: string): DayPick[] => {
    const ov = dayOverrides[date];
    const base = ov ? ov.picks : (dayPlans[weekdayOf(date)]?.picks ?? []);
    return base.map((p) => ({ ...p }));
  };
  const openDateOv = (date: string) => {
    setOvDate(date);
    setOvEnd("");
    setOvPicks(effectivePicksFor(date));
    setOvCourses(dayOverrides[date]?.courses ?? null);
    setOvSlotEdit(null);
    setOvCourseWarn(null);
    setOvConflictSlots(new Set());
    setOvPendingPick(null);
    setShowDateOv(true);
  };
  const ovWeeklyCourses = (): SchedRow[] => (sched[weekdayOf(ovDate)] ?? []).map((c) => ({ ...c }));
  const ovEffectiveCourses = (): SchedRow[] => (ovCourses ?? ovWeeklyCourses());
  const ovShiftSlotSet = (): Set<string> =>
    new Set(ovPicks.flatMap((p) => shiftTimesOn(p.place, p.shift, ovDate, true)));
  const ovCourseAt = (t: string) => ovEffectiveCourses().find((c) => c.t === t);
  const courseLabelOf = (c: SchedRow) => c.n || c.cat3 || c.cat2 || c.cat1;
  const addOvCourse = (t: string, c: { n: string; cat1: string; cat2: string; cat3: string; color?: string }) =>
    setOvCourses((prev) => [
      ...(prev ?? ovWeeklyCourses()).filter((x) => x.t !== t),
      { t, n: c.n, cat1: c.cat1, cat2: c.cat2, cat3: c.cat3, color: c.color },
    ]);
  const removeOvCourse = (t: string) =>
    setOvCourses((prev) => (prev ?? ovWeeklyCourses()).filter((x) => x.t !== t));
  const ovPickActive = (place: Place, shift: string) =>
    ovPicks.some((p) => p.place === place && p.shift === shift);
  const ovPickDisabled = (place: Place, shift: string) => {
    if (ovPickActive(place, shift)) return false;
    const r = shiftRangeOn(place, shift, ovDate, true);
    if (!r) return true;
    return ovPicks.some((p) => rangeOverlap(r, shiftRangeOn(p.place, p.shift, ovDate, true)));
  };
  const toggleOvPick = (place: Place, shift: string) => {
    const exists = ovPicks.some((p) => p.place === place && p.shift === shift);
    if (exists) {
      setOvPicks((prev) => prev.filter((p) => !(p.place === place && p.shift === shift)));
      return;
    }
    const r = shiftRangeOn(place, shift, ovDate, true);
    if (!r) return;
    if (ovPicks.some((p) => rangeOverlap(r, shiftRangeOn(p.place, p.shift, ovDate, true)))) return;
    const slots = shiftTimesOn(place, shift, ovDate, true);
    const clash = ovEffectiveCourses().filter((c) => slots.includes(c.t));
    if (clash.length) {
      setOvConflictSlots(new Set(clash.map((c) => c.t)));
      setOvPendingPick({ place, shift });
      setOvCourseWarn(
        `紅色的課與「${placeName(place)}·${shiftLabelOf(place, shift)}」衝突，移除才能新增此班。`,
      );
      return;
    }
    setOvConflictSlots(new Set());
    setOvPendingPick(null);
    setOvCourseWarn(null);
    setOvPicks((prev) => [...prev, { place, shift }]);
  };
  const datesInRange = (start: string, end: string): string[] => {
    const out: string[] = [];
    const s = new Date(start + "T12:00:00");
    const e = new Date((end || start) + "T12:00:00");
    if (e < s) return [start];
    const cur = new Date(s);
    let guard = 0;
    while (cur <= e && guard < 90) {
      out.push(
        `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`,
      );
      cur.setDate(cur.getDate() + 1);
      guard++;
    }
    return out;
  };
  const commitOverride = (picks: DayPick[], courses: SchedRow[] | null) => {
    const dates = datesInRange(ovDate, ovEnd);
    const next = { ...dayOverrides };
    for (const d of dates)
      next[d] =
        courses !== null
          ? { picks: picks.map((p) => ({ ...p })), courses: courses.map((c) => ({ ...c })) }
          : { picks: picks.map((p) => ({ ...p })) };
    setDayOverrides(next);
    saveDayOverrides(next);
    setShowDateOv(false);
  };
  const removeOverrideDate = (date: string) => {
    const next = { ...dayOverrides };
    delete next[date];
    setDayOverrides(next);
    saveDayOverrides(next);
  };

  const lpTimer = useRef<number | null>(null);
  const lpStart = useRef<{ x: number; y: number } | null>(null);
  const lpFired = useRef(false);
  const LONG_PRESS_MS = 450;
  const MOVE_CANCEL_PX = 8;

  const pushHistory = (item: HistoryItem) => {
    if (!item.cat1) return;
    setHistory((prev) => {
      const key = (h: HistoryItem) => `${h.name}|${h.cat1}|${h.cat2}|${h.cat3}`;
      const filtered = prev.filter((h) => key(h) !== key(item));
      const next = [item, ...filtered].slice(0, 10);
      saveJSON(LS_KEYS.scheduleHistory, next);
      return next;
    });
  };

  const isWE = (d: string) => d === "六" || d === "日";
  const placeColor = (place: Place) =>
    workplaces.find((w) => w.id === place)?.color ?? CAT.cat2Color("兼差", placeName(place));

  const shiftTimesForDay = (day: string): string[] =>
    (dayPlans[day]?.picks ?? []).flatMap((p) => shiftTimes(p.place, p.shift, day));

  const isCoveredByShift = (day: string, time: string): boolean =>
    shiftTimesForDay(day).includes(time);

  const pickActive = (day: string, place: Place, shift: string) =>
    (dayPlans[day]?.picks ?? []).some((p) => p.place === place && p.shift === shift);
  const pickDisabled = (day: string, place: Place, shift: string) =>
    !pickActive(day, place, shift) && pickOverlaps(day, place, shift, dayPlans[day]?.picks ?? []);
  const togglePick = (day: string, place: Place, shift: string) => {
    setDayPlans((prev) => {
      const cur = prev[day] ?? { picks: [] };
      const exists = cur.picks.some((p) => p.place === place && p.shift === shift);
      if (exists)
        return {
          ...prev,
          [day]: { picks: cur.picks.filter((p) => !(p.place === place && p.shift === shift)) },
        };
      if (pickOverlaps(day, place, shift, cur.picks)) return prev; // 重疊不加
      return { ...prev, [day]: { picks: [...cur.picks, { place, shift }] } };
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const firstSchedSave = useRef(true);
  const skipSchedPush = useRef(false);
  useEffect(() => {
    saveJSON(LS_KEYS.weekSchedule, sched); // 一律存本地
    if (firstSchedSave.current) {
      firstSchedSave.current = false;
      return;
    }
    if (skipSchedPush.current) {
      skipSchedPush.current = false;
      return;
    }
    void pushAppState(APP_STATE_KEYS.weekSchedule, sched);
  }, [sched]);

  useEffect(
    () =>
      subscribeAppState(APP_STATE_KEYS.weekSchedule, () => {
        skipSchedPush.current = true;
        setSched(normalizeSchedule(loadJSON(LS_KEYS.weekSchedule, {})));
      }),
    [],
  );

  const firstDayPlanSave = useRef(true);
  const skipDayPlanPush = useRef(false);
  useEffect(() => {
    if (firstDayPlanSave.current) {
      firstDayPlanSave.current = false;
      return;
    } // 初次載入不推雲
    if (skipDayPlanPush.current) {
      skipDayPlanPush.current = false;
      return;
    } // 遠端套用不回推
    saveDayPlans(dayPlans);
  }, [dayPlans]);

  useEffect(
    () =>
      subscribeAppState(APP_STATE_KEYS.dayPlans, () => {
        skipDayPlanPush.current = true;
        setDayPlans(loadDayPlans());
      }),
    [],
  );

  useEffect(
    () => subscribeAppState(APP_STATE_KEYS.workplaces, () => setWorkplaces(loadWorkplaces())),
    [],
  );

  // 一次性把現有分類色種進 workplace.color（之後與名稱脫鉤；只補缺漏、不動自訂色）
  const colorSeeded = useRef(false);
  useEffect(() => {
    if (colorSeeded.current) return;
    colorSeeded.current = true;
    if (workplaces.some((w) => !w.color)) {
      handleWpChange(
        workplaces.map((w) => (w.color ? w : { ...w, color: CAT.cat2Color("兼差", w.name) })),
      );
    }
  }, [workplaces]);

  const rowGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: GRID_COLS,
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

  const MEAL_TIMES = new Set(["07:00", "12:00", "17:00"]);
  const timeColStyleFor = (t: string): CSSProperties => ({
    ...timeColStyle,
    fontSize: t.endsWith(":00") ? 10 : 7,
    fontWeight: t.endsWith(":00") ? 800 : 400,
    color: MEAL_TIMES.has(t) ? "#FDE68A" : TH.muted,
  });

  // 時間欄凍結：左右捲動恆顯。不透明背板蓋住捲到底下的日格／班別塊（zIndex 高於覆蓋層 5）
  const timeBackdropStyle: CSSProperties = {
    position: "sticky",
    left: 0,
    zIndex: 20,
    background: TH.bg,
    height: "100%",
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

  const setCells = (targets: EditTarget[], data: Omit<SchedRow, "t"> | null) =>
    setSched((s) => {
      const next: Record<string, SchedRow[]> = { ...s };
      for (const { d, t } of targets) {
        const prev = (next[d] || []).filter((e) => e.t !== t);
        next[d] = data ? [...prev, { t, ...data }] : prev;
      }
      return next;
    });

  const toggleSelect = (d: string, t: string) => {
    if (isCoveredByShift(d, t)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const k = selKey(d, t);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const openBatchEdit = () => {
    if (selected.size === 0) return;
    const targets: EditTarget[] = [...selected].map((k) => {
      const [d, t] = k.split("__");
      return { d, t };
    });
    const first = getCell(targets[0].d, targets[0].t);
    setDraft(
      first
        ? { name: first.n, cat1: first.cat1, cat2: first.cat2, cat3: first.cat3, color: first.color ?? "" }
        : { name: "", cat1: "學習", cat2: "", cat3: "", color: "" },
    );
    setEditTargets(targets);
  };

  const openEdit = (d: string, t: string, cell: SchedRow | undefined) => {
    setEditTargets([{ d, t }]);
    setDraft(
      cell
        ? { name: cell.n, cat1: cell.cat1, cat2: cell.cat2, cat3: cell.cat3, color: cell.color ?? "" }
        : { name: "", cat1: "學習", cat2: "", cat3: "", color: "" },
    );
  };

  const cat2Options = draft.cat1 ? CAT.cat2List(draft.cat1) : [];
  const cat3Options =
    draft.cat1 && draft.cat2 ? CAT.cat3List(draft.cat1, draft.cat2) : [];

  const renderClassCell = (d: string, t: string) => {
    if (isCoveredByShift(d, t)) {
      return <div key={d} style={wePlaceholderStyle} />;
    }
    const cell = getCell(d, t);
    const col = cell
      ? cell.color || CAT.deepColorFull(cell.cat1, cell.cat2 || undefined, cell.cat3 || undefined)
      : null;
    const sel = selectMode && selected.has(selKey(d, t));
    return (
      <div
        key={d}
        role="button"
        tabIndex={0}
        onPointerDown={(e) => {
          lpStart.current = { x: e.clientX, y: e.clientY };
          lpFired.current = false;
          lpTimer.current = window.setTimeout(() => {
            lpFired.current = true;
            setSelectMode(true);
            setSelected((prev) => new Set(prev).add(selKey(d, t)));
            lpTimer.current = null;
          }, LONG_PRESS_MS);
        }}
        onPointerMove={(e) => {
          if (lpTimer.current == null || !lpStart.current) return;
          if (
            Math.abs(e.clientX - lpStart.current.x) > MOVE_CANCEL_PX ||
            Math.abs(e.clientY - lpStart.current.y) > MOVE_CANCEL_PX
          ) {
            clearTimeout(lpTimer.current);
            lpTimer.current = null;
          }
        }}
        onPointerUp={() => {
          if (lpTimer.current != null) {
            clearTimeout(lpTimer.current);
            lpTimer.current = null;
          }
        }}
        onClick={() => {
          if (lpFired.current) {
            lpFired.current = false;
            return;
          }
          if (selectMode) toggleSelect(d, t);
          else openEdit(d, t, cell);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (selectMode) toggleSelect(d, t);
            else openEdit(d, t, cell);
          }
        }}
        style={{
          height: ROW_H,
          background: col ? col + "33" : "#1C1C24",
          borderRadius: 5,
          padding: "3px 4px",
          border: sel ? `2px solid ${TH.accent}` : `1px solid ${col ? col + "44" : TH.border}`,
          boxShadow: sel ? `0 0 0 2px ${TH.accent}55` : "none",
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
              color: col ? labelOnDark(col) : undefined,
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              overflow: "hidden",
              lineHeight: 1.2,
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
  const ovNeedCustom = !!ovCourseWarn && ovCourses === null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <BackBtn onBack={onBack} label="課表" />
        <input
          value={note}
          onChange={(e) => saveNote(e.target.value)}
          placeholder="這份課表的標題／備註（例：勞保衝刺期 7/22–8/31）"
          style={{
            flex: 1,
            minWidth: 0,
            background: "#15151B",
            border: `1px solid ${TH.border}`,
            borderRadius: 8,
            padding: "6px 10px",
            color: TH.text,
            fontSize: 12,
            outline: "none",
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Chip
          label="🏢 管理工作場所"
          active={showWpMgr}
          color={TH.accent}
          onClick={() => setShowWpMgr((v) => !v)}
          style={{ fontSize: 11 }}
        />
        <Chip
          label="🛏 管理固定作息"
          active={showRoutineMgr}
          color={TH.accent}
          onClick={() => setShowRoutineMgr((v) => !v)}
          style={{ fontSize: 11 }}
        />
        <button
          type="button"
          onClick={() => {
            if (window.confirm("清空所有天的班別選擇？（課表課程、番茄不受影響）")) {
              setDayPlans(Object.fromEntries(DAYS.map((d) => [d, { picks: [] }])));
            }
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
          🧹 清空所有班別
        </button>
        <Chip
          label="📅 指定日期排班"
          active={showDateOv}
          color={TH.accent}
          onClick={() => (showDateOv ? setShowDateOv(false) : openDateOv(ovDate))}
          style={{ fontSize: 11 }}
        />
        <Chip
          label={selectMode ? "✓ 多選中" : "▦ 多選"}
          active={selectMode}
          color={TH.accent}
          onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
          style={{ fontSize: 11 }}
        />
        {!selectMode && (
          <span style={{ fontSize: 10, color: TH.muted }}>（或長按任一格進入多選）</span>
        )}
        {selectMode && (
          <>
            <span style={{ fontSize: 11, color: TH.muted }}>已選 {selected.size} 格</span>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={openBatchEdit}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 8,
                border: "none",
                background: selected.size ? TH.green : "#333",
                color: "#fff",
                cursor: selected.size ? "pointer" : "default",
              }}
            >
              編輯選取
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
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
              清空選取
            </button>
            <button
              type="button"
              onClick={exitSelect}
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
          </>
        )}
      </div>
      {pasteNotice && (
        <div
          style={{
            border: "1px solid #F59E0B66",
            background: "#F59E0B18",
            borderRadius: 8,
            padding: "8px 10px",
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 14 }}>⚠️</span>
          <div style={{ flex: 1, fontSize: 11, color: TH.text, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {pasteNotice}
          </div>
          <button
            type="button"
            onClick={() => setPasteNotice(null)}
            style={{ background: "none", border: "none", color: TH.muted, fontSize: 14, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}
      {showDateOv && (
        <Card style={{ border: `1px solid ${TH.accent}44` }}>
          <SL>📅 指定日期排班（便利貼）</SL>
          <div style={{ fontSize: 10, color: TH.muted, margin: "4px 0 8px" }}>
            💡 便利貼只改「這一天」，不動每週固定班表；可挑任何班（含平常這天沒有的班）。撕掉便利貼就恢復每週固定。
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 11, color: TH.muted }}>日期</span>
            <input
              type="date"
              value={ovDate}
              onChange={(e) => {
                setOvDate(e.target.value);
                setOvPicks(effectivePicksFor(e.target.value));
                setOvCourses(dayOverrides[e.target.value]?.courses ?? null);
                setOvSlotEdit(null);
                setOvCourseWarn(null);
                setOvConflictSlots(new Set());
                setOvPendingPick(null);
              }}
              style={{
                background: "#15151B",
                border: `1px solid ${TH.border}`,
                borderRadius: 6,
                color: TH.text,
                fontSize: 12,
                padding: "4px 6px",
                colorScheme: "dark",
              }}
            />
            <span style={{ fontSize: 11, color: TH.muted }}>到（選填，套用整段）</span>
            <input
              type="date"
              value={ovEnd}
              min={ovDate}
              onChange={(e) => setOvEnd(e.target.value)}
              style={{
                background: "#15151B",
                border: `1px solid ${TH.border}`,
                borderRadius: 6,
                color: TH.text,
                fontSize: 12,
                padding: "4px 6px",
                colorScheme: "dark",
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: TH.text, fontWeight: 700, marginBottom: 4 }}>
            週{weekdayOf(ovDate)}　挑這天要上的班
          </div>
          {workplaces.map((w) => (
            <div key={w.id} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: placeColor(w.id), fontWeight: 700 }}>{w.name}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                {w.shifts.map((s) => {
                  const r = shiftRangeOn(w.id, s.id, ovDate, true);
                  const disabled = ovPickDisabled(w.id, s.id);
                  return (
                    <Chip
                      key={`${w.id}-${s.id}`}
                      label={`${s.label}${r ? " " + r : ""}`}
                      active={ovPickActive(w.id, s.id)}
                      color={placeColor(w.id)}
                      onClick={() => {
                        if (!disabled) toggleOvPick(w.id, s.id);
                      }}
                      style={{ fontSize: 9, padding: "3px 8px", opacity: disabled ? 0.3 : 1 }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${TH.border}`, marginTop: 8, paddingTop: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <div style={{ fontSize: 11, color: TH.text, fontWeight: 700 }}>📚 這天的班表＋課程</div>
              <button
                type="button"
                onClick={() => {
                  setOvCourses((prev) => (prev === null ? ovWeeklyCourses() : null));
                  setOvSlotEdit(null);
                }}
                style={{
                  fontSize: 10,
                  padding: "3px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  border: `1px solid ${
                    ovCourses === null ? (ovNeedCustom ? TH.yellow : TH.border) : TH.accent
                  }`,
                  background:
                    ovCourses === null
                      ? ovNeedCustom
                        ? TH.yellow + "22"
                        : "transparent"
                      : TH.accent,
                  color: ovCourses === null ? (ovNeedCustom ? TH.yellow : TH.muted) : "#fff",
                  fontWeight: 700,
                  boxShadow: ovNeedCustom ? `0 0 0 3px ${TH.yellow}33` : "none",
                }}
              >
                {ovCourses === null
                  ? ovNeedCustom
                    ? "👉 點我自訂這天課程"
                    : "沿用每週固定（點我自訂課程）"
                  : "✓ 自訂這天課程"}
              </button>
            </div>
            <div style={{ fontSize: 10, color: TH.muted, marginBottom: 6 }}>
              💡 班別色塊會蓋住課程格；被蓋住的時段不能排課。自訂後點空格加課、點課格換/移除。
            </div>
            {ovCourseWarn && (
              <div
                style={{
                  border: "1px solid #F59E0B66",
                  background: "#F59E0B18",
                  borderRadius: 8,
                  padding: "6px 8px",
                  display: "flex",
                  gap: 6,
                  alignItems: "flex-start",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 13 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: TH.text, lineHeight: 1.5 }}>
                    {ovCourseWarn}
                  </div>
                  <div style={{ fontSize: 9.5, color: TH.muted, marginTop: 2 }}>
                    💡 也可以直接點紅色課格右邊的 ×，或用下面的一鍵移除
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const slots = new Set(ovConflictSlots);
                      if (slots.size === 0) return;
                      const pk = ovPendingPick;
                      const who = pk
                        ? `「${placeName(pk.place)}·${shiftLabelOf(pk.place, pk.shift)}」`
                        : "此班";
                      if (
                        !window.confirm(
                          `確定移除這 ${slots.size} 堂與${who}衝突的課程？\n（只影響 ${ovDate} 這一天，不動每週固定課表）`,
                        )
                      )
                        return;
                      setOvCourses((prev) =>
                        (prev ?? ovWeeklyCourses()).filter((c) => !slots.has(c.t)),
                      );
                      if (pk)
                        setOvPicks((prev) =>
                          prev.some((p) => p.place === pk.place && p.shift === pk.shift)
                            ? prev
                            : [...prev, pk],
                        );
                      setOvConflictSlots(new Set());
                      setOvPendingPick(null);
                      setOvCourseWarn(null);
                      setOvSlotEdit(null);
                    }}
                    style={{
                      marginTop: 6,
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "5px 10px",
                      borderRadius: 8,
                      border: "1px solid #EF444455",
                      background: "#EF444422",
                      color: TH.red,
                      cursor: "pointer",
                    }}
                  >
                    🗑 移除這 {ovConflictSlots.size} 堂衝突課
                    {ovPendingPick ? "，並排入此班" : ""}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOvCourseWarn(null);
                    setOvConflictSlots(new Set());
                    setOvPendingPick(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: TH.muted,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            )}
            <div style={{ position: "relative" }}>
              {ROWS.map((row) => {
                if (row.kind === "fixed") {
                  const fixedH = row.times.length * ROW_H + (row.times.length - 1) * GAP;
                  return (
                    <div
                      key={row.times.join("-")}
                      style={{
                        display: "grid",
                        gridTemplateColumns: `44px 1fr`,
                        gap: GAP,
                        height: fixedH,
                        marginBottom: GAP,
                      }}
                    >
                      <div style={{ ...timeColStyle }}>{row.times[0]}</div>
                      <div style={{ ...fixedCellStyle, height: "100%" }}>{renderFixedRoutineText(row)}</div>
                    </div>
                  );
                }
                const t = row.time;
                const covered = ovShiftSlotSet().has(t);
                const conflict = ovConflictSlots.has(t);
                const c = ovCourseAt(t);
                const col = c
                  ? c.color || CAT.deepColorFull(c.cat1, c.cat2 || undefined, c.cat3 || undefined)
                  : null;
                const editable = ovCourses !== null && !covered;
                return (
                  <div
                    key={t}
                    style={{
                      display: "grid",
                      gridTemplateColumns: `44px 1fr`,
                      gap: GAP,
                      height: ROW_H,
                      marginBottom: GAP,
                    }}
                  >
                    <div style={{ ...timeColStyle }}>{t}</div>
                    {covered ? (
                      <div style={wePlaceholderStyle} />
                    ) : (
                      <div style={{ position: "relative", height: ROW_H }}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (editable) setOvSlotEdit(t);
                          }}
                          style={{
                            height: ROW_H,
                            background: conflict ? "#EF444433" : col ? col + "33" : "#1C1C24",
                            borderRadius: 5,
                            padding: "3px 6px",
                            paddingRight: c && editable ? 22 : 6,
                            border: conflict
                              ? `1.5px solid ${TH.red}`
                              : ovSlotEdit === t
                                ? `2px solid ${TH.accent}`
                                : `1px solid ${col ? col + "44" : TH.border}`,
                            cursor: editable ? "pointer" : "default",
                            display: "flex",
                            alignItems: "center",
                            fontSize: 9,
                            fontWeight: 700,
                            color: conflict ? TH.red : col ? labelOnDark(col) : TH.muted,
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            boxSizing: "border-box",
                          }}
                        >
                          {c ? courseLabelOf(c) : editable ? "＋" : ""}
                        </div>
                        {c && editable && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeOvCourse(t);
                              const remaining = [...ovConflictSlots].filter((x) => x !== t);
                              setOvConflictSlots(new Set(remaining));
                              if (remaining.length === 0) setOvCourseWarn(null);
                              if (remaining.length === 0) setOvPendingPick(null);
                              if (ovSlotEdit === t) setOvSlotEdit(null);
                            }}
                            style={{
                              position: "absolute",
                              right: 3,
                              top: "50%",
                              transform: "translateY(-50%)",
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              border: "none",
                              background: conflict ? TH.red : "#00000055",
                              color: "#fff",
                              fontSize: 11,
                              lineHeight: "14px",
                              textAlign: "center",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {ovPicks.map(({ place, shift }) => {
                const times = shiftTimesOn(place, shift, ovDate, true);
                const coveredIdx = HALF_SLOTS.map((slot, i) => (times.includes(slot) ? i : -1)).filter(
                  (i) => i >= 0,
                );
                if (coveredIdx.length === 0) return null;
                const top = coveredIdx[0] * STEP;
                const height = coveredIdx.length * STEP - GAP;
                const r = shiftRangeOn(place, shift, ovDate, true);
                const [rs, re] = r.split("~");
                const col = placeColor(place);
                return (
                  <div
                    key={`ovshift-${place}-${shift}`}
                    style={{
                      position: "absolute",
                      top: `${top}px`,
                      height: `${height}px`,
                      left: `${44 + GAP}px`,
                      width: `calc(100% - ${44 + GAP}px)`,
                      background: col + "40",
                      border: `1px solid ${col}66`,
                      borderRadius: 5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      zIndex: 5,
                      pointerEvents: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <span style={{ color: labelOnDark(col), fontSize: 9, fontWeight: 700 }}>
                      {`兼差:${placeName(place)}`}
                    </span>
                    <span style={{ color: labelOnDark(col), fontSize: 8 }}>
                      {rs}～{re}
                    </span>
                  </div>
                );
              })}
            </div>
            {ovCourses !== null && ovSlotEdit && (
              <div
                style={{
                  marginTop: 8,
                  border: `1px solid ${TH.accent}55`,
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                <div style={{ fontSize: 11, color: TH.text, fontWeight: 700, marginBottom: 6 }}>
                  {ovSlotEdit} 這格
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    value=""
                    onChange={(e) => {
                      const lib = loadScheduleCourses();
                      const c = lib[Number(e.target.value)];
                      if (c && ovSlotEdit) {
                        addOvCourse(ovSlotEdit, c);
                        setOvSlotEdit(null);
                      }
                    }}
                    style={{
                      background: "#0A0A0C",
                      border: `1px solid ${TH.border}`,
                      borderRadius: 6,
                      color: TH.text,
                      fontSize: 11,
                      padding: "4px 6px",
                      maxWidth: 160,
                    }}
                  >
                    <option value="">選科目…</option>
                    {loadScheduleCourses().map((c, i) => (
                      <option key={i} value={String(i)}>
                        {courseLabelOf(c)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setOvSlotEdit(null)}
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
                    關閉
                  </button>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => commitOverride(ovPicks, ovCourses)}
              style={{
                flex: 1,
                minWidth: 110,
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
              存成便利貼
              {ovEnd && ovEnd !== ovDate ? `（${datesInRange(ovDate, ovEnd).length}天）` : ""}
            </button>
            <button
              type="button"
              onClick={() => commitOverride([], ovCourses)}
              style={{
                padding: "7px 10px",
                borderRadius: 8,
                background: "#F59E0B22",
                border: "1px solid #F59E0B55",
                color: "#F59E0B",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🌙 設為休假
            </button>
            {dayOverrides[ovDate] && (
              <button
                type="button"
                onClick={() => {
                  removeOverrideDate(ovDate);
                  setShowDateOv(false);
                }}
                style={{
                  padding: "7px 10px",
                  borderRadius: 8,
                  background: "#EF444422",
                  border: "1px solid #EF444444",
                  color: TH.red,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🗑 撕掉便利貼
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDateOv(false)}
              style={{
                padding: "7px 10px",
                borderRadius: 8,
                background: "transparent",
                border: `1px solid ${TH.border}`,
                color: TH.muted,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              關閉
            </button>
          </div>

          {Object.keys(dayOverrides).length > 0 && (
            <div style={{ marginTop: 12, borderTop: `1px solid ${TH.border}`, paddingTop: 8 }}>
              <div style={{ fontSize: 11, color: TH.muted, marginBottom: 6 }}>已貼的便利貼</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {Object.keys(dayOverrides)
                  .sort()
                  .map((d) => {
                    const picks = dayOverrides[d].picks;
                    const summary = picks.length ? picks.map(describePick).join("、") : "🌙 休假";
                    return (
                      <div
                        key={d}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: "#0D0D0F",
                          border: `1px solid ${TH.border}`,
                          borderRadius: 6,
                          padding: "5px 8px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => openDateOv(d)}
                          style={{
                            flex: 1,
                            textAlign: "left",
                            background: "none",
                            border: "none",
                            color: TH.text,
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          <b>{d}</b> 週{weekdayOf(d)}{" "}
                          <span style={{ color: TH.muted }}>{summary}</span>
                          {dayOverrides[d].courses !== undefined && (
                            <span style={{ color: TH.cyan, fontSize: 10 }}>・自訂課程</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeOverrideDate(d)}
                          style={{
                            fontSize: 10,
                            padding: "3px 8px",
                            borderRadius: 6,
                            border: "1px solid #EF444444",
                            background: "#EF444422",
                            color: TH.red,
                            cursor: "pointer",
                          }}
                        >
                          撕掉
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </Card>
      )}
      {editTargets && (
        <Card style={{ border: `1px solid ${TH.accent}44` }}>
          <SL>
            {editTargets.length === 1 ? (
              <>✏️ 編輯 週{editTargets[0].d} {editTargets[0].t}</>
            ) : (
              <>✏️ 批次編輯 {editTargets.length} 格</>
            )}
          </SL>
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
                      onClick={() =>
                        setDraft({
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={fieldLabelStyle}>大分類</div>
            <button
              type="button"
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
              <span style={{ fontSize: 9, color: TH.muted }}>新增/管理分類</span>
              <span style={{ fontSize: 13 }}>⚙️</span>
            </button>
          </div>
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
          <div style={{ marginBottom: 8 }}>
            <div style={fieldLabelStyle}>顏色（同一分類下不同科目可各自上色）</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, color: "" })}
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
              {[
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
              ].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft({ ...draft, color: c })}
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
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
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
              onClick={() => {
                const data = draft.cat1
                  ? {
                      n: draft.name,
                      cat1: draft.cat1,
                      cat2: draft.cat2,
                      cat3: draft.cat3,
                      color: draft.color || undefined,
                    }
                  : null;
                setCells(editTargets, data);
                if (draft.cat1) {
                  pushHistory({
                    name: draft.name,
                    cat1: draft.cat1,
                    cat2: draft.cat2,
                    cat3: draft.cat3,
                    color: draft.color || undefined,
                  });
                }
                setEditTargets(null);
                exitSelect();
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
                setCells(editTargets, null);
                setEditTargets(null);
                exitSelect();
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
              onClick={() => setEditTargets(null)}
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
      {dayMenu && !editTargets && (
        <Card style={{ border: `1px solid ${TH.accent}44` }}>
          <SL>📅 週{dayMenu}　整天操作</SL>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => {
                setClip({
                  from: dayMenu,
                  courses: (sched[dayMenu] || []).map((c) => ({ ...c })),
                  plan: null,
                  mode: "courses",
                });
                setPasteNotice(null);
                setDayMenu(null);
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                border: `1px solid ${TH.border}`,
                background: "transparent",
                color: TH.text,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              📋 複製課程
            </button>
            <button
              type="button"
              onClick={() => {
                const p = dayPlans[dayMenu];
                setClip({
                  from: dayMenu,
                  courses: (sched[dayMenu] || []).map((c) => ({ ...c })),
                  plan: p ? { picks: [...p.picks] } : null,
                  mode: "full",
                });
                setPasteNotice(null);
                setDayMenu(null);
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                border: `1px solid ${TH.border}`,
                background: "transparent",
                color: TH.text,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              📋 複製課程＋班別
            </button>
            {clip && (
              <button
                type="button"
                onClick={() => {
                  const day = dayMenu;
                  if (!day) return;
                  setSched((s) => ({ ...s, [day]: clip.courses.map((c) => ({ ...c })) }));
                  if (clip.mode === "full" && clip.plan) {
                    const pl = clip.plan;
                    const valid = pl.picks.filter((pk) => shiftRange(pk.place, pk.shift, day) !== "");
                    const skipped = pl.picks.filter((pk) => shiftRange(pk.place, pk.shift, day) === "");
                    setDayPlans((prev) => ({ ...prev, [day]: { picks: valid } }));
                    setPasteNotice(
                      skipped.length
                        ? `以下班別在週${day}不是可上班日，已略過未貼：${skipped.map(describePick).join("、")}。\n若要固定在週${day}上這些班：點「🏢 管理工作場所」→ 找到該班 → 打開「可上班日」的「${day}」，再貼一次。`
                        : null,
                    );
                  }
                  setDayMenu(null);
                }}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: "none",
                  background: TH.green,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                📥 貼上（從週{clip.from}・{clip.mode === "full" ? "課程＋班別" : "只課程"}）
              </button>
            )}
            {clip && (
              <div style={{ borderTop: `1px solid ${TH.border}`, paddingTop: 6, marginTop: 2 }}>
                <div style={{ fontSize: 10, color: TH.muted, marginBottom: 4 }}>
                  或一次貼到多天（從週{clip.from}・{clip.mode === "full" ? "課程＋班別" : "只課程"}）
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                  {DAYS.map((d) => (
                    <Chip
                      key={`pt-${d}`}
                      label={d}
                      active={pasteTargets.has(d)}
                      color={TH.accent}
                      onClick={() =>
                        setPasteTargets((prev) => {
                          const next = new Set(prev);
                          if (next.has(d)) next.delete(d);
                          else next.add(d);
                          return next;
                        })
                      }
                      style={{ fontSize: 10, minWidth: 26, textAlign: "center" }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  disabled={pasteTargets.size === 0}
                  onClick={() => {
                    const targets = [...pasteTargets];
                    setSched((s) => {
                      const next = { ...s };
                      for (const d of targets) next[d] = clip.courses.map((c) => ({ ...c }));
                      return next;
                    });
                    const skips: string[] = [];
                    if (clip.mode === "full") {
                      const pl = clip.plan;
                      setDayPlans((prev) => {
                        const next = { ...prev };
                        for (const d of targets) {
                          const valid = pl ? pl.picks.filter((pk) => shiftRange(pk.place, pk.shift, d) !== "") : [];
                          next[d] = { picks: valid };
                          if (pl)
                            for (const pk of pl.picks)
                              if (shiftRange(pk.place, pk.shift, d) === "")
                                skips.push(`週${d}：${describePick(pk)}`);
                        }
                        return next;
                      });
                    }
                    setPasteNotice(
                      skips.length
                        ? `以下班別不是該天的可上班日，已略過未貼：\n${[...new Set(skips)].join("、")}。\n若要固定排這些班：到「🏢 管理工作場所」打開對應的「可上班日」，再貼一次。`
                        : null,
                    );
                    setPasteTargets(new Set());
                    setDayMenu(null);
                  }}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "none",
                    background: pasteTargets.size ? TH.accent : "#333",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: pasteTargets.size ? "pointer" : "default",
                  }}
                >
                  📥 貼到選取的 {pasteTargets.size} 天
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setSched((s) => ({ ...s, [dayMenu]: [] }));
                setDayMenu(null);
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                border: "1px solid #EF444444",
                background: "#EF444422",
                color: TH.red,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              🗑 清空此日課程
            </button>
            <button
              type="button"
              onClick={() => {
                setDayMenu(null);
                setPasteTargets(new Set());
                setPasteNotice(null);
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                border: `1px solid ${TH.border}`,
                background: "transparent",
                color: TH.muted,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              關閉
            </button>
          </div>
        </Card>
      )}
      {showWpMgr && (
        <WorkplaceManager
          workplaces={workplaces}
          onChange={handleWpChange}
          onClose={() => setShowWpMgr(false)}
        />
      )}
      {showRoutineMgr && <RoutineManager onClose={() => setShowRoutineMgr(false)} />}
      <div style={{ fontSize: 10, color: TH.muted }}>
        💡 一天可跨店排班；與已選班別時間重疊的會變灰、不能選
      </div>
      <div style={{ fontSize: 10, color: TH.muted }}>
        💡 點「🏢 管理工作場所」可改各班別時間；同一班別可設「不同日子不同時間」
      </div>
      <div style={{ fontSize: 10, color: TH.muted }}>
        💡 點最上面的星期（一、二…）可複製整天課程／班別，再貼到其他天
      </div>
      <div style={{ fontSize: 10, color: TH.muted }}>
        💡 欄寬會依「目前最長的課程名稱」自動調整，讓名稱能一行顯示
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        <button
          type="button"
          onClick={() => setExpandEarly((v) => !v)}
          style={{
            fontSize: 9,
            padding: "3px 8px",
            borderRadius: 8,
            border: `1px solid ${TH.border}`,
            background: expandEarly ? TH.accent + "22" : "transparent",
            color: expandEarly ? TH.accent : TH.muted,
            cursor: "pointer",
          }}
        >
          {expandEarly ? "▲ 收合凌晨" : "▼ 展開凌晨 00:00–06:00"}
        </button>
      </div>
      <div
        className="flowlife-hscroll"
        style={{
          overflowX: "auto",
          overflowY: "visible",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
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
                gap: GAP,
                marginBottom: GAP,
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
              {DAYS.map((d) => (
                <div
                  key={d}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDayMenu(d)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setDayMenu(d);
                  }}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textAlign: "center",
                    padding: "4px 0",
                    background: isWE(d) ? TH.cyan + "11" : TH.card,
                    borderRadius: 5,
                    color: isWE(d) ? TH.cyan : TH.muted,
                    cursor: "pointer",
                  }}
                >
                  {d}
                  <span style={{ fontSize: 7, opacity: 0.5 }}> ⋯</span>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: GRID_COLS,
                gap: GAP,
                marginBottom: GAP,
              }}
            >
              <div style={timeBackdropStyle} />
              {DAYS.map((d) => (
                <div
                  key={`plan-${d}`}
                  style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}
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
                      {w.shifts.filter((s) => s.days?.includes(d)).map((s) => {
                        const disabled = pickDisabled(d, w.id, s.id);
                        return (
                          <Chip
                            key={`${w.id}-${s.id}`}
                            label={s.label}
                            active={pickActive(d, w.id, s.id)}
                            color={placeColor(w.id)}
                            onClick={() => {
                              if (!disabled) togglePick(d, w.id, s.id);
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
            {ROWS.map((row) => {
              if (row.kind === "fixed") {
                const fixedH = row.times.length * ROW_H + (row.times.length - 1) * GAP;
                const fixedRowStyle: CSSProperties = { ...rowGridStyle, height: fixedH };
                if (row.span === "all") {
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
                  <div key={row.times.join("-")} style={fixedRowStyle}>
                    <div style={timeBackdropStyle}>
                      <div style={timeColStyleFor(row.times[0])}>{row.times[0]}</div>
                    </div>
                    <div style={{ ...fixedCellStyle, gridColumn: "span 5", height: "100%" }}>
                      {renderFixedRoutineText(row)}
                    </div>
                    <div style={wePlaceholderStyle} />
                    <div style={wePlaceholderStyle} />
                  </div>
                );
              }
              return (
                <div key={row.time} style={rowGridStyle}>
                  <div style={timeBackdropStyle}>
                    <div style={timeColStyleFor(row.time)}>{row.time}</div>
                  </div>
                  {DAYS.map((d) => renderClassCell(d, row.time))}
                </div>
              );
            })}

            {DAYS.flatMap((day, dayColIndex) => {
              const plan = dayPlans[day];
              if (!plan) return [];
              return plan.picks
                .map(({ place, shift }) => {
                  const times = shiftTimes(place, shift, day);
                  const coveredIdx = HALF_SLOTS.map((t, i) =>
                    times.includes(t) ? i : -1,
                  ).filter((i) => i >= 0);
                  if (coveredIdx.length === 0) return null;
                  const firstIdx = coveredIdx[0];
                  const count = coveredIdx.length;
                  const top = firstIdx * STEP;
                  const height = count * STEP - GAP;
                  const [rangeStart, rangeEnd] = shiftRange(place, shift, day).split("~");
                  const col = placeColor(place);

                  return (
                    <div
                      key={`shift-${day}-${place}-${shift}`}
                      style={{
                        position: "absolute",
                        top: `${top}px`,
                        height: `${height}px`,
                        left: leftForDay(dayColIndex),
                        width: COL_W,
                        background: col + "33",
                        border: `1px solid ${col}44`,
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
                      <span
                        style={{
                          color: labelOnDark(col),
                          fontSize: 8,
                          fontWeight: 700,
                          lineHeight: 1.2,
                        }}
                      >
                        {`兼差:${placeName(place)}`}
                      </span>
                      <span
                        style={{
                          color: labelOnDark(col),
                          fontSize: 8,
                          fontWeight: 700,
                          lineHeight: 1.2,
                        }}
                      >
                        {rangeStart}
                      </span>
                      <span style={{ color: labelOnDark(col), fontSize: 7, lineHeight: 1 }}>～</span>
                      <span
                        style={{
                          color: labelOnDark(col),
                          fontSize: 8,
                          fontWeight: 700,
                          lineHeight: 1.2,
                        }}
                      >
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
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button
          type="button"
          onClick={() => setExpandLate((v) => !v)}
          style={{
            fontSize: 9,
            padding: "3px 8px",
            borderRadius: 8,
            border: `1px solid ${TH.border}`,
            background: expandLate ? TH.accent + "22" : "transparent",
            color: expandLate ? TH.accent : TH.muted,
            cursor: "pointer",
          }}
        >
          {expandLate ? "▲ 收合深夜" : "▼ 展開深夜 23:00–24:00"}
        </button>
      </div>
    </div>
  );
}
