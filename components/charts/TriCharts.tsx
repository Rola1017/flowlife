import { CFG } from "@/lib/config";
import { Card, SL } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
import { CatBars } from "@/components/charts/CatBars";
import { TH } from "@/lib/theme";

export function TriCharts({
  chartData,
  lineD,
  period,
  onPeriodChange,
  label,
}: {
  chartData: { label: string; value: number; color: string }[];
  lineD: { labels: string[]; focus: number[] };
  period: string;
  onPeriodChange: (p: string) => void;
  label: string;
}) {
  const lineColor = chartData[0]?.color || TH.accent;
  return (
    <>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
        {CFG.TIME_RANGES.map((p) => (
          <Chip key={p} label={p} active={period === p} onClick={() => onPeriodChange(p)} />
        ))}
      </div>
      <Card>
        <SL>
          {period} {label} 圓餅圖
        </SL>
        <PieChart data={chartData} size={160} title={period} />
      </Card>
      <Card>
        <SL>
          {period} {label} 時長分佈
        </SL>
        <CatBars data={chartData} />
      </Card>
      <Card>
        <SL>{period} 專注趨勢</SL>
        <LineChart data={lineD.focus} labels={lineD.labels} color={lineColor} height={70} />
      </Card>
    </>
  );
}
