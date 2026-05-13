"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Card, SL } from "@/components/ui/Card";
import { TodoCard } from "@/components/todo/TodoCard";
import { VerticalTimeline } from "@/components/timeline/VerticalTimeline";
import { CFG, TODO_REMINDER_OPTIONS, type TodoReminderId } from "@/lib/config";
import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { MOCK } from "@/lib/mock";
import { DS, DT, toM } from "@/lib/utils";

const HOUR_OPTS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTE_OPTS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function parseDateTime(v: string | null): { date: string; hour: string; minute: string } | null {
  if (!v || typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  return {
    date: m[1],
    hour: m[2].padStart(2, "0"),
    minute: m[3].padStart(2, "0"),
  };
}

function formatDateTimeDisplay(v: string): string {
  const p = parseDateTime(v);
  if (!p) return "";
  const slash = p.date.replace(/-/g, "/");
  return `${slash}  ${p.hour}:${p.minute}`;
}

function buildDateTime(date: string, hour: string, minute: string): string {
  return `${date} ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function splitTodoDateTime(startDateTime: string | null, endDateTime: string | null): {
  date: string;
  startTime: string;
  endTime: string;
} {
  const sp = parseDateTime(startDateTime);
  const ep = parseDateTime(endDateTime);
  const date = sp?.date ?? ep?.date ?? CFG.TODAY_STR;
  const startTime = sp ? `${sp.hour}:${sp.minute}` : "";
  const endTime = ep ? `${ep.hour}:${ep.minute}` : "";
  return { date, startTime, endTime };
}

function normalizeTimelineTime(time: string): string {
  const m = time.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return "09:00";
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

type DateTimePickerProps = {
  value: string | null;
  onChange: (val: string | null) => void;
  label: string;
  enabled: boolean;
  onToggle: () => void;
};

function DateTimePicker({ value, onChange, label, enabled, onToggle }: DateTimePickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [innerFocus, setInnerFocus] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setExpanded(false);
      setInnerFocus(false);
    }
  }, [enabled]);

  const p = parseDateTime(value);
  const date = p?.date ?? CFG.TODAY_STR;
  const hour = p?.hour ?? "09";
  const minute = p?.minute ?? "00";

  const setPart = (next: { date?: string; hour?: string; minute?: string }) => {
    const d = next.date ?? date;
    const h = next.hour ?? hour;
    const mm = next.minute ?? minute;
    onChange(buildDateTime(d, h, mm));
  };

  const selectInner: CSSProperties = {
    flex: 1,
    minWidth: 0,
    background: "#15151B",
    border: `1px solid ${TH.border}`,
    borderRadius: 8,
    padding: "8px 10px",
    color: TH.text,
    fontSize: 12,
    outline: "none",
    colorScheme: "dark",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: TH.text }}>{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={(e) => {
            e.preventDefault();
            onToggle();
          }}
          style={{
            width: 48,
            height: 28,
            borderRadius: 14,
            border: "none",
            padding: 0,
            cursor: "pointer",
            background: enabled ? TH.accent : "#3A3A45",
            position: "relative",
            flexShrink: 0,
            transition: "background 0.2s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: enabled ? 23 : 3,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,.35)",
              transition: "left 0.2s",
              pointerEvents: "none",
            }}
          />
        </button>
      </div>

      {enabled && value && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            style={{
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
              background: "#15151B",
              border: `1px solid ${expanded || innerFocus ? TH.accent : TH.border}`,
              borderRadius: 12,
              padding: "10px 12px",
              color: TH.text,
              fontSize: 13,
              fontWeight: 600,
              colorScheme: "dark",
              transition: "border-color 0.15s",
            }}
          >
            {formatDateTimeDisplay(value)}
          </button>
          <div
            style={{
              maxHeight: expanded ? 220 : 0,
              overflow: "hidden",
              transition: "max-height 0.2s ease",
            }}
            onFocusCapture={() => setInnerFocus(true)}
            onBlurCapture={() => setInnerFocus(false)}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
              <input
                type="date"
                value={date}
                onChange={(e) => setPart({ date: e.target.value })}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#15151B",
                  border: `1px solid ${TH.border}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: TH.text,
                  fontSize: 12,
                  outline: "none",
                  colorScheme: "dark",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <select
                  aria-label={`${label} 小時`}
                  value={hour}
                  onChange={(e) => setPart({ hour: e.target.value })}
                  style={selectInner}
                >
                  {HOUR_OPTS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 16, fontWeight: 800, color: TH.muted, flexShrink: 0 }}>:</span>
                <select
                  aria-label={`${label} 分鐘`}
                  value={minute}
                  onChange={(e) => setPart({ minute: e.target.value })}
                  style={selectInner}
                >
                  {MINUTE_OPTS.map((mm) => (
                    <option key={mm} value={mm}>
                      {mm}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const getCurrentMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

const selectFieldStyle: CSSProperties = {
  background: "#15151B",
  border: `1px solid ${TH.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: TH.text,
  fontSize: 12,
  outline: "none",
  colorScheme: "dark",
  width: "100%",
  boxSizing: "border-box",
};

export function TimelinePage({
  todos,
  onStart,
  onEnd,
  onToggleDone,
  onAddTodo,
}: {
  todos: Record<string, unknown>[];
  onStart: (id: number) => void;
  onEnd: (id: number) => void;
  onToggleDone: (id: number) => void;
  onAddTodo: (todo: Record<string, unknown>) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({
    text: "",
    startDateTime: null as string | null,
    endDateTime: null as string | null,
    cat: CAT.cat1List()[0] as string,
    mustDo: true,
    reminder: "none" as TodoReminderId,
  });
  const [quickDraft, setQuickDraft] = useState<{
    text: string;
    startDateTime: string | null;
    endDateTime: string | null;
    cat: string;
    mustDo: boolean;
    reminder: TodoReminderId;
  } | null>(null);
  const [now, setNow] = useState(getCurrentMinutes);
  const nowPct = ((now - DS) / DT) * 100;

  useEffect(() => {
    const syncNow = () => setNow(getCurrentMinutes());
    syncNow();
    const timer = setInterval(syncNow, 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  const active = todos.filter(
    (t: { date?: string; phase?: string }) => t.date === CFG.TODAY_STR && t.phase !== "done",
  );
  const done = todos.filter(
    (t: { date?: string; phase?: string }) => t.date === CFG.TODAY_STR && t.phase === "done",
  );
  const pendingTL = active.filter(
    (t: { startTime?: string }) => t.startTime,
  ) as { id: number; text: string; startTime: string; endTime: string }[];
  const doneTL = done.filter(
    (t: { endAt?: string }) => t.endAt,
  ) as { id: number; text: string; startTime: string; endTime: string; endAt?: string }[];
  const { ACT } = MOCK.schedule;

  const submitTodo = () => {
    const text = draft.text.trim();
    if (!text) return;
    const { date, startTime, endTime } = splitTodoDateTime(draft.startDateTime, draft.endDateTime);
    onAddTodo({
      text,
      date,
      startTime,
      endTime,
      cat: draft.cat,
      mustDo: draft.mustDo,
      reminder: draft.reminder,
    });
    setDraft({
      text: "",
      startDateTime: null,
      endDateTime: null,
      cat: CAT.cat1List()[0] as string,
      mustDo: true,
      reminder: "none",
    });
    setAddOpen(false);
  };
  const submitQuickTodo = () => {
    const text = quickDraft?.text.trim();
    if (!quickDraft || !text) return;
    const { date, startTime, endTime } = splitTodoDateTime(quickDraft.startDateTime, quickDraft.endDateTime);
    onAddTodo({
      text,
      date,
      startTime,
      endTime,
      cat: quickDraft.cat,
      mustDo: quickDraft.mustDo,
      reminder: quickDraft.reminder,
    });
    setQuickDraft(null);
  };

  const quickHeader =
    quickDraft &&
    (() => {
      const a = quickDraft.startDateTime ? formatDateTimeDisplay(quickDraft.startDateTime) : "";
      const b = quickDraft.endDateTime ? formatDateTimeDisplay(quickDraft.endDateTime) : "";
      if (a && b) return `快速新增 ${a} ～ ${b}`;
      if (a) return `快速新增 ${a}`;
      if (b) return `快速新增 ${b}`;
      return "快速新增";
    })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            height: 10,
            borderRadius: 5,
            overflow: "hidden",
            background: "#1C1C22",
            position: "relative",
            marginTop: 8,
          }}
        >
          {ACT.map((item, i) => {
            const l = ((toM(item.start) - DS) / DT) * 100,
              w = ((toM(item.end) - toM(item.start)) / DT) * 100;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${l}%`,
                  width: `${w}%`,
                  height: "100%",
                  background: item.deep ? "#1F2937" : item.idle ? "#374151" : CAT.cat1Color(item.cat1 ?? "") || "#6B7280",
                }}
              />
            );
          })}
        </div>
        <VerticalTimeline
          nowPct={nowPct}
          pendingTodos={pendingTL}
          doneTodos={doneTL}
          date={CFG.TODAY_STR}
          onTimeClick={(time) => {
            const hm = normalizeTimelineTime(time);
            setQuickDraft({
              text: "",
              startDateTime: `${CFG.TODAY_STR} ${hm}`,
              endDateTime: null,
              cat: "未分類",
              mustDo: true,
              reminder: "none",
            });
          }}
        />
      </div>
      <Card style={{ padding: "8px 12px" }}>
        <SL>今日待辦</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
          {active.map((t) => (
            <TodoCard key={t.id as number} todo={t} onStart={onStart} onEnd={onEnd} onToggleDone={onToggleDone} />
          ))}
        </div>
        {done.length > 0 && (
          <>
            <div style={{ fontSize: 9, color: TH.muted, marginBottom: 4 }}>✅ 已完成</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {done.map((t) => (
                <TodoCard key={t.id as number} todo={t} onStart={onStart} onEnd={onEnd} onToggleDone={onToggleDone} />
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "8px",
            borderRadius: 10,
            border: `1px dashed ${TH.accent}`,
            background: addOpen ? TH.accent + "12" : "transparent",
            color: TH.accent,
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ＋ 新增待辦
        </button>
        {addOpen && (
          <div
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 12,
              border: `1px solid ${TH.border}`,
              background: "#0A0A0C",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <input
              value={draft.text}
              onChange={(e) => setDraft((v) => ({ ...v, text: e.target.value }))}
              placeholder="事件名稱（必填）"
              style={{
                background: "#15151B",
                border: `1px solid ${TH.border}`,
                borderRadius: 8,
                padding: "8px 10px",
                color: TH.text,
                fontSize: 12,
                outline: "none",
              }}
            />
            <DateTimePicker
              label="開始時間"
              value={draft.startDateTime}
              enabled={draft.startDateTime !== null}
              onToggle={() =>
                setDraft((v) => ({
                  ...v,
                  startDateTime:
                    v.startDateTime === null ? `${CFG.TODAY_STR} 09:00` : null,
                }))
              }
              onChange={(val) => setDraft((v) => ({ ...v, startDateTime: val }))}
            />
            <DateTimePicker
              label="結束時間"
              value={draft.endDateTime}
              enabled={draft.endDateTime !== null}
              onToggle={() =>
                setDraft((v) => ({
                  ...v,
                  endDateTime: v.endDateTime === null ? `${CFG.TODAY_STR} 10:00` : null,
                }))
              }
              onChange={(val) => setDraft((v) => ({ ...v, endDateTime: val }))}
            />
            <label style={{ fontSize: 10, color: TH.muted, marginBottom: -4 }}>提醒</label>
            <select
              value={draft.reminder}
              onChange={(e) =>
                setDraft((v) => ({ ...v, reminder: e.target.value as TodoReminderId }))
              }
              style={selectFieldStyle}
            >
              {TODO_REMINDER_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={draft.cat}
              onChange={(e) => setDraft((v) => ({ ...v, cat: e.target.value }))}
              style={selectFieldStyle}
            >
              {CAT.cat1List().map((cat) => (
                <option key={cat as string} value={cat as string}>
                  {cat as string}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setDraft((v) => ({ ...v, mustDo: !v.mustDo }))}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${draft.mustDo ? TH.red : TH.border}`,
                background: draft.mustDo ? TH.red + "16" : "transparent",
                color: draft.mustDo ? TH.red : TH.muted,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {draft.mustDo ? "🔴 必做" : "⚪ 非必做"}
            </button>
            <button
              className="flowlife-pressable"
              type="button"
              onClick={submitTodo}
              disabled={!draft.text.trim()}
              style={{
                padding: "10px",
                borderRadius: 10,
                border: "none",
                background: draft.text.trim() ? TH.accent : "#374151",
                color: draft.text.trim() ? "#fff" : "#6B7280",
                fontSize: 12,
                fontWeight: 900,
                cursor: draft.text.trim() ? "pointer" : "not-allowed",
                transition: "transform .12s, filter .12s",
              }}
            >
              確認新增
            </button>
          </div>
        )}
      </Card>
      {quickDraft && (
        <Card style={{ padding: 10 }}>
          <SL>{quickHeader}</SL>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              value={quickDraft.text}
              onChange={(e) => setQuickDraft((v) => (v ? { ...v, text: e.target.value } : v))}
              placeholder="輸入待辦名稱..."
              autoFocus
              style={{
                background: "#15151B",
                border: `1px solid ${TH.border}`,
                borderRadius: 8,
                padding: "8px 10px",
                color: TH.text,
                fontSize: 12,
                outline: "none",
              }}
            />
            <DateTimePicker
              label="開始時間"
              value={quickDraft.startDateTime}
              enabled={quickDraft.startDateTime !== null}
              onToggle={() =>
                setQuickDraft((v) =>
                  v
                    ? {
                        ...v,
                        startDateTime:
                          v.startDateTime === null ? `${CFG.TODAY_STR} 09:00` : null,
                      }
                    : v,
                )
              }
              onChange={(val) => setQuickDraft((v) => (v ? { ...v, startDateTime: val } : v))}
            />
            <DateTimePicker
              label="結束時間"
              value={quickDraft.endDateTime}
              enabled={quickDraft.endDateTime !== null}
              onToggle={() =>
                setQuickDraft((v) =>
                  v
                    ? {
                        ...v,
                        endDateTime: v.endDateTime === null ? `${CFG.TODAY_STR} 10:00` : null,
                      }
                    : v,
                )
              }
              onChange={(val) => setQuickDraft((v) => (v ? { ...v, endDateTime: val } : v))}
            />
            <label style={{ fontSize: 10, color: TH.muted, marginBottom: -4 }}>提醒</label>
            <select
              value={quickDraft.reminder}
              onChange={(e) =>
                setQuickDraft((v) =>
                  v ? { ...v, reminder: e.target.value as TodoReminderId } : v,
                )
              }
              style={selectFieldStyle}
            >
              {TODO_REMINDER_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={quickDraft.cat}
              onChange={(e) => setQuickDraft((v) => (v ? { ...v, cat: e.target.value } : v))}
              style={selectFieldStyle}
            >
              {CAT.cat1List().map((cat) => (
                <option key={cat as string} value={cat as string}>
                  {cat as string}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setQuickDraft((v) => (v ? { ...v, mustDo: !v.mustDo } : v))}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${quickDraft.mustDo ? TH.red : TH.border}`,
                background: quickDraft.mustDo ? TH.red + "16" : "transparent",
                color: quickDraft.mustDo ? TH.red : TH.muted,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {quickDraft.mustDo ? "🔴 必做" : "⚪ 非必做"}
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="flowlife-pressable"
                type="button"
                onClick={submitQuickTodo}
                disabled={!quickDraft.text.trim()}
                style={{
                  flex: 1,
                  padding: "9px 10px",
                  borderRadius: 10,
                  border: "none",
                  background: quickDraft.text.trim() ? TH.accent : "#374151",
                  color: quickDraft.text.trim() ? "#fff" : "#6B7280",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: quickDraft.text.trim() ? "pointer" : "not-allowed",
                }}
              >
                新增待辦
              </button>
              <button
                type="button"
                onClick={() => setQuickDraft(null)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: `1px solid ${TH.border}`,
                  background: "transparent",
                  color: TH.muted,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                取消
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
