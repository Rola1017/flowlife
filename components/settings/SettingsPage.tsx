"use client";

import { useEffect, useState } from "react";
import { BackBtn } from "@/components/ui/BackBtn";
import { Card, SL } from "@/components/ui/Card";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { CloudSyncBadge } from "@/components/ui/CloudSyncBadge";
import { isOnline, subscribeOnline } from "@/lib/authState";
import { CARD_TONES, CARD_TONE_COLOR, CARD_TONE_LABEL } from "@/lib/cardTone";
import { TH } from "@/lib/theme";
import { SYNC_TARGET_LABELS, syncNow, type SyncReport } from "@/lib/cloudSync";
import type { Todo } from "@/lib/types";

export function SettingsPage({
  onBack,
  onResetAllData,
  onResetTodos,
  onClearRecords,
}: {
  onBack: () => void;
  onResetAllData: () => void | Promise<void>;
  onResetTodos: (todos: Partial<Todo>[]) => void;
  onClearRecords: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [clearingRecords, setClearingRecords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [online, setOnline] = useState(isOnline);

  useEffect(() => subscribeOnline(setOnline), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <BackBtn onBack={onBack} label="設定" />

      <Card tone="neutral">
        <SL>雲端同步（測試中）</SL>
        <CloudSyncBadge />
        <AuthPanel />
        {!online ? (
          <div style={{ marginTop: 10, fontSize: 12, color: TH.yellow, fontWeight: 800, lineHeight: 1.5 }}>
            📴 目前離線，無法同步
          </div>
        ) : null}
        <button
          type="button"
          disabled={syncing || !online}
          onClick={() => {
            if (!isOnline()) return;
            setSyncing(true);
            setSyncProgress("同步中…");
            void syncNow({ onProgress: setSyncProgress })
              .then(setSyncReport)
              .finally(() => {
                setSyncing(false);
                setSyncProgress("");
              });
          }}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "8px 12px",
            borderRadius: 10,
            border: `1px solid ${TH.border}`,
            background: "transparent",
            color: online ? TH.text : TH.muted,
            fontSize: 12,
            fontWeight: 800,
            cursor: syncing || !online ? "not-allowed" : "pointer",
          }}
        >
          {syncing ? syncProgress || "同步中…" : "立即同步並檢查"}
        </button>
        {online && syncReport && (
          <div style={{ marginTop: 8, fontSize: 11, color: TH.muted, lineHeight: 1.6 }}>
            <div>
              {syncReport.loggedIn
                ? syncReport.offline
                  ? "📴 目前離線，無法同步"
                  : syncReport.allClear
                    ? "✅ 已全部同步"
                    : syncReport.timedOut
                      ? "⏱ 逾時（未完成≠失敗，可重試）"
                      : "⚠️ 尚有資料未同步完成"
                : "未登入"}
            </div>
            {syncReport.targets.map((t) => (
              <div key={t.name}>
                {SYNC_TARGET_LABELS[t.name] ?? t.name}：上傳 {t.pushed}／刪除 {t.deleted}／待處理 {t.pending}
                {t.failed > 0 ? `／失敗 ${t.failed}` : ""}
                {t.lastError ? `（${t.lastError}）` : ""}
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4, marginTop: 8 }}>
          💡 立即同步只上傳本機有改（dirty）與雲端缺的，並把墓碑列 stamp 軟刪；不會蓋掉他機較新的資料，也不會刪他機新資料。
        </div>
        <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4, marginTop: 4 }}>
          💡 登出只退出這台；登出所有裝置才會讓其他裝置也退出。離線時無法同步。
        </div>
        <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4, marginTop: 4 }}>
          💡 紅色標記＝寫入失敗，點開看最後錯誤。
        </div>
      </Card>

      <Card tone="neutral">
        <SL>清除番茄/金幣記錄</SL>
        <div style={{ color: TH.muted, fontSize: 11, lineHeight: 1.5, marginBottom: 12 }}>
          只清除番茄紀錄、金幣收支、評分與未利用時間統計。
          保留你的分類設定、課表、班別。適合清掉測試資料、重新開始記錄。
          這會同時清除雲端資料，所有裝置都會消失，且無法復原。
        </div>
        {!clearingRecords ? (
          <button
            type="button"
            disabled={busy}
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
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            清除番茄/金幣記錄
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ color: TH.yellow, fontSize: 12, fontWeight: 800, textAlign: "center" }}>
              這會同時清除雲端資料，所有裝置都會消失，且無法復原。確定？
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void Promise.resolve(onClearRecords()).finally(() => setBusy(false));
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
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "清除中…" : "確認清除記錄"}
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

      <Card tone="neutral">
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
          ⚠️ 重置後會清空所有 FlowLife 本機＋雲端資料，包含待辦、番茄紀錄、金幣、評分、休息與未利用時間統計。這會同時清除雲端資料，所有裝置都會消失，且無法復原。
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
              這會同時清除雲端資料，所有裝置都會消失，且無法復原。確定？
            </div>
            <button
              className="flowlife-pressable"
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                onResetTodos([]);
                void Promise.resolve(onResetAllData()).finally(() => setBusy(false));
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
                cursor: busy ? "not-allowed" : "pointer",
                transition: "transform .12s, filter .12s",
              }}
            >
              {busy ? "重置中…" : "確認重置，清空所有資料"}
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

      <Card tone="neutral">
        <SL>顏色圖例</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {CARD_TONES.map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: CARD_TONE_COLOR[t],
                  flexShrink: 0,
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: 12, color: TH.text, fontWeight: 700 }}>{CARD_TONE_LABEL[t]}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4, marginTop: 8 }}>
          💡 定義：外框顏色代表這張卡片屬於哪一類資料。
        </div>
        <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4, marginTop: 4 }}>
          💡 用法：滑動時用顏色快速找到區塊。
        </div>
        <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4, marginTop: 4 }}>
          💡 範例：黃色＝待辦、藍色＝課表。
        </div>
      </Card>
      <div style={{ fontSize: 9, color: TH.muted, textAlign: "center" }}>版本 v1.0.0 · FlowLife</div>
    </div>
  );
}
