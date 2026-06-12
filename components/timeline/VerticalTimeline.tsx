"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { pctPos, pctH, buildTimelineHours, DS, DE, toM } from "@/lib/utils";
import { CFG } from "@/lib/config";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";

const DAY_KEYS = ["日", "一", "二", "三", "四", "五", "六"]; // JS getDay() 0=日
const dateToDayKey = (dateStr: string): string => {
  const d = new Date(dateStr + "T12:00:00");
  return DAY_KEYS[d.getDay()];
};

type Place = "診" | "彩";
const PLACE_NAME: Record<Place, string> = { 診: "診所", 彩: "彩券行" };
const isMonWedFri = (day: string) => day === "一" || day === "三" || day === "五";
const shiftRangeOf = (place: Place, shift: string, day: string): [string, string] | null => {
  if (place === "診") {
    if (shift === "早") return ["08:30", "12:00"];
    if (shift === "午") return isMonWedFri(day) ? ["14:00", "18:00"] : ["14:30", "18:00"];
    if (shift === "晚") return ["18:00", "22:00"];
  } else {
    if (shift === "早") return ["07:30", "14:00"];
    if (shift === "晚") return ["14:00", "22:00"];
  }
  return null;
};

type TodoOverlay = {
  id: number;
  text: string;
  startTime: string;
  endTime: string;
  endAt?: string;
};

type DoneTodoMarker = {
  todo: TodoOverlay;
  doneEndTime: string;
  top: number;
};

type DailyOverride = Record<string, { label: string; cat1: string; startTime: string; endTime: string }>;

