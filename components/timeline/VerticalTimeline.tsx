"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { MOCK } from "@/lib/mock";
import { pctPos, pctH, buildTimelineHours, DS, DE, toM } from "@/lib/utils";
import { CFG } from "@/lib/config";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";

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
  const { PLN, ACT } = MOCK.schedule;
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
    if (!onTimeClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const mins = Math.round(DS + pct * (DE - DS));
    onTimeClick(formatMinutes(mins));
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
        {PLN.map((item, i) => {
          const override = dailyOverride[item.start];
          const startTime = override?.startTime ?? item.start;
          const endTime = override?.endTime ?? item.end;
          const top = pctPos(startTime),
            h = pctH(startTime, endTime);
          const label = override?.label ?? item.label;
          const cat1 = override?.cat1 ?? item.cat1 ?? "";
          const col = CAT.cat1Color(cat1);
          return (
            <div
              key={`p${i}`}
              onClick={(e) => {
                e.stopPropagation();
                setOverrideDraft({
                  start: item.start,
                  top,
                  label,
                  cat1: cat1 || "未分類",
                  startTime,
                  endTime,
                });
              }}
              style={{
                position: "absolute",
                top: `${top}%`,
                height: `${h}%`,
                left: 4,
                right: "47%",
                background: col ? col + "2E" : "#1F293777",
                borderRadius: 5,
                padding: "2px 5px",
                overflow: "hidden",
                zIndex: 2,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: col || "#9CA3AF",
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
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
              left: overrideDraft.start.startsWith("act_") ? "47%" : 8,
              right: overrideDraft.start.startsWith("act_") ? 8 : "47%",
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

        {ACT.map((item, i) => {
          const overrideKey = `act_${item.start}`;
          const override = dailyOverride[overrideKey];
          const startTime = override?.startTime ?? item.start;
          const endTime = override?.endTime ?? item.end;
          const top = pctPos(startTime),
            h = pctH(startTime, endTime);
          const label = override?.label ?? item.label;
          const cat1 = override?.cat1 ?? item.cat1 ?? "";
          const col = override
            ? CAT.cat1Color(cat1)
            : item.deep
              ? "#1F2937"
              : item.idle
                ? "#1E2A3A"
                : CAT.cat1Color(cat1) || "#374151";
          return (
            <div
              key={`a${i}`}
              onClick={(e) => {
                e.stopPropagation();
                setOverrideDraft({
                  start: overrideKey,
                  top,
                  label,
                  cat1: cat1 || "未分類",
                  startTime,
                  endTime,
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
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: override ? "#fff" : item.deep || item.idle ? "#4B5563" : "#fff",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
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
