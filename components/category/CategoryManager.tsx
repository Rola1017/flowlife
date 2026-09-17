"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { BackBtn } from "@/components/ui/BackBtn";
import { Card, SL } from "@/components/ui/Card";
import { SortableList } from "@/components/ui/SortableList";
import { TH } from "@/lib/theme";
import { CAT, categoriesFromDomainTags, saveCategoriesOnly } from "@/lib/categories";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { ensureTagsMigrated } from "@/lib/tagsMigrate";
import { loadTagGroups, loadTags, saveTagGroups, saveTags } from "@/lib/tagsStore";
import type { Tag, TagGroup } from "@/lib/tags";
import { DELETED_TAG_LABEL, TAG_GROUP_IDS } from "@/lib/tags";
import {
  addChildTag,
  addGroup,
  childrenOf,
  countTagsUsage,
  demoteTag,
  flattenScheduleCells,
  liveGroups,
  patchGroup,
  patchTag,
  promoteTag,
  reorderGroups,
  reorderSiblings,
  softDeleteGroup,
  softDeleteTagAndDescendants,
  tagDepth,
  type CatRef,
} from "@/lib/tagTree";
import type { Session, Todo } from "@/lib/types";

const DEFAULT_PALETTE = [
  "#EA0000",
  "#FFAAD5",
  "#FF00FF",
  "#9F35FF",
  "#0000E3",
  "#46A3FF",
  "#4DFFFF",
  "#4EFEB3",
  "#28FF28",
  "#C2FF68",
  "#FFFF37",
  "#EAC100",
  "#FF8000",
  "#FF5809",
  "#AD5A5A",
  "#AFAF61",
  "#81C0C0",
  "#9999CC",
  "#AE57A4",
  "#9D9D9D",
];

const HINT = {
  selectMode: "💡 可多選＝一筆資料能同時掛好幾個（例如同時是事業和學習）",
  required: "💡 必填＝新增番茄或待辦時一定要選一個",
  isTimeDestination:
    "💡 打開＝這個維度會參與時數分攤（例如「領域」「專案」）。判準：這個維度所有標籤的時數加起來，會不會剛好等於總時數？像「難易度」「來源」這種只是註記的，不要打開。",
};

function cascadeRename(level: "cat1" | "cat2" | "cat3", oldName: string, newName: string) {
  if (oldName === newName) return;

  const sessions = loadJSON<Record<string, unknown>[]>(LS_KEYS.sessions, []);
  let sChanged = false;
  for (const s of sessions) {
    if (s[level] === oldName) {
      s[level] = newName;
      sChanged = true;
    }
  }
  if (sChanged) saveJSON(LS_KEYS.sessions, sessions);

  const coinLog = loadJSON<Record<string, unknown>[]>(LS_KEYS.coinIncomeLog, []);
  let cChanged = false;
  for (const r of coinLog) {
    if (r[level] === oldName) {
      r[level] = newName;
      cChanged = true;
    }
  }
  if (cChanged) saveJSON(LS_KEYS.coinIncomeLog, coinLog);

  const week = loadJSON<Record<string, Record<string, unknown>[]>>(LS_KEYS.weekSchedule, {});
  let wChanged = false;
  for (const day of Object.keys(week)) {
    const rows = week[day];
    if (!Array.isArray(rows)) continue;
    for (const cell of rows) {
      if (cell && cell[level] === oldName) {
        cell[level] = newName;
        wChanged = true;
      }
    }
  }
  if (wChanged) saveJSON(LS_KEYS.weekSchedule, week);
}

function loadUsageData() {
  const sessions = loadJSON<Session[]>(LS_KEYS.sessions, []);
  const todos = loadJSON<Todo[]>(LS_KEYS.todos, []);
  const week = loadJSON<Record<string, CatRef[]>>(LS_KEYS.weekSchedule, {});
  const ovs = loadJSON<Record<string, { courses?: CatRef[] }>>(LS_KEYS.dayOverrides, {});
  return {
    sessions,
    todos,
    scheduleCells: flattenScheduleCells(week, ovs),
  };
}

