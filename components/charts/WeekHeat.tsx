import { TH } from "@/lib/theme";
import { CFG } from "@/lib/config";
import { shiftDateStr } from "@/lib/dateStr";
import { formatMd } from "@/lib/utils";
import type { Session } from "@/lib/types";
import type { Tag, TagGroup } from "@/lib/tags";
import { resolveSessionTagIds } from "@/lib/analytics";
import { splitMinutesByGroup } from "@/lib/tagStats";
import { primaryTagColor, tagPathLabel, UNCATEGORIZED_COLOR } from "@/lib/tagSelect";

const AXIS_START = 6;
const AXIS_LEN = 17;

function toHour(t?: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

export function WeekHeat({
  sessions,
  days = 7,
  tags,
  groups,
  groupId,
  todayStr = CFG.TODAY_STR,
}: {
  sessions: Session[];
  days?: number;
  tags: Tag[];
  groups: TagGroup[];
  groupId: string;
  todayStr?: string;
}) {
  const dayList: { key: string; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = shiftDateStr(todayStr, -i);
    const label = i === 0 ? "今天" : formatMd(key);
    dayList.push({ key, label });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {dayList.map((day) => {
        const daySessions = sessions.filter((s) => s.date === day.key);
        return (
          <div key={day.key} style={{ display: "flex", gap: 4, alignItems: "center", minWidth: 0, width: "100%", boxSizing: "border-box" }}>
            <div
              style={{
                width: 36,
                fontSize: 8,
                color: TH.muted,
                textAlign: "right",
                paddingRight: 4,
                flexShrink: 0,
              }}
            >
              {day.label}
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                height: 13,
                background: "#1C1C22",
                borderRadius: 4,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {daySessions.map((s, si) => {
                const sh = toHour(s.startTime);
                const eh = toHour(s.endTime);
                if (sh == null || eh == null) return null;
                const leftPct = ((sh - AXIS_START) / AXIS_LEN) * 100;
                const widthPct = Math.max(((eh - sh) / AXIS_LEN) * 100, 1.5);
                const ids = resolveSessionTagIds(s, tags);
                const pieces = splitMinutesByGroup(s.mins ?? 0, ids, groupId, tags, groups);
                const parts =
                  pieces.length > 0
                    ? pieces
                    : [{ tagId: "", minutes: s.mins ?? 0 }];
                const total = parts.reduce((a, p) => a + p.minutes, 0) || 1;
                let acc = 0;
                return parts.map((p, pi) => {
                  const frac = p.minutes / total;
                  const segLeft = leftPct + widthPct * acc;
                  acc += frac;
                  const col = p.tagId ? primaryTagColor([p.tagId], tags) : UNCATEGORIZED_COLOR;
                  const path = p.tagId ? tagPathLabel(p.tagId, tags) : "未分類";
                  return (
                    <div
                      key={`${day.key}-${si}-${pi}`}
                      title={path}
                      style={{
                        position: "absolute",
                        left: `${segLeft}%`,
                        width: `${Math.max(widthPct * frac, 0.4)}%`,
                        top: 2,
                        bottom: 2,
                        borderRadius: 3,
                        background: col || TH.muted,
                      }}
                    />
                  );
                });
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
