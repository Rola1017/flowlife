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
      for (const s of [...next]) {
        if (p.startsWith(s + CAT_PATH_SEP) || s.startsWith(p + CAT_PATH_SEP)) next.delete(s);
      }
      next.add(p);
    }
    onChange(next);
  };

  const cat1s = CAT.cat1List();
  const activeCat1 = cat1s;
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
        const c1Color = CAT.cat1Color(c1);
        const showSubMids = c2s.filter(
          (c2) =>
            selected.has(catPath(c1, c2)) ||
            CAT.cat3List(c1, c2).some((c3) => selected.has(catPath(c1, c2, c3))),
        );
        return (
          <div key={`grp-${c1}`} style={{ borderTop: `2px solid ${c1Color}99`, paddingTop: 8, marginTop: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: c1Color, marginBottom: 5 }}>◆ {c1} · 中分類</div>
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
            {showSubMids.map((c2) => {
              const c3s = CAT.cat3List(c1, c2);
              if (c3s.length === 0) return null;
              return (
                <div key={`s-${c1}-${c2}`} style={{ borderTop: `1px dashed ${TH.border}`, marginTop: 6, paddingTop: 6, marginLeft: 10 }}>
                  <div style={labelStyle}>{c1} › {c2} · 小分類</div>
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
