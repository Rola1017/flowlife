import type { CSSProperties } from "react";
import { APP_STATE_KEYS, notifyAppState, pushAppState } from "@/lib/appStateCloud";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { TH, liftStripeOnDark, parseHexRRGGBB, withAlpha } from "@/lib/theme";

export type CardTone = "focus" | "todo" | "schedule" | "shift" | "routine" | "review" | "reward" | "neutral";

export type CardToneColors = Partial<Record<CardTone, string>>;

export const CARD_TONES: readonly CardTone[] = [
  "focus",
  "todo",
  "schedule",
  "shift",
  "routine",
  "review",
  "reward",
  "neutral",
] as const;

export const CARD_TONE_COLOR: Record<CardTone, string> = {
  focus: TH.accent,
  todo: TH.yellow,
  schedule: TH.blue,
  shift: TH.cyan,
  routine: TH.green,
  review: TH.purple,
  reward: TH.gold,
  neutral: TH.border,
};

export const CARD_TONE_LABEL: Record<CardTone, string> = {
  focus: "番茄／專注",
  todo: "待辦",
  schedule: "課表／課程",
  shift: "班別／工作場所",
  routine: "固定作息",
  review: "覆盤／筆記",
  reward: "金幣／獎勵",
  neutral: "其餘",
};

const TONE_SET = new Set<string>(CARD_TONES);

export function resolveCardTone(tone: string): CardTone {
  return TONE_SET.has(tone) ? (tone as CardTone) : "neutral";
}

/** 只留合法 tone＋6 位 hex；非法鍵／值丟掉。 */
export function sanitizeCardToneOverrides(raw: unknown): CardToneColors {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: CardToneColors = {};
  for (const t of CARD_TONES) {
    const hex = parseHexRRGGBB(src[t]);
    if (!hex) continue;
    if (hex.toLowerCase() === CARD_TONE_COLOR[t].toLowerCase()) continue;
    out[t] = hex;
  }
  return out;
}

export function loadCardToneOverrides(): CardToneColors {
  return sanitizeCardToneOverrides(loadJSON<unknown>(LS_KEYS.cardToneColors, {}));
}

/** 原始色（覆寫優先，非法已在 load 丟掉）。供取色器顯示已存值。 */
export function toneColor(tone: CardTone | string): string {
  const t = resolveCardTone(tone);
  return loadCardToneOverrides()[t] ?? CARD_TONE_COLOR[t];
}

/** 顯示用色帶：過暗才提亮，不改存檔。 */
export function displayToneColor(tone: CardTone | string): string {
  return liftStripeOnDark(toneColor(tone));
}

export function saveCardToneOverrides(next: CardToneColors): CardToneColors {
  const clean = sanitizeCardToneOverrides(next);
  saveJSON(LS_KEYS.cardToneColors, clean);
  notifyAppState(APP_STATE_KEYS.cardToneColors);
  void pushAppState(APP_STATE_KEYS.cardToneColors, clean);
  return clean;
}

export function setCardToneColor(tone: CardTone, hex: string): CardToneColors {
  const parsed = parseHexRRGGBB(hex);
  if (!parsed) return loadCardToneOverrides();
  return saveCardToneOverrides({ ...loadCardToneOverrides(), [tone]: parsed });
}

export function resetCardToneColor(tone: CardTone): CardToneColors {
  const cur = { ...loadCardToneOverrides() };
  delete cur[tone];
  return saveCardToneOverrides(cur);
}

export function resetAllCardToneColors(): CardToneColors {
  return saveCardToneOverrides({});
}

/**
 * 卡片外框唯一來源：左 3px 實心色帶＋1px 同色淡化外框。
 * 用 borderLeft，不加額外元素，避免擠壓／橫向捲動（§8-16）。
 */
export function cardStyle(tone: CardTone | string): CSSProperties {
  const color = displayToneColor(tone);
  return {
    border: `1px solid ${withAlpha(color, 0.35)}`,
    borderLeft: `3px solid ${color}`,
    boxSizing: "border-box",
  };
}
