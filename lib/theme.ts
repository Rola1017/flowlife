export const TH = {
  bg: "#09090B",
  card: "#111113",
  border: "#1E1E24",
  text: "#F4F4F5",
  muted: "#52525B",
  accent: "#F97316",
  /** 主維度（領域）強調色，與其他維度的橘色 accent 區隔 */
  primaryDim: "#38BDF8",
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

/** 色碼正規化：接受 #RGB／RGB／#RRGGBB／RRGGBB（大小寫、可省略 #）。輸出大寫 #RRGGBB；非法回 null。 */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let h = input.trim().replace(/^#/, "").toUpperCase();
  if (h.length === 3 && /^[0-9A-F]{3}$/.test(h)) {
    h = h.split("").map((c) => c + c).join("");
  }
  if (h.length !== 6 || !/^[0-9A-F]{6}$/.test(h)) return null;
  return `#${h}`;
}

/** 嚴格 6 位或可展開的 3 位；實作＝normalizeHex（讀取正規化）。 */
export function parseHexRRGGBB(hex: unknown): string | null {
  return normalizeHex(hex);
}

/** YIQ 感知亮度 0~255；解析失敗回 null。 */
export function yiqLum(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
}

/** 色帶最低亮度。低於此值才往白混（不改存檔，只影響顯示）。文字用 labelOnDark 門檻 140。 */
export const STRIPE_MIN_LUM = 50;

function mixTowardWhite(hex: string, minLum: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const lum = yiqLum(hex);
  if (lum == null || lum >= minLum) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * 0.55);
  const [r, g, b] = rgb;
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** 過暗色帶提亮，保留色相。不改呼叫端存的值。 */
export function liftStripeOnDark(hex: string): string {
  return mixTowardWhite(hex, STRIPE_MIN_LUM);
}

/** hex → rgba。a 為 0~1。失敗回原字串。唯一實作，禁止各處自寫。 */
export function withAlpha(hex: string, a: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const alpha = Math.min(1, Math.max(0, a));
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** 深色介面上的「標籤文字色」：太暗的色往白色混以確保可讀，保留色相。非 hex → 安全亮灰。 */
export function labelOnDark(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#E5E7EB";
  return mixTowardWhite(hex, 140);
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
