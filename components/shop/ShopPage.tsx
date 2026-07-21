"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { TH } from "@/lib/theme";
import { MOCK } from "@/lib/mock";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { APP_STATE_KEYS, pushAppState, subscribeAppState } from "@/lib/appStateCloud";
import type { ShopItem } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { BackBtn } from "@/components/ui/BackBtn";
import { CategorySelector } from "@/components/pomodoro/CategorySelector";
import type { CoinIncomeLogRow } from "@/components/pomodoro/usePomodoro";

const emptyDraft = {
  name: "",
  desc: "",
  kind: "instant" as "instant" | "time",
  price: "",
  coinsPerMin: "",
  cat1: "",
  cat2: "",
  cat3: "",
  productCat: "娛樂",
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#0A0A0C",
  border: `1px solid ${TH.border}`,
  borderRadius: 6,
  padding: "6px 10px",
  color: TH.text,
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
  marginBottom: 6,
};

export function ShopPage({
  coins,
  onSpend,
  spendRows,
  allSpendRows,
  onRefundSpend,
  onBack,
}: {
  coins: number;
  onSpend: (amount: number, label?: string) => boolean;
  spendRows?: CoinIncomeLogRow[];
  allSpendRows?: CoinIncomeLogRow[];
  onRefundSpend?: (rowId: number) => void;
  onBack: () => void;
}) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [notice, setNotice] = useState("");

  const updateShopItems = (next: ShopItem[]) => {
    setItems(next);
    saveJSON(LS_KEYS.shopItems, next);
    void pushAppState(APP_STATE_KEYS.shopItems, next);
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1800);
  };

  useEffect(() => {
    const saved = loadJSON<ShopItem[] | null>(LS_KEYS.shopItems, null);
    if (saved && Array.isArray(saved)) {
      setItems(saved);
    } else {
      const seeded: ShopItem[] = (MOCK.shopItems ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        desc: m.desc,
        kind: "instant" as const,
        price: m.price,
        productCat: "其他",
      }));
      setItems(seeded);
      saveJSON(LS_KEYS.shopItems, seeded);
      void pushAppState(APP_STATE_KEYS.shopItems, seeded);
    }
  }, []);

  useEffect(
    () =>
      subscribeAppState(APP_STATE_KEYS.shopItems, () =>
        setItems(loadJSON<ShopItem[]>(LS_KEYS.shopItems, [])),
      ),
    [],
  );

  const purchaseGroups = useMemo(() => {
    const rows = allSpendRows ?? spendRows ?? [];
    const grouped = rows.reduce<Record<string, CoinIncomeLogRow[]>>((acc, r) => {
      acc[r.date] = [...(acc[r.date] ?? []), r];
      return acc;
    }, {});
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, rs]) => ({
        date,
        rows: rs.sort((a, b) => b.at.localeCompare(a.at)),
        total: rs.reduce((s, r) => s + Math.abs(r.amount), 0),
      }));
  }, [allSpendRows, spendRows]);

  const openEdit = (it: ShopItem) => {
    setEditingId(it.id);
    setDraft({
      name: it.name,
      desc: it.desc ?? "",
      kind: it.kind,
      price: it.price != null ? String(it.price) : "",
      coinsPerMin: it.coinsPerMin != null ? String(it.coinsPerMin) : "",
      cat1: it.cat1 ?? "",
      cat2: it.cat2 ?? "",
      cat3: it.cat3 ?? "",
      productCat: it.productCat ?? "娛樂",
    });
    setAddOpen(true);
  };

  const saveDraft = () => {
    if (!draft.name.trim()) return;
    if (draft.kind === "instant" && !draft.price) return;
    if (draft.kind === "time" && !draft.coinsPerMin) return;
    const item: ShopItem = {
      id: editingId ?? Date.now(),
      name: draft.name.trim(),
      desc: draft.desc.trim() || undefined,
      kind: draft.kind,
      productCat: draft.productCat || "其他",
      ...(draft.kind === "instant"
        ? { price: Number(draft.price) }
        : {
            coinsPerMin: Number(draft.coinsPerMin),
            cat1: draft.cat1 || undefined,
            cat2: draft.cat2 || undefined,
            cat3: draft.cat3 || undefined,
          }),
    };
    updateShopItems(editingId ? items.map((i) => (i.id === editingId ? item : i)) : [...items, item]);
    setDraft(emptyDraft);
    setEditingId(null);
    setAddOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackBtn onBack={onBack} label="商店" />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <span>🪙</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: TH.gold }}>{coins.toLocaleString()}</span>
        </div>
      </div>
      {notice && (
        <div
          style={{
            border: `1px solid ${TH.red}55`,
            background: TH.red + "14",
            color: TH.red,
            borderRadius: 10,
            padding: "8px 10px",
            fontSize: 12,
            fontWeight: 800,
            textAlign: "center",
          }}
        >
          {notice}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setEditingId(null);
          setDraft(emptyDraft);
          setAddOpen(!addOpen);
        }}
        style={{
          padding: "9px",
          borderRadius: 10,
          border: `1px dashed ${TH.accent}`,
          background: "transparent",
          color: TH.accent,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ＋ 新增商品
      </button>
      {addOpen && (
        <Card style={{ border: `1px solid ${TH.accent}44` }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {(["instant", "time"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDraft({ ...draft, kind: k })}
                style={{
                  flex: 1,
                  padding: "6px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `1px solid ${draft.kind === k ? TH.accent : TH.border}`,
                  background: draft.kind === k ? TH.accent : "transparent",
                  color: draft.kind === k ? "#fff" : TH.muted,
                }}
              >
                {k === "instant" ? "一次性商品" : "⏱ 計時商品"}
              </button>
            ))}
          </div>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="商品名稱"
            style={inputStyle}
          />
          <input
            value={draft.desc}
            onChange={(e) => setDraft({ ...draft, desc: e.target.value })}
            placeholder="說明（可留空）"
            style={inputStyle}
          />
          {draft.kind === "instant" ? (
            <input
              type="number"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              placeholder="金幣價格"
              style={inputStyle}
            />
          ) : (
            <>
              <input
                type="number"
                value={draft.coinsPerMin}
                onChange={(e) => setDraft({ ...draft, coinsPerMin: e.target.value })}
                placeholder="每分鐘幾金幣（例：讀書10分換1分＝10）"
                style={inputStyle}
              />
              <div style={{ fontSize: 9, color: TH.muted, margin: "2px 0 6px" }}>
                這段時間會記成下面這個番茄分類：
              </div>
              <CategorySelector
                cat1={draft.cat1}
                cat2={draft.cat2}
                cat3={draft.cat3}
                onChange={(n) => setDraft({ ...draft, ...n })}
              />
            </>
          )}
          <div style={{ fontSize: 9, color: TH.muted, margin: "8px 0 4px" }}>商品分類</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            {["飲食", "購物", "娛樂", "其他"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDraft({ ...draft, productCat: p })}
                style={{
                  padding: "4px 10px",
                  borderRadius: 16,
                  fontSize: 10,
                  cursor: "pointer",
                  border: `1px solid ${draft.productCat === p ? TH.accent : TH.border}`,
                  background: draft.productCat === p ? TH.accent + "22" : "transparent",
                  color: draft.productCat === p ? TH.accent : TH.muted,
                }}
              >
                {p}
              </button>
            ))}
            <input
              value={draft.productCat}
              onChange={(e) => setDraft({ ...draft, productCat: e.target.value })}
              placeholder="或自訂"
              style={{ ...inputStyle, width: 80, marginBottom: 0 }}
            />
          </div>
          <button
            type="button"
            onClick={saveDraft}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: 8,
              background: TH.accent,
              border: "none",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {editingId ? "儲存修改" : "新增"}
          </button>
        </Card>
      )}
      {items.map((item) => {
        const isTime = item.kind === "time";
        const price = item.price ?? 0;
        const catLabel = [item.cat1, item.cat2, item.cat3].filter(Boolean).join(" › ");
        return (
          <Card key={item.id}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: TH.text }}>{item.name}</div>
                {item.desc && <div style={{ fontSize: 10, color: TH.muted }}>{item.desc}</div>}
                {item.productCat && (
                  <div
                    style={{
                      display: "inline-block",
                      marginTop: 4,
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 9,
                      fontWeight: 700,
                      color: TH.accent,
                      border: `1px solid ${TH.accent}55`,
                      background: TH.accent + "18",
                    }}
                  >
                    {item.productCat}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  style={{ background: "none", border: "none", color: TH.muted, cursor: "pointer", fontSize: 13 }}
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => updateShopItems(items.filter((i) => i.id !== item.id))}
                  style={{ background: "none", border: "none", color: TH.muted, cursor: "pointer", fontSize: 13 }}
                >
                  🗑️
                </button>
              </div>
            </div>
            {isTime ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 11, color: TH.muted, lineHeight: 1.4 }}>
                  ⏱ 每分鐘 {item.coinsPerMin ?? 0} 🪙
                  {catLabel ? ` · 記入 ${catLabel}` : ""}
                </div>
                <button
                  type="button"
                  disabled
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    border: "none",
                    background: "#374151",
                    color: "#6B7280",
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: "not-allowed",
                    whiteSpace: "nowrap",
                  }}
                >
                  計時功能下一步開放
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span>🪙</span>
                  <span style={{ fontSize: 17, fontWeight: 900, color: TH.gold }}>{price}</span>
                </div>
                <button
                  className="flowlife-pressable"
                  type="button"
                  onClick={() => {
                    if (!onSpend(price, item.name)) {
                      showNotice("金幣不足");
                      return;
                    }
                  }}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 20,
                    border: "none",
                    background:
                      coins >= price ? `linear-gradient(135deg,${TH.gold},${TH.accent})` : "#374151",
                    color: coins >= price ? "#000" : "#6B7280",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "transform .12s, filter .12s",
                  }}
                >
                  {coins >= price ? "兌換" : "金幣不足"}
                </button>
              </div>
            )}
          </Card>
        );
      })}
      <Card>
        <div style={{ fontSize: 12, fontWeight: 900, color: TH.text }}>最近購買</div>
        <div style={{ fontSize: 9, color: TH.muted, margin: "4px 0 8px", lineHeight: 1.4 }}>
          💡 買錯了可以在這裡取消，金幣會退回
        </div>
        {(spendRows?.length ?? 0) === 0 ? (
          <div style={{ fontSize: 11, color: TH.muted, textAlign: "center", padding: 10 }}>
            尚無可取消的購買
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {spendRows?.slice(0, 10).map((row) => (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#0A0A0C",
                  borderRadius: 8,
                  padding: "7px 8px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: TH.text,
                      fontWeight: 800,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.taskName}
                  </div>
                  <div style={{ fontSize: 9, color: TH.muted }}>
                    {row.date} {row.time}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: TH.red, fontWeight: 900 }}>
                  {row.amount} 🪙
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `取消購買「${row.taskName}」並退回 ${Math.abs(row.amount)} 金幣？`,
                      )
                    ) {
                      onRefundSpend?.(row.id);
                    }
                  }}
                  style={{
                    border: `1px solid ${TH.accent}66`,
                    borderRadius: 7,
                    padding: "4px 7px",
                    background: "transparent",
                    color: TH.accent,
                    fontSize: 9,
                    fontWeight: 800,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  ↩ 取消購買
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <div style={{ fontSize: 12, fontWeight: 900, color: TH.text, marginBottom: 10 }}>購買記錄</div>
        {purchaseGroups.length === 0 ? (
          <div style={{ fontSize: 11, color: TH.muted, textAlign: "center", padding: 10 }}>尚無購買記錄</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {purchaseGroups.map((group) => (
              <div key={group.date} style={{ background: "#0A0A0C", borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 10, color: TH.muted, fontWeight: 800, marginBottom: 6 }}>{group.date}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.rows.map((row) => (
                    <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: TH.text, fontWeight: 800 }}>{row.taskName}</div>
                        <div style={{ fontSize: 9, color: TH.muted }}>{row.time}</div>
                      </div>
                      <div style={{ fontSize: 11, color: TH.red, fontWeight: 900 }}>
                        -{Math.abs(row.amount)} 🪙
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: `1px solid ${TH.border}`,
                    textAlign: "right",
                    fontSize: 10,
                    color: TH.gold,
                    fontWeight: 900,
                  }}
                >
                  當日合計 -{group.total} 🪙
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
