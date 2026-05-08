import { CAT } from "@/lib/categories";

export function CatBadge({ cat1, cat2, cat3 }: { cat1: string; cat2?: string; cat3?: string }) {
  if (!cat1) return null;
  const parts = [cat1, cat2, cat3].filter(Boolean);
  const color = CAT.deepColor(cat1, cat2);
  return (
    <span style={{ fontSize: 9, color, background: color + "22", padding: "1px 6px", borderRadius: 8 }}>
      {parts.join(" › ")}
    </span>
  );
}
