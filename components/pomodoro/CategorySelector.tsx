import { TH } from "@/lib/theme";
import { CAT } from "@/lib/categories";
import { Chip } from "@/components/ui/Chip";

export function CategorySelector({
  cat1,
  cat2,
  cat3,
  onChange,
  onShowCategoryManager,
}: {
  cat1: string;
  cat2: string;
  cat3: string;
  onChange: (next: { cat1: string; cat2: string; cat3: string }) => void;
  onShowCategoryManager: () => void;
}) {
  const cat2List = CAT.cat2List(cat1);
  const cat3List = cat2 ? CAT.cat3List(cat1, cat2) : [];
  const setC1 = (v: string) => onChange({ cat1: v, cat2: "", cat3: "" });
  const setC2 = (v: string) => onChange({ cat1, cat2: cat2 === v ? "" : v, cat3: "" });
  const setC3 = (v: string) => onChange({ cat1, cat2, cat3: cat3 === v ? "" : v });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 9, color: TH.muted }}>
            大分類 <span style={{ color: TH.red }}>必填</span>
          </div>
          <button
            type="button"
            onClick={onShowCategoryManager}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span style={{ fontSize: 9, color: TH.muted }}>分類管理</span>
            <span style={{ fontSize: 13 }}>⚙️</span>
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {CAT.cat1List().map((c) => (
            <Chip
              key={c}
              label={c}
              active={cat1 === c}
              color={CAT.cat1Color(c)}
              onClick={() => setC1(c)}
              style={{ fontSize: 9 }}
            />
          ))}
        </div>
      </div>
      {cat1 && cat1 !== "未分類" && cat2List.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: TH.muted, marginBottom: 4 }}>中分類</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {cat2List.map((c) => (
              <Chip
                key={c}
                label={c}
                active={cat2 === c}
                color={CAT.cat2Color(cat1, c)}
                onClick={() => setC2(c)}
                style={{ fontSize: 9 }}
              />
            ))}
          </div>
        </div>
      )}
      {cat2 && cat3List.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: TH.muted, marginBottom: 4 }}>小分類</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {cat3List.map((c) => (
              <Chip
                key={c}
                label={c}
                active={cat3 === c}
                color={CAT.cat3Color(cat1, cat2, c)}
                onClick={() => setC3(c)}
                style={{ fontSize: 9 }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
