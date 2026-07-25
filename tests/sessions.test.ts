import { beforeEach, describe, expect, it } from "vitest";
import { buildManualSession, setSessionTimes, splitSpanByDay } from "@/lib/sessions";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { LS_KEYS, saveJSON } from "@/lib/storage";
import type { Session } from "@/lib/types";

beforeEach(() => {
  localStorage.clear();
  saveJSON(LS_KEYS.categories, DEFAULT_CATEGORIES);
});

describe("sessions.splitSpanByDay", () => {
  it("跨午夜必須切成兩段，且兩段分鐘數總和等於原始總分鐘", () => {
    // 2026-07-25 23:30 → 2026-07-26 00:30 = 60 分鐘
    const start = new Date(2026, 6, 25, 23, 30, 0, 0).getTime();
    const end = new Date(2026, 6, 26, 0, 30, 0, 0).getTime();
    const segs = splitSpanByDay(start, end);
    expect(segs.length).toBe(2);
    expect(segs[0].endTime).toBe("24:00");
    expect(segs[1].startTime).toBe("00:00");
    const total = segs.reduce((s, g) => s + g.mins, 0);
    expect(total).toBe(60);
  });
});

describe("sessions.buildManualSession", () => {
  it("不得產生超出 endAt 的紀錄；跨天自動切段", () => {
    const { sessions } = buildManualSession({
      startAt: "2026-07-25T23:00",
      endAt: "2026-07-26T01:00",
      name: "跨夜",
      cat1: DEFAULT_CATEGORIES[0]?.name ?? "學習",
    });
    expect(sessions.length).toBe(2);
    const endMs = new Date("2026-07-26T01:00").getTime();
    for (const s of sessions) {
      const [eh, em] = (s.endTime === "24:00" ? ["24", "00"] : s.endTime!.split(":")).map(Number);
      const segEnd = new Date(`${s.date}T00:00:00`);
      if (s.endTime === "24:00") {
        segEnd.setDate(segEnd.getDate() + 1);
      } else {
        segEnd.setHours(eh, em, 0, 0);
      }
      expect(segEnd.getTime()).toBeLessThanOrEqual(endMs);
    }
    expect(sessions.reduce((a, s) => a + s.mins, 0)).toBe(120);
  });

  it("單日段落落在起訖之間", () => {
    const { sessions } = buildManualSession({
      startAt: "2026-07-20T10:00",
      endAt: "2026-07-20T10:25",
      name: "短",
      cat1: DEFAULT_CATEGORIES[0]?.name ?? "學習",
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe("2026-07-20");
    expect(sessions[0].mins).toBe(25);
  });
});

describe("sessions.setSessionTimes", () => {
  it("分鐘數由起訖時間推導，且不可為負", () => {
    const base: Session = {
      id: 1,
      date: "2026-07-25",
      name: "x",
      cat1: DEFAULT_CATEGORIES[0]?.name ?? "學習",
      cat2: "",
      cat3: "",
      mins: 25,
      rating: "",
      earnedCoins: 0,
      startTime: "10:00",
      endTime: "10:25",
    };
    const { sessions } = setSessionTimes([base], 1, "09:00", "10:00");
    expect(sessions[0].mins).toBe(60);
    expect(sessions[0].mins).toBeGreaterThan(0);

    const inverted = setSessionTimes([base], 1, "11:00", "10:00");
    expect(inverted.sessions[0].mins).toBeGreaterThanOrEqual(1);
  });
});
