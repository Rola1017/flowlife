import { useRef, type CSSProperties } from "react";
import { TH } from "@/lib/theme";

export function Chip({
  label,
  active,
  color = TH.accent,
  onClick,
  onLongPress,
  style = {},
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick?: () => void;
  onLongPress?: () => void;
  style?: CSSProperties;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const start = () => {
    if (!onLongPress) return;
    longFired.current = false;
    timer.current = setTimeout(() => {
      longFired.current = true;
      onLongPress();
    }, 450);
  };
  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const handleClick = () => {
    if (longFired.current) {
      longFired.current = false;
      return;
    }
    onClick?.();
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => {
        if (onLongPress) e.preventDefault();
      }}
      style={{
        padding: "4px 10px",
        borderRadius: 20,
        border: `1px solid ${active ? color : TH.border}`,
        background: active ? color + "22" : "transparent",
        color: active ? color : TH.muted,
        fontSize: 10,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
        ...style,
      }}
    >
      {label}
    </button>
  );
}
