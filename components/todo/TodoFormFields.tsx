"use client";

import { type CSSProperties } from "react";
import { CategorySelector } from "@/components/pomodoro/CategorySelector";
import { CatBadge } from "@/components/pomodoro/CatBadge";
import { TodoDateRangePicker } from "@/components/ui/TodoDateRangePicker";
import { CFG, TODO_REMINDER_OPTIONS, type TodoReminderId } from "@/lib/config";
import { useTagsSnapshot } from "@/components/hooks/useTagsSnapshot";
import { canStartWithTags, missingRequiredGroupNames, selFromTagIds } from "@/lib/tagSelect";
import { loadTagGroups, loadTags } from "@/lib/tagsStore";
import { TH } from "@/lib/theme";
import { stampTodoTags, uncategorizedRootTagId } from "@/lib/todoTags";
import type { Todo } from "@/lib/types";

export type TodoFormDraft = {
  text: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  deadline?: string;
  estimateHours?: number;
  reminder: TodoReminderId;
  tagIds: string[];
  mustDo: boolean;
  error: string;
};

const EST_PRESETS = [
  { label: "30分", hours: 0.5 },
  { label: "1小時", hours: 1 },
  { label: "半天", hours: 4 },
  { label: "1天", hours: 8 },
  { label: "3天", hours: 24 },
] as const;