export function VerticalTimeline({
  nowPct,
  showNowLine = true,
  pendingTodos,
  doneTodos,
  date = CFG.TODAY_STR,
  onTimeClick,
}: {
  nowPct: number;
  showNowLine?: boolean;
  pendingTodos?: TodoOverlay[];
  doneTodos?: TodoOverlay[];
  date?: string;
  onTimeClick?: (time: string) => void;
}) {
  const hours = buildTimelineHours();

  const schedulePln = useMemo(() => {
    const dayKey = dateToDayKey(date);

    type Cell = { t: string; n: string; cat1: string; cat2: string; cat3: string };
    const week = loadJSON<Record<string, Cell[]>>(LS_KEYS.weekSchedule, {});
    const cells = week[dayKey] ?? [];

    const FIXED_BLOCKS = [
      { start: "06:30", end: "07:00", label: "😴 起床" },
      { start: "07:00", end: "07:30", label: "🍳 早餐" },
      { start: "12:00", end: "13:00", label: "🍱 午餐" },
      { start: "13:00", end: "13:30", label: "😴 午覺" },
      { start: "17:00", end: "18:00", label: "🍽️ 晚餐" },
      { start: "22:30", end: "23:00", label: "😴 睡覺" },
    ];
    const fixedBlocks = FIXED_BLOCKS.map((b) => ({
      start: b.start,
      end: b.end,
      label: b.label,
      color: "",
      kind: "fixed" as const,
    }));

    const addHalfHour = (t: string): string => {
      const [h, m] = t.split(":").map(Number);
      const total = h * 60 + m + 30;
      const nh = Math.floor(total / 60);
      const nm = total % 60;
      return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
    };

    const courseBlocks = cells.map((cell) => {
      const end = addHalfHour(cell.t);
      const label = cell.n || cell.cat3 || cell.cat2 || cell.cat1;
      const color = CAT.deepColorFull(cell.cat1, cell.cat2 || undefined, cell.cat3 || undefined);
      return { start: cell.t, end, label, color, kind: "course" as const };
    });

    type DayPlan = { place: Place; shifts: string[] };
    const dayPlans = loadJSON<Record<string, DayPlan>>(LS_KEYS.dayPlans, {});
    const plan = dayPlans[dayKey];
    const shiftBlocks = (plan?.shifts ?? []).flatMap((s) => {
      const range = plan ? shiftRangeOf(plan.place, s, dayKey) : null;
      if (!range) return [];
      return [
        {
          start: range[0],
          end: range[1],
          label: `兼差:${PLACE_NAME[plan.place]}`,
          color: CAT.cat2Color("兼差", PLACE_NAME[plan.place]),
          kind: "shift" as const,
        },
      ];
    });

    return [...fixedBlocks, ...courseBlocks, ...shiftBlocks];
  }, [date]);

  const actSessions = useMemo(() => {
    type SRow = {
      date: string;
      name?: string;
      cat1?: string;
      cat2?: string;
      cat3?: string;
      startTime?: string;
      endTime?: string;
    };
    const all = loadJSON<SRow[]>(LS_KEYS.sessions, []);
    return all
      .filter((s) => s.date === date && s.startTime && s.endTime)
      .map((s) => {
        const cat1 = s.cat1 ?? "";
        const color =
          CAT.deepColorFull(cat1, s.cat2 || undefined, s.cat3 || undefined) ||
          CAT.cat1Color(cat1) ||
          "#374151";
        return {
          start: s.startTime as string,
          end: s.endTime as string,
          label: s.name || s.cat3 || s.cat2 || cat1 || "番茄",
          color,
        };
      })
      .filter((b) => {
        const p = pctPos(b.start);
        return p >= 0 && p <= 100;
      });
  }, [date]);

  const [dailyOverride, setDailyOverride] = useState<DailyOverride>({});
  const [loadedOverrideKey, setLoadedOverrideKey] = useState("");
  const [overrideDraft, setOverrideDraft] = useState<{
    start: string;
    top: number;
    label: string;
    cat1: string;
    startTime: string;
    endTime: string;
  } | null>(null);
  const dailyOverrideKey = `${LS_KEYS.dailyOverride}${date}`;

  useEffect(() => {
    setDailyOverride(loadJSON<DailyOverride>(dailyOverrideKey, {}));
    setLoadedOverrideKey(dailyOverrideKey);
    setOverrideDraft(null);
  }, [dailyOverrideKey]);

  useEffect(() => {
    if (loadedOverrideKey !== dailyOverrideKey) return;
    saveJSON(dailyOverrideKey, dailyOverride);
  }, [dailyOverride, dailyOverrideKey, loadedOverrideKey]);

  const idleBlocks = useMemo(() => {
    const intervals: [number, number][] = [];
    for (const b of actSessions) intervals.push([toM(b.start), toM(b.end)]);
    for (const ov of Object.values(dailyOverride)) intervals.push([toM(ov.startTime), toM(ov.endTime)]);
    for (const it of schedulePln)
      if (it.kind === "shift" || it.kind === "fixed") intervals.push([toM(it.start), toM(it.end)]);

    let cutoff: number;
    if (date === CFG.TODAY_STR) cutoff = Math.round(DS + Math.min(1, Math.max(0, nowPct / 100)) * (DE - DS));
    else if (date < CFG.TODAY_STR) cutoff = DE;
    else return [];
    if (cutoff <= DS) return [];

    const clamped = intervals
      .map(([s, e]) => [Math.max(DS, s), Math.min(cutoff, e)] as [number, number])
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [s, e] of clamped) {
      const last = merged[merged.length - 1];
      if (last && s <= last[1]) last[1] = Math.max(last[1], e);
      else merged.push([s, e]);
    }

    const fmtM = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const gaps: { start: string; end: string }[] = [];
    let pos = DS;
    for (const [s, e] of merged) {
      if (s > pos) gaps.push({ start: fmtM(pos), end: fmtM(s) });
      pos = Math.max(pos, e);
    }
    if (pos < cutoff) gaps.push({ start: fmtM(pos), end: fmtM(cutoff) });
    return gaps.filter((g) => toM(g.end) - toM(g.start) >= 5);
  }, [actSessions, dailyOverride, schedulePln, date, nowPct]);

  const isVisibleTodo = (todo: TodoOverlay) => {
    const mins = toM(todo.startTime);
    const pos = pctPos(todo.startTime);
    return mins >= DS && mins <= DE && pos >= 0 && pos <= 100;
  };
  const getVisibleDoneTime = (todo: TodoOverlay) => {
    const endTime = todo.endAt?.slice(0, 5);
    if (!endTime) return null;
    const top = pctPos(endTime);
    return top >= 0 && top <= 100 ? { endTime, top } : null;
  };
  const doneTodoGroups = (doneTodos ?? []).reduce<{ top: number; items: DoneTodoMarker[] }[]>((groups, todo) => {
    const doneTime = getVisibleDoneTime(todo);
    if (!doneTime) return groups;

    const group = groups.find((g) => Math.abs(g.top - doneTime.top) < 3);
    const marker = {
      todo,
      doneEndTime: doneTime.endTime,
      top: doneTime.top,
    };

    if (group) group.items.push(marker);
    else groups.push({ top: doneTime.top, items: [marker] });

    return groups;
  }, []);
  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  const handleTimelineClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pctY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const mins = Math.round(DS + pctY * (DE - DS));
    const t = formatMinutes(mins);
    const isActSide = (e.clientX - rect.left) / rect.width >= 0.5;
    if (isActSide) {
      const endMins = Math.min(DE, mins + 30);
      setOverrideDraft({
        start: `man_${t}`,
        top: pctPos(t),
        label: "",
        cat1: "未分類",
        startTime: t,
        endTime: formatMinutes(endMins),
      });
    } else {
      onTimeClick?.(t);
    }
  };
  const saveOverride = () => {
    if (!overrideDraft?.label.trim()) return;
    setDailyOverride((prev) => ({
      ...prev,
      [overrideDraft.start]: {
        label: overrideDraft.label.trim(),
        cat1: overrideDraft.cat1,
        startTime: overrideDraft.startTime,
        endTime: overrideDraft.endTime,
      },
    }));
    setOverrideDraft(null);
  };

  return (
    <div style={{ display: "flex" }}>
      <div style={{ width: 34, flexShrink: 0, position: "relative", height: 840 }}>
        {hours.map((h) => (
          <div
            key={h.label}
            style={{
              position: "absolute",
              top: `${h.pos}%`,
              right: 4,
              fontSize: 8,
              color: TH.muted,
              transform: "translateY(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {h.label}
          </div>
        ))}
      </div>
      <div
        style={{
          flex: 1,
          position: "relative",
          height: 840,
          background: "#0D0D0F",
          borderRadius: 8,
          border: `1px solid ${TH.border}`,
        }}
        onClick={handleTimelineClick}
      >
        {schedulePln.map((item, i) => {
          const top = pctPos(item.start);
          const h = pctH(item.start, item.end);
          const col = item.color;
          const isFixed = item.kind === "fixed";
          return (
            <div
              key={`pln-${i}`}
              style={{
                position: "absolute",
                top: `${top}%`,
                height: `${h}%`,
                left: 4,
                right: "53%",
                background: isFixed ? "#1A1A22" : col ? col + "2E" : "#1F293777",
                border: item.kind === "shift" ? `1px solid ${col}66` : "none",
                borderRadius: 5,
                padding: "2px 5px",
                overflow: "hidden",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: isFixed ? "center" : "flex-start",
              }}
            >
              <div
                style={{
                  fontSize: isFixed ? 8 : 9,
                  color: isFixed ? TH.muted : col || "#9CA3AF",
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </div>
            </div>
          );
        })}

        {overrideDraft && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: `${overrideDraft.top}%`,
              left:
                overrideDraft.start.startsWith("act_") || overrideDraft.start.startsWith("man_")
                  ? "47%"
                  : 8,
              right:
                overrideDraft.start.startsWith("act_") || overrideDraft.start.startsWith("man_")
                  ? 8
                  : "47%",
              zIndex: 20,
              background: "#0A0A0C",
              border: `1px solid ${TH.accent}`,
              borderRadius: 10,
              padding: 8,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              boxShadow: "0 8px 24px rgba(0,0,0,.35)",
            }}
          >
            <input
              value={overrideDraft.label}
              onChange={(e) => setOverrideDraft((v) => (v ? { ...v, label: e.target.value } : v))}
              autoFocus
              style={{
                background: "#15151B",
                border: `1px solid ${TH.border}`,
                borderRadius: 6,
                padding: "6px 8px",
                color: TH.text,
                fontSize: 11,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="time"
                value={overrideDraft.startTime}
                onChange={(e) => setOverrideDraft((v) => (v ? { ...v, startTime: e.target.value } : v))}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "#15151B",
                  border: `1px solid ${TH.border}`,
                  borderRadius: 6,
                  padding: "6px 8px",
                  color: TH.text,
                  fontSize: 11,
                  outline: "none",
                  colorScheme: "dark",
                }}
              />
              <input
                type="time"
                value={overrideDraft.endTime}
                onChange={(e) => setOverrideDraft((v) => (v ? { ...v, endTime: e.target.value } : v))}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "#15151B",
                  border: `1px solid ${TH.border}`,
                  borderRadius: 6,
                  padding: "6px 8px",
                  color: TH.text,
                  fontSize: 11,
                  outline: "none",
                  colorScheme: "dark",
                }}
              />
            </div>
            <select
              value={overrideDraft.cat1}
              onChange={(e) => setOverrideDraft((v) => (v ? { ...v, cat1: e.target.value } : v))}
              style={{
                background: "#15151B",
                border: `1px solid ${TH.border}`,
                borderRadius: 6,
                padding: "6px 8px",
                color: TH.text,
                fontSize: 11,
                outline: "none",
              }}
            >
              {CAT.cat1List().map((cat) => (
                <option key={cat as string} value={cat as string}>
                  {cat as string}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={saveOverride}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 8px",
                  background: TH.accent,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                儲存
              </button>
              <button
                type="button"
                onClick={() => setOverrideDraft(null)}
                style={{
                  border: `1px solid ${TH.border}`,
                  borderRadius: 8,
                  padding: "6px 8px",
                  background: "transparent",
                  color: TH.muted,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {pendingTodos?.filter(isVisibleTodo).map((todo) => {
          const top = pctPos(todo.startTime);
          const hasRange = todo.endTime && todo.endTime !== todo.startTime;
          const spanH = hasRange ? Math.max(pctH(todo.startTime, todo.endTime), 2) : 0;
          return (
            <div
              key={`td-${todo.id}`}
              style={{
                position: "absolute",
                top: `${top}%`,
                height: hasRange ? `${spanH}%` : "auto",
                left: "35%",
                transform: "translateX(-50%)",
                width: "fit-content",
                maxWidth: "44%",
                zIndex: 6,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  border: `1.5px solid ${TH.yellow}`,
                  borderRadius: 4,
                  padding: "2px 6px",
                  background: "rgba(9,9,11,0.9)",
                  marginLeft: 2,
                  marginRight: 2,
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    color: TH.yellow,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {todo.text}
                </div>
                {todo.startTime && (
                  <div style={{ fontSize: 7, color: TH.yellow + "99" }}>
                    {todo.startTime}
                    {todo.endTime ? `～${todo.endTime}` : ""}
                  </div>
                )}
              </div>
              {hasRange && (
                <div
                  style={{
                    flex: 1,
                    width: 2,
                    background: TH.yellow,
                    marginTop: 1,
                    borderRadius: 1,
                    marginLeft: "auto",
                    marginRight: "auto",
                  }}
                />
              )}
            </div>
          );
        })}

        {actSessions.map((b, i) => {
          const top = pctPos(b.start),
            h = pctH(b.start, b.end);
          return (
            <div
              key={`act-ses-${i}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: `${top}%`,
                height: `${h}%`,
                left: "47%",
                right: 4,
                background: b.color,
                borderRadius: 5,
                padding: "2px 5px",
                overflow: "hidden",
                zIndex: 3,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "#111",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {b.label}
              </div>
            </div>
          );
        })}

        {Object.entries(dailyOverride).map(([key, ov]) => {
          const top = pctPos(ov.startTime),
            h = pctH(ov.startTime, ov.endTime);
          if (!(top >= 0 && top <= 100)) return null;
          const col = CAT.cat1Color(ov.cat1) || "#374151";
          return (
            <div
              key={`act-ov-${key}`}
              onClick={(e) => {
                e.stopPropagation();
                setOverrideDraft({
                  start: key,
                  top,
                  label: ov.label,
                  cat1: ov.cat1 || "未分類",
                  startTime: ov.startTime,
                  endTime: ov.endTime,
                });
              }}
              style={{
                position: "absolute",
                top: `${top}%`,
                height: `${h}%`,
                left: "47%",
                right: 4,
                background: col,
                borderRadius: 5,
                padding: "2px 5px",
                overflow: "hidden",
                zIndex: 3,
                cursor: "pointer",
                border: "1px solid #ffffff22",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "#fff",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {ov.label}
              </div>
            </div>
          );
        })}

        {doneTodoGroups.map((group, groupIndex) => {
          return (
            <div
              key={`tdd-group-${groupIndex}-${group.top}`}
              style={{
                position: "absolute",
                top: `${group.top}%`,
                left: "65%",
                transform: "translateX(-50%)",
                zIndex: 6,
                display: "flex",
                flexDirection: "row",
                gap: 0,
                pointerEvents: "none",
              }}
            >
              {group.items.map((marker) => (
                <div
                  key={`tdd-${marker.todo.id}`}
                  style={{
                    border: "1px solid #3A3A45",
                    borderRadius: 4,
                    padding: "2px 6px",
                    background: "rgba(15,15,18,0.88)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 8,
                      color: "#6B7280",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {marker.todo.text}
                  </div>
                  <div style={{ fontSize: 7, color: "#4B5563" }}>{marker.doneEndTime}</div>
                </div>
              ))}
            </div>
          );
        })}

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 1,
            background: "rgba(255,255,255,.04)",
            zIndex: 4,
            pointerEvents: "none",
          }}
        />

        {showNowLine && nowPct >= 0 && nowPct <= 100 && (
          <div
            style={{
              position: "absolute",
              top: `${nowPct}%`,
              left: 0,
              right: 0,
              height: 2,
              background: TH.red + "80",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -4,
                top: -4,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: TH.red + "80",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
