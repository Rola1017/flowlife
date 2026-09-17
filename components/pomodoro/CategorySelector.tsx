"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { TH } from "@/lib/theme";
import { resolveCatIds } from "@/lib/categories";
import { Chip } from "@/components/ui/Chip";
import { useTagsSnapshot } from "@/components/hooks/useTagsSnapshot";
import type { Tag, TagGroup } from "@/lib/tags";
import { childrenOf, liveGroups, liveTags } from "@/lib/tagTree";
import {
  loadTagCombos,
  primaryTagColor,
  removeTagFromSelection,
  selFromTagIds,
  splitComboLayers,
  tagPathLabel,
  tagsOfGroup,
  toggleTagInSelection,
  type TagSel,
} from "@/lib/tagSelect";

const H_SCROLL: CSSProperties = {
  display: "flex",
  gap: 6,
  overflowX: "auto",
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  WebkitOverflowScrolling: "touch",
  paddingBottom: 2,
};

const TOUCH: CSSProperties = {
  minHeight: 40,
  minWidth: 40,
  boxSizing: "border-box",
  touchAction: "manipulation",
  flexShrink: 0,
};

export function CategorySelector({
  tagIds,
  cat1 = "",
  cat2 = "",
  cat3 = "",
  onChange,
  onShowCategoryManager,
  showQuickLane = true,
}: {
  tagIds?: string[];
  cat1?: string;
  cat2?: string;
  cat3?: string;
  onChange: (next: TagSel) => void;
  onShowCategoryManager?: () => void;
  showQuickLane?: boolean;
}) {
  const { tags, groups } = useTagsSnapshot();
  const [combos, setCombos] = useState<string[][]>(() => loadTagCombos());
  const [pickerGroup, setPickerGroup] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const liveG = useMemo(() => liveGroups(groups), [groups]);

  const selected = useMemo(() => {
    if (tagIds?.length) return tagIds;
    if (!cat1) return [] as string[];
    const ids = resolveCatIds(cat1, cat2, cat3);
    const deepest = ids.cat3Id || ids.cat2Id || ids.cat1Id;
    return deepest ? [deepest] : [];
  }, [tagIds, cat1, cat2, cat3]);

  const emit = (nextIds: string[]) => onChange(selFromTagIds(nextIds, tags));

  const applyCombo = (ids: string[]) => {
    emit(ids);
    setCombos(loadTagCombos());
  };

  const lastCombo = combos[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minWidth: 0, gap: 8 }}>
        <div style={{ fontSize: 9, color: TH.muted, minWidth: 0 }}>分類標籤</div>
        {onShowCategoryManager && (
          <button
            type="button"
            onClick={onShowCategoryManager}
            style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, ...TOUCH, minWidth: "auto" }}
          >
            <span style={{ fontSize: 9, color: TH.muted }}>標籤管理</span>
            <span style={{ fontSize: 13 }}>⚙️</span>
          </button>
        )}
      </div>

      {showQuickLane && (
        <div style={{ minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, minWidth: 0 }}>
            <div style={{ fontSize: 9, color: TH.muted, flex: 1, minWidth: 0 }}>最近用過的組合</div>
            <button
              type="button"
              disabled={!lastCombo?.length}
              onClick={() => lastCombo && applyCombo(lastCombo)}
              style={{
                ...TOUCH,
                padding: "0 10px",
                borderRadius: 12,
                border: `1px solid ${lastCombo?.length ? TH.accent : TH.border}`,
                background: lastCombo?.length ? TH.accent + "22" : "transparent",
                color: lastCombo?.length ? TH.accent : TH.muted,
                fontSize: 10,
                fontWeight: 800,
                cursor: lastCombo?.length ? "pointer" : "not-allowed",
              }}
            >
              沿用上次
            </button>
          </div>
          {combos.length === 0 ? (
            <div style={{ fontSize: 9, color: TH.muted }}>💡 開過番茄後，這裡會出現最近 5 組，一鍵套用</div>
          ) : (
            <div style={H_SCROLL}>
              {combos.map((c) => (
                <ComboCard
                  key={c.join("|")}
                  tagIds={c}
                  tags={tags}
                  groups={groups}
                  active={selected.length === c.length && selected.every((id, i) => id === c[i])}
                  onApply={() => applyCombo(c)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {liveG.map((g) =>
        g.selectMode === "multi" ? (
          <MultiGroupBlock
            key={g.id}
            group={g}
            tags={tags}
            selected={tagsOfGroup(selected, g.id, tags)}
            allSelected={selected}
            onRemove={(id) => emit(removeTagFromSelection(selected, id))}
            onOpenPicker={() => {
              setSearch("");
              setPickerGroup(g.id);
              const roots = childrenOf(tags, undefined, g.id);
              setExpanded(new Set(roots.map((t) => t.id)));
            }}
          />
        ) : (
          <SingleGroupBlock
            key={g.id}
            group={g}
            tags={tags}
            selectedId={tagsOfGroup(selected, g.id, tags)[0]}
            onToggle={(id) => emit(toggleTagInSelection(selected, id, tags, groups))}
          />
        ),
      )}

      {pickerGroup && liveG.some((g) => g.id === pickerGroup) && (
        <TagTreePicker
          group={liveG.find((g) => g.id === pickerGroup)!}
          tags={tags}
          selected={selected}
          search={search}
          expanded={expanded}
          onSearch={setSearch}
          onToggleExpand={(id) =>
            setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onPick={(id) => emit(toggleTagInSelection(selected, id, tags, groups))}
          onClose={() => setPickerGroup(null)}
        />
      )}
    </div>
  );
}

function ComboCard({
  tagIds,
  tags,
  groups,
  active,
  onApply,
}: {
  tagIds: string[];
  tags: Tag[];
  groups: TagGroup[];
  active: boolean;
  onApply: () => void;
}) {
  const { domain, rest } = splitComboLayers(tagIds, tags, groups);
  const nameOf = (id: string) => tags.find((t) => t.id === id)?.name ?? tagPathLabel(id, tags).split(" › ").pop() ?? "";
  return (
    <button
      type="button"
      onClick={onApply}
      style={{
        ...TOUCH,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: 2,
        minHeight: 40,
        minWidth: 0,
        maxWidth: "100%",
        padding: "6px 10px",
        borderRadius: 12,
        border: `1px solid ${active ? primaryTagColor(tagIds, tags) : TH.border}`,
        background: active ? primaryTagColor(tagIds, tags) + "18" : TH.card,
        cursor: "pointer",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      {domain.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minWidth: 0, maxWidth: "100%" }}>
          {domain.map((id) => (
            <span
              key={id}
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: primaryTagColor([id], tags),
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}
            >
              {nameOf(id)}
            </span>
          ))}
        </div>
      )}
      {(domain.length ? rest : tagIds).length > 0 && (
        <div
          style={{
            fontSize: domain.length ? 9 : 12,
            fontWeight: domain.length ? 600 : 800,
            color: domain.length ? TH.muted : primaryTagColor(tagIds, tags),
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 220,
          }}
        >
          {(domain.length ? rest : tagIds).map(nameOf).join(" · ")}
        </div>
      )}
    </button>
  );
}

function MultiGroupBlock({
  group,
  tags,
  selected,
  allSelected,
  onRemove,
  onOpenPicker,
}: {
  group: TagGroup;
  tags: Tag[];
  selected: string[];
  allSelected: string[];
  onRemove: (id: string) => void;
  onOpenPicker: () => void;
}) {
  return (
    <div style={{ minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ fontSize: 9, color: TH.muted, marginBottom: 4 }}>
        {group.name}
        {group.required && <span style={{ color: TH.red }}> 必填</span>}
        <span style={{ color: TH.muted }}> · 可多選</span>
      </div>
      {group.required && selected.length === 0 && (
        <div style={{ fontSize: 9, color: TH.red, marginBottom: 4 }}>{group.name} 為必填</div>
      )}
      <div style={H_SCROLL}>
        {selected.map((id) => {
          const isPrimary = allSelected[0] === id;
          const color = primaryTagColor([id], tags);
          return (
            <div
              key={id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                height: 40,
                borderRadius: 20,
                border: `1px solid ${color}`,
                background: color + "22",
                flexShrink: 0,
                minWidth: 0,
                boxSizing: "border-box",
                paddingLeft: 4,
              }}
            >
              <button
                type="button"
                onClick={() => onRemove(id)}
                style={{
                  ...TOUCH,
                  border: "none",
                  background: "none",
                  color,
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: "pointer",
                  padding: "0 6px",
                  minWidth: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {isPrimary ? "主 " : ""}
                {tags.find((t) => t.id === id)?.name ?? tagPathLabel(id, tags)}
              </button>
              <button
                type="button"
                aria-label="移除"
                onClick={() => onRemove(id)}
                style={{
                  ...TOUCH,
                  width: 40,
                  border: "none",
                  background: "none",
                  color: TH.muted,
                  fontSize: 14,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={onOpenPicker}
          style={{
            ...TOUCH,
            padding: "0 12px",
            borderRadius: 20,
            border: `1px dashed ${TH.border}`,
            background: "transparent",
            color: TH.muted,
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ＋ 加標籤
        </button>
      </div>
      <div style={{ fontSize: 9, color: TH.muted, marginTop: 4 }}>💡 再點已選的標籤即可取消</div>
    </div>
  );
}

function SingleGroupBlock({
  group,
  tags,
  selectedId,
  onToggle,
}: {
  group: TagGroup;
  tags: Tag[];
  selectedId?: string;
  onToggle: (id: string) => void;
}) {
  const list = liveTags(tags).filter((t) => t.groupId === group.id);
  if (!list.length) return null;
  return (
    <div style={{ minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ fontSize: 9, color: TH.muted, marginBottom: 4 }}>
        {group.name}
        {group.required && <span style={{ color: TH.red }}> 必填</span>}
      </div>
      {group.required && !selectedId && (
        <div style={{ fontSize: 9, color: TH.red, marginBottom: 4 }}>{group.name} 為必填</div>
      )}
      <div style={H_SCROLL}>
        {list.map((t) => (
          <Chip
            key={t.id}
            label={t.name}
            active={selectedId === t.id}
            color={t.color || TH.accent}
            onClick={() => onToggle(t.id)}
            style={{ fontSize: 11, ...TOUCH }}
          />
        ))}
      </div>
    </div>
  );
}

function TagTreePicker({
  group,
  tags,
  selected,
  search,
  expanded,
  onSearch,
  onToggleExpand,
  onPick,
  onClose,
}: {
  group: TagGroup;
  tags: Tag[];
  selected: string[];
  search: string;
  expanded: Set<string>;
  onSearch: (q: string) => void;
  onToggleExpand: (id: string) => void;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const q = search.trim().toLowerCase();
  const live = liveTags(tags).filter((t) => t.groupId === group.id);
  const matches = q
    ? live
        .map((t) => ({ t, path: tagPathLabel(t.id, tags) }))
        .filter((x) => x.path.toLowerCase().includes(q) || x.t.name.toLowerCase().includes(q))
    : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.58)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`選擇${group.name}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 430,
          maxHeight: "80vh",
          background: TH.card,
          border: `1px solid ${TH.border}`,
          borderRadius: "16px 16px 0 0",
          padding: 12,
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: TH.text, flex: 1, minWidth: 0 }}>{group.name}</div>
          <button
            type="button"
            onClick={onClose}
            style={{ ...TOUCH, border: "none", background: "none", color: TH.muted, fontSize: 14, cursor: "pointer" }}
          >
            完成
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
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
        <div style={{ fontSize: 9, color: TH.muted }}>💡 再點已選的項目即可取消；選子標籤不會自動勾父層</div>
        <div style={{ overflowY: "auto", minHeight: 0, flex: 1, maxHeight: "52vh" }}>
          {matches ? (
            matches.length === 0 ? (
              <div style={{ fontSize: 11, color: TH.muted, padding: 12 }}>沒有符合的標籤</div>
            ) : (
              matches.map(({ t, path }) => (
                <PickerRow
                  key={t.id}
                  label={path}
                  picked={selected.includes(t.id)}
                  onPick={() => onPick(t.id)}
                />
              ))
            )
          ) : (
            <TreeNodes
              tags={tags}
              groupId={group.id}
              parentId={undefined}
              depth={0}
              selected={selected}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onPick={onPick}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TreeNodes({
  tags,
  groupId,
  parentId,
  depth,
  selected,
  expanded,
  onToggleExpand,
  onPick,
}: {
  tags: Tag[];
  groupId: string;
  parentId: string | undefined;
  depth: number;
  selected: string[];
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onPick: (id: string) => void;
}) {
  if (depth > 20) return null;
  const kids = childrenOf(tags, parentId, groupId);
  return (
    <>
      {kids.map((t) => {
        const nested = childrenOf(tags, t.id, groupId);
        const open = expanded.has(t.id);
        return (
          <div key={t.id}>
            <div style={{ display: "flex", alignItems: "center", minWidth: 0, paddingLeft: depth * 12 }}>
              {nested.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onToggleExpand(t.id)}
                  style={{ ...TOUCH, width: 40, border: "none", background: "none", color: TH.muted, cursor: "pointer" }}
                  aria-label={open ? "收合" : "展開"}
                >
                  {open ? "▾" : "▸"}
                </button>
              ) : (
                <span style={{ width: 40, flexShrink: 0 }} />
              )}
              <PickerRow label={t.name} picked={selected.includes(t.id)} onPick={() => onPick(t.id)} />
            </div>
            {open && nested.length > 0 && (
              <TreeNodes
                tags={tags}
                groupId={groupId}
                parentId={t.id}
                depth={depth + 1}
                selected={selected}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
                onPick={onPick}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function PickerRow({ label, picked, onPick }: { label: string; picked: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        ...TOUCH,
        flex: 1,
        minWidth: 0,
        textAlign: "left",
        border: "none",
        background: picked ? TH.accent + "22" : "transparent",
        color: picked ? TH.accent : TH.text,
        fontSize: 13,
        fontWeight: picked ? 800 : 600,
        cursor: "pointer",
        padding: "8px 10px",
        borderRadius: 8,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {picked ? "✓ " : ""}
      {label}
    </button>
  );
}
