"use client";

import { CFG } from "@/lib/config";
import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { fmtIdleTime } from "@/lib/utils";

export function RingTimer({
  mode,
  secs,
  dur,
  restSecs,
  idleTrackStart,
  idleSecs,
  confirmed,
}: {
  mode: string;
  secs: number;
  dur: number;
  restSecs: number;
  idleTrackStart: number | null;
  idleSecs: number;
  confirmed: { cat1: string; cat2?: string; name?: string } | null;
}) {
  const m = Math.floor(secs / 60),
    s = secs % 60;
  const rm = Math.floor(restSecs / 60),
    rs = restSecs % 60;
  const circ = 2 * Math.PI * 58;
  const restTotal = CFG.REST_SECONDS[dur] ?? 5 * 60;
  const prog = idleTrackStart
    ? Math.min(idleSecs / 3600, 1)
    : mode === "rest" && restSecs > 0
      ? restSecs / restTotal
      : secs / (dur * 60);
  const ringColor =
    mode === "focus"
      ? TH.accent
      : mode === "rest" && restSecs > 0
        ? TH.green
        : idleTrackStart
          ? "#3A3A42"
          : TH.muted;

  return (
    <div style={{ position: "relative", width: 148, height: 148 }}>
      <svg width={148} height={148} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={74} cy={74} r={58} fill="none" stroke={TH.border} strokeWidth={8} />
        <circle
          cx={74}
          cy={74}
          r={58}
          fill="none"
          stroke={ringColor}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${prog * circ} ${circ}`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {mode === "rest" && restSecs > 0 ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, color: TH.green }}>
              {String(rm).padStart(2, "0")}:{String(rs).padStart(2, "0")}
            </div>
            <div style={{ fontSize: 9, color: TH.green }}>💤 休息中</div>
          </>
        ) : idleTrackStart ? (
          <>
            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: TH.red,
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              {fmtIdleTime(idleSecs)}
            </div>
            <div style={{ fontSize: 8, color: TH.muted, marginTop: 2 }}>⏳ 未利用</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, color: TH.text }}>
              {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
            </div>
            <div style={{ fontSize: 9, color: TH.muted }}>{mode === "focus" ? "🔥 專注中" : "⏸ 待機"}</div>
            {mode === "focus" && confirmed && (
              <div style={{ fontSize: 8, color: CAT.cat1Color(confirmed.cat1), marginTop: 3 }}>
                {confirmed.cat1}
                {confirmed.cat2 && " › " + confirmed.cat2}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