function usageConfirm(name: string, counts: { sessions: number; todos: number; schedule: number }, extra: string) {
  return `${extra}這個標籤有 ${counts.sessions} 筆番茄、${counts.todos} 筆待辦、${counts.schedule} 個課表格子在使用，刪除後它們會顯示為「${DELETED_TAG_LABEL}」。確定刪除「${name}」？`;
}

function ColorPicker({
  value,
  onChange,
  onClose,
  palette,
  onPaletteChange,
}: {
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
  palette: string[];
  onPaletteChange: (index: number, hex: string) => void;
}) {
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState<number | null>(null);

  const handleColorInput = (hex: string) => {
    if (selectedPaletteIndex !== null) {
      onPaletteChange(selectedPaletteIndex, hex);
    }
    onChange(hex);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 200,
        background: TH.card,
        border: `1px solid ${TH.border}`,
        borderRadius: 10,
        padding: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        minWidth: 200,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 32px)",
          gap: 6,
          marginBottom: 8,
        }}
      >
        {palette.map((c, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              if (selectedPaletteIndex === index) {
                setSelectedPaletteIndex(null);
              } else {
                setSelectedPaletteIndex(index);
                onChange(c);
              }
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "none",
              outline: selectedPaletteIndex === index ? "2px solid white" : "none",
              background: c,
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: 9, color: TH.muted, margin: "0 0 8px", lineHeight: 1.4 }}>
        點選格子後，用下方色輪調整，顏色會固定在那一格
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => handleColorInput(e.target.value)}
          style={{ width: 36, height: 28, border: "none", padding: 0, cursor: "pointer" }}
        />
        <span style={{ fontSize: 10, color: TH.muted, fontFamily: "monospace" }}>{value}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          width: "100%",
          padding: "7px",
          borderRadius: 8,
          border: "none",
          background: TH.accent,
          color: "#fff",
          fontSize: 11,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        ✓ 確認
      </button>
    </div>
  );
}

function RenameInput({
  value,
  onCommit,
  style,
}: {
  value: string;
  onCommit: (v: string) => void;
  style?: CSSProperties;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const t = draft.trim();
        if (t && t !== value) onCommit(t);
        else setDraft(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      style={{
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
        background: TH.bg,
        border: `1px solid ${TH.border}`,
        borderRadius: 6,
        padding: "4px 8px",
        color: TH.text,
        fontSize: 12,
        fontWeight: 700,
        ...style,
      }}
    />
  );
}

function HintDot({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ flexShrink: 0, minWidth: 0, maxWidth: "100%" }}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="說明"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 12,
          lineHeight: 1,
        }}
      >
        💡
      </button>
      {open && (
        <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.45, marginTop: 4, minWidth: 0 }}>
          {text}
        </div>
      )}
    </div>
  );
}

const btnSm: CSSProperties = {
  background: "none",
  border: `1px solid ${TH.border}`,
  borderRadius: 6,
  color: TH.muted,
  fontSize: 10,
  padding: "2px 6px",
  cursor: "pointer",
  flexShrink: 0,
};

