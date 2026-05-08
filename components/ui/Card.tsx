import type { CSSProperties, ReactNode } from "react";
import { TH } from "@/lib/theme";

export function Card({ children, style = {} }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: TH.card,
        border: `1px solid ${TH.border}`,
        borderRadius: 14,
        padding: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export { SL } from "./SL";