const fieldStyle: CSSProperties = {
  background: "#15151B",
  border: `1px solid ${TH.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: TH.text,
  fontSize: 12,
  outline: "none",
  colorScheme: "dark",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

const tip: CSSProperties = { fontSize: 9, color: TH.muted, lineHeight: 1.4 };

function normalizeReminder(r: unknown): TodoReminderId {
  const s = typeof r === "string" ? r : "none";
  return TODO_REMINDER_OPTIONS.some((o) => o.id === s) ? (s as TodoReminderId) : "none";
}

export function createTodoFormDraft(defaultDate: string, extras?: Partial<TodoFormDraft>): TodoFormDraft {
  const uncat = uncategorizedRootTagId();
  return {
    text: "",
    date: defaultDate,
    endDate: undefined,
    startTime: undefined,
    endTime: undefined,
    deadline: undefined,
    estimateHours: undefined,
    reminder: "none",
    tagIds: uncat ? [uncat] : [],
    mustDo: true,
    error: "",
    ...extras,
  };
}

export function todoToFormDraft(todo: Todo): TodoFormDraft {
  return createTodoFormDraft(todo.date, {
    text: todo.text ?? "",
    date: todo.date,
    endDate: todo.endDate,
    startTime: todo.startTime,
    endTime: todo.endTime,
    deadline: todo.deadline,
    estimateHours: todo.estimateHours,
    reminder: normalizeReminder(todo.reminder),
    tagIds: todo.tagIds?.length ? [...todo.tagIds] : [],
    mustDo: Boolean(todo.mustDo),
  });
}

export function todoDraftCanSubmit(d: TodoFormDraft): boolean {
  if (!d.text.trim()) return false;
  return canStartWithTags(d.tagIds, loadTagGroups(), loadTags());
}

export function formDraftToTodoPatch(
  d: TodoFormDraft,
): { ok: true; patch: Partial<Todo> } | { ok: false; error: string } {
  const text = d.text.trim();
  if (!text) return { ok: false, error: "請輸入活動名稱" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return { ok: false, error: "請選擇日期" };
  if (d.endDate && d.endDate < d.date) return { ok: false, error: "結束日期不能早於開始日期" };
  const sameDay = !d.endDate || d.endDate === d.date;
  if (sameDay && d.startTime && d.endTime && d.endTime <= d.startTime) {
    return { ok: false, error: "結束時間不能早於開始時間" };
  }
  const tags = loadTags();
  const groups = loadTagGroups();
  if (!canStartWithTags(d.tagIds, groups, tags)) {
    const missing = missingRequiredGroupNames(d.tagIds, groups, tags);
    return { ok: false, error: missing.length ? `請選擇：${missing.join("、")}` : "請選擇標籤" };
  }
  const deadline = d.deadline?.trim();
  const stamped = stampTodoTags(
    {
      id: 0,
      text,
      cat: "未分類",
      date: d.date,
      phase: "pending",
      tagIds: d.tagIds,
    },
    tags,
  );
  return {
    ok: true,
    patch: {
      text,
      date: d.date,
      endDate: d.endDate && d.endDate > d.date ? d.endDate : undefined,
      startTime: d.startTime || undefined,
      endTime: d.endTime || undefined,
      deadline: deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : undefined,
      estimateHours: typeof d.estimateHours === "number" && d.estimateHours > 0 ? d.estimateHours : undefined,
      reminder: d.reminder,
      tagIds: stamped.tagIds,
      cat: stamped.cat,
      mustDo: d.mustDo,
    },
  };
}

export function TodoFormFields({
  draft,
  setDraft,
  defaultStartTime,
  defaultEndTime,
  autoFocusName,
}: {
  draft: TodoFormDraft;
  setDraft: (fn: (v: TodoFormDraft) => TodoFormDraft) => void;
  defaultStartTime?: string;
  defaultEndTime?: string;
  autoFocusName?: boolean;
}) {
  const { tags, groups } = useTagsSnapshot();
  const hours = draft.estimateHours;
  const customStr =
    hours != null && !EST_PRESETS.some((p) => p.hours === hours) ? String(hours) : hours != null ? String(hours) : "";
  const missing = missingRequiredGroupNames(draft.tagIds, groups, tags);
  const sel = selFromTagIds(draft.tagIds, tags);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <input
        value={draft.text}
        onChange={(e) => setDraft((v) => ({ ...v, text: e.target.value, error: "" }))}
        placeholder="活動名稱（必填）"
        autoFocus={autoFocusName}
        style={fieldStyle}
      />
      <TodoDateRangePicker
        value={{
          date: draft.date,
          endDate: draft.endDate,
          startTime: draft.startTime,
          endTime: draft.endTime,
        }}
        defaultStartTime={defaultStartTime}
        defaultEndTime={defaultEndTime}
        hint={
          <div style={tip}>
            💡 只設日期＝排定這天做；開「結束日期」＝這段期間內有空就做，每天都會顯示，直到你按結束
          </div>
        }
        onChange={(next) =>
          setDraft((v) => ({
            ...v,
            date: next.date,
            endDate: next.endDate,
            startTime: next.startTime,
            endTime: next.endTime,
            error: "",
          }))
        }
      />
      {draft.date && draft.date < CFG.TODAY_STR ? (
        <div style={tip}>💡 這是過去的日期，會記錄為當天的事</div>
      ) : null}
      <label style={{ fontSize: 10, color: TH.muted }}>⏳ 期限（選填）</label>
      <input
        type="date"
        value={draft.deadline ?? ""}
        onChange={(e) => setDraft((v) => ({ ...v, deadline: e.target.value || undefined, error: "" }))}
        style={fieldStyle}
      />
      <div style={tip}>💡 期限＝最晚必須完成的日子（例如取件期限）。它不會因為你把計畫挪到別天而改變</div>
      <label style={{ fontSize: 10, color: TH.muted }}>⏱ 預估用時（選填）</label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box",
            WebkitOverflowScrolling: "touch",
            flex: 1,
          }}
        >
          {EST_PRESETS.map((p) => {
            const active = hours === p.hours;
            return (
              <button
                key={p.hours}
                type="button"
                onClick={() =>
                  setDraft((v) => ({
                    ...v,
                    estimateHours: v.estimateHours === p.hours ? undefined : p.hours,
                    error: "",
                  }))
                }
                style={{
                  flexShrink: 0,
                  minHeight: 40,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: `1px solid ${active ? TH.accent : TH.border}`,
                  background: active ? TH.accent + "22" : "transparent",
                  color: active ? TH.accent : TH.muted,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.5}
          placeholder="時"
          value={customStr}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              setDraft((v) => ({ ...v, estimateHours: undefined, error: "" }));
              return;
            }
            const n = Number(raw);
            setDraft((v) => ({
              ...v,
              estimateHours: Number.isFinite(n) && n > 0 ? n : undefined,
              error: "",
            }));
          }}
          style={{
            ...fieldStyle,
            width: 64,
            flexShrink: 0,
            minHeight: 40,
            padding: "8px 6px",
            textAlign: "center",
          }}
        />
      </div>
      <div style={tip}>💡 填了用時，快到期時會更早提醒你（例如要做 3 天的事，不會等到剩 1 天才說）。1天＝8小時工作量</div>
      <label style={{ fontSize: 10, color: TH.muted }}>提醒</label>
      <select
        value={draft.reminder}
        onChange={(e) => setDraft((v) => ({ ...v, reminder: e.target.value as TodoReminderId }))}
        style={fieldStyle}
      >
        {TODO_REMINDER_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <label style={{ fontSize: 10, color: TH.muted }}>標籤</label>
      <CategorySelector
        tagIds={draft.tagIds}
        cat1={sel.cat1}
        cat2={sel.cat2}
        cat3={sel.cat3}
        onChange={(n) => setDraft((v) => ({ ...v, tagIds: n.tagIds, error: "" }))}
        showQuickLane
      />
      {draft.tagIds.length > 0 ? (
        <div style={{ fontSize: 10, color: TH.muted }}>
          已選：
          <CatBadge tagIds={draft.tagIds} />
        </div>
      ) : null}
      {missing.length > 0 ? (
        <div style={{ fontSize: 11, color: TH.red, fontWeight: 700 }}>請選擇：{missing.join("、")}</div>
      ) : null}
      <div style={tip}>💡 定義：待辦現在和番茄用同一套標籤。</div>
      <div style={tip}>💡 用法：新增／編輯至少選一個領域標籤（可選「未分類」）。</div>
      <div style={tip}>💡 範例：一則待辦同時貼「學習」和「法律」，兩邊篩選都看得到它。</div>
      <button
        type="button"
        onClick={() => setDraft((v) => ({ ...v, mustDo: !v.mustDo }))}
        style={{
          padding: "8px 10px",
          minHeight: 40,
          borderRadius: 10,
          border: `1px solid ${draft.mustDo ? TH.red : TH.border}`,
          background: draft.mustDo ? TH.red + "16" : "transparent",
          color: draft.mustDo ? TH.red : TH.muted,
          fontSize: 12,
          fontWeight: 800,
          cursor: "pointer",
          boxSizing: "border-box",
        }}
      >
        {draft.mustDo ? "🔴 必做" : "⚪ 非必做"}
      </button>
      {draft.error ? <div style={{ fontSize: 11, color: TH.red, textAlign: "center" }}>⚠️ {draft.error}</div> : null}
    </div>
  );
}