export function CategoryManager({ onBack }: { onBack: () => void }) {
  const [groups, setGroups] = useState<TagGroup[]>(() => {
    ensureTagsMigrated();
    return loadTagGroups();
  });
  const [tags, setTags] = useState<Tag[]>(() => loadTags());
  const live = useMemo(() => liveGroups(groups), [groups]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => liveGroups(loadTagGroups())[0]?.id ?? null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [palette, setPalette] = useState<string[]>(() => loadJSON(LS_KEYS.colorPalette, DEFAULT_PALETTE));

  const selected = live.find((g) => g.id === selectedGroupId) ?? live[0] ?? null;

  const handlePaletteChange = (index: number, hex: string) => {
    const next = [...palette];
    next[index] = hex;
    setPalette(next);
    saveJSON(LS_KEYS.colorPalette, next);
  };

  const persistGroups = useCallback((next: TagGroup[]) => {
    setGroups(next);
    saveTagGroups(next);
  }, []);

  const persistTags = useCallback((next: Tag[]) => {
    setTags(next);
    saveTags(next);
    saveCategoriesOnly(categoriesFromDomainTags(next));
  }, []);

  const addNewGroup = () => {
    const name = window.prompt("新群組名稱");
    if (!name?.trim()) return;
    const next = addGroup(groups, { name: name.trim() });
    persistGroups(next);
    const created = liveGroups(next).at(-1);
    if (created) setSelectedGroupId(created.id);
  };

  const deleteGroup = (g: TagGroup) => {
    const seed = tags.filter((t) => t.groupId === g.id && !t.deletedAt).map((t) => t.id);
    const counts = countTagsUsage(seed, tags, loadUsageData());
    const nTags = seed.length;
    const msg = `刪除群組「${g.name}」會一併軟刪除其下 ${nTags} 個標籤。這個群組有 ${counts.sessions} 筆番茄、${counts.todos} 筆待辦、${counts.schedule} 個課表格子在使用，刪除後它們會顯示為「${DELETED_TAG_LABEL}」。確定刪除？`;
    if (!window.confirm(msg)) return;
    const out = softDeleteGroup(groups, tags, g.id, new Date().toISOString());
    persistGroups(out.groups);
    persistTags(out.tags);
    const remain = liveGroups(out.groups);
    setSelectedGroupId(remain[0]?.id ?? null);
  };

  const renameTag = (tag: Tag, name: string) => {
    const next = patchTag(tags, tag.id, { name });
    persistTags(next);
    if (tag.groupId === TAG_GROUP_IDS.domain) {
      const depth = tagDepth(tags, tag.id);
      if (depth === 0) cascadeRename("cat1", tag.name, name);
      else if (depth === 1) cascadeRename("cat2", tag.name, name);
      else if (depth === 2) cascadeRename("cat3", tag.name, name);
    }
  };

  const deleteTag = (tag: Tag) => {
    if (tag.name === "未分類" && !tag.parentId) return;
    const counts = countTagsUsage([tag.id], tags, loadUsageData());
    const kids = tags.filter((t) => t.parentId === tag.id && !t.deletedAt).length;
    const extra = kids > 0 ? `刪除後其所有子孫也會一併軟刪除。` : "";
    if (!window.confirm(usageConfirm(tag.name, counts, extra))) return;
    persistTags(softDeleteTagAndDescendants(tags, tag.id, new Date().toISOString()));
  };

  const addTagUnder = (groupId: string, parentId: string | undefined, parentColor?: string) => {
    const name = window.prompt(parentId ? "新子標籤名稱" : "新標籤名稱");
    if (!name?.trim()) return;
    const next = addChildTag(tags, {
      groupId,
      parentId,
      name: name.trim(),
      color: parentColor ?? "#3B82F6",
    });
    persistTags(next);
    if (parentId) setExpanded((e) => ({ ...e, [parentId]: true }));
  };

  const applyPromote = (id: string) => {
    const next = promoteTag(tags, id);
    if (!next) return;
    persistTags(next);
  };

  const applyDemote = (id: string) => {
    const next = demoteTag(tags, id);
    if (!next) return;
    persistTags(next);
  };

  const isExpanded = (id: string, depth: number) => expanded[id] ?? depth < 2;

  const renderTree = (groupId: string, parentId: string | undefined, depth: number) => {
    const items = childrenOf(tags, parentId, groupId);
    if (items.length === 0 && depth > 0) return null;
    return (
      <SortableList
        items={items}
        getId={(t) => t.id}
        gap={depth === 0 ? 8 : 6}
        onReorder={(from, to) => persistTags(reorderSiblings(tags, groupId, parentId, from, to))}
        renderItem={(tag, _i, handle) => {
          const color = tag.color ?? "#6B7280";
          const open = isExpanded(tag.id, depth);
          const canPromote = !!tag.parentId;
          const sibs = childrenOf(tags, tag.parentId, groupId);
          const canDemote = sibs.findIndex((t) => t.id === tag.id) > 0;
          return (
            <div
              style={{
                border: depth === 0 ? `1px solid ${TH.border}` : undefined,
                borderLeft: depth > 0 ? `3px solid ${color}` : undefined,
                borderRadius: depth === 0 ? 10 : 0,
                overflow: "hidden",
                minWidth: 0,
                paddingLeft: depth > 0 ? 8 : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 6,
                  padding: depth === 0 ? "8px 10px" : "4px 0",
                  background: depth === 0 ? color + "18" : undefined,
                  minWidth: 0,
                }}
              >
                <span
                  {...handle}
                  style={{
                    ...handle.style,
                    flexShrink: 0,
                    color: TH.muted,
                    fontSize: 14,
                    lineHeight: 1,
                    padding: "4px 2px",
                  }}
                  aria-label="拖曳排序"
                >
                  ⋮⋮
                </span>
                <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setColorPickerId(colorPickerId === tag.id ? null : tag.id)}
                    style={{
                      width: depth === 0 ? 22 : 18,
                      height: depth === 0 ? 22 : 18,
                      borderRadius: 6,
                      border: `1px solid ${TH.border}`,
                      background: color,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  />
                  {colorPickerId === tag.id && (
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setColorPickerId(null)} />
                      <ColorPicker
                        value={color}
                        onChange={(c) => persistTags(patchTag(tags, tag.id, { color: c }))}
                        onClose={() => setColorPickerId(null)}
                        palette={palette}
                        onPaletteChange={handlePaletteChange}
                      />
                    </>
                  )}
                </div>
                {depth === 0 && CAT.cat1Emoji(tag.name) ? (
                  <span style={{ flexShrink: 0, fontSize: 14, lineHeight: 1 }} aria-hidden>
                    {CAT.cat1Emoji(tag.name)}
                  </span>
                ) : null}
                <RenameInput
                  value={tag.name}
                  onCommit={(n) => renameTag(tag, n)}
                  style={{ fontSize: depth === 0 ? 12 : 11, fontWeight: depth === 0 ? 700 : 600 }}
                />
                <button
                  type="button"
                  onClick={() => applyPromote(tag.id)}
                  disabled={!canPromote}
                  style={{ ...btnSm, opacity: canPromote ? 1 : 0.35 }}
                  aria-label="升一層"
                  title="升一層"
                >
                  ⇤
                </button>
                <button
                  type="button"
                  onClick={() => applyDemote(tag.id)}
                  disabled={!canDemote}
                  style={{ ...btnSm, opacity: canDemote ? 1 : 0.35 }}
                  aria-label="降一層"
                  title="降一層"
                >
                  ⇥
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [tag.id]: !open }))}
                  style={btnSm}
                >
                  {open ? "▲" : "▼"}
                </button>
                <button type="button" onClick={() => addTagUnder(groupId, tag.id, color)} style={btnSm}>
                  +子
                </button>
                {!(tag.name === "未分類" && !tag.parentId) && (
                  <button type="button" onClick={() => deleteTag(tag)} style={{ ...btnSm, color: TH.red }}>
                    刪
                  </button>
                )}
              </div>
              {open && (
                <div style={{ padding: depth === 0 ? "8px 10px 10px" : "2px 0 6px", background: depth === 0 ? TH.bg : undefined, minWidth: 0 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: TH.text,
                      cursor: "pointer",
                      marginBottom: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={tag.noCoin === true}
                      onChange={(e) => persistTags(patchTag(tags, tag.id, { noCoin: e.target.checked }))}
                    />
                    ⌛ 只計時（不發金幣 ❌）
                  </label>
                  {renderTree(groupId, tag.id, depth + 1)}
                </div>
              )}
            </div>
          );
        }}
      />
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, boxSizing: "border-box" }}>
      <BackBtn onBack={onBack} label="標籤管理" />

      <Card>
        <SL>群組</SL>
        <p style={{ fontSize: 10, color: TH.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
          💡 按住左邊的 ⋮⋮ 可以拖曳調整群組順序（手機用手指長按拖動）
        </p>
        <SortableList
          items={live}
          getId={(g) => g.id}
          gap={8}
          onReorder={(from, to) => persistGroups(reorderGroups(groups, from, to))}
          renderItem={(g, _i, handle) => {
            const active = selected?.id === g.id;
            return (
              <div
                style={{
                  border: `1px solid ${active ? TH.accent : TH.border}`,
                  borderRadius: 10,
                  padding: 10,
                  minWidth: 0,
                  background: active ? TH.accent + "14" : TH.bg,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
                  <span
                    {...handle}
                    style={{ ...handle.style, flexShrink: 0, color: TH.muted, fontSize: 14, lineHeight: 1, padding: "4px 2px" }}
                    aria-label="拖曳排序"
                  >
                    ⋮⋮
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedGroupId(g.id)}
                    style={{
                      ...btnSm,
                      color: active ? TH.accent : TH.muted,
                      fontWeight: 800,
                    }}
                  >
                    {active ? "已選" : "選取"}
                  </button>
                  <RenameInput
                    value={g.name}
                    onCommit={(n) => persistGroups(patchGroup(groups, g.id, { name: n }))}
                  />
                  <button type="button" onClick={() => deleteGroup(g)} style={{ ...btnSm, color: TH.red }}>
                    刪
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, minWidth: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: TH.text, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={g.selectMode === "multi"}
                          onChange={(e) =>
                            persistGroups(patchGroup(groups, g.id, { selectMode: e.target.checked ? "multi" : "single" }))
                          }
                        />
                        可多選
                      </label>
                      <HintDot text={HINT.selectMode} />
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: TH.text, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={g.required}
                          onChange={(e) => persistGroups(patchGroup(groups, g.id, { required: e.target.checked }))}
                        />
                        必填
                      </label>
                      <HintDot text={HINT.required} />
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: TH.text, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={g.isTimeDestination}
                          onChange={(e) => persistGroups(patchGroup(groups, g.id, { isTimeDestination: e.target.checked }))}
                        />
                        參與時數分攤
                      </label>
                      <HintDot text={HINT.isTimeDestination} />
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
        />
        <button
          type="button"
          onClick={addNewGroup}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "10px",
            borderRadius: 10,
            border: `1px dashed ${TH.border}`,
            background: "transparent",
            color: TH.accent,
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          + 新增群組
        </button>
      </Card>

      <Card>
        <SL>標籤樹{selected ? ` · ${selected.name}` : ""}</SL>
        {!selected ? (
          <p style={{ fontSize: 11, color: TH.muted, margin: 0 }}>請先新增或選取一個群組</p>
        ) : (
          <>
            <p style={{ fontSize: 10, color: TH.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
              💡 ⋮⋮ 拖曳調整同層順序。層級用 ⇤ 升一層／⇥ 降一層（SortableList 只支援同層排序，不支援拖到別的標籤底下）。預設展開兩層。
            </p>
            {renderTree(selected.id, undefined, 0)}
            <button
              type="button"
              onClick={() => addTagUnder(selected.id, undefined)}
              style={{
                width: "100%",
                marginTop: 8,
                padding: "10px",
                borderRadius: 10,
                border: `1px dashed ${TH.border}`,
                background: "transparent",
                color: TH.accent,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              + 新增頂層標籤
            </button>
          </>
        )}
      </Card>
    </div>
  );
}
