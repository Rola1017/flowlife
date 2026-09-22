"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { CFG } from "@/lib/config";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { Card, SL } from "@/components/ui/Card";
import {
  type CourseInfo,
  type DayOverride,
  type DayPick,
  type DayPlan,
  type Place,
  type WorkplaceConfig,
  applyDayVacation,
  loadDayOverrides,
  loadDayPlans,
  loadRoutine,
  loadWorkplaces,
  placeName,
  resolveDayView,
  restoreDayToTemplate,
  saveDayOverrides,
  pickOverlapsOn,
  shiftRangeOn,
  shiftTimesOn,
  vacationClearCounts,
  weekdayOf,
  newCourseId,
} from "@/lib/schedule";
import { subscribeAppState, APP_STATE_KEYS } from "@/lib/appStateCloud";
import { mondayOfDateStr, weekDatesFromMonday, weekRangeMd, addDaysYmd, formatMd, isCurrentWeek } from "@/lib/dateStr";
import { toM } from "@/lib/utils";
import { ScheduleBoard } from "./ScheduleBoard";
import { buildScheduleRows, halfSlotsOf, inFixedSlot } from "./scheduleGridModel";
import { CourseEditPanel, type CourseDraft, type CourseHistoryItem } from "./CourseEditPanel";
import { useHorizontalSwipe } from "@/components/hooks/useHorizontalSwipe";

const CORE_S = toM("06:00");
const CORE_E = toM("23:00");
const FULL_S = 0;
const FULL_E = 24 * 60;

const navHit: CSSProperties = {
  flexShrink: 0,
  width: 26,
  height: 26,
  padding: 9,
  margin: -9,
  boxSizing: "content-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: TH.card,
  borderRadius: 8,
  border: "none",
  color: TH.text,
  fontSize: 20,
  fontWeight: 800,
  cursor: "pointer",
};

const EDIT_TIP = "💡 在這裡改只會影響這一天，不會動到常用模板";

type Draft = CourseDraft;

