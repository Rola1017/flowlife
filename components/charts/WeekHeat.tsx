import { CAT } from "@/lib/categories";
import { TH } from "@/lib/theme";
import { toLocalDateStr } from "@/lib/utils";
import type { Session } from "@/lib/types";

const AXIS_START = 6;
const AXIS_LEN = 17;

function toHour(t?: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

export function WeekHeat({ sessions, days = 7 }: { sessions: Session[]; days?: number }) {
  const today = new Date();
  const dayList: { key: string; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toLocalDateStr(d);
    const label =
      i === 0
        ? "今天"
        : `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    dayList.push({ key, label });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {dayList.map((day) => {
        const daySessions = sessions.filter((s) => s.date === day.key);
        return (
          <div key={day.key} style={{ display: "flex", gap: 4, alignItems: "center" }}>
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
                const left = ((sh - AXIS_START) / AXIS_LEN) * 100;
                const width = Math.max(((eh - sh) / AXIS_LEN) * 100, 1.5);
                const col = CAT.deepColorFull(s.cat1, s.cat2 || undefined, s.cat3 || undefined);
                return (
                  <div
                    key={`${day.key}-${si}`}
                    style={{
                      position: "absolute",
                      left: `${left}%`,
                      width: `${width}%`,
                      top: 2,
                      bottom: 2,
                      borderRadius: 3,
                      background: col || TH.muted,
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
