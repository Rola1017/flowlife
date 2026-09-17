import { CFG } from "@/lib/config";
import { Card, SL } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
import { CatBars } from "@/components/charts/CatBars";
import { TH } from "@/lib/theme";
import { resolveIsTimeDestination, type TagGroup } from "@/lib/tags";
import { liveGroups } from "@/lib/tagTree";

export function StatsGroupSwitcher({
  groups,
  groupId,
  onChange,
}: {
  groups: TagGroup[];
  groupId: string;
  onChange: (id: string) => void;
}) {
  const dest = liveGroups(groups).filter((g) => resolveIsTimeDestination(g));
  if (!dest.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <div style={{ fontSize: 9, color: TH.muted }}>統計維度</div>
      <div
        style={{
          display: "flex",
          gap: 4,
          overflowX: "auto",
          width: "100%",
          minWidth: 0,
          WebkitOverflowScrolling: "touch",
          paddingBottom: 2,
        }}
      >
        {dest.map((g) => (
          <Chip key={g.id} label={g.name} active={groupId === g.id} onClick={() => onChange(g.id)} />
        ))}
      </div>
      <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.45 }}>
        💡 換個角度看時間：依領域看＝學習/事業各多少；依專案看＝Roro/網站各多少。總時數都一樣。
      </div>
    </div>
  );
}

export function TriCharts({
  chartData,
  lineD,
  period,
  onPeriodChange,
  label,
  idleLine,
  groups,
  statsGroupId,
  onStatsGroupChange,
}: {
  chartData: { label: string; value: number; color: string; path?: string }[];
  lineD: { labels: string[]; focus: number[] };
  period: string;
  onPeriodChange: (p: string) => void;
  label: string;
  idleLine?: { labels: string[]; data: number[] };
  groups: TagGroup[];
  statsGroupId: string;
  onStatsGroupChange: (id: string) => void;
}) {
  const lineColor = chartData[0]?.color || TH.accent;
  return (
    <>
      <StatsGroupSwitcher groups={groups} groupId={statsGroupId} onChange={onStatsGroupChange} />
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2, minWidth: 0 }}>
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
