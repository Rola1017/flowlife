"use client";

import { TH } from "@/lib/theme";

/**
 * 可開關面板的關閉鈕唯一實作。min 44×44；手機／電腦皆顯示。
 * label 只准「取消」或「關閉」。
 */
export function PanelDismissButton({
  onClick,
  label = "取消",
}: {
  onClick: () => void;
  label?: "取消" | "關閉";
}) {
  return (
    <button
      type="button"
      data-panel-dismiss="1"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 44,
        minWidth: 44,
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${TH.border}`,
        background: "transparent",
        color: TH.muted,
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        boxSizing: "border-box",
      }}
    >
      {label}
    </button>
  );
}