function stopSwipe(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

export function ScheduleWeekPage({ onShowCategoryManager }: { onShowCategoryManager?: () => void }) {
  const [monday, setMonday] = useState(() => mondayOfDateStr(CFG.TODAY_STR));
  const [week, setWeek] = useState<Record<string, CourseInfo[]>>(() =>
    loadJSON<Record<string, CourseInfo[]>>(LS_KEYS.weekSchedule, {}),
  );
  const [plans, setPlans] = useState<Record<string, DayPlan>>(loadDayPlans);
  const [overrides, setOverrides] = useState<Record<string, DayOverride>>(loadDayOverrides);
  const [workplaces, setWorkplaces] = useState<WorkplaceConfig[]>(loadWorkplaces);
  const [routineRev, setRoutineRev] = useState(0);
  const [expandEarly, setExpandEarly] = useState(false);
  const [expandLate, setExpandLate] = useState(false);
  const [dayPanel, setDayPanel] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ date: string; time: string; draft: Draft; courseId?: string } | null>(null);
  const [history, setHistory] = useState<CourseHistoryItem[]>(() =>
    loadJSON<CourseHistoryItem[]>(LS_KEYS.scheduleHistory, []),
  );
  const editWarned = useRef(false);
  const swipe = useHorizontalSwipe((dir) => {
    setMonday((m) => addDaysYmd(m, dir === "left" ? 7 : -7));
    setDayPanel(null);
    setEdit(null);
  });

  const dates = useMemo(() => weekDatesFromMonday(monday), [monday]);

  useEffect(
    () => subscribeAppState(APP_STATE_KEYS.weekSchedule, () => setWeek(loadJSON(LS_KEYS.weekSchedule, {}))),
    [],
  );
  useEffect(() => subscribeAppState(APP_STATE_KEYS.dayPlans, () => setPlans(loadDayPlans())), []);
  useEffect(() => subscribeAppState(APP_STATE_KEYS.dayOverrides, () => setOverrides(loadDayOverrides())), []);
  useEffect(() => subscribeAppState(APP_STATE_KEYS.workplaces, () => setWorkplaces(loadWorkplaces())), []);
  useEffect(() => subscribeAppState(APP_STATE_KEYS.routine, () => setRoutineRev((n) => n + 1)), []);

  const winStart = expandEarly ? FULL_S : CORE_S;
  const winEnd = expandLate ? FULL_E : CORE_E;
  const rows = useMemo(() => buildScheduleRows(loadRoutine(), winStart, winEnd), [routineRev, winStart, winEnd]);
  const halfSlots = useMemo(() => halfSlotsOf(rows), [rows]);

  const resolved = useMemo(
    () => Object.fromEntries(dates.map((d) => [d, resolveDayView(d, week, plans, overrides)])),
    [dates, week, plans, overrides],
  );

  const dayColMin = useMemo(() => {
    const labels: string[] = [];
    for (const d of dates) {
      for (const c of resolved[d]?.courses ?? []) labels.push(c.n || c.cat3 || c.cat2 || c.cat1 || "");
    }
    const FALLBACK = 85;
    if (labels.length === 0 || typeof document === "undefined") return FALLBACK;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return FALLBACK;
    ctx.font = "700 8px system-ui, -apple-system, 'Noto Sans TC', sans-serif";
    let max = 0;
    for (const l of labels) max = Math.max(max, ctx.measureText(l).width);
    return Math.round(Math.min(240, Math.max(60, max + 16)));
  }, [dates, resolved]);

  const placeColor = (place: Place) =>
    workplaces.find((w) => w.id === place)?.color ?? CAT.cat2Color("兼差", placeName(place));

  const commitOverrides = (next: Record<string, DayOverride>) => {
    setOverrides(next);
    saveDayOverrides(next);
  };

  const confirmEditOnce = () => {
    if (editWarned.current) return true;
    if (!window.confirm(EDIT_TIP)) return false;
    editWarned.current = true;
    return true;
  };

  const seedOverride = (date: string): DayOverride => {
    const existing = overrides[date];
    if (existing) {
      return {
        picks: existing.picks.map((p) => ({ ...p })),
        courses: existing.courses !== undefined ? existing.courses.map((c) => ({ ...c })) : undefined,
      };
    }
    const r = resolved[date];
    return { picks: (r?.picks ?? []).map((p) => ({ ...p })) };
  };

  const writeDay = (date: string, next: DayOverride) => {
    commitOverrides({ ...overrides, [date]: next });
  };

  const onTogglePick = (date: string, place: Place, shift: string) => {
    if (!confirmEditOnce()) return;
    const cur = seedOverride(date);
    const exists = cur.picks.some((p) => p.place === place && p.shift === shift);
    if (exists) {
      writeDay(date, { ...cur, picks: cur.picks.filter((p) => !(p.place === place && p.shift === shift)) });
      return;
    }
    const r = shiftRangeOn(place, shift, date, true);
    if (!r) return;
    if (pickOverlapsOn(date, place, shift, cur.picks, true)) return;
    writeDay(date, { ...cur, picks: [...cur.picks, { place, shift }] });
  };

  const onCellClick = (date: string, time: string, cell: CourseInfo | undefined) => {
    if (inFixedSlot(time)) return;
    if (resolved[date]?.picks.some((p) => shiftTimesOn(p.place, p.shift, date, resolved[date].isOverride).includes(time)))
      return;
    if (!confirmEditOnce()) return;
    setEdit({
      date,
      time,
      courseId: cell?.id,
      draft: cell
        ? { name: cell.n, cat1: cell.cat1, cat2: cell.cat2, cat3: cell.cat3, color: cell.color ?? "" }
        : { name: "", cat1: "學習", cat2: "", cat3: "", color: "" },
    });
  };

  const saveCell = () => {
    if (!edit) return;
    const cur = seedOverride(edit.date);
    const baseCourses = cur.courses !== undefined ? cur.courses : [...(resolved[edit.date]?.courses ?? [])];
    const existing = baseCourses.find((c) => c.t === edit.time);
    const rest = baseCourses.filter((c) => c.t !== edit.time);
    const d = edit.draft;
    const nextCourses = d.cat1
      ? [
          ...rest,
          {
            id: existing?.id ?? edit.courseId ?? newCourseId(),
            t: edit.time,
            n: d.name,
            cat1: d.cat1,
            cat2: d.cat2,
            cat3: d.cat3,
            color: d.color || undefined,
          },
        ]
      : rest;
    writeDay(edit.date, { ...cur, courses: nextCourses });
    if (d.cat1) {
      setHistory((prev) => {
        const key = (h: CourseHistoryItem) => `${h.name}|${h.cat1}|${h.cat2}|${h.cat3}`;
        const item = { name: d.name, cat1: d.cat1, cat2: d.cat2, cat3: d.cat3, color: d.color || undefined };
        const next = [item, ...prev.filter((h) => key(h) !== key(item))].slice(0, 10);
        saveJSON(LS_KEYS.scheduleHistory, next);
        return next;
      });
    }
    setEdit(null);
  };

  const clearCell = () => {
    if (!edit) return;
    const cur = seedOverride(edit.date);
    const baseCourses = cur.courses !== undefined ? cur.courses : [...(resolved[edit.date]?.courses ?? [])];
    writeDay(edit.date, { ...cur, courses: baseCourses.filter((c) => c.t !== edit.time) });
    setEdit(null);
  };

  const runVacation = (date: string, mode: "shifts" | "courses" | "both") => {
    const r = resolved[date];
    if (!r) return;
    const counts = vacationClearCounts(r);
    const n = mode === "shifts" ? counts.shifts : mode === "courses" ? counts.courses : counts.shifts + counts.courses;
    const label = mode === "shifts" ? "班別" : mode === "courses" ? "課程" : "班別與課程";
    if (!window.confirm(`將清掉這一天的 ${n} 筆${label}（只寫入這一天的例外，常用模板不變）。確定？`)) return;
    commitOverrides(applyDayVacation(date, mode, week, plans, overrides));
  };

  const restore = (date: string) => {
    if (!window.confirm("恢復成常用模板？這會清掉這一天的特別調整。")) return;
    commitOverrides(restoreDayToTemplate(overrides, date));
    setDayPanel(null);
  };

  const panelResolved = dayPanel ? resolved[dayPanel] : null;
  const panelCounts = panelResolved ? vacationClearCounts(panelResolved) : { shifts: 0, courses: 0 };
  const thisMonday = mondayOfDateStr(CFG.TODAY_STR);
  const onThisWeek = isCurrentWeek(monday, CFG.TODAY_STR);

  return (
    <div
      {...swipe.bind}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        ...swipe.bind.style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, width: "100%", boxSizing: "border-box" }}>
        <button type="button" aria-label="上一週" onPointerDown={stopSwipe} onClick={() => setMonday((m) => addDaysYmd(m, -7))} style={navHit}>
          ‹
        </button>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: "center",
            fontSize: 14,
            fontWeight: 800,
            color: TH.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {weekRangeMd(monday)}
        </div>
        <div style={{ width: 44, height: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {!onThisWeek && (
            <button
              type="button"
              aria-label="回本週"
              onPointerDown={stopSwipe}
              onClick={() => setMonday(thisMonday)}
              style={{
                ...navHit,
                fontSize: 12,
                fontWeight: 800,
                borderRadius: "50%",
                boxShadow: `inset 0 0 0 1.5px ${TH.yellow}`,
              }}
            >
              今
            </button>
          )}
        </div>
        <button type="button" aria-label="下一週" onPointerDown={stopSwipe} onClick={() => setMonday((m) => addDaysYmd(m, 7))} style={navHit}>
          ›
        </button>
      </div>
      <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4, textAlign: "center" }}>
        💡 左右滑動或點箭頭可切換週；在課表格子裡滑動是左右看內容；點黃圈『今』回到本週
      </div>
      <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4 }}>
        💡 左上橘色小圓點／虛線框＝這天被特別改過（便利貼），常用模板沒動
      </div>

      {dayPanel && panelResolved && (
        <div onPointerDown={stopSwipe}>
        <Card>
          <SL>
            {formatMd(dayPanel)}（{panelResolved.weekday}）
            {panelResolved.isOverride ? " · 已特別調整" : ""}
          </SL>
          {panelResolved.isOverride && (
            <button
              type="button"
              onPointerDown={stopSwipe}
              onClick={() => restore(dayPanel)}
              style={{
                width: "100%",
                marginBottom: 8,
                padding: "10px 12px",
                minHeight: 44,
                borderRadius: 10,
                border: `1px solid ${TH.border}`,
                background: "transparent",
                color: TH.text,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              恢復成常用模板
            </button>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              type="button"
              onClick={() => runVacation(dayPanel, "shifts")}
              style={vacBtn}
            >
              🏖 兼差休假（{panelCounts.shifts} 筆班）
            </button>
            <button type="button" onClick={() => runVacation(dayPanel, "courses")} style={vacBtn}>
              📕 課程休假（{panelCounts.courses} 筆課）
            </button>
            <button type="button" onClick={() => runVacation(dayPanel, "both")} style={vacBtn}>
              🌴 都休假
            </button>
          </div>
          <div style={{ fontSize: 9, color: TH.muted, marginTop: 8, lineHeight: 1.4 }}>
            💡 只會讓這一天空下來，常用模板不受影響；可用「恢復成常用模板」還原
          </div>
          <button
            type="button"
            onPointerDown={stopSwipe}
            onClick={() => setDayPanel(null)}
            style={{ marginTop: 8, background: "none", border: "none", color: TH.muted, fontSize: 11, cursor: "pointer" }}
          >
            關閉
          </button>
        </Card>
        </div>
      )}

      {edit && (
        <CourseEditPanel
          title={
            <>
              編輯 {formatMd(edit.date)} {edit.time}
            </>
          }
          hint={EDIT_TIP}
          draft={edit.draft}
          onChange={(draft) => setEdit({ ...edit, draft })}
          history={history}
          onShowCategoryManager={onShowCategoryManager}
          saveLabel="儲存（只改這一天）"
          onSave={saveCell}
          onClear={clearCell}
          onCancel={() => setEdit(null)}
        />
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" onPointerDown={stopSwipe} onClick={() => setExpandEarly((v) => !v)} style={tinyBtn(expandEarly)}>
          {expandEarly ? "▲ 收合凌晨" : "▼ 展開凌晨 00:00–06:00"}
        </button>
      </div>

      <ScheduleBoard
        columns={dates.map((d) => {
          const r = resolved[d];
          return {
            key: d,
            title: weekdayOf(d),
            subtitle: formatMd(d),
            weekend: weekdayOf(d) === "六" || weekdayOf(d) === "日",
            marked: r?.isOverride,
            onHeaderClick: () => setDayPanel(d),
          };
        })}
        rows={rows}
        halfSlots={halfSlots}
        workplaces={workplaces}
        dayColMin={dayColMin}
        getCell={(d, t) => resolved[d]?.courses.find((c) => c.t === t)}
        isCoveredByShift={(d, t) =>
          (resolved[d]?.picks ?? []).some((p) =>
            shiftTimesOn(p.place, p.shift, d, resolved[d]?.isOverride === true).includes(t),
          )
        }
        onCellClick={(d, t, cell) => onCellClick(d, t, cell)}
        cellExtraStyle={(d) =>
          resolved[d]?.isOverride ? { outline: `1px dashed ${TH.accent}66` } : undefined
        }
        picksFor={(d) => resolved[d]?.picks ?? []}
        shiftTimesFor={(d, place, shift) => shiftTimesOn(place, shift, d, resolved[d]?.isOverride === true)}
        shiftRangeFor={(d, place, shift) => shiftRangeOn(place, shift, d, resolved[d]?.isOverride === true)}
        pickActive={(d, place, shift) => (resolved[d]?.picks ?? []).some((p) => p.place === place && p.shift === shift)}
        pickDisabled={(d, place, shift) => {
          const picks = resolved[d]?.picks ?? [];
          if (picks.some((p) => p.place === place && p.shift === shift)) return false;
          const r = shiftRangeOn(place, shift, d, true);
          if (!r) return true;
          return pickOverlapsOn(d, place, shift, picks, true);
        }}
        onTogglePick={onTogglePick}
        showShift={(d, place, shiftId) => {
          const sh = workplaces.find((w) => w.id === place)?.shifts.find((x) => x.id === shiftId);
          if (!sh) return false;
          if (resolved[d]?.isOverride) return true;
          return !!sh.days?.includes(weekdayOf(d));
        }}
        placeColor={placeColor}
      />

      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button type="button" onPointerDown={stopSwipe} onClick={() => setExpandLate((v) => !v)} style={tinyBtn(expandLate)}>
          {expandLate ? "▲ 收合深夜" : "▼ 展開深夜 23:00–24:00"}
        </button>
      </div>
    </div>
  );
}

const vacBtn: CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${TH.border}`,
  background: "transparent",
  color: TH.text,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  boxSizing: "border-box",
};

function tinyBtn(active: boolean): CSSProperties {
  return {
    fontSize: 9,
    padding: "3px 8px",
    borderRadius: 8,
    border: `1px solid ${TH.border}`,
    background: active ? TH.accent + "22" : "transparent",
    color: active ? TH.accent : TH.muted,
    cursor: "pointer",
  };
}
