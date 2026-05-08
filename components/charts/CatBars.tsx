import { TH } from "@/lib/theme";
import { fmt } from "@/lib/utils";

export function CatBars({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value || 0), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 56,
              fontSize: 9,
              color: TH.muted,
              textAlign: "right",
              flexShrink: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {d.label}
          </div>
          <div
            style={{
              flex: 1,
              height: 6,
              background: "#1C1C22",
              borderRadius: 3,
              overflow: "hidden",
              maxWidth: "55%",
            }}
          >
            <div
              style={{
                width: `${(d.value / max) * 100}%`,
                height: "100%",
                background: d.color,
                borderRadius: 3,
              }}
            />
          </div>
          <div style={{ fontSize: 9, color: TH.muted, minWidth: 28, textAlign: "right" }}>{fmt(d.value)}</div>
        </div>
      ))}
    </div>
  );
}
