import type { CSSProperties, ReactNode } from "react";
import { TH } from "@/lib/theme";

export function SL({ children, style = {} }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ fontSize: 10, color: TH.muted, marginBottom: 7, ...style }}>{children}</div>;
}
