"use client";

import { useState } from "react";
import { TH } from "@/lib/theme";
import { MOCK } from "@/lib/mock";
import { Card } from "@/components/ui/Card";
import { BackBtn } from "@/components/ui/BackBtn";

export function ShopPage({
  coins,
  onSpend,
  onBack,
}: {
  coins: number;
  onSpend: (n: number) => void;
  onBack: () => void;
}) {
  const [items, setItems] = useState(MOCK.shopItems);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", price: "", desc: "" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackBtn onBack={onBack} label="商店" />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <span>🪙</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: TH.gold }}>{coins.toLocaleString()}</span>
        </div>
      </div>
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
              type="button"
              onClick={() => {
                if (coins >= item.price) onSpend(item.price);
                else alert("金幣不足！");
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
              }}
            >
              {coins >= item.price ? "兌換" : "金幣不足"}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
