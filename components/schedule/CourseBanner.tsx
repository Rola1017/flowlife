"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { currentOrNextCourse, type CourseInfo } from "@/lib/schedule";

const wrap: CSSProperties = {
  width: "100%",
  background: TH.card,
  border: `1px solid ${TH.border}`,
  borderRadius: 12,
  padding: "10px 12px",
  boxSizing: "border-box",
};

export function CourseBanner({
  onQuickStart,
  fallback,
}: {
  onQuickStart?: (c: CourseInfo) => void;
  fallback?: { text: string; time?: string } | null;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const cn = useMemo(() => currentOrNextCourse(now), [now]);

  if (!cn) {
    return (
      <div style={wrap}>
        {fallback ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 9, color: TH.muted, fontWeight: 800 }}>⏭ 接下來的待辦</span>
            <span style={{ fontSize: 12, color: TH.text, fontWeight: 800 }}>
              {fallback.text}
              {fallback.time ? `　${fallback.time}` : ""}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: TH.muted }}>📭 今天目前沒有排課</span>
        )}
      </div>
    );
  }

  const c = cn.course;
  const isNow = cn.status === "current";
  const name = c.n || c.cat3 || c.cat2 || c.cat1;
  const path = [c.cat1, c.cat2, c.cat3].filter(Boolean).join(" › ");
  const dot =
    CAT.deepColorFull(c.cat1, c.cat2 || undefined, c.cat3 || undefined) || CAT.cat1Color(c.cat1) || TH.muted;
  const accent = isNow ? TH.accent : TH.cyan;

  return (
    <div style={{ ...wrap, border: `1px solid ${accent}55`, background: accent + "10" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: accent, fontWeight: 800 }}>
            {isNow ? `🎯 現在　現在～${cn.endTime}` : `⏭ 接下來　${c.t}～${cn.endTime}`}
          </div>
          <div
            style={{
              fontSize: 13,
              color: TH.text,
              fontWeight: 800,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          {path && (
            <div
              style={{
                fontSize: 9,
                color: TH.muted,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {path}
            </div>
          )}
        </div>
        {onQuickStart && (
          <button
            type="button"
            onClick={() => onQuickStart(c)}
            style={{
              flexShrink: 0,
              padding: "8px 14px",
              borderRadius: 20,
              border: "none",
              background: `linear-gradient(135deg,${TH.accent},#EA580C)`,
              color: "#fff",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            一鍵開始 🍅
          </button>
        )}
      </div>
    </div>
  );
}
