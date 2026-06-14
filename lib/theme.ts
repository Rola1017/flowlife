export const TH = {
  bg: "#09090B",
  card: "#111113",
  border: "#1E1E24",
  text: "#F4F4F5",
  muted: "#52525B",
  accent: "#F97316",
  green: "#22C55E",
  red: "#EF4444",
  yellow: "#F59E0B",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  gold: "#FBBF24",
  pink: "#EC4899",
} as const;

/** 解析 #rgb / #rrggbb（含 8 位含 alpha，取前 6 位）→ [r,g,b]；失敗回 null */
function hexToRgb(hex: string): [number, number, number] | null {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length >= 6) h = h.slice(0, 6);
  else return null;
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * 依底色感知亮度，回傳「印在該底色上清晰可讀」的文字色。
 * 深色底 → 亮字；淺色底 → 暗字。非 hex 或解析失敗 → 安全預設亮字（本 App 為深色介面）。
 * 用 YIQ 感知亮度近似（便宜、夠用）；門檻 128 為經典中點。
 */
export function readableTextOn(bg: string, dark = "#111111", light = "#FFFFFF"): string {
  const rgb = hexToRgb(bg);
  if (!rgb) return light;
  const [r, g, b] = rgb;
  const luminance = (r * 299 + g * 587 + b * 114) / 1000; // 0~255
  return luminance > 128 ? dark : light;
}
