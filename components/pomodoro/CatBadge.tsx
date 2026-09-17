"use client";

import { useState } from "react";
import { CAT } from "@/lib/categories";
import { TH } from "@/lib/theme";
import { useTagsSnapshot } from "@/components/hooks/useTagsSnapshot";
import { primaryTagColor, sessionCatLabels, tagPathLabel } from "@/lib/tagSelect";

export function CatHeading({
  cat1,
  cat2,
  cat3,
  tagIds,
  titleSize = 12,
  pathSize = 9,
  showDot = false,
}: {
  cat1?: string;
  cat2?: string;
  cat3?: string;
  tagIds?: string[];
  titleSize?: number;
  pathSize?: number;
  showDot?: boolean;
}) {
  const { tags } = useTagsSnapshot();
  const { leaf, path } = sessionCatLabels({ tagIds, cat1, cat2, cat3 }, tags);
  const color = tagIds?.length
    ? primaryTagColor(tagIds, tags)
    : CAT.deepColorFull(cat1 ?? "", cat2 || undefined, cat3 || undefined);
  const showPath = !!path && path !== leaf;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 5,
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      {showDot && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color || TH.muted,
            flexShrink: 0,
            alignSelf: "center",
          }}
        />
      )}
      <span
        style={{
          fontSize: titleSize,
          fontWeight: 800,
          color: TH.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {leaf}
      </span>
      {showPath && (
        <span
          style={{
            fontSize: pathSize,
            color: TH.muted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          {path}
        </span>
      )}
    </span>
  );
}

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
    const { leaf, path } = sessionCatLabels({ tagIds }, tags);
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
        <span style={{ fontWeight: 800 }}>{leaf}</span>
        {path && path !== leaf && (
          <span style={{ fontSize: 7, color: TH.muted, marginLeft: 4 }}>{path}</span>
        )}
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
  const { leaf, path } = sessionCatLabels({ cat1, cat2, cat3 });
  const color = CAT.deepColor(cat1, cat2);
  return (
    <span style={{ fontSize: 9, color, background: color + "22", padding: "1px 6px", borderRadius: 8, display: "inline-block", maxWidth: "100%", boxSizing: "border-box", wordBreak: "break-word" }}>
      <span style={{ fontWeight: 800 }}>{leaf}</span>
      {path && path !== leaf && (
        <span style={{ fontSize: 7, color: TH.muted, marginLeft: 4 }}>{path}</span>
      )}
    </span>
  );
}
