import type { CSSProperties } from "react";
import { TH, withAlpha } from "@/lib/theme";

export type CardTone = "focus" | "todo" | "schedule" | "shift" | "routine" | "review" | "reward" | "neutral";

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

/**
 * 卡片外框唯一來源：左 3px 實心色帶＋1px 同色淡化外框。
 * 用 borderLeft，不加額外元素，避免擠壓／橫向捲動（§8-16）。
 */
export function cardStyle(tone: CardTone | string): CSSProperties {
  const color = CARD_TONE_COLOR[resolveCardTone(tone)];
  return {
    border: `1px solid ${withAlpha(color, 0.35)}`,
    borderLeft: `3px solid ${color}`,
    boxSizing: "border-box",
  };
}
