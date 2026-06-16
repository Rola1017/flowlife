"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { CFG } from "@/lib/config";
import { TH, readableTextOn } from "@/lib/theme";
import { getReview } from "@/lib/reviews";
import { nowHM } from "@/lib/utils";

function yesterdayStr(today: string): string {
  const yd = new Date(today + "T12:00:00");
  yd.setDate(yd.getDate() - 1);
  return `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, "0")}-${String(yd.getDate()).padStart(2, "0")}`;
}

export function ReviewNudgeCard({
  onWriteSummary,
  nowTick,
}: {
  onWriteSummary: () => void;
  nowTick: number;
}) {
  const today = CFG.TODAY_STR;
  const yesterday = useMemo(() => yesterdayStr(today), [today]);

  const hm = useMemo(() => nowHM(), [nowTick]);
  const todayReview = getReview("day", today);
  const shouldShow = hm >= CFG.REVIEW_NUDGE_AFTER && !todayReview?.text?.trim();

  if (!shouldShow) return null;

  const yesterdayReview = getReview("day", yesterday);

  return (
    <Card>
      <div style={{ fontSize: 13, fontWeight: 800, color: TH.text, marginBottom: 6 }}>🌙 今日總覆盤</div>
      <div style={{ fontSize: 11, color: TH.text, lineHeight: 1.5, marginBottom: 10 }}>
        現在 {hm}，今天還沒寫總結——用一句話收束今天吧
      </div>
      <button
        type="button"
        onClick={onWriteSummary}
        style={{
          width: "100%",
          padding: "9px 12px",
          borderRadius: 10,
          border: "none",
          background: TH.accent,
          color: readableTextOn(TH.accent),
          fontSize: 12,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        去寫今日總覆盤 →
      </button>
      {yesterdayReview?.text?.trim() && (
        <div
          style={{
            marginTop: 10,
            fontSize: 10,
            color: TH.muted,
            lineHeight: 1.5,
            padding: "8px 10px",
            background: TH.bg,
            borderRadius: 8,
            border: `1px solid ${TH.border}`,
          }}
        >
          昨日總覆盤：{yesterdayReview.text}
        </div>
      )}
      <div style={{ fontSize: 9, color: TH.muted, marginTop: 8, lineHeight: 1.4 }}>
        💡 過 22:30 提醒你寫；寫完就會自動收起（真推播待 App 打包後支援）
      </div>
    </Card>
  );
}
