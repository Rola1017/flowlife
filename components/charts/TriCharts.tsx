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
  idleLine,
}: {
  chartData: { label: string; value: number; color: string }[];
  lineD: { labels: string[]; focus: number[] };
  period: string;
  onPeriodChange: (p: string) => void;
  label: string;
  idleLine?: { labels: string[]; data: number[] };
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
          {period} {label} 分佈(時長)
        </SL>
        <CatBars data={chartData} />
      </Card>
      <Card>
        <SL>{period} 趨勢(時長)</SL>
        <LineChart data={lineD.focus} labels={lineD.labels} color={lineColor} height={70} />
      </Card>
      {idleLine && idleLine.data.length >= 2 && (
        <Card>
          <SL>
            {period} 未利用 趨勢(時長)
          </SL>
          <LineChart
            data={idleLine.data}
            labels={idleLine.labels}
            color={TH.muted}
            height={70}
            showValueLabels
          />
          <div style={{ fontSize: 9, color: TH.muted, marginTop: 4, lineHeight: 1.4 }}>
            💡 點多時只標出重點日（最高／最低／最後一天）
          </div>
        </Card>
      )}
    </>
  );
}
