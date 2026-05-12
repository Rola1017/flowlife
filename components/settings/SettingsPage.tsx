"use client";

import { useState } from "react";
import { BackBtn } from "@/components/ui/BackBtn";
import { Card, SL } from "@/components/ui/Card";
import { TH } from "@/lib/theme";

export function SettingsPage({ onBack, onResetAllData }: { onBack: () => void; onResetAllData: () => void }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <BackBtn onBack={onBack} label="設定" />

      <Card>
        <SL>危險操作</SL>
        <div
          style={{
            border: `1px solid ${TH.red}66`,
            background: TH.red + "12",
            borderRadius: 12,
            padding: 12,
            color: TH.red,
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1.5,
            marginBottom: 12,
          }}
        >
          ⚠️ 重置後會清空所有 FlowLife 本機資料，包含待辦、番茄紀錄、金幣、評分、休息與未利用時間統計。此操作無法復原。
        </div>

        {!confirming ? (
          <button
            className="flowlife-pressable"
            type="button"
            onClick={() => setConfirming(true)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid ${TH.red}`,
              background: TH.red + "18",
              color: TH.red,
              fontSize: 13,
              fontWeight: 900,
              cursor: "pointer",
              transition: "transform .12s, filter .12s",
            }}
          >
            重置所有資料
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ color: TH.yellow, fontSize: 12, fontWeight: 800, textAlign: "center" }}>
              請再次確認：真的要刪除所有本機資料？
            </div>
            <button
              className="flowlife-pressable"
              type="button"
              onClick={onResetAllData}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "none",
                background: TH.red,
                color: "#fff",
                fontSize: 13,
                fontWeight: 900,
                cursor: "pointer",
                transition: "transform .12s, filter .12s",
              }}
            >
              確認重置，清空所有資料
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 12,
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
        )}
      </Card>
      <div style={{ fontSize: 9, color: TH.muted, textAlign: "center" }}>版本 v1.0.0 · FlowLife</div>
    </div>
  );
}
