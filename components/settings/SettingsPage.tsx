"use client";

import { useState } from "react";
import { BackBtn } from "@/components/ui/BackBtn";
import { Card, SL } from "@/components/ui/Card";
import { TH } from "@/lib/theme";

export function SettingsPage({
  onBack,
  onResetAllData,
  onResetTodos,
  onClearRecords,
}: {
  onBack: () => void;
  onResetAllData: () => void;
  onResetTodos: (todos: Record<string, unknown>[]) => void;
  onClearRecords: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [clearingRecords, setClearingRecords] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <BackBtn onBack={onBack} label="設定" />

      <Card>
        <SL>清除番茄/金幣記錄</SL>
        <div style={{ color: TH.muted, fontSize: 11, lineHeight: 1.5, marginBottom: 12 }}>
          只清除番茄紀錄、金幣收支、評分與未利用時間統計。
          保留你的分類設定、課表、班別。適合清掉測試資料、重新開始記錄。
        </div>
        {!clearingRecords ? (
          <button
            type="button"
            onClick={() => setClearingRecords(true)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid ${TH.yellow}`,
              background: TH.yellow + "18",
              color: TH.yellow,
              fontSize: 13,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            清除番茄/金幣記錄
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ color: TH.yellow, fontSize: 12, fontWeight: 800, textAlign: "center" }}>
              確認清除所有番茄/金幣記錄？（設定會保留）
            </div>
            <button
              type="button"
              onClick={() => {
                onClearRecords();
                setClearingRecords(false);
              }}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "none",
                background: TH.yellow,
                color: "#000",
                fontSize: 13,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              確認清除記錄
            </button>
            <button
              type="button"
              onClick={() => setClearingRecords(false)}
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

      <Card>
        <SL>危險操作</SL>
        <div
          style={{
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
              onClick={() => {
                onResetTodos([]);
                onResetAllData();
              }}
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
