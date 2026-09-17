"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { TH } from "@/lib/theme";
import { Chip } from "@/components/ui/Chip";
import { useTagsSnapshot } from "@/components/hooks/useTagsSnapshot";
import type { Tag, TagGroup } from "@/lib/tags";
import { childrenOf, liveGroups, liveTags } from "@/lib/tagTree";
import { primaryTagColor, tagPathLabel } from "@/lib/tagSelect";

const H_SCROLL: CSSProperties = {
  display: "flex",
  gap: 4,
  overflowX: "auto",
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  WebkitOverflowScrolling: "touch",
  flexWrap: "wrap",
};

const TOUCH: CSSProperties = {
  minHeight: 40,
  minWidth: 40,
  boxSizing: "border-box",
  touchAction: "manipulation",
  flexShrink: 0,
};

export function MultiCategoryFilter({
  selected,
  onChange,
}: {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const { tags, groups } = useTagsSnapshot();
  const liveG = useMemo(() => liveGroups(groups), [groups]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const q = search.trim().toLowerCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, boxSizing: "border-box" }}>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜尋標籤…"
        style={{
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          background: "#15151B",
          border: `1px solid ${TH.border}`,
          borderRadius: 8,
          padding: "10px 12px",
          color: TH.text,
          fontSize: 13,
          outline: "none",
          minHeight: 40,
        }}
      />
      <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.45 }}>
        💡 同一個維度裡選多個＝其中之一就算；不同維度都選＝兩個都要符合
      </div>
      {liveG.map((g) => (
        <GroupBlock
          key={g.id}
          group={g}
          tags={tags}
          selected={selected}
          expanded={expanded}
          query={q}
          onToggle={toggle}
          onToggleExpand={toggleExpand}
        />
      ))}
    </div>
  );
}

function GroupBlock({
  group,
  tags,
  selected,
  expanded,
  query,
  onToggle,
  onToggleExpand,
}: {
  group: TagGroup;
  tags: Tag[];
  selected: Set<string>;
  expanded: Set<string>;
  query: string;
  onToggle: (id: string) => void;
  onToggleExpand: (id: string) => void;
}) {
  const live = liveTags(tags).filter((t) => t.groupId === group.id);
  if (!live.length) return null;

  if (query) {
    const hits = live.filter(
      (t) => t.name.toLowerCase().includes(query) || tagPathLabel(t.id, tags).toLowerCase().includes(query),
    );
    if (!hits.length) return null;
    return (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: TH.muted, marginBottom: 4 }}>{group.name}</div>
        <div style={H_SCROLL}>
          {hits.map((t) => (
            <span key={t.id} title={tagPathLabel(t.id, tags)}>
              <Chip
                label={t.name}
                active={selected.has(t.id)}
                color={primaryTagColor([t.id], tags)}
                onClick={() => onToggle(t.id)}
                style={{ fontSize: 9 }}
              />
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: TH.muted, marginBottom: 4 }}>{group.name}</div>
      <FilterTree
        tags={tags}
        groupId={group.id}
        parentId={undefined}
        depth={0}
        selected={selected}
        expanded={expanded}
        onToggle={onToggle}
        onToggleExpand={onToggleExpand}
      />
    </div>
  );
}

function FilterTree({
  tags,
  groupId,
  parentId,
  depth,
  selected,
  expanded,
  onToggle,
  onToggleExpand,
}: {
  tags: Tag[];
  groupId: string;
  parentId: string | undefined;
  depth: number;
  selected: Set<string>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onToggleExpand: (id: string) => void;
}) {
  if (depth > 20) return null;
  const kids = childrenOf(tags, parentId, groupId);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      {kids.map((t) => {
        const nested = childrenOf(tags, t.id, groupId);
        const open = expanded.has(t.id);
        return (
          <div key={t.id} style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0, paddingLeft: depth * 10 }}>
              {nested.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onToggleExpand(t.id)}
                  style={{
                    ...TOUCH,
                    width: 40,
                    border: "none",
                    background: "none",
                    color: TH.muted,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                  aria-label={open ? "收合" : "展開"}
                >
                  {open ? "▾" : "▸"}
                </button>
              ) : (
                <span style={{ width: 40, flexShrink: 0 }} />
              )}
              <span title={tagPathLabel(t.id, tags)}>
                <Chip
                  label={t.name}
                  active={selected.has(t.id)}
                  color={primaryTagColor([t.id], tags)}
                  onClick={() => onToggle(t.id)}
                  style={{ fontSize: 9 }}
                />
              </span>
            </div>
            {open && nested.length > 0 && (
              <FilterTree
                tags={tags}
                groupId={groupId}
                parentId={t.id}
                depth={depth + 1}
                selected={selected}
                expanded={expanded}
                onToggle={onToggle}
                onToggleExpand={onToggleExpand}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
