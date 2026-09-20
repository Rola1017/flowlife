"use client";

import { Chip } from "@/components/ui/Chip";
import { TH } from "@/lib/theme";
import { SchedulePage } from "./SchedulePage";
import { ScheduleWeekPage } from "./ScheduleWeekPage";

export type ScheduleHubView = "calendar" | "template";

export function ScheduleHub({
  view,
  onChangeView,
  onShowCategoryManager,
}: {
  view: ScheduleHubView;
  onChangeView: (v: ScheduleHubView) => void;
  onShowCategoryManager: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
        <Chip
          label="課表行事曆"
          active={view === "calendar"}
          color={TH.accent}
          onClick={() => onChangeView("calendar")}
          style={{ fontSize: 11, flex: 1, flexShrink: 1, justifyContent: "center", minHeight: 40, whiteSpace: "normal", textAlign: "center" }}
        />
        <Chip
          label="課表常用模板"
          active={view === "template"}
          color={TH.accent}
          onClick={() => onChangeView("template")}
          style={{ fontSize: 11, flex: 1, flexShrink: 1, justifyContent: "center", minHeight: 40, whiteSpace: "normal", textAlign: "center" }}
        />
      </div>
      {view === "calendar" ? (
        <ScheduleWeekPage onShowCategoryManager={onShowCategoryManager} />
      ) : (
        <SchedulePage hideBack onShowCategoryManager={onShowCategoryManager} />
      )}
    </div>
  );
}
