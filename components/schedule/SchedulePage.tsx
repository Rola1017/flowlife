"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TH, labelOnDark } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import {
  type Place,
  type DayPlan,
  type DayPick,
  type WorkplaceConfig,
  placeName,
  pickOverlaps,
  shiftTimes,
  shiftRange,
  loadDayPlans,
  saveDayPlans,
  loadWorkplaces,
  saveWorkplaces,
  FIXED_ROUTINE,
} from "@/lib/schedule";
import { subscribeAppState, pushAppState, APP_STATE_KEYS } from "@/lib/appStateCloud";
import { WorkplaceManager } from "./WorkplaceManager";
import { toM } from "@/lib/utils";
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
  | { kind: "fixed"; times: string[]; label: string; span: "all" | "weekday" }
  | { kind: "class"; time: string };

const GRID_START_MIN = toM("06:30");
const GRID_END_MIN = toM("23:00"); // 最後一格 22:30–23:00
const fmtHM2 = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// 課表固定列由 FIXED_ROUTINE 衍生（單一來源）；其餘 30 分格為可排課格
function buildRows(): RowDef[] {
  const rows: RowDef[] = [];
  let t = GRID_START_MIN;
  while (t < GRID_END_MIN) {
    const blk = FIXED_ROUTINE.find((b) => toM(b.start) <= t && t < toM(b.end));
    if (blk) {
      const blkEnd = Math.min(toM(blk.end), GRID_END_MIN);
      const times: string[] = [];
      while (t < blkEnd) {
        times.push(fmtHM2(t));
        t += 30;
      }
      rows.push({ kind: "fixed", times, label: blk.label, span: "all" });
    } else {
      rows.push({ kind: "class", time: fmtHM2(t) });
      t += 30;
    }
  }
  return rows;
}

const ROWS: RowDef[] = buildRows();

const HALF_SLOTS: string[] = [];
for (const row of ROWS) {
  if (row.kind === "class") HALF_SLOTS.push(row.time);
  else HALF_SLOTS.push(...row.times);
}

const ROW_H = 26;
const GAP = 2;
const STEP = ROW_H + GAP;

const DAYS = ["一", "二", "三", "四", "五", "六", "日"] as const;
const COL_W = `calc((100% - 44px - ${7 * GAP}px) / 7)`;

const inFixedSlot = (t: string) =>
  FIXED_ROUTINE.some((b) => toM(b.start) <= toM(t) && toM(t) < toM(b.end));

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
  const [draft, setDraft] = useState<Draft>({ name: "", cat1: "學習", cat2: "", cat3: "" });
  type HistoryItem = { name: string; cat1: string; cat2: string; cat3: string };
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

  const MEAL_TIMES = new Set(["07:00", "12:00", "17:00"]);
  const timeColStyleFor = (t: string): CSSProperties => ({
    ...timeColStyle,
    fontSize: t.endsWith(":00") ? 10 : 7,
    fontWeight: t.endsWith(":00") ? 800 : 400,
    color: MEAL_TIMES.has(t) ? "#FDE68A" : TH.muted,
  });

  // 時間欄凍結：左右捲動恆顯。不透明背板蓋住捲到底下的日格（zIndex 高於日格與班別覆蓋層）
  const timeBackdropStyle: CSSProperties = {
    position: "sticky",
    left: 0,
    zIndex: 6,
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
        ? { name: first.n, cat1: first.cat1, cat2: first.cat2, cat3: first.cat3 }
        : { name: "", cat1: "學習", cat2: "", cat3: "" },
    );
    setEditTargets(targets);
  };

  const openEdit = (d: string, t: string, cell: SchedRow | undefined) => {
    setEditTargets([{ d, t }]);
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
    if (isCoveredByShift(d, t)) {
      return <div key={d} style={wePlaceholderStyle} />;
    }
    const cell = getCell(d, t);
    const col = cell
      ? CAT.deepColorFull(cell.cat1, cell.cat2 || undefined, cell.cat3 || undefined)
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Chip
          label="🏢 管理工作場所"
          active={showWpMgr}
          color={TH.accent}
          onClick={() => setShowWpMgr((v) => !v)}
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
                  const col = CAT.deepColorFull(h.cat1, h.cat2 || undefined, h.cat3 || undefined);
                  const label = h.name || h.cat3 || h.cat2 || h.cat1;
                  return (
                    <button
                      key={`hist-${i}`}
                      type="button"
                      onClick={() =>
                        setDraft({ name: h.name, cat1: h.cat1, cat2: h.cat2, cat3: h.cat3 })
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
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => {
                const data = draft.cat1
                  ? { n: draft.name, cat1: draft.cat1, cat2: draft.cat2, cat3: draft.cat3 }
                  : null;
                setCells(editTargets, data);
                if (draft.cat1) {
                  pushHistory({
                    name: draft.name,
                    cat1: draft.cat1,
                    cat2: draft.cat2,
                    cat3: draft.cat3,
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
                  setSched((s) => ({
                    ...s,
                    [dayMenu]: clip.courses.map((c) => ({ ...c })),
                  }));
                  if (clip.mode === "full" && clip.plan) {
                    const pl = clip.plan;
                    setDayPlans((prev) => ({
                      ...prev,
                      [dayMenu]: { picks: [...pl.picks] },
                    }));
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
              onClick={() => setDayMenu(null)}
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
      <div style={{ fontSize: 10, color: TH.muted }}>
        💡 一天可跨店排班；與已選班別時間重疊的會變灰、不能選
      </div>
      <div style={{ fontSize: 10, color: TH.muted }}>
        💡 點「🏢 管理工作場所」可改各班別時間；同一班別可設「不同日子不同時間」
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
        <div style={{ minWidth: 520 }}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
              background: TH.bg,
              paddingBottom: 2,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "44px repeat(7, 1fr)",
                gap: GAP,
                marginBottom: GAP,
              }}
            >
              <div
                style={{ ...timeBackdropStyle, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
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
                gridTemplateColumns: "44px repeat(7, 1fr)",
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
                      {w.shifts.map((s) => {
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
                        {row.label}
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
                      {row.label}
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
    </div>
  );
}
