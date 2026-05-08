import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { fmt, aggregateByCat1 } from "@/lib/utils";

export function BattleCard({
  title,
  pomos,
  prevMins,
  prevCount,
}: {
  title: string;
  pomos: { cat1: string; mins: number }[];
  prevMins: number;
  prevCount: number;
}) {
  const agg = aggregateByCat1(pomos);
  const total = pomos.reduce((s, p) => s + p.mins, 0);
  const pct = prevMins > 0 ? Math.round(((total - prevMins) / prevMins) * 100) : 0;
  const cntDiff = pomos.length - prevCount;
  const maxM = Math.max(...agg.map((a) => a.mins), 1);
  return (
    <div style={{ background: TH.card, border: `1px solid ${TH.border}`, borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: TH.text, marginBottom: 5 }}>⚔️ {title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: pct >= 0 ? TH.green : TH.red }}>
          {pct >= 0 ? "+" : ""}
          {pct}%
        </div>
        <div style={{ fontSize: 10, color: TH.muted }}>{fmt(total)}</div>
        <div style={{ marginLeft: "auto", fontSize: 9, color: TH.muted }}>
          🍅{pomos.length}
          {cntDiff !== 0 && (
            <span style={{ color: cntDiff > 0 ? TH.green : TH.red, fontWeight: 800 }}>
              {cntDiff > 0 ? "+" : ""}
              {cntDiff}
            </span>
          )}
        </div>
      </div>
      {agg.map((a, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: CAT.cat1Color(a.cat1),
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 9,
              color: TH.muted,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {a.cat1}
          </span>
          <div
            style={{
              width: 36,
              height: 4,
              background: "#1C1C22",
              borderRadius: 2,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: `${(a.mins / maxM) * 100}%`,
                height: "100%",
                background: CAT.cat1Color(a.cat1),
                borderRadius: 2,
              }}
            />
          </div>
          <span style={{ fontSize: 8, color: TH.muted, minWidth: 22, textAlign: "right" }}>{fmt(a.mins)}</span>
        </div>
      ))}
    </div>
  );
}
