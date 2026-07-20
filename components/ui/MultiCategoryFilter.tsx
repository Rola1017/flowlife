"use client";

import { TH } from "@/lib/theme";
import { CAT, catPath, CAT_PATH_SEP } from "@/lib/categories";
import { Chip } from "@/components/ui/Chip";

export function MultiCategoryFilter({
  selected,
  onChange,
}: {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const toggle = (p: string) => {
    const next = new Set(selected);
    if (next.has(p)) next.delete(p);
    else {
      // 選了子層就移除同路徑的父層／子層，避免重複計算
      for (const s of [...next]) {
        if (p.startsWith(s + CAT_PATH_SEP) || s.startsWith(p + CAT_PATH_SEP)) next.delete(s);
      }
      next.add(p);
    }
    onChange(next);
  };

  const cat1s = CAT.cat1List();
  const activeCat1 = cat1s.filter((c1) =>
    selected.size === 0 ? true : [...selected].some((s) => s === c1 || s.startsWith(c1 + CAT_PATH_SEP)),
  );
  const rowStyle = { display: "flex", gap: 4, flexWrap: "wrap" as const };
  const labelStyle = { fontSize: 9, color: TH.muted, marginBottom: 4 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <div style={labelStyle}>大分類（可複選）</div>
        <div style={rowStyle}>
          {cat1s.map((c1) => (
            <Chip
              key={c1}
              label={c1}
              active={selected.has(catPath(c1))}
              color={CAT.cat1Color(c1)}
              onClick={() => toggle(catPath(c1))}
              style={{ fontSize: 9 }}
            />
          ))}
        </div>
      </div>

      {activeCat1.map((c1) => {
        const c2s = CAT.cat2List(c1);
        if (c2s.length === 0) return null;
        return (
          <div key={`m-${c1}`}>
            <div style={labelStyle}>{c1} · 中分類（可複選，可跨大分類一起選）</div>
            <div style={rowStyle}>
              {c2s.map((c2) => (
                <Chip
                  key={`${c1}-${c2}`}
                  label={c2}
                  active={selected.has(catPath(c1, c2))}
                  color={CAT.cat2Color(c1, c2)}
                  onClick={() => toggle(catPath(c1, c2))}
                  style={{ fontSize: 9 }}
                />
              ))}
            </div>

            {c2s.map((c2) => {
              if (!selected.has(catPath(c1, c2))) return null;
              const c3s = CAT.cat3List(c1, c2);
              if (c3s.length === 0) return null;
              return (
                <div key={`s-${c1}-${c2}`} style={{ marginTop: 6 }}>
                  <div style={labelStyle}>
                    {c1} › {c2} · 小分類（可複選）
                  </div>
                  <div style={rowStyle}>
                    {c3s.map((c3) => (
                      <Chip
                        key={`${c1}-${c2}-${c3}`}
                        label={c3}
                        active={selected.has(catPath(c1, c2, c3))}
                        color={CAT.cat3Color(c1, c2, c3)}
                        onClick={() => toggle(catPath(c1, c2, c3))}
                        style={{ fontSize: 9 }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
