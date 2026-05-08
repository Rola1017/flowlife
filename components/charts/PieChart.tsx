import { TH } from "@/lib/theme";
import { fmt } from "@/lib/utils";

export function PieChart({
  data,
  size = 160,
  title = "",
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  title?: string;
}) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  if (!total) return null;
  const cx = size / 2,
    cy = size / 2,
    r = size * 0.3,
    inner = size * 0.17;
  let cum = 0;
  const slices = data.map((d) => {
    const sa = (cum / total) * 2 * Math.PI - Math.PI / 2;
    cum += d.value;
    const ea = (cum / total) * 2 * Math.PI - Math.PI / 2;
    const mid = (sa + ea) / 2,
      large = ea - sa > Math.PI ? 1 : 0;
    const [x1, y1] = [cx + r * Math.cos(sa), cy + r * Math.sin(sa)];
    const [x2, y2] = [cx + r * Math.cos(ea), cy + r * Math.sin(ea)];
    const [ix1, iy1] = [cx + inner * Math.cos(sa), cy + inner * Math.sin(sa)];
    const [ix2, iy2] = [cx + inner * Math.cos(ea), cy + inner * Math.sin(ea)];
    const path = `M ${ix1} ${iy1} A ${inner} ${inner} 0 ${large} 1 ${ix2} ${iy2} L ${x2} ${y2} A ${r} ${r} 0 ${large} 0 ${x1} ${y1} Z`;
    const pct = Math.round((d.value / total) * 100);
    const lr = r + size * 0.12;
    return {
      ...d,
      path,
      pct,
      lx: cx + lr * Math.cos(mid),
      ly: cy + lr * Math.sin(mid),
      skip: pct < 7,
    };
  });
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <g key={i}>
            <path d={s.path} fill={s.color} stroke={TH.card} strokeWidth={2} />
            {!s.skip && (
              <text
                x={s.lx}
                y={s.ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={s.color}
                fontSize={size * 0.055}
                fontWeight={800}
              >
                {s.pct}%
              </text>
            )}
          </g>
        ))}
        <text x={cx} y={cy - 7} textAnchor="middle" fill={TH.text} fontSize={size * 0.1} fontWeight={900}>
          {Math.floor(total / 60)}h
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill={TH.muted} fontSize={size * 0.05}>
          {title}
        </text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span
              style={{
                fontSize: 10,
                color: TH.muted,
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.label}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: TH.text }}>{fmt(s.value)}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: s.color, minWidth: 24, textAlign: "right" }}>
              {s.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
