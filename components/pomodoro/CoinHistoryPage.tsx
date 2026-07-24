"use client";

import { useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { CFG } from "@/lib/config";
import { CAT, catPath, CAT_PATH_SEP, matchesCatSelection } from "@/lib/categories";
import { TH } from "@/lib/theme";
import { BackBtn } from "@/components/ui/BackBtn";
import { Chip } from "@/components/ui/Chip";
import { MultiCategoryFilter } from "@/components/ui/MultiCategoryFilter";
import type { CoinIncomeLogRow } from "@/components/pomodoro/usePomodoro";

type PeriodFilter = "all" | "today" | "week" | "month" | "custom";
type ViewMode = "time" | "type" | "sign";
type SignTab = "summary" | "income" | "spend";

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
  const [view, setView] = useState<ViewMode>("time");
  const [signTab, setSignTab] = useState<SignTab>("summary");
  const [catSel, setCatSel] = useState<Set<string>>(new Set());
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [keyword, setKeyword] = useState("");
  const [editingCoinId, setEditingCoinId] = useState<number | null>(null);
  const [editTaskName, setEditTaskName] = useState("");
  const [editCat1, setEditCat1] = useState("");
  const [editCat2, setEditCat2] = useState("");
  const [editCat3, setEditCat3] = useState("");
  const [expandedProductCat, setExpandedProductCat] = useState<string | null>(null);

  const today = CFG.TODAY_STR;
  const weekStart = useMemo(() => getWeekStartMonday(today), [today]);
  const monthStart = `${today.slice(0, 7)}-01`;

  const switchView = (next: ViewMode) => {
    setView(next);
    setSignTab("summary");
    setCatSel(new Set());
    setExpandedProductCat(null);
  };

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

  const typeGroups = useMemo(() => {
    const grouped = filteredLog.reduce<Record<string, CoinIncomeLogRow[]>>((acc, row) => {
      const label =
        row.cat1 ||
        (row.kind === "spend"
          ? row.productCat || "商店消費"
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

  const spendProductGroups = useMemo(() => {
    const spendRows = filteredLog.filter((r) => (r.kind ?? "") === "spend" || (r.amount < 0 && !r.cat1));
    const grouped = spendRows.reduce<Record<string, CoinIncomeLogRow[]>>((acc, row) => {
      const key = row.productCat || "其他";
      acc[key] = [...(acc[key] ?? []), row];
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([label, rows]) => ({
        label,
        rows: [...rows].sort((a, b) => b.at.localeCompare(a.at)),
        subtotal: rows.reduce((sum, row) => sum + row.amount, 0),
      }))
      .sort((a, b) => a.subtotal - b.subtotal);
  }, [filteredLog]);

  const catFiltered = useMemo(
    () =>
      filteredLog
        .filter((r) => matchesCatSelection(catSel, r.cat1, r.cat2?.trim(), r.cat3?.trim()))
        .sort((a, b) => b.at.localeCompare(a.at)),
    [filteredLog, catSel],
  );

  const catFilteredTotal = useMemo(
    () => catFiltered.reduce((s, r) => s + (r.amount ?? 0), 0),
    [catFiltered],
  );

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
    const displayName = row.taskName?.trim() || row.cat1 || row.productCat || "未命名";
    const catLabel = row.cat1
      ? [row.cat1, row.cat2, row.cat3].filter(Boolean).join(" › ")
      : row.productCat;
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
            {catLabel && (
              <div style={{ fontSize: 9, color: TH.muted, marginTop: 2, display: "flex", alignItems: "center" }}>
                {row.cat1 && (
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
                )}
                {catLabel}
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
            placeholder="活動名稱"
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
    opts?: { onTitleClick?: () => void; showChevron?: boolean },
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
        role={opts?.onTitleClick ? "button" : undefined}
        tabIndex={opts?.onTitleClick ? 0 : undefined}
        onClick={opts?.onTitleClick}
        onKeyDown={(e) => {
          if (opts?.onTitleClick && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            opts.onTitleClick();
          }
        }}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          gap: 8,
          cursor: opts?.onTitleClick ? "pointer" : undefined,
        }}
      >
        <span style={{ fontSize: 10, color: TH.text, fontWeight: 800 }}>
          {title} · {rows.length} 筆
          {opts?.showChevron ? " ▸" : ""}
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

  const backBtnStyle: CSSProperties = {
    alignSelf: "flex-start",
    fontSize: 10,
    padding: "4px 10px",
    borderRadius: 8,
    border: `1px solid ${TH.border}`,
    background: "transparent",
    color: TH.muted,
    cursor: "pointer",
  };

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

      <div style={{ fontSize: 10, color: TH.text, fontWeight: 800 }}>① 先選時間區間</div>
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
            placeholder="搜尋活動名稱…"
            style={fieldStyle}
          />
        </div>
      </div>

      <div style={{ fontSize: 10, color: TH.text, fontWeight: 800 }}>② 再選要怎麼看</div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        <Chip label="🕒 依時間" active={view === "time"} onClick={() => switchView("time")} />
        <Chip
          label="➕➖ 收入/支出"
          active={view === "sign"}
          onClick={() => switchView("sign")}
        />
        <Chip label="🏷 依分類" active={view === "type"} onClick={() => switchView("type")} />
      </div>
      <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.5 }}>
        💡 先框出時間範圍，再切換「依分類」看金幣來自哪類番茄，或「收支」分別看收入與支出
      </div>

      <div style={{ fontSize: 10, color: TH.muted }}>
        共 {summary.count} 筆 · 合計 {summary.total > 0 ? "+" : ""}
        {summary.total} 🪙
      </div>

      {view === "sign" && (
        <>
          <div style={{ display: "flex", gap: 6 }}>
            {(
              [
                ["income", "收入總計", signGroups.incomeTotal, TH.gold],
                ["spend", "支出總計", -signGroups.spendTotal, TH.red],
              ] as const
            ).map(([tab, label, amount, color]) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setSignTab(tab);
                  setExpandedProductCat(null);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: TH.card,
                  border: `1px solid ${signTab === tab ? TH.accent : TH.border}`,
                  borderRadius: 9,
                  padding: "8px 5px",
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 8, color: TH.muted }}>{label}</div>
                <div style={{ fontSize: 12, color: String(color), fontWeight: 900 }}>
                  {Number(amount) > 0 ? "+" : ""}
                  {String(amount)}
                </div>
              </button>
            ))}
            <div
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
              <div style={{ fontSize: 8, color: TH.muted }}>餘額</div>
              <div
                style={{
                  fontSize: 12,
                  color: signGroups.balance < 0 ? TH.red : TH.accent,
                  fontWeight: 900,
                }}
              >
                {signGroups.balance > 0 ? "+" : ""}
                {signGroups.balance}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 9, color: TH.muted }}>
            💡 點「收入總計」或「支出總計」看該類完整列表；餘額＝收入＋支出
          </div>
        </>
      )}

      {filteredLog.length === 0 ? (
        <div style={{ fontSize: 10, color: TH.muted, textAlign: "center", padding: 16 }}>
          此範圍內沒有金幣記錄
        </div>
      ) : view === "time" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 9, color: TH.muted }}>
            💡 依時間＝所有收入與支出混在一起，最近的在最上面
          </div>
          {[...filteredLog].sort((a, b) => b.at.localeCompare(a.at)).map(renderRow)}
        </div>
      ) : view === "type" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              background: TH.card,
              border: `1px solid ${TH.border}`,
              borderRadius: 12,
              padding: 10,
            }}
          >
            <MultiCategoryFilter selected={catSel} onChange={setCatSel} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 10, color: TH.muted }}>
                已選：
                <span style={{ color: TH.text, fontWeight: 700 }}>
                  {catSel.size === 0
                    ? "（未選＝全部）"
                    : [...catSel].map((p) => p.split(CAT_PATH_SEP).join(" › ")).join("　＋　")}
                </span>
              </span>
              {catSel.size > 0 && (
                <button
                  type="button"
                  onClick={() => setCatSel(new Set())}
                  style={backBtnStyle}
                >
                  ✕ 清除分類
                </button>
              )}
            </div>
            <div style={{ fontSize: 9, color: TH.muted, marginTop: 6 }}>
              💡 可同時選多個分類一起加總；也能跨不同大分類選中分類（例：學習›金融 ＋ 閱讀›金融）
            </div>
          </div>

          {catSel.size === 0 ? (
            typeGroups.map((group) =>
              renderGroupCard(group.label, group.label, group.rows, group.subtotal),
            )
          ) : catFiltered.length === 0 ? (
            <div style={{ fontSize: 10, color: TH.muted, textAlign: "center", padding: 16 }}>
              此範圍內沒有符合的金幣記錄
            </div>
          ) : (
            renderGroupCard(
              "cat-filtered",
              `已選 ${catSel.size} 項合計`,
              catFiltered,
              catFilteredTotal,
            )
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {signTab === "summary" ? (
            <>
              {signGroups.income.length > 0 &&
                renderGroupCard("income", "收入", signGroups.income, signGroups.incomeTotal)}
              {signGroups.spend.length > 0 &&
                renderGroupCard(
                  "spend",
                  "支出",
                  signGroups.spend,
                  -signGroups.spendTotal,
                )}
            </>
          ) : (
            <>
              <button type="button" onClick={() => setSignTab("summary")} style={backBtnStyle}>
                ← 返回收支總覽
              </button>
              {signTab === "income"
                ? renderGroupCard(
                    "income-detail",
                    "收入明細（近→遠）",
                    signGroups.income,
                    signGroups.incomeTotal,
                  )
                : (
                  <>
                    <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.5 }}>
                      💡 支出可依商品分類（飲食/購物/娛樂…）看花在哪
                    </div>
                    {spendProductGroups.map((group) => {
                      const expanded = expandedProductCat === group.label;
                      return (
                        <div
                          key={group.label}
                          style={{
                            background: TH.card,
                            border: `1px solid ${expanded ? TH.accent : TH.border}`,
                            borderRadius: 12,
                            padding: 10,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedProductCat(expanded ? null : group.label)
                            }
                            style={{
                              width: "100%",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 8,
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <span style={{ fontSize: 10, color: TH.text, fontWeight: 800 }}>
                              🛒 {group.label} · {group.rows.length} 筆 {expanded ? "▾" : "▸"}
                            </span>
                            <span style={{ fontSize: 9, color: TH.red, whiteSpace: "nowrap" }}>
                              小計 {group.subtotal} 🪙
                            </span>
                          </button>
                          {expanded && (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                                marginTop: 8,
                              }}
                            >
                              {group.rows.map(renderRow)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {renderGroupCard(
                      "spend-detail",
                      "全部支出（近→遠）",
                      signGroups.spend,
                      -signGroups.spendTotal,
                    )}
                  </>
                )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
