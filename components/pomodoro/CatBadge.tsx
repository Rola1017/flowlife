"use client";

import { useState } from "react";
import { CAT } from "@/lib/categories";
import { useTagsSnapshot } from "@/components/hooks/useTagsSnapshot";
import { primaryTagColor, tagPathLabel } from "@/lib/tagSelect";

export function CatBadge({
  cat1,
  cat2,
  cat3,
  tagIds,
}: {
  cat1?: string;
  cat2?: string;
  cat3?: string;
  tagIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const { tags } = useTagsSnapshot();
  if (tagIds?.length) {
    const extra = tagIds.length - 1;
    const color = primaryTagColor(tagIds, tags);
    const primary = tagPathLabel(tagIds[0], tags);
    return (
      <span
        onClick={extra ? () => setOpen((v) => !v) : undefined}
        style={{
          fontSize: 9,
          color,
          background: color + "22",
          padding: "1px 6px",
          borderRadius: 8,
          display: "inline-block",
          maxWidth: "100%",
          boxSizing: "border-box",
          wordBreak: "break-word",
          cursor: extra ? "pointer" : "default",
        }}
      >
        {primary}
        {extra > 0 ? ` +${extra}` : ""}
        {open && extra > 0 && (
          <span style={{ display: "block", marginTop: 2, color, fontWeight: 400 }}>
            {tagIds.map((id) => tagPathLabel(id, tags)).join("　")}
          </span>
        )}
      </span>
    );
  }
  if (!cat1) return null;
  const parts = [CAT.cat1Display(cat1), cat2, cat3].filter(Boolean);
  const color = CAT.deepColor(cat1, cat2);
  return (
    <span style={{ fontSize: 9, color, background: color + "22", padding: "1px 6px", borderRadius: 8, display: "inline-block", maxWidth: "100%", boxSizing: "border-box", wordBreak: "break-word" }}>
      {parts.join(" › ")}
    </span>
  );
}
