import { describe, expect, it } from "vitest";
import {
  CARD_TONES,
  CARD_TONE_COLOR,
  cardStyle,
  resolveCardTone,
} from "@/lib/cardTone";
import { TH } from "@/lib/theme";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("cardTone 唯一來源", () => {
  it("每個 tone 都回傳非空樣式", () => {
    for (const tone of CARD_TONES) {
      const s = cardStyle(tone);
      expect(s.border, tone).toBeTruthy();
      expect(s.borderLeft, tone).toBeTruthy();
      expect(s.boxSizing).toBe("border-box");
    }
  });

  it("tone 對應的顏色來自 TH（不得為字面色碼）", () => {
    expect(CARD_TONE_COLOR.focus).toBe(TH.accent);
    expect(CARD_TONE_COLOR.todo).toBe(TH.yellow);
    expect(CARD_TONE_COLOR.schedule).toBe(TH.blue);
    expect(CARD_TONE_COLOR.shift).toBe(TH.cyan);
    expect(CARD_TONE_COLOR.routine).toBe(TH.green);
    expect(CARD_TONE_COLOR.review).toBe(TH.purple);
    expect(CARD_TONE_COLOR.reward).toBe(TH.gold);
    expect(CARD_TONE_COLOR.neutral).toBe(TH.border);

    const src = readFileSync(path.resolve(__dirname, "../lib/cardTone.ts"), "utf8");
    expect(src).not.toMatch(/#[0-9A-Fa-f]{3,8}/);

    expect(String(cardStyle("todo").borderLeft)).toContain(TH.yellow);
    expect(String(cardStyle("schedule").borderLeft)).toContain(TH.blue);
  });

  it("未知 tone → neutral", () => {
    expect(resolveCardTone("nope")).toBe("neutral");
    expect(cardStyle("nope")).toEqual(cardStyle("neutral"));
    expect(cardStyle("")).toEqual(cardStyle("neutral"));
  });
});
