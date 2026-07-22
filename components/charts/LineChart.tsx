import { TH } from "@/lib/theme";

/** 趨勢點標註：0→"0"、<60→"45m"、≥60→"2h5m" */
function fmtPointMins(m: number) {
  const n = Math.round(m);
  if (n <= 0) return "0";
  if (n < 60) return `${n}m`;
  const h = Math.floor(n / 60);
  const r = n % 60;
  return r ? `${h}h${r}m` : `${h}h`;
}

export function LineChart({
  data,
  labels,
  color = TH.accent,
  height = 70,
  showValueLabels = false,
}: {
  data: number[];
  labels: string[];
  color?: string;
  height?: number;
  /** 每個資料點上方標註數值（未利用趨勢用）；點數 >14 隔點顯示 */
  showValueLabels?: boolean;
}) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1),
    W = 300,
    H = height,
    px = 16,
    py = 10,
    pw = W - px * 2;
  const pts = data.map((v, i) => ({
    x: px + (i / (data.length - 1)) * pw,
    y: H - py - (v / max) * (H - py * 2),
  }));
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + `${p.x},${p.y}`).join(" ");
  const area = `${path} L${pts[pts.length - 1].x},${H - py} L${pts[0].x},${H - py} Z`;
  const gid = `g${color.replace(/[^a-z0-9]/gi, "")}`;
  const sparseLabels = data.length > 14;
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={color} />
            {showValueLabels && (!sparseLabels || i % 2 === 0) && (
              <text
                x={p.x}
                y={p.y - 6}
                textAnchor="middle"
                fontSize={8}
                fill={TH.muted}
              >
                {fmtPointMins(data[i])}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", paddingLeft: px, paddingRight: px }}>
        {labels.map((l, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 8,
              color: TH.muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
