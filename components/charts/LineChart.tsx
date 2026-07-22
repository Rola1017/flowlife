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

/** 點多時自適應：等距抽樣 + 永遠含最高／最低／最後一天 */
export function adaptiveShowIdx(data: number[]): Set<number> {
  const n = data.length;
  const showIdx = new Set<number>();
  if (n === 0) return showIdx;
  const step = n <= 7 ? 1 : n <= 14 ? 2 : Math.ceil(n / 7);
  const maxIdx = data.indexOf(Math.max(...data));
  const minIdx = data.indexOf(Math.min(...data));
  data.forEach((_, i) => {
    if (i % step === 0) showIdx.add(i);
  });
  showIdx.add(maxIdx);
  showIdx.add(minIdx);
  showIdx.add(n - 1);
  return showIdx;
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
  /** 未利用趨勢：自適應標註最高／最低／抽樣點 */
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
  const showIdx = showValueLabels ? adaptiveShowIdx(data) : null;
  const maxIdx = showValueLabels ? data.indexOf(Math.max(...data)) : -1;
  const minIdx = showValueLabels ? data.indexOf(Math.min(...data)) : -1;
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
        {pts.map((p, i) => {
          const isMax = i === maxIdx;
          const isMin = i === minIdx;
          const labelColor = isMax ? TH.red : isMin ? TH.green : TH.muted;
          const r = showValueLabels && (isMax || isMin) ? 4.5 : 3;
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={r} fill={isMax ? TH.red : isMin ? TH.green : color} />
              {showIdx?.has(i) && (
                <text
                  x={p.x}
                  y={p.y - 6}
                  textAnchor="middle"
                  fontSize={8}
                  fill={labelColor}
                  fontWeight={isMax || isMin ? 700 : 400}
                >
                  {fmtPointMins(data[i])}
                </text>
              )}
            </g>
          );
        })}
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
            {!showIdx || showIdx.has(i) ? l : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
