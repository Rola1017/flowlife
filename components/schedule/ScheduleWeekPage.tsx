"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { CFG } from "@/lib/config";
import { LS_KEYS, loadJSON } from "@/lib/storage";
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
  shiftRangeOn,
  shiftTimesOn,
  vacationClearCounts,
  weekdayOf,
} from "@/lib/schedule";
import { subscribeAppState, APP_STATE_KEYS } from "@/lib/appStateCloud";
import { mondayOfDateStr, weekDatesFromMonday, weekRangeMd, addDaysYmd, formatMd } from "@/lib/dateStr";
import { toM } from "@/lib/utils";
import { ScheduleBoard } from "./ScheduleBoard";
import { buildScheduleRows, halfSlotsOf, inFixedSlot } from "./scheduleGridModel";

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

const SWIPE_MIN_PX = 60;
const SWIPE_H_RATIO = 1.5;
const EDIT_TIP = "💡 在這裡改只會影響這一天，不會動到常用模板";

function shouldIgnoreWeekSwipe(target: EventTarget | null, root: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== root) {
    if (el instanceof HTMLElement && el.dataset.noWeekSwipe === "1") return true;
    const ox = getComputedStyle(el).overflowX;
    if (ox === "auto" || ox === "scroll") return true;
    el = el.parentElement;
  }
  return false;
}

type Draft = { name: string; cat1: string; cat2: string; cat3: string; color: string };

