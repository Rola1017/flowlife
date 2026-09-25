import { beforeEach, describe, expect, it } from "vitest";
import {
  CARD_TONES,
  CARD_TONE_COLOR,
  cardStyle,
  displayToneColor,
  resolveCardTone,
  toneColor,
} from "@/lib/cardTone";
import { LS_KEYS, saveJSON } from "@/lib/storage";
import { parseHexRRGGBB, STRIPE_MIN_LUM, TH, yiqLum } from "@/lib/theme";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("cardTone 唯一來源", () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

  it("覆寫存在時採用覆寫", () => {
    const pink = parseHexRRGGBB(TH.pink);
    saveJSON(LS_KEYS.cardToneColors, { todo: pink });
    expect(toneColor("todo")).toBe(pink);
    expect(String(cardStyle("todo").borderLeft)).toContain(displayToneColor("todo"));
  });

  it("非法值一律退回預設", () => {
    saveJSON(LS_KEYS.cardToneColors, {
      todo: "",
      schedule: "red",
      shift: "#12",
    });
    expect(toneColor("todo")).toBe(TH.yellow);
    expect(toneColor("schedule")).toBe(TH.blue);
    expect(toneColor("shift")).toBe(TH.cyan);
    expect(String(cardStyle("todo").borderLeft)).toContain(TH.yellow);
  });

  it("過暗顏色提亮後的亮度高於門檻", () => {
    saveJSON(LS_KEYS.cardToneColors, { todo: "#050505" });
    expect(toneColor("todo")).toBe("#050505");
    const shown = displayToneColor("todo");
    expect(shown.toLowerCase()).not.toBe("#050505");
    expect(yiqLum(shown)).toBeGreaterThanOrEqual(STRIPE_MIN_LUM);
    expect(String(cardStyle("todo").borderLeft)).toContain(shown);
  });

  it("恢復預設後回到 TH 值", () => {
    const pink = parseHexRRGGBB(TH.pink);
    saveJSON(LS_KEYS.cardToneColors, { todo: pink });
    expect(toneColor("todo")).toBe(pink);
    saveJSON(LS_KEYS.cardToneColors, {});
    expect(toneColor("todo")).toBe(TH.yellow);
    expect(String(cardStyle("todo").borderLeft)).toContain(TH.yellow);
  });
});
