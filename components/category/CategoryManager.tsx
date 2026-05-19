"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { BackBtn } from "@/components/ui/BackBtn";
import { Card, SL } from "@/components/ui/Card";
import { TH } from "@/lib/theme";
import {
  type CategoryData,
  cat3ColorFrom,
  loadCategories,
  saveCategories,
} from "@/lib/categories";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";

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

function cloneData(data: CategoryData): CategoryData {
  return JSON.parse(JSON.stringify(data)) as CategoryData;
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
  const [colorPickerMid, setColorPickerMid] = useState<string | null>(null);
  const [palette, setPalette] = useState<string[]>(() => loadJSON(LS_KEYS.colorPalette, DEFAULT_PALETTE));

  const handlePaletteChange = (index: number, hex: string) => {
    const next = [...palette];
    next[index] = hex;
    setPalette(next);
    saveJSON(LS_KEYS.colorPalette, next);
  };

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

  const updateMidColor = (bi: number, mi: number, color: string) => {
    const next = cloneData(categories);
    next[bi].mids[mi].color = color;
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
    next[bi].mids.push({ name: name.trim(), color: next[bi].color, subs: [] });
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
          中分類顏色可自訂（點色塊修改）；小分類繼承中分類顏色，依序漸淺。用 ↑↓ 調整排序。
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
                        palette={palette}
                        onPaletteChange={handlePaletteChange}
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
                    const midCol = mid.color;
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
                          <div style={{ position: "relative" }}>
                            <button
                              type="button"
                              onClick={() =>
                                setColorPickerMid(colorPickerMid === `${bi}-${mi}` ? null : `${bi}-${mi}`)
                              }
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                border: "none",
                                background: mid.color,
                                cursor: "pointer",
                                flexShrink: 0,
                              }}
                            />
                            {colorPickerMid === `${bi}-${mi}` && (
                              <>
                                <div
                                  style={{ position: "fixed", inset: 0, zIndex: 199 }}
                                  onClick={() => setColorPickerMid(null)}
                                />
                                <ColorPicker
                                  value={mid.color}
                                  onChange={(c) => updateMidColor(bi, mi, c)}
                                  onClose={() => setColorPickerMid(null)}
                                  palette={palette}
                                  onPaletteChange={handlePaletteChange}
                                />
                              </>
                            )}
                          </div>
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
                                    background: cat3ColorFrom(mid.color, si),
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
