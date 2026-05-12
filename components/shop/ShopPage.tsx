"use client";

import { useEffect, useMemo, useState } from "react";
import { TH } from "@/lib/theme";
import { MOCK } from "@/lib/mock";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { Card } from "@/components/ui/Card";
import { BackBtn } from "@/components/ui/BackBtn";

type PurchaseLogRow = {
  id: number;
  name: string;
  amount: number;
  date: string;
  time: string;
  at: string;
};

function localDateParts(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${d}`, time: `${h}:${min}`, at: `${y}-${m}-${d} ${h}:${min}` };
}

export function ShopPage({
  coins,
  onSpend,
  onBack,
}: {
  coins: number;
  onSpend: (n: number) => boolean;
  onBack: () => void;
}) {
  const [items, setItems] = useState(MOCK.shopItems);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", price: "", desc: "" });
  const [notice, setNotice] = useState("");
  const [purchaseLog, setPurchaseLog] = useState<PurchaseLogRow[]>([]);
  const [purchaseLogReady, setPurchaseLogReady] = useState(false);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1800);
  };

  useEffect(() => {
    const saved = loadJSON<unknown>(LS_KEYS.purchaseLog, []);
    if (Array.isArray(saved)) setPurchaseLog(saved as PurchaseLogRow[]);
    setPurchaseLogReady(true);
  }, []);

  useEffect(() => {
    if (!purchaseLogReady) return;
    saveJSON(LS_KEYS.purchaseLog, purchaseLog);
  }, [purchaseLog, purchaseLogReady]);

  const purchaseGroups = useMemo(() => {
    const grouped = purchaseLog.reduce<Record<string, PurchaseLogRow[]>>((acc, row) => {
      acc[row.date] = [...(acc[row.date] ?? []), row];
      return acc;
    }, {});
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, rows]) => ({
        date,
        rows: rows.sort((a, b) => b.at.localeCompare(a.at)),
        total: rows.reduce((sum, row) => sum + row.amount, 0),
      }));
  }, [purchaseLog]);

  const recordPurchase = (name: string, amount: number) => {
    const now = localDateParts();
    setPurchaseLog((log) => [{ id: Date.now(), name, amount, ...now }, ...log]);
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
        onClick={() => setAddOpen(!addOpen)}
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
          {(
            [
              ["name", "商品名稱"],
              ["desc", "說明"],
            ] as const
          ).map(([k, ph]) => (
            <input
              key={k}
              value={draft[k as "name" | "desc"]}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              placeholder={ph}
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
                marginBottom: 6,
              }}
            />
          ))}
          <input
            type="number"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            placeholder="金幣價格"
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
              marginBottom: 8,
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (!draft.name || !draft.price) return;
              setItems((is) => [...is, { ...draft, id: Date.now(), price: Number(draft.price) }]);
              setDraft({ name: "", price: "", desc: "" });
              setAddOpen(false);
            }}
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
            新增
          </button>
        </Card>
      )}
      {items.map((item) => (
        <Card key={item.id}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: TH.text }}>{item.name}</div>
              {item.desc && <div style={{ fontSize: 10, color: TH.muted }}>{item.desc}</div>}
            </div>
            <button
              type="button"
              onClick={() => setItems((is) => is.filter((i) => i.id !== item.id))}
              style={{ background: "none", border: "none", color: TH.muted, cursor: "pointer", fontSize: 13 }}
            >
              🗑️
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span>🪙</span>
              <span style={{ fontSize: 17, fontWeight: 900, color: TH.gold }}>{item.price}</span>
            </div>
            <button
              className="flowlife-pressable"
              type="button"
              onClick={() => {
                if (!onSpend(item.price)) {
                  showNotice("金幣不足");
                  return;
                }
                recordPurchase(item.name, item.price);
              }}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                border: "none",
                background:
                  coins >= item.price ? `linear-gradient(135deg,${TH.gold},${TH.accent})` : "#374151",
                color: coins >= item.price ? "#000" : "#6B7280",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                transition: "transform .12s, filter .12s",
              }}
            >
              {coins >= item.price ? "兌換" : "金幣不足"}
            </button>
          </div>
        </Card>
      ))}
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
                        <div style={{ fontSize: 11, color: TH.text, fontWeight: 800 }}>{row.name}</div>
                        <div style={{ fontSize: 9, color: TH.muted }}>{row.time}</div>
                      </div>
                      <div style={{ fontSize: 11, color: TH.red, fontWeight: 900 }}>-{row.amount} 🪙</div>
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
