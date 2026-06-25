"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CFG } from "@/lib/config";
import { TH, readableTextOn } from "@/lib/theme";
import { getReview, loadReviews, subscribeReviews, upsertReview } from "@/lib/reviews";
import {
  weekKey,
  monthKey,
  quarterKey,
  daysOfWeek,
  weekKeysOfMonth,
  monthKeysOfQuarter,
  weekLabel,
  monthLabel,
  quarterLabel,
} from "@/lib/period";

function dayShortLabel(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}/${Number(d)}`;
}

const HINTS = {
  week: "💡 自動收攏本週 7 天的「今日總結」當素材，你寫一句本週總結；月/季同理層層往上",
  month: "💡 自動收攏本月各週的「週總結」當素材，你在這寫一句本月總結",
  quarter: "💡 自動收攏本季各月的「月總結」當素材，你在這寫一句本季總結",
} as const;

const SUMMARY_TITLE = {
  week: "本週總結",
  month: "本月總結",
  quarter: "本季總結",
} as const;

const PERIOD_TITLE = {
  week: weekLabel,
  month: monthLabel,
  quarter: quarterLabel,
} as const;

export function PeriodReview({ scope }: { scope: "week" | "month" | "quarter" }) {
  const [offset, setOffset] = useState(0);

  const periodKey = useMemo(() => {
    const t = CFG.TODAY;
    if (scope === "week") {
      const d = new Date(t);
      d.setDate(d.getDate() + offset * 7);
      return weekKey(d);
    }
    if (scope === "month") return monthKey(new Date(t.getFullYear(), t.getMonth() + offset, 1));
    return quarterKey(new Date(t.getFullYear(), t.getMonth() + offset * 3, 1));
  }, [scope, offset]);

  const [reviews, setReviews] = useState(() => loadReviews());
  const [summaryDraft, setSummaryDraft] = useState(
    () => getReview(scope, periodKey)?.text ?? "",
  );
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingRef = useRef(false);

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  // 切換 scope 時回到當期
  useEffect(() => setOffset(0), [scope]);

  // navigation 重設：切 scope/期數無條件重設草稿與素材
  useEffect(() => {
    setSummaryDraft(getReview(scope, periodKey)?.text ?? "");
    setReviews(loadReviews());
  }, [scope, periodKey]);

  // 即時刷新：訂閱變更，正在打字時不蓋掉草稿
  useEffect(() => {
    const unsub = subscribeReviews(() => {
      setReviews(loadReviews());
      if (!editingRef.current) {
        setSummaryDraft(getReview(scope, periodKey)?.text ?? "");
      }
    });
    return unsub;
  }, [scope, periodKey]);

  const childItems = useMemo(() => {
    if (scope === "week") {
      return daysOfWeek(periodKey).map((k) => ({
        key: k,
        label: dayShortLabel(k),
        text: reviews.find((r) => r.scope === "day" && r.periodKey === k)?.text?.trim(),
      }));
    }
    if (scope === "month") {
      return weekKeysOfMonth(periodKey).map((k) => ({
        key: k,
        label: weekLabel(k),
        text: reviews.find((r) => r.scope === "week" && r.periodKey === k)?.text?.trim(),
      }));
    }
    return monthKeysOfQuarter(periodKey).map((k) => ({
      key: k,
      label: monthLabel(k),
      text: reviews.find((r) => r.scope === "month" && r.periodKey === k)?.text?.trim(),
    }));
  }, [scope, periodKey, reviews]);

  const written = childItems.filter((i) => i.text).length;
  const filled = childItems.filter((i) => i.text);

  const saveSummary = () => {
    setReviews(upsertReview(scope, periodKey, summaryDraft));
    setSavedFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setSavedFlash(false), 1800);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 9, color: TH.muted, paddingLeft: 2, lineHeight: 1.5 }}>{HINTS[scope]}</div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
        }}
      >
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          style={{
            border: "none",
            background: "transparent",
            color: TH.muted,
            fontSize: 22,
            lineHeight: 1,
            cursor: "pointer",
            padding: "0 4px",
          }}
        >
          ‹
        </button>
        <div style={{ fontSize: 11, fontWeight: 800, color: TH.text, textAlign: "center" }}>
          {PERIOD_TITLE[scope](periodKey)}
        </div>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset === 0}
          style={{
            border: "none",
            background: "transparent",
            color: TH.muted,
            fontSize: 22,
            lineHeight: 1,
            cursor: offset === 0 ? "default" : "pointer",
            opacity: offset === 0 ? 0.35 : 1,
            padding: "0 4px",
          }}
        >
          ›
        </button>
      </div>
      <div style={{ fontSize: 9, color: TH.muted, textAlign: "center", lineHeight: 1.4 }}>
        💡 用 ‹ › 可翻看上週/上月/上季的總結
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: TH.muted }}>📋 子期素材（唯讀）</div>
        <div style={{ fontSize: 9, color: TH.muted }}>
          已寫 {written} / 共 {childItems.length}
        </div>
      </div>

      {filled.length === 0 ? (
        <div style={{ fontSize: 10, color: TH.muted, textAlign: "center", padding: 16, lineHeight: 1.6 }}>
          子期總結都還沒寫，先去「日」或下層期間補上吧。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filled.map((item) => (
            <div
              key={item.key}
              style={{
                background: TH.card,
                border: `1px solid ${TH.border}`,
                borderRadius: 10,
                padding: "8px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: TH.accent }}>{item.label}</div>
              <div style={{ fontSize: 11, color: TH.text, lineHeight: 1.5 }}>{item.text}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 10, fontWeight: 800, color: TH.muted, marginTop: 4 }}>
        📝 {SUMMARY_TITLE[scope]}
      </div>
      <div style={{ fontSize: 9, color: TH.muted, paddingLeft: 2, lineHeight: 1.4 }}>
        💡 失焦或按儲存都會存，存好會顯示「已儲存 ✓」
      </div>
      <textarea
        value={summaryDraft}
        onChange={(e) => setSummaryDraft(e.target.value)}
        onFocus={() => (editingRef.current = true)}
        onBlur={() => {
          editingRef.current = false;
          saveSummary();
        }}
        placeholder={
          scope === "week"
            ? "本週整體學到什麼、下週要調整什麼？"
            : scope === "month"
              ? "本月整體學到什麼、下月要調整什麼？"
              : "本季整體學到什麼、下季要調整什麼？"
        }
        style={{
          width: "100%",
          minHeight: 72,
          resize: "vertical",
          background: TH.bg,
          border: `1px solid ${TH.border}`,
          borderRadius: 8,
          color: TH.text,
          fontSize: 12,
          padding: "8px 10px",
          fontFamily: "inherit",
          boxSizing: "border-box",
          lineHeight: 1.5,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        {savedFlash && (
          <span style={{ fontSize: 10, color: TH.green, fontWeight: 700 }}>已儲存 ✓</span>
        )}
        <button
          type="button"
          onClick={saveSummary}
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "5px 14px",
            borderRadius: 8,
            border: "none",
            background: TH.accent,
            color: readableTextOn(TH.accent),
            cursor: "pointer",
          }}
        >
          儲存
        </button>
      </div>
    </div>
  );
}
