"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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

type RowDef =
  | { kind: "fixed"; times: string[]; label: string; span: "all" | "weekday" }
  | { kind: "class"; time: string };

type Place = "診" | "彩";

type DayPlan = { place: Place; shifts: string[] };

const PLACE_NAME: Record<Place, string> = { 診: "診所", 彩: "彩券行" };
const PLACE_SHIFTS: Record<Place, string[]> = { 診: ["早", "午", "晚"], 彩: ["早", "晚"] };

const DEFAULT_PLANS: Record<string, DayPlan> = {
  一: { place: "診", shifts: ["晚"] },
  二: { place: "診", shifts: ["晚"] },
  三: { place: "診", shifts: ["晚"] },
  四: { place: "診", shifts: ["晚"] },
  五: { place: "診", shifts: ["晚"] },
  六: { place: "彩", shifts: ["晚"] },
  日: { place: "彩", shifts: ["晚"] },
};

const ROWS: RowDef[] = [
  { kind: "fixed", times: ["06:30"], label: "😴 起床", span: "all" },
  { kind: "fixed", times: ["07:00"], label: "🍳 早餐", span: "all" },
  { kind: "class", time: "07:30" },
  { kind: "class", time: "08:00" },
  { kind: "class", time: "08:30" },
  { kind: "class", time: "09:00" },
  { kind: "class", time: "09:30" },
  { kind: "class", time: "10:00" },
  { kind: "class", time: "10:30" },
  { kind: "class", time: "11:00" },
  { kind: "class", time: "11:30" },
  { kind: "fixed", times: ["12:00", "12:30"], label: "🍱 午餐", span: "all" },
  { kind: "fixed", times: ["13:00"], label: "😴 午覺", span: "all" },
  { kind: "class", time: "13:30" },
  { kind: "class", time: "14:00" },
  { kind: "class", time: "14:30" },
  { kind: "class", time: "15:00" },
  { kind: "class", time: "15:30" },
  { kind: "class", time: "16:00" },
  { kind: "class", time: "16:30" },
  { kind: "fixed", times: ["17:00", "17:30"], label: "🍽️ 晚餐", span: "all" },
  { kind: "class", time: "18:00" },
  { kind: "class", time: "18:30" },
  { kind: "class", time: "19:00" },
  { kind: "class", time: "19:30" },
  { kind: "class", time: "20:00" },
  { kind: "class", time: "20:30" },
  { kind: "class", time: "21:00" },
  { kind: "class", time: "21:30" },
  { kind: "class", time: "22:00" },
  { kind: "fixed", times: ["22:30"], label: "😴 睡覺", span: "all" },
];

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

const isMonWedFri = (day: string) => day === "一" || day === "三" || day === "五";

const shiftTimes = (place: Place, shift: string, day: string): string[] => {
  if (place === "診") {
    if (shift === "早")
      return ["08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];
    if (shift === "午")
      return isMonWedFri(day)
        ? ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"]
        : ["14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"];
    if (shift === "晚")
      return ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];
  } else {
    if (shift === "早")
      return [
        "07:30",
        "08:00",
        "08:30",
        "09:00",
        "09:30",
        "10:00",
        "10:30",
        "11:00",
        "11:30",
        "12:00",
        "12:30",
        "13:00",
        "13:30",
      ];
    if (shift === "晚")
      return [
        "14:00",
        "14:30",
        "15:00",
        "15:30",
        "16:00",
        "16:30",
        "17:00",
        "17:30",
        "18:00",
        "18:30",
        "19:00",
        "19:30",
        "20:00",
        "20:30",
        "21:00",
        "21:30",
      ];
  }
  return [];
};

