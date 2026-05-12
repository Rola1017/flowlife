import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { MOCK } from "@/lib/mock";
import { pctPos, pctH, buildTimelineHours, DS, DE, toM } from "@/lib/utils";

type TodoOverlay = {
  id: number;
  text: string;
  startTime: string;
  endTime: string;
  endAt?: string;
};

type DoneTodoMarker = {
  todo: TodoOverlay;
  doneEndTime: string;
  top: number;
};

export function VerticalTimeline({
  nowPct,
  showNowLine = true,
  pendingTodos,
  doneTodos,
}: {
  nowPct: number;
  showNowLine?: boolean;
  pendingTodos?: TodoOverlay[];
  doneTodos?: TodoOverlay[];
}) {
  const hours = buildTimelineHours();
  const { PLN, ACT } = MOCK.schedule;
  const isVisibleTodo = (todo: TodoOverlay) => {
    const mins = toM(todo.startTime);
    const pos = pctPos(todo.startTime);
    return mins >= DS && mins <= DE && pos >= 0 && pos <= 100;
  };
  const getVisibleDoneTime = (todo: TodoOverlay) => {
    const endTime = todo.endAt?.slice(0, 5);
    if (!endTime) return null;
    const top = pctPos(endTime);
    return top >= 0 && top <= 100 ? { endTime, top } : null;
  };
  const doneTodoGroups = (doneTodos ?? []).reduce<{ top: number; items: DoneTodoMarker[] }[]>((groups, todo) => {
    const doneTime = getVisibleDoneTime(todo);
    if (!doneTime) return groups;

    const group = groups.find((g) => Math.abs(g.top - doneTime.top) < 3);
    const marker = {
      todo,
      doneEndTime: doneTime.endTime,
      top: doneTime.top,
    };

    if (group) group.items.push(marker);
    else groups.push({ top: doneTime.top, items: [marker] });

    return groups;
  }, []);

  return (
    <div style={{ display: "flex" }}>
      <div style={{ width: 34, flexShrink: 0, position: "relative", height: 560 }}>
        {hours.map((h) => (
          <div
            key={h.label}
            style={{
              position: "absolute",
              top: `${h.pos}%`,
              right: 4,
              fontSize: 8,
              color: TH.muted,
              transform: "translateY(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {h.label}
          </div>
        ))}
      </div>
      <div
        style={{
          flex: 1,
          position: "relative",
          height: 560,
          background: "#0D0D0F",
          borderRadius: 8,
          border: `1px solid ${TH.border}`,
        }}
      >
        {PLN.map((item, i) => {
          const top = pctPos(item.start),
            h = pctH(item.start, item.end);
          const col = CAT.cat1Color(item.cat1 ?? "");
          return (
            <div
              key={`p${i}`}
              style={{
                position: "absolute",
                top: `${top}%`,
                height: `${h}%`,
                left: 4,
                right: "47%",
                background: col ? col + "2E" : "#1F293777",
                borderRadius: 5,
                padding: "2px 5px",
                overflow: "hidden",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: col || "#9CA3AF",
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </div>
            </div>
          );
        })}

        {pendingTodos?.filter(isVisibleTodo).map((todo) => {
          const top = pctPos(todo.startTime);
          const hasRange = todo.endTime && todo.endTime !== todo.startTime;
          const spanH = hasRange ? Math.max(pctH(todo.startTime, todo.endTime), 2) : 0;
          return (
            <div
              key={`td-${todo.id}`}
              style={{
                position: "absolute",
                top: `${top}%`,
                height: hasRange ? `${spanH}%` : "auto",
                left: "35%",
                transform: "translateX(-50%)",
                width: "fit-content",
                maxWidth: "44%",
                zIndex: 6,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  border: `1.5px solid ${TH.yellow}`,
                  borderRadius: 4,
                  padding: "2px 6px",
                  background: "rgba(9,9,11,0.9)",
                  marginLeft: 2,
                  marginRight: 2,
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    color: TH.yellow,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {todo.text}
                </div>
                {todo.startTime && (
                  <div style={{ fontSize: 7, color: TH.yellow + "99" }}>
                    {todo.startTime}
                    {todo.endTime ? `～${todo.endTime}` : ""}
                  </div>
                )}
              </div>
              {hasRange && (
                <div
                  style={{
                    flex: 1,
                    width: 2,
                    background: TH.yellow,
                    marginTop: 1,
                    borderRadius: 1,
                    marginLeft: "auto",
                    marginRight: "auto",
                  }}
                />
              )}
            </div>
          );
        })}

        {ACT.map((item, i) => {
          const top = pctPos(item.start),
            h = pctH(item.start, item.end);
          const col = item.deep ? "#1F2937" : item.idle ? "#1E2A3A" : CAT.cat1Color(item.cat1 ?? "") || "#374151";
          return (
            <div
              key={`a${i}`}
              style={{
                position: "absolute",
                top: `${top}%`,
                height: `${h}%`,
                left: "47%",
                right: 4,
                background: col,
                borderRadius: 5,
                padding: "2px 5px",
                overflow: "hidden",
                zIndex: 3,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: item.deep || item.idle ? "#4B5563" : "#fff",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </div>
            </div>
          );
        })}

        {doneTodoGroups.map((group, groupIndex) => {
          return (
            <div
              key={`tdd-group-${groupIndex}-${group.top}`}
              style={{
                position: "absolute",
                top: `${group.top}%`,
                left: "65%",
                transform: "translateX(-50%)",
                zIndex: 6,
                display: "flex",
                flexDirection: "row",
                gap: 0,
                pointerEvents: "none",
              }}
            >
              {group.items.map((marker) => (
                <div
                  key={`tdd-${marker.todo.id}`}
                  style={{
                    border: "1px solid #3A3A45",
                    borderRadius: 4,
                    padding: "2px 6px",
                    background: "rgba(15,15,18,0.88)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 8,
                      color: "#6B7280",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {marker.todo.text}
                  </div>
                  <div style={{ fontSize: 7, color: "#4B5563" }}>{marker.doneEndTime}</div>
                </div>
              ))}
            </div>
          );
        })}

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 1,
            background: "rgba(255,255,255,.04)",
            zIndex: 4,
            pointerEvents: "none",
          }}
        />

        {showNowLine && nowPct >= 0 && nowPct <= 100 && (
          <div
            style={{
              position: "absolute",
              top: `${nowPct}%`,
              left: 0,
              right: 0,
              height: 2,
              background: TH.red,
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -4,
                top: -4,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: TH.red,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
