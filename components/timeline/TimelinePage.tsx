"use client";

import { Card, SL } from "@/components/ui/Card";
import { TodoCard } from "@/components/todo/TodoCard";
import { VerticalTimeline } from "@/components/timeline/VerticalTimeline";
import { CFG } from "@/lib/config";
import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { MOCK } from "@/lib/mock";
import { DS, DT, toM } from "@/lib/utils";

export function TimelinePage({
  todos,
  onStart,
  onEnd,
  onToggleDone,
}: {
  todos: Record<string, unknown>[];
  onStart: (id: number) => void;
  onEnd: (id: number) => void;
  onToggleDone: (id: number) => void;
}) {
  const now = 15 * 60 + 30,
    nowPct = ((now - DS) / DT) * 100;
  const active = todos.filter(
    (t: { date?: string; phase?: string }) => t.date === CFG.TODAY_STR && t.phase !== "done",
  );
  const done = todos.filter(
    (t: { date?: string; phase?: string }) => t.date === CFG.TODAY_STR && t.phase === "done",
  );
  const { ACT } = MOCK.schedule;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Card style={{ padding: "8px 12px" }}>
        <SL>今日待辦</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
          {active.map((t) => (
            <TodoCard key={t.id as number} todo={t} onStart={onStart} onEnd={onEnd} onToggleDone={onToggleDone} />
          ))}
        </div>
        {done.length > 0 && (
          <>
            <div style={{ fontSize: 9, color: TH.muted, marginBottom: 4 }}>✅ 已完成</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {done.map((t) => (
                <TodoCard key={t.id as number} todo={t} onStart={onStart} onEnd={onEnd} onToggleDone={onToggleDone} />
              ))}
            </div>
          </>
        )}
        <div
          style={{
            height: 10,
            borderRadius: 5,
            overflow: "hidden",
            background: "#1C1C22",
            position: "relative",
            marginTop: 8,
          }}
        >
          {ACT.map((item, i) => {
            const l = ((toM(item.start) - DS) / DT) * 100,
              w = ((toM(item.end) - toM(item.start)) / DT) * 100;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${l}%`,
                  width: `${w}%`,
                  height: "100%",
                  background: item.deep ? "#1F2937" : item.idle ? "#374151" : CAT.cat1Color(item.cat1 ?? "") || "#6B7280",
                }}
              />
            );
          })}
        </div>
      </Card>
      <VerticalTimeline nowPct={nowPct} />
    </div>
  );
}