const shiftRange = (place: Place, shift: string, day: string): string => {
  if (place === "診") {
    if (shift === "早") return "08:30~12:00";
    if (shift === "午") return isMonWedFri(day) ? "14:00~18:00" : "14:30~18:00";
    if (shift === "晚") return "18:00~22:00";
  } else {
    if (shift === "早") return "07:30~14:00";
    if (shift === "晚") return "14:00~22:00";
  }
  return "";
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

export function SchedulePage({
  onBack,
  onShowCategoryManager,
}: {
  onBack: () => void;
  onShowCategoryManager: () => void;
}) {
  const [sched, setSched] = useState<Record<string, SchedRow[]>>(() =>
    normalizeSchedule(
      loadJSON(LS_KEYS.weekSchedule, MOCK.weekdaySchedule as Record<string, RawSchedRow[]>),
    ),
  );
  const [dayPlans, setDayPlans] = useState<Record<string, DayPlan>>(() => {
    const loaded = loadJSON<Record<string, DayPlan>>(LS_KEYS.dayPlans, {});
    const merged: Record<string, DayPlan> = {};
    for (const d of DAYS) merged[d] = loaded[d] ?? DEFAULT_PLANS[d] ?? { place: "彩", shifts: [] };
    return merged;
  });
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
  const placeColor = (place: Place) => CAT.cat2Color("兼差", PLACE_NAME[place]);

  const shiftTimesForDay = (day: string): string[] => {
    const plan = dayPlans[day];
    if (!plan) return [];
    return plan.shifts.flatMap((s) => shiftTimes(plan.place, s, day));
  };

  const isCoveredByShift = (day: string, time: string): boolean =>
    shiftTimesForDay(day).includes(time);

  const togglePlace = (day: string) => {
    setDayPlans((prev) => {
      const cur = prev[day];
      const newPlace: Place = cur.place === "診" ? "彩" : "診";
      const valid = PLACE_SHIFTS[newPlace];
      return {
        ...prev,
        [day]: { place: newPlace, shifts: cur.shifts.filter((s) => valid.includes(s)) },
      };
    });
  };

  const toggleShift = (day: string, shift: string) => {
    setDayPlans((prev) => {
      const cur = prev[day];
      const shifts = cur.shifts.includes(shift)
        ? cur.shifts.filter((s) => s !== shift)
        : [...cur.shifts, shift];
      return { ...prev, [day]: { ...cur, shifts } };
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    saveJSON(LS_KEYS.weekSchedule, sched);
  }, [sched]);

  useEffect(() => {
    saveJSON(LS_KEYS.dayPlans, dayPlans);
  }, [dayPlans]);

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
              color: col ?? undefined,
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
              <div style={{ fontSize: 9, color: TH.muted, textAlign: "center", alignSelf: "end" }}>
                時間
              </div>
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "44px repeat(7, 1fr)",
                gap: GAP,
                marginBottom: GAP,
              }}
            >
              <div />
              {DAYS.map((d) => {
                const plan = dayPlans[d];
                const shiftsOfPlace = PLACE_SHIFTS[plan.place];
                return (
                  <div
                    key={`plan-${d}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      alignItems: "center",
                    }}
                  >
                    <Chip
                      label="診"
                      active={plan.place === "診"}
                      color={TH.cyan}
                      onClick={() => togglePlace(d)}
                      style={{ fontSize: 8, padding: "2px 6px", width: "100%", textAlign: "center" }}
                    />
                    {shiftsOfPlace.map((s) => (
                      <Chip
                        key={s}
                        label={s}
                        active={plan.shifts.includes(s)}
                        color={placeColor(plan.place)}
                        onClick={() => toggleShift(d, s)}
                        style={{ fontSize: 8, padding: "2px 6px", width: "100%", textAlign: "center" }}
                      />
                    ))}
                  </div>
                );
              })}
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
                      <div style={timeColStyleFor(row.times[0])}>{row.times[0]}</div>
                      <div style={{ ...fixedCellStyle, gridColumn: "2 / -1", height: "100%" }}>
                        {row.label}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={row.times.join("-")} style={fixedRowStyle}>
                    <div style={timeColStyleFor(row.times[0])}>{row.times[0]}</div>
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
                  <div style={timeColStyleFor(row.time)}>{row.time}</div>
                  {DAYS.map((d) => renderClassCell(d, row.time))}
                </div>
              );
            })}

            {DAYS.flatMap((day, dayColIndex) => {
              const plan = dayPlans[day];
              if (!plan) return [];
              return plan.shifts
                .map((shiftKey) => {
                  const times = shiftTimes(plan.place, shiftKey, day);
                  const coveredIdx = HALF_SLOTS.map((t, i) =>
                    times.includes(t) ? i : -1,
                  ).filter((i) => i >= 0);
                  if (coveredIdx.length === 0) return null;
                  const firstIdx = coveredIdx[0];
                  const count = coveredIdx.length;
                  const top = firstIdx * STEP;
                  const height = count * STEP - GAP;
                  const [rangeStart, rangeEnd] = shiftRange(plan.place, shiftKey, day).split("~");
                  const col = placeColor(plan.place);

                  return (
                    <div
                      key={`shift-${day}-${shiftKey}`}
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
                          color: col,
                          fontSize: 8,
                          fontWeight: 700,
                          lineHeight: 1.2,
                        }}
                      >
                        {`兼差:${PLACE_NAME[plan.place]}`}
                      </span>
                      <span
                        style={{
                          color: col,
                          fontSize: 8,
                          fontWeight: 700,
                          lineHeight: 1.2,
                        }}
                      >
                        {rangeStart}
                      </span>
                      <span style={{ color: col, fontSize: 7, lineHeight: 1 }}>～</span>
                      <span
                        style={{
                          color: col,
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
