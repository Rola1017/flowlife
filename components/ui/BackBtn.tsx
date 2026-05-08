import { TH } from "@/lib/theme";

export function BackBtn({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onBack}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "none",
        border: "none",
        color: TH.muted,
        fontSize: 13,
        cursor: "pointer",
        padding: "0 0 8px 0",
        fontWeight: 600,
      }}
    >
      ← {label}
    </button>
  );
}
