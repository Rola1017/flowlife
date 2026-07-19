"use client";

import { useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { CFG } from "@/lib/config";
import { CAT } from "@/lib/categories";
import { TH } from "@/lib/theme";
import { BackBtn } from "@/components/ui/BackBtn";
import { Chip } from "@/components/ui/Chip";
import type { CoinIncomeLogRow } from "@/components/pomodoro/usePomodoro";

type PeriodFilter = "all" | "today" | "week" | "month" | "custom";

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekStartMonday(todayStr: string) {
  const d = new Date(`${todayStr}T12:00:00`);
  const dow = d.getDay();
  const diff = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - diff);
  return toDateStr(d);
}

function formatDateLabel(date: string) {
  const [y, m, day] = date.split("-");
  return y && m && day ? `${y}/${m}/${day}` : date;
}

const durLabel = (s?: string, e?: string): string => {
  if (!s || !e) return "";
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? ` · ${mins}分` : "";
};

export function CoinHistoryPage({
  coinIncomeLog,
  setCoinIncomeLog,
  onBack,
  onReconcile,
}: {
  coinIncomeLog: CoinIncomeLogRow[];
  setCoinIncomeLog: Dispatch<SetStateAction<CoinIncomeLogRow[]>>;
  onBack: () => void;
  onReconcile?: () => void;
}) {
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [view, setView] = useState<"time" | "type" | "sign">("time");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [keyword, setKeyword] = useState("");
  const [editingCoinId, setEditingCoinId] = useState<number | null>(null);
  const [editTaskName, setEditTaskName] = useState("");
  const [editCat1, setEditCat1] = useState("");
  const [editCat2, setEditCat2] = useState("");
  const [editCat3, setEditCat3] = useState("");

  const today = CFG.TODAY_STR;
  const weekStart = useMemo(() => getWeekStartMonday(today), [today]);
  const monthStart = `${today.slice(0, 7)}-01`;

  const filteredLog = useMemo(() => {
    let rows = coinIncomeLog;
    if (period === "today") {
      rows = rows.filter((r) => r.date === today);
    } else if (period === "week") {
      rows = rows.filter((r) => r.date >= weekStart && r.date <= today);
    } else if (period === "month") {
      rows = rows.filter((r) => r.date >= monthStart && r.date <= today);
    } else if (period === "custom" && customStart && customEnd) {
      const start = customStart <= customEnd ? customStart : customEnd;
      const end = customStart <= customEnd ? customEnd : customStart;
      rows = rows.filter((r) => r.date >= start && r.date <= end);
    }
    const q = keyword.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.taskName.toLowerCase().includes(q));
    return rows;
  }, [coinIncomeLog, period, today, weekStart, monthStart, customStart, customEnd, keyword]);

  const summary = useMemo(
    () => ({
      count: filteredLog.length,
      total: filteredLog.reduce((sum, r) => sum + r.amount, 0),
    }),
    [filteredLog],
  );

  const groupedLog = useMemo(
    () =>
      filteredLog.reduce(
        (acc, row) => {
          if (!acc[row.date]) acc[row.date] = [];
          acc[row.date].push(row);
          return acc;
        },
        {} as Record<string, CoinIncomeLogRow[]>,
      ),
    [filteredLog],
  );

  const sortedDates = useMemo(() => Object.keys(groupedLog).sort((a, b) => b.localeCompare(a)), [groupedLog]);

  const typeGroups = useMemo(() => {
    const grouped = filteredLog.reduce<Record<string, CoinIncomeLogRow[]>>((acc, row) => {
      const label =
        row.cat1 ||
        (row.kind === "spend"
          ? "商店消費"
          : row.kind === "opening"
            ? "期初結餘"
            : "其他");
      acc[label] = [...(acc[label] ?? []), row];
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([label, rows]) => ({
        label,
        rows: [...rows].sort((a, b) => b.at.localeCompare(a.at)),
        subtotal: rows.reduce((sum, row) => sum + row.amount, 0),
      }))
      .sort((a, b) => b.subtotal - a.subtotal);
  }, [filteredLog]);

  const signGroups = useMemo(() => {
    const income = filteredLog
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.at.localeCompare(a.at));
    const spend = filteredLog
      .filter((row) => row.amount < 0)
      .sort((a, b) => b.at.localeCompare(a.at));
    return {
      income,
      spend,
      incomeTotal: income.reduce((sum, row) => sum + row.amount, 0),
      spendTotal: spend.reduce((sum, row) => sum + Math.abs(row.amount), 0),
      balance: filteredLog.reduce((sum, row) => sum + row.amount, 0),
    };
  }, [filteredLog]);

  const fieldStyle: CSSProperties = {
    width: "100%",
    background: TH.card,
    border: `1px solid ${TH.border}`,
    borderRadius: 8,
    padding: "6px 10px",
    color: TH.text,
    fontSize: 11,
    outline: "none",
  };

  const fieldLabelStyle: CSSProperties = {
    fontSize: 11,
    color: TH.muted,
    marginBottom: 4,
  };

  const openEdit = (row: CoinIncomeLogRow) => {
    if (editingCoinId === row.id) {
      setEditingCoinId(null);
      return;
    }
    setEditingCoinId(row.id);
    setEditTaskName(row.taskName);
    const c1 = row.cat1 ?? CAT.cat1List()[0] ?? "";
    setEditCat1(c1);
    const mids = CAT.cat2List(c1);
    setEditCat2(row.cat2 && mids.includes(row.cat2) ? row.cat2 : "");
    const subs = CAT.cat3List(c1, row.cat2 ?? "");
    setEditCat3(row.cat3 && subs.includes(row.cat3) ? row.cat3 : "");
  };

  const saveEdit = (rowId: number) => {
    if (!editCat1.trim()) return;
    const newTaskName = editTaskName.trim();
    setCoinIncomeLog((log) =>
      log.map((r) =>
        r.id === rowId
          ? {
              ...r,
              taskName: newTaskName,
              cat1: editCat1,
              cat2: editCat2.trim(),
              cat3: editCat3.trim(),
            }
          : r,
      ),
    );
    setEditingCoinId(null);
  };

  const renderRow = (row: CoinIncomeLogRow) => {
    const isEditing = editingCoinId === row.id;
    const cat2Options = editCat1 ? CAT.cat2List(editCat1) : [];
    const cat3Options =
      editCat1 && editCat2 ? CAT.cat3List(editCat1, editCat2) : [];
    const displayName = row.taskName?.trim() || row.cat1 || "未命名";
    const timeLabel =
      row.startTime && row.endTime ? `${row.startTime}～${row.endTime}` : row.time;
    return (
      <div key={row.id}>
        <button
          type="button"
          onClick={() => openEdit(row)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#0A0A0C",
            borderRadius: 8,
            padding: "7px 9px",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: TH.text }}>{displayName}</div>
            {row.cat1 && (
              <div style={{ fontSize: 9, color: TH.muted, marginTop: 2, display: "flex", alignItems: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: CAT.deepColorFull(row.cat1 ?? "", row.cat2 || undefined, row.cat3 || undefined),
                    marginRight: 4,
                    verticalAlign: "middle",
                    flexShrink: 0,
                  }}
                />
                {[row.cat1, row.cat2, row.cat3].filter(Boolean).join(" › ")}
              </div>
            )}
            <div style={{ fontSize: 9, color: TH.muted }}>
              {view === "time" ? timeLabel : `${formatDateLabel(row.date)} · ${timeLabel}`}
              {durLabel(row.startTime, row.endTime)}
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              color: row.amount < 0 ? TH.red : TH.gold,
              fontWeight: 900,
            }}
          >
            {row.amount < 0 ? `${row.amount} 🪙` : `+${row.amount} 🪙`}
          </div>
        </button>
        {isEditing && (
          <div
            style={{
              background: TH.bg,
              borderRadius: 8,
              padding: "8px 9px",
              marginTop: 4,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              value={editTaskName}
              onChange={(e) => setEditTaskName(e.target.value)}
              placeholder="事件名稱"
              style={fieldStyle}
            />
            <div>
              <div style={fieldLabelStyle}>大分類</div>
              <select
                value={editCat1}
                onChange={(e) => {
                  const next = e.target.value;
                  setEditCat1(next);
                  setEditCat2("");
                  setEditCat3("");
                }}
                style={fieldStyle}
              >
                {CAT.cat1List().map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={fieldLabelStyle}>中分類</div>
              <select
                value={editCat2}
                onChange={(e) => {
                  setEditCat2(e.target.value);
                  setEditCat3("");
                }}
                disabled={!editCat1}
                style={fieldStyle}
              >
                <option value="">— 不選 —</option>
                {cat2Options.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {editCat2 && cat3Options.length > 0 && (
              <div>
                <div style={fieldLabelStyle}>小分類</div>
                <select
                  value={editCat3}
                  onChange={(e) => setEditCat3(e.target.value)}
                  style={fieldStyle}
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
                onClick={() => saveEdit(row.id)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 8,
                  border: "none",
                  background: TH.accent,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                儲存
              </button>
              <button
                type="button"
                onClick={() => setEditingCoinId(null)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 8,
                  border: `1px solid ${TH.border}`,
                  background: "transparent",
                  color: TH.muted,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGroupCard = (
    key: string,
    title: string,
    rows: CoinIncomeLogRow[],
    subtotal: number,
  ) => (
    <div
      key={key}
      style={{
        background: TH.card,
        border: `1px solid ${TH.border}`,
        borderRadius: 12,
        padding: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          gap: 8,
        }}
      >
        <span style={{ fontSize: 10, color: TH.text, fontWeight: 800 }}>
          {title} · {rows.length} 筆
        </span>
        <span
          style={{
            fontSize: 9,
            color: subtotal < 0 ? TH.red : TH.gold,
            whiteSpace: "nowrap",
          }}
        >
          小計 {subtotal > 0 ? "+" : ""}
          {subtotal} 🪙
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(renderRow)}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <BackBtn onBack={onBack} label="金幣收支" />

      <div style={{ border: `1px solid ${TH.border}`, borderRadius: 10, padding: 10, background: "#0A0A0C" }}>
        <button
          type="button"
          onClick={() => onReconcile?.()}
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: 8,
            border: `1px solid ${TH.yellow}66`,
            background: TH.yellow + "18",
            color: TH.yellow,
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          🧾 對帳：清理「番茄已不存在」的金幣紀錄
        </button>
        <div style={{ fontSize: 9, color: TH.muted, marginTop: 6, lineHeight: 1.5 }}>
          💡 早期刪番茄時可能留下沒清乾淨的金幣紀錄；按這裡會找出來、一併扣回對應金幣
        </div>
        <div style={{ fontSize: 9, color: TH.muted, marginTop: 4, lineHeight: 1.5 }}>
          💡 金幣餘額＝這張明細的總和；刪番茄會連同該筆收入一起移除，餘額自動更新
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        <Chip label="🕒 依時間" active={view === "time"} onClick={() => setView("time")} />
        <Chip label="🏷 依分類" active={view === "type"} onClick={() => setView("type")} />
        <Chip
          label="➕➖ 收入/支出"
          active={view === "sign"}
          onClick={() => setView("sign")}
        />
      </div>
      <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.5 }}>
        💡 切換檢視可以看出金幣主要來自哪一類番茄、花在哪裡
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
            style={fieldStyle}
          >
            <option value="all">全部</option>
            <option value="today">今天</option>
            <option value="week">本週</option>
            <option value="month">本月</option>
            <option value="custom">自訂</option>
          </select>
          {period === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ ...fieldStyle, flex: 1, minWidth: 0 }}
              />
              <span style={{ fontSize: 9, color: TH.muted }}>至</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ ...fieldStyle, flex: 1, minWidth: 0 }}
              />
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜尋事件名稱…"
            style={fieldStyle}
          />
        </div>
      </div>

      <div style={{ fontSize: 10, color: TH.muted }}>
        共 {summary.count} 筆 · 合計 {summary.total > 0 ? "+" : ""}
        {summary.total} 🪙
      </div>

      {view === "sign" && (
        <div style={{ display: "flex", gap: 6 }}>
          {[
            ["收入總計", signGroups.incomeTotal, TH.gold],
            ["支出總計", -signGroups.spendTotal, TH.red],
            ["餘額", signGroups.balance, signGroups.balance < 0 ? TH.red : TH.accent],
          ].map(([label, amount, color]) => (
            <div
              key={String(label)}
              style={{
                flex: 1,
                minWidth: 0,
                background: TH.card,
                border: `1px solid ${TH.border}`,
                borderRadius: 9,
                padding: "8px 5px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 8, color: TH.muted }}>{label}</div>
              <div style={{ fontSize: 12, color: String(color), fontWeight: 900 }}>
                {Number(amount) > 0 ? "+" : ""}
                {String(amount)}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredLog.length === 0 ? (
        <div style={{ fontSize: 10, color: TH.muted, textAlign: "center", padding: 16 }}>
          此範圍內沒有金幣記錄
        </div>
      ) : view === "time" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sortedDates.map((date) => {
            const rows = [...groupedLog[date]].sort((a, b) => b.at.localeCompare(a.at));
            const dayTotal = rows.reduce((sum, row) => sum + row.amount, 0);
            return renderGroupCard(date, formatDateLabel(date), rows, dayTotal);
          })}
        </div>
      ) : view === "type" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {typeGroups.map((group) =>
            renderGroupCard(group.label, group.label, group.rows, group.subtotal),
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {signGroups.income.length > 0 &&
            renderGroupCard("income", "收入", signGroups.income, signGroups.incomeTotal)}
          {signGroups.spend.length > 0 &&
            renderGroupCard(
              "spend",
              "支出",
              signGroups.spend,
              -signGroups.spendTotal,
            )}
        </div>
      )}
    </div>
  );
}
