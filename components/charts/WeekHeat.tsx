import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { MOCK } from "@/lib/mock";

export function WeekHeat({ days = 7 }: { days?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {MOCK.heat.slice(-days).map((day, i) => (
        <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
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
            {day.day}
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
            {day.s.map((s, si) => {
              const T = 17,
                l = ((s.s - 6) / T) * 100,
                w = ((s.e - s.s) / T) * 100;
              return (
                <div
                  key={si}
                  style={{
                    position: "absolute",
                    left: `${l}%`,
                    width: `${w}%`,
                    top: 2,
                    bottom: 2,
                    borderRadius: 3,
                    background: CAT.cat1Color(s.c) || TH.muted,
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
