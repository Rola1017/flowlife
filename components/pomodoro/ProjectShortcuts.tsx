"use client";

import { useRef } from "react";
import { TH } from "@/lib/theme";
import { Chip } from "@/components/ui/Chip";
import { useTagsSnapshot } from "@/components/hooks/useTagsSnapshot";
import {
  canStartWithTags,
  latestComboContaining,
  loadTagCombos,
  primaryTagColor,
  projectLeafTags,
  selFromTagIds,
  tagIdsForProjectShortcut,
  type TagSel,
} from "@/lib/tagSelect";
import type { Tag } from "@/lib/tags";

const H_SCROLL = {
  display: "flex",
  gap: 6,
  overflowX: "auto" as const,
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box" as const,
  WebkitOverflowScrolling: "touch" as const,
  paddingBottom: 2,
};

export function ProjectShortcuts({
  onApply,
  onQuickStart,
}: {
  onApply: (sel: TagSel) => void;
  onQuickStart: (sel: TagSel & { name: string }) => void;
}) {
  const { tags, groups } = useTagsSnapshot();
  const leaves = projectLeafTags(tags, groups);
  if (!leaves.length) return null;

  const applyOnly = (tag: Tag) => {
    onApply(selFromTagIds(tagIdsForProjectShortcut(loadTagCombos(), tag.id), tags));
  };

  const tap = (tag: Tag) => {
    const combo = latestComboContaining(loadTagCombos(), tag.id);
    if (combo && canStartWithTags(combo, groups, tags)) {
      const sel = selFromTagIds(combo, tags);
      onQuickStart({ ...sel, name: tag.name });
      return;
    }
    onApply(selFromTagIds(combo ?? [tag.id], tags));
  };

  return (
    <div style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ fontSize: 9, color: TH.muted, marginBottom: 4 }}>專案快捷</div>
      <div style={H_SCROLL}>
        {leaves.map((tag) => {
          const color = primaryTagColor([tag.id], tags);
          return (
            <div key={tag.id} style={{ display: "flex", alignItems: "stretch", flexShrink: 0, minWidth: 0 }}>
              <Chip
                label={tag.name}
                active
                color={color}
                onClick={() => tap(tag)}
                onLongPress={() => applyOnly(tag)}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  fontSize: 12,
                  fontWeight: 800,
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                }}
              />
              <ApplyOnlyBtn color={color} onApply={() => applyOnly(tag)} />
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: TH.muted, marginTop: 4, lineHeight: 1.4 }}>
        💡 點一下＝用上次同樣的設定直接開始；還沒用過的專案會先幫你帶入，讓你補選領域
      </div>
    </div>
  );
}

function ApplyOnlyBtn({ color, onApply }: { color: string; onApply: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const start = () => {
    longFired.current = false;
    timer.current = setTimeout(() => {
      longFired.current = true;
      onApply();
    }, 450);
  };
  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return (
    <button
      type="button"
      aria-label="只套用標籤"
      onClick={() => {
        if (longFired.current) {
          longFired.current = false;
          return;
        }
        onApply();
      }}
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        minHeight: 44,
        minWidth: 36,
        padding: "0 8px",
        borderRadius: "0 20px 20px 0",
        border: `1px solid ${color}`,
        borderLeft: "none",
        background: color + "22",
        color,
        fontSize: 14,
        fontWeight: 800,
        cursor: "pointer",
        flexShrink: 0,
        boxSizing: "border-box",
        touchAction: "manipulation",
      }}
    >
      ›
    </button>
  );
}