export function ScheduleWeekPage() {
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
  const [edit, setEdit] = useState<{ date: string; time: string; draft: Draft } | null>(null);
  const editWarned = useRef(false);
  const swipeRef = useRef<{ x: number; y: number; id: number; ignore: boolean } | null>(null);

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
    const overlap = cur.picks.some((p) => {
      const other = shiftRangeOn(p.place, p.shift, date, true);
      if (!other || !r) return false;
      const [a1, b1] = r.split("~");
      const [a2, b2] = other.split("~");
      const m = (t: string) => {
        const [h, mm] = t.split(":").map(Number);
        return h * 60 + mm;
      };
      return m(a1) < m(b2) && m(a2) < m(b1);
    });
    if (overlap) return;
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
      draft: cell
        ? { name: cell.n, cat1: cell.cat1, cat2: cell.cat2, cat3: cell.cat3, color: cell.color ?? "" }
        : { name: "", cat1: "學習", cat2: "", cat3: "", color: "" },
    });
  };

  const saveCell = () => {
    if (!edit) return;
    const cur = seedOverride(edit.date);
    const baseCourses = cur.courses !== undefined ? cur.courses : [...(resolved[edit.date]?.courses ?? [])];
    const rest = baseCourses.filter((c) => c.t !== edit.time);
    const d = edit.draft;
    const nextCourses = d.cat1
      ? [...rest, { t: edit.time, n: d.name, cat1: d.cat1, cat2: d.cat2, cat3: d.cat3, color: d.color || undefined }]
      : rest;
    writeDay(edit.date, { ...cur, courses: nextCourses });
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

  const onSwipeDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const ignore = shouldIgnoreWeekSwipe(e.target, e.currentTarget);
    swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, ignore };
    if (!ignore) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* 非信任事件 */
      }
    }
  };
  const onSwipeUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s || s.ignore || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) <= SWIPE_MIN_PX) return;
    if (Math.abs(dx) <= Math.abs(dy) * SWIPE_H_RATIO) return;
    setMonday((m) => addDaysYmd(m, dx < 0 ? 7 : -7));
    setDayPanel(null);
    setEdit(null);
  };

  const cat2Options = edit?.draft.cat1 ? CAT.cat2List(edit.draft.cat1) : [];
  const cat3Options = edit?.draft.cat1 && edit.draft.cat2 ? CAT.cat3List(edit.draft.cat1, edit.draft.cat2) : [];
  const panelResolved = dayPanel ? resolved[dayPanel] : null;
  const panelCounts = panelResolved ? vacationClearCounts(panelResolved) : { shifts: 0, courses: 0 };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", minWidth: 0, boxSizing: "border-box" }}
      onPointerDown={onSwipeDown}
      onPointerMove={() => {
        /* 垂直捲動不擋；水平判定在 pointerup */
      }}
      onPointerUp={onSwipeUp}
      onPointerCancel={() => {
        swipeRef.current = null;
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, width: "100%", boxSizing: "border-box" }}>
        <button type="button" aria-label="上一週" onClick={() => setMonday((m) => addDaysYmd(m, -7))} style={navHit}>
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
        <button type="button" aria-label="下一週" onClick={() => setMonday((m) => addDaysYmd(m, 7))} style={navHit}>
          ›
        </button>
      </div>
      <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4, textAlign: "center" }}>
        💡 左右滑動或點箭頭可切換週；在課表格子裡滑動是左右看內容
      </div>
      <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4 }}>
        💡 左上橘色小圓點／虛線框＝這天被特別改過（便利貼），常用模板沒動
      </div>

      {dayPanel && panelResolved && (
        <Card>
          <SL>
            {formatMd(dayPanel)}（{panelResolved.weekday}）
            {panelResolved.isOverride ? " · 已特別調整" : ""}
          </SL>
          {panelResolved.isOverride && (
            <button
              type="button"
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
            onClick={() => setDayPanel(null)}
            style={{ marginTop: 8, background: "none", border: "none", color: TH.muted, fontSize: 11, cursor: "pointer" }}
          >
            關閉
          </button>
        </Card>
      )}

      {edit && (
        <Card>
          <SL>
            編輯 {formatMd(edit.date)} {edit.time}
          </SL>
          <div style={{ fontSize: 10, color: TH.muted, marginBottom: 8 }}>{EDIT_TIP}</div>
          <input
            value={edit.draft.name}
            onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, name: e.target.value } })}
            placeholder="課名（可空）"
            style={inputStyle}
          />
          <select
            value={edit.draft.cat1}
            onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, cat1: e.target.value, cat2: "", cat3: "" } })}
            style={inputStyle}
          >
            {CAT.cat1List().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {cat2Options.length > 0 && (
            <select
              value={edit.draft.cat2}
              onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, cat2: e.target.value, cat3: "" } })}
              style={inputStyle}
            >
              <option value="">—</option>
              {cat2Options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {cat3Options.length > 0 && (
            <select
              value={edit.draft.cat3}
              onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, cat3: e.target.value } })}
              style={inputStyle}
            >
              <option value="">—</option>
              {cat3Options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={saveCell} style={{ ...vacBtn, flex: 1, background: TH.accent, color: "#000", border: "none" }}>
              儲存（只改這一天）
            </button>
            <button type="button" onClick={clearCell} style={{ ...vacBtn, flex: 1, color: TH.red, border: `1px solid ${TH.red}` }}>
              清空此格
            </button>
            <button type="button" onClick={() => setEdit(null)} style={{ ...vacBtn, color: TH.muted }}>
              取消
            </button>
          </div>
        </Card>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" onClick={() => setExpandEarly((v) => !v)} style={tinyBtn(expandEarly)}>
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
          return picks.some((p) => {
            const other = shiftRangeOn(p.place, p.shift, d, true);
            if (!other) return false;
            const [a1, b1] = r.split("~");
            const [a2, b2] = other.split("~");
            const m = (t: string) => {
              const [h, mm] = t.split(":").map(Number);
              return h * 60 + mm;
            };
            return m(a1) < m(b2) && m(a2) < m(b1);
          });
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
        <button type="button" onClick={() => setExpandLate((v) => !v)} style={tinyBtn(expandLate)}>
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

const inputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  background: "#0A0A0C",
  border: `1px solid ${TH.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: TH.text,
  fontSize: 12,
  marginBottom: 8,
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
