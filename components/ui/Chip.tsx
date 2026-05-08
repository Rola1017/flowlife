import type { CSSProperties } from "react";
import { TH } from "@/lib/theme";

export function Chip({
  label,
  active,
  color = TH.accent,
  onClick,
  style = {},
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
        ...style,
      }}
    >
      {label}
    </button>
  );
}
