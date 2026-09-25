import type { CSSProperties, ReactNode } from "react";
import { cardStyle, type CardTone } from "@/lib/cardTone";
import { TH } from "@/lib/theme";

export function Card({
  children,
  style = {},
  tone = "neutral",
}: {
  children: ReactNode;
  style?: CSSProperties;
  tone?: CardTone;
}) {
  return (
    <div
      style={{
        background: TH.card,
        borderRadius: 14,
        padding: 14,
        boxSizing: "border-box",
        minWidth: 0,
        ...cardStyle(tone),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export { SL } from "./SL";
