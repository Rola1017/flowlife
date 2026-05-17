"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { BackBtn } from "@/components/ui/BackBtn";
import { Card, SL } from "@/components/ui/Card";
import { TH } from "@/lib/theme";
import {
  type CategoryData,
  cat2Color,
  cat3Color,
  loadCategories,
  saveCategories,
} from "@/lib/categories";

const COLOR_PALETTE = [
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

function cloneData(data: CategoryData): CategoryData {
  return JSON.parse(JSON.stringify(data)) as CategoryData;
}

function ColorPicker({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
}) {
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
        {COLOR_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              onChange(c);
              onClose();
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "none",
              outline: value === c ? "2px solid white" : "none",
              background: c,
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 28, border: "none", padding: 0, cursor: "pointer" }}
        />
        <span style={{ fontSize: 10, color: TH.muted, fontFamily: "monospace" }}>{value}</span>
      </div>
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

export function CategoryManager({ onBack }: { onBack: () => void }) {
  const [categories, setCategories] = useState<CategoryData>(() => loadCategories());
  const [expandedBig, setExpandedBig] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(loadCategories().map((_, i) => [i, true])),
  );
  const [expandedMid, setExpandedMid] = useState<Record<string, boolean>>({});
  const [colorPickerBig, setColorPickerBig] = useState<number | null>(null);

  const persist = useCallback((next: CategoryData) => {
    setCategories(next);
    saveCategories(next);
  }, []);

  const moveBig = (bi: number, dir: -1 | 1) => {
    const j = bi + dir;
    if (j < 0 || j >= categories.length) return;
    const next = cloneData(categories);
    [next[bi], next[j]] = [next[j], next[bi]];
    persist(next);
  };

  const updateBigName = (bi: number, name: string) => {
    const next = cloneData(categories);
    next[bi].name = name;
    persist(next);
  };

  const updateBigColor = (bi: number, color: string) => {
    const next = cloneData(categories);
    next[bi].color = color;
    persist(next);
  };

  const deleteBig = (bi: number) => {
    if (categories[bi].name === "未分類") return;
    if (!window.confirm(`刪除大分類「${categories[bi].name}」？`)) return;
    const next = categories.filter((_, i) => i !== bi);
    persist(next);
  };

  const addBig = () => {
    const name = window.prompt("新大分類名稱");
    if (!name?.trim()) return;
    if (categories.some((c) => c.name === name.trim())) {
      window.alert("名稱已存在");
      return;
    }
    persist([...cloneData(categories), { name: name.trim(), color: "#3B82F6", mids: [] }]);
  };

  const addMid = (bi: number) => {
    const name = window.prompt("新中分類名稱");
    if (!name?.trim()) return;
    const next = cloneData(categories);
    if (next[bi].mids.some((m) => m.name === name.trim())) {
      window.alert("名稱已存在");
      return;
    }
    next[bi].mids.push({ name: name.trim(), subs: [] });
    persist(next);
    setExpandedBig((e) => ({ ...e, [bi]: true }));
  };

  const updateMidName = (bi: number, mi: number, name: string) => {
    const next = cloneData(categories);
    next[bi].mids[mi].name = name;
    persist(next);
  };

  const deleteMid = (bi: number, mi: number) => {
    if (!window.confirm(`刪除中分類「${categories[bi].mids[mi].name}」？`)) return;
    const next = cloneData(categories);
    next[bi].mids.splice(mi, 1);
    persist(next);
  };

  const moveMid = (bi: number, mi: number, dir: -1 | 1) => {
    const j = mi + dir;
    if (j < 0 || j >= categories[bi].mids.length) return;
    const next = cloneData(categories);
    const mids = next[bi].mids;
    [mids[mi], mids[j]] = [mids[j], mids[mi]];
    persist(next);
  };

  const addSub = (bi: number, mi: number) => {
    const name = window.prompt("新小分類名稱");
    if (!name?.trim()) return;
    const next = cloneData(categories);
    if (next[bi].mids[mi].subs.includes(name.trim())) {
      window.alert("名稱已存在");
      return;
    }
    next[bi].mids[mi].subs.push(name.trim());
    persist(next);
    setExpandedMid((e) => ({ ...e, [`${bi}-${mi}`]: true }));
  };

  const updateSubName = (bi: number, mi: number, si: number, name: string) => {
    const next = cloneData(categories);
    next[bi].mids[mi].subs[si] = name;
    persist(next);
  };

  const deleteSub = (bi: number, mi: number, si: number) => {
    if (!window.confirm(`刪除小分類「${categories[bi].mids[mi].subs[si]}」？`)) return;
    const next = cloneData(categories);
    next[bi].mids[mi].subs.splice(si, 1);
    persist(next);
  };

  const moveSub = (bi: number, mi: number, si: number, dir: -1 | 1) => {
    const subs = categories[bi].mids[mi].subs;
    const j = si + dir;
    if (j < 0 || j >= subs.length) return;
    const next = cloneData(categories);
    const arr = next[bi].mids[mi].subs;
    [arr[si], arr[j]] = [arr[j], arr[si]];
    persist(next);
  };

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <BackBtn onBack={onBack} label="分類管理" />

      <Card>
        <SL>大分類</SL>
        <p style={{ fontSize: 10, color: TH.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
          中／小分類顏色依大分類色自動計算。用 ↑↓ 調整排序。
        </p>

        {categories.map((big, bi) => {
          const midKey = (mi: number) => `${bi}-${mi}`;
          const isOpen = expandedBig[bi] ?? false;
          return (
            <div
              key={`${big.name}-${bi}`}
              style={{
                border: `1px solid ${TH.border}`,
                borderRadius: 10,
                marginBottom: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 10px",
                  background: big.color + "18",
                }}
              >
                <button type="button" onClick={() => moveBig(bi, -1)} disabled={bi === 0} style={btnSm}>
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveBig(bi, 1)}
                  disabled={bi === categories.length - 1}
                  style={btnSm}
                >
                  ↓
                </button>
                <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setColorPickerBig(colorPickerBig === bi ? null : bi)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: `1px solid ${TH.border}`,
                      background: big.color,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  />
                  {colorPickerBig === bi && (
                    <>
                      <div
                        style={{
                          position: "fixed",
                          inset: 0,
                          zIndex: 199,
                        }}
                        onClick={() => setColorPickerBig(null)}
                      />
                      <ColorPicker
                        value={big.color}
                        onChange={(c) => updateBigColor(bi, c)}
                        onClose={() => setColorPickerBig(null)}
                      />
                    </>
                  )}
                </div>
                <RenameInput value={big.name} onCommit={(n) => updateBigName(bi, n)} />
                <button
                  type="button"
                  onClick={() => setExpandedBig((e) => ({ ...e, [bi]: !isOpen }))}
                  style={btnSm}
                >
                  {isOpen ? "▲" : "▼"}
                </button>
                {big.name !== "未分類" && (
                  <button type="button" onClick={() => deleteBig(bi)} style={{ ...btnSm, color: TH.red }}>
                    刪
                  </button>
                )}
              </div>

              {isOpen && (
                <div style={{ padding: "8px 10px 10px", background: TH.bg }}>
                  {big.mids.map((mid, mi) => {
                    const midOpen = expandedMid[midKey(mi)] ?? false;
                    const midCol = cat2Color(big.color, mi);
                    return (
                      <div
                        key={`${mid.name}-${mi}`}
                        style={{
                          marginBottom: 8,
                          borderLeft: `3px solid ${midCol}`,
                          paddingLeft: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <button type="button" onClick={() => moveMid(bi, mi, -1)} disabled={mi === 0} style={btnSm}>
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveMid(bi, mi, 1)}
                            disabled={mi === big.mids.length - 1}
                            style={btnSm}
                          >
                            ↓
                          </button>
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: midCol,
                              flexShrink: 0,
                            }}
                          />
                          <RenameInput
                            value={mid.name}
                            onCommit={(n) => updateMidName(bi, mi, n)}
                            style={{ fontSize: 11, fontWeight: 600 }}
                          />
                          <button
                            type="button"
                            onClick={() => setExpandedMid((e) => ({ ...e, [midKey(mi)]: !midOpen }))}
                            style={btnSm}
                          >
                            {midOpen ? "▲" : "▼"}
                          </button>
                          <button type="button" onClick={() => deleteMid(bi, mi)} style={{ ...btnSm, color: TH.red }}>
                            刪
                          </button>
                        </div>

                        {midOpen && (
                          <div style={{ paddingLeft: 4 }}>
                            {mid.subs.map((sub, si) => (
                              <div
                                key={`${sub}-${si}`}
                                style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}
                              >
                                <button
                                  type="button"
                                  onClick={() => moveSub(bi, mi, si, -1)}
                                  disabled={si === 0}
                                  style={btnSm}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveSub(bi, mi, si, 1)}
                                  disabled={si === mid.subs.length - 1}
                                  style={btnSm}
                                >
                                  ↓
                                </button>
                                <div
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: cat3Color(si),
                                    flexShrink: 0,
                                  }}
                                />
                                <RenameInput
                                  value={sub}
                                  onCommit={(n) => updateSubName(bi, mi, si, n)}
                                  style={{ fontSize: 10, fontWeight: 500 }}
                                />
                                <button
                                  type="button"
                                  onClick={() => deleteSub(bi, mi, si)}
                                  style={{ ...btnSm, color: TH.red }}
                                >
                                  刪
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addSub(bi, mi)} style={{ ...btnSm, marginTop: 2 }}>
                              + 小分類
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => addMid(bi)} style={btnSm}>
                    + 中分類
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={addBig}
          style={{
            width: "100%",
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
          + 新增大分類
        </button>
      </Card>
    </div>
  );
}
