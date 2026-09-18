import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { LS_KEYS, saveJSON } from "@/lib/storage";
import { DEFAULT_TAG_GROUPS, DELETED_TAG_LABEL, TAG_GROUP_IDS, type Tag, type TagGroup } from "@/lib/tags";
import { TH } from "@/lib/theme";
import { matchesTagSelection } from "@/lib/tagsCompat";
import type { Session } from "@/lib/types";
import {
  buildCalendarStats,
  buildDistribution,
  buildLineSeries,
  datesInPeriod,
  distributeAndFilter,
  periodRange,
  resolveSessionTagIds,
  unspecifiedLabel,
} from "@/lib/analytics";

const DOMAIN = TAG_GROUP_IDS.domain;
const DIFF = TAG_GROUP_IDS.difficulty;
const GROUPS = DEFAULT_TAG_GROUPS.map((g) => ({ ...g }));

const tags: Tag[] = [
  { id: "learn", groupId: DOMAIN, name: "學習", color: "#FFFF37", order: 0 },
  { id: "law", groupId: DOMAIN, name: "法律", parentId: "learn", color: "#4444f8", order: 0 },
  { id: "biz", groupId: DOMAIN, name: "事業", color: "#3B82F6", order: 1 },
  { id: "hard", groupId: DIFF, name: "難", order: 0 },
  { id: "easy", groupId: DIFF, name: "易", order: 1 },
];

beforeEach(() => {
  localStorage.clear();
  saveJSON(LS_KEYS.categories, DEFAULT_CATEGORIES);
});

function sess(partial: Partial<Session> & Pick<Session, "id" | "mins">): Session {
  return {
    date: "2026-09-17",
    name: "t",
    cat1: "學習",
    cat2: "",
    cat3: "",
    rating: "",
    earnedCoins: 0,
    ...partial,
  };
}

describe("buildDistribution 分攤", () => {
  it("60 分掛 2 個領域頂層標籤 → 各 30", () => {
    const sessions = [sess({ id: 1, mins: 60, tagIds: ["learn", "biz"] })];
    const dist = buildDistribution(sessions, new Set(), DOMAIN, tags, GROUPS);
    const by = Object.fromEntries(dist.map((d) => [d.label, d.value]));
    expect(by["學習"]).toBe(30);
    expect(by["事業"]).toBe(30);
    expect(dist.reduce((a, d) => a + d.value, 0)).toBe(60);
  });

  it("50 分掛 3 個頂層領域 → [17,17,16] 依 tagIds 順序", () => {
    const extra: Tag[] = [...tags, { id: "health", groupId: DOMAIN, name: "健康", color: "#22C55E", order: 2 }];
    const sessions = [sess({ id: 1, mins: 50, tagIds: ["learn", "biz", "health"] })];
    const dist = buildDistribution(sessions, new Set(), DOMAIN, extra, GROUPS);
    expect(dist.find((d) => d.label === "學習")?.value).toBe(17);
    expect(dist.find((d) => d.label === "事業")?.value).toBe(17);
    expect(dist.find((d) => d.label === "健康")?.value).toBe(16);
    expect(dist.reduce((a, d) => a + d.value, 0)).toBe(50);
  });

  it("只分攤指定維度：學習+事業+困難，依領域時困難不出現", () => {
    const sessions = [sess({ id: 1, mins: 60, tagIds: ["learn", "biz", "hard"] })];
    const dist = buildDistribution(sessions, new Set(), DOMAIN, tags, GROUPS);
    expect(dist.some((d) => d.label === "難")).toBe(false);
    expect(dist.reduce((a, d) => a + d.value, 0)).toBe(60);
  });

  it("未選標籤時依頂層分組，子孫滾入根，總和仍等於總時數", () => {
    const sessions = [
      sess({ id: 1, mins: 25, tagIds: ["law"] }),
      sess({ id: 2, mins: 10, tagIds: ["biz"] }),
    ];
    const dist = buildDistribution(sessions, new Set(), DOMAIN, tags, GROUPS);
    const by = Object.fromEntries(dist.map((d) => [d.label, d.value]));
    expect(by["學習"]).toBe(25);
    expect(by["事業"]).toBe(10);
    expect(dist.reduce((a, d) => a + d.value, 0)).toBe(35);
  });

  it("已刪除標籤顯示「已刪除的標籤」", () => {
    const dead: Tag[] = tags.map((t) => (t.id === "biz" ? { ...t, deletedAt: "x" } : t));
    const dist = buildDistribution(
      [sess({ id: 1, mins: 20, tagIds: ["biz"] })],
      new Set(["biz"]),
      DOMAIN,
      dead,
      GROUPS,
    );
    expect(dist[0]?.label).toBe(DELETED_TAG_LABEL);
    expect(dist[0]?.value).toBe(20);
  });

  it("同時選父與子，一筆只歸最深、總和不膨脹", () => {
    const sessions = [sess({ id: 1, mins: 60, tagIds: ["law"] })];
    const dist = buildDistribution(sessions, new Set(["learn", "law"]), DOMAIN, tags, GROUPS);
    expect(dist.reduce((a, d) => a + d.value, 0)).toBe(60);
    expect(dist.find((d) => d.label === "法律")?.value).toBe(60);
    expect(dist.find((d) => d.label === "學習")).toBeUndefined();
  });

  it("篩選學習時，掛學習+事業的 60 分 → 只有學習 30，總時數 30", () => {
    const sessions = [sess({ id: 1, mins: 60, tagIds: ["learn", "biz"] })];
    const { slices, totalMinutes } = distributeAndFilter(sessions, new Set(["learn"]), DOMAIN, tags, GROUPS);
    expect(totalMinutes).toBe(30);
    expect(slices).toHaveLength(1);
    expect(slices[0]?.label).toBe("學習");
    expect(slices[0]?.minutes).toBe(30);
    expect(slices.some((s) => s.label.includes("未指定") || s.label === "未分類")).toBe(false);
  });

  it("篩選時不得出現未指定／未分類（除非該標籤本身被選取）", () => {
    const withUncat: Tag[] = [...tags, { id: "uncat-real", groupId: DOMAIN, name: "未分類", color: "#9D9D9D", order: 9 }];
    const sessions = [
      sess({ id: 1, mins: 60, tagIds: ["learn", "biz"] }),
      sess({ id: 2, mins: 20, tagIds: ["hard"] }),
    ];
    const dist = buildDistribution(sessions, new Set(["learn"]), DOMAIN, withUncat, GROUPS);
    expect(dist.map((d) => d.label)).toEqual(["學習"]);
    expect(dist.reduce((a, d) => a + d.value, 0)).toBe(30);
  });

  it("未篩選、依專案看：沒有專案標籤 → 未指定專案，不是未分類", () => {
    const PROJECT = "tg_project";
    const g: TagGroup[] = [
      ...GROUPS,
      { id: PROJECT, name: "專案", selectMode: "multi", required: false, isTimeDestination: true, order: 4 },
    ];
    const t: Tag[] = [...tags, { id: "roro", groupId: PROJECT, name: "Roro", order: 0 }];
    const sessions = [sess({ id: 1, mins: 40, tagIds: ["learn"] })];
    const { slices, totalMinutes } = distributeAndFilter(sessions, new Set(), PROJECT, t, g);
    expect(totalMinutes).toBe(40);
    expect(slices).toHaveLength(1);
    expect(slices[0]?.label).toBe(unspecifiedLabel("專案"));
    expect(slices[0]?.label).toBe("未指定專案");
    expect(slices[0]?.label).not.toBe("未分類");
    expect(slices[0]?.color).toBe(TH.muted);
  });

  it("真實未分類標籤與未指定領域是兩片", () => {
    const extra: Tag[] = [...tags, { id: "uncat-real", groupId: DOMAIN, name: "未分類", color: "#9D9D9D", order: 9 }];
    const sessions = [
      sess({ id: 1, mins: 20, tagIds: ["uncat-real"] }),
      sess({ id: 2, mins: 15, tagIds: ["hard"] }),
    ];
    const { slices, totalMinutes } = distributeAndFilter(sessions, new Set(), DOMAIN, extra, GROUPS);
    expect(totalMinutes).toBe(35);
    expect(slices).toHaveLength(2);
    expect(slices.find((s) => s.label === "未分類")?.minutes).toBe(20);
    expect(slices.find((s) => s.label === "未指定領域")?.minutes).toBe(15);
    expect(slices.find((s) => s.label === "未分類")?.tagId).toBe("uncat-real");
    expect(slices.find((s) => s.label === "未指定領域")?.tagId).toBeNull();
  });

  it("非 isTimeDestination 維度不分攤、回空", () => {
    expect(buildDistribution([sess({ id: 1, mins: 60, tagIds: ["hard"] })], new Set(), DIFF, tags, GROUPS)).toEqual([]);
  });
});

describe("不變式：各片總和＝當時顯示的總時數", () => {
  it("50 組無篩選 + 50 組有篩選，slices 總和恆等於 totalMinutes", () => {
    let seed = 20260917;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const pool = ["learn", "law", "biz", "hard", "easy"];
    const run = (withSel: boolean) => {
      for (let i = 0; i < 50; i++) {
        const n = 1 + Math.floor(rnd() * 8);
        const sessions = Array.from({ length: n }, (_, k) => {
          const mins = Math.floor(rnd() * 180);
          const count = 1 + Math.floor(rnd() * 3);
          const tagIds: string[] = [];
          for (let t = 0; t < count; t++) {
            const id = pool[Math.floor(rnd() * pool.length)];
            if (!tagIds.includes(id)) tagIds.push(id);
          }
          return sess({ id: k + 1, mins, tagIds, cat1: "學習" });
        });
        const sel = withSel ? (rnd() < 0.5 ? new Set(["learn"]) : new Set(["learn", "hard"])) : new Set<string>();
        const { slices, totalMinutes } = distributeAndFilter(sessions, sel, DOMAIN, tags, GROUPS);
        expect(slices.reduce((a, d) => a + d.minutes, 0)).toBe(totalMinutes);
        const dist = buildDistribution(sessions, sel, DOMAIN, tags, GROUPS);
        expect(dist.reduce((a, d) => a + d.value, 0)).toBe(totalMinutes);
        if (!withSel) {
          expect(totalMinutes).toBe(sessions.reduce((a, s) => a + (s.mins ?? 0), 0));
        }
        if (sel.has("learn") && !sel.has("hard")) {
          expect(slices.some((s) => s.label.startsWith("未指定") || s.label === "未分類")).toBe(false);
        }
      }
    };
    run(false);
    run(true);
  });
});

describe("sessionMatches / resolveSessionTagIds 舊資料相容", () => {
  it("只有 cat1/2/3 沒有 tagIds 的 session 仍能統計", () => {
    const learn = DEFAULT_CATEGORIES[0];
    const sessions = [sess({ id: 1, mins: 25, cat1: learn.name, cat2: "", cat3: "" })];
    const domainTags: Tag[] = [
      { id: learn.id, groupId: DOMAIN, name: learn.name, color: learn.color, order: 0 },
      { id: "biz", groupId: DOMAIN, name: "事業", color: "#3B82F6", order: 1 },
    ];
    expect(resolveSessionTagIds(sessions[0], domainTags)).toEqual([learn.id]);
    const dist = buildDistribution(sessions, new Set(), DOMAIN, domainTags, GROUPS);
    expect(dist.reduce((a, d) => a + d.value, 0)).toBe(25);
    expect(dist[0]?.label).toBe(learn.name);
  });
});

describe("matchesTagSelection 同維度聯集／跨維度交集", () => {
  it("同維度多選＝聯集", () => {
    const sel = new Set(["learn", "biz"]);
    expect(matchesTagSelection(sel, ["law"], tags)).toBe(true);
    expect(matchesTagSelection(sel, ["biz"], tags)).toBe(true);
    expect(matchesTagSelection(sel, ["hard"], tags)).toBe(false);
  });

  it("跨維度＝交集", () => {
    const sel = new Set(["learn", "hard"]);
    expect(matchesTagSelection(sel, ["law", "hard"], tags)).toBe(true);
    expect(matchesTagSelection(sel, ["law"], tags)).toBe(false);
    expect(matchesTagSelection(sel, ["biz", "hard"], tags)).toBe(false);
  });
});

describe("時區鎖死／行事曆統計", () => {
  it("periodRange／datesInPeriod／buildLineSeries 用固定日期字串", () => {
    expect(periodRange("7天", 2026, 9, "2026-09-17")).toEqual({ start: "2026-09-11", end: "2026-09-17" });
    expect(datesInPeriod("7天", 2026, 9, "2026-09-17")).toEqual([
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
    ]);
    const month = periodRange("月", 2026, 9, "2026-09-17");
    expect(month).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    const line = buildLineSeries(
      [sess({ id: 1, mins: 60, date: "2026-09-17", tagIds: ["learn", "biz"] })],
      "3天",
      2026,
      9,
      "2026-09-17",
    );
    expect(line.labels).toEqual(["09/15", "09/16", "09/17"]);
    expect(line.focus).toEqual([0, 0, 60]);
    expect(line.pomos).toEqual([0, 0, 1]);
  });

  it("buildCalendarStats 未篩選時圓餅各片＝視窗內 mins 直加總", () => {
    const sessions = [
      sess({ id: 1, mins: 60, date: "2026-09-17", tagIds: ["learn", "biz"] }),
      sess({ id: 2, mins: 25, date: "2026-08-01", tagIds: ["learn"] }),
    ];
    const { chartData, lineD, totalMinutes } = buildCalendarStats({
      sessions,
      sel: new Set(),
      groupId: DOMAIN,
      tags,
      groups: GROUPS,
      period: "7天",
      anchorY: 2026,
      anchorM: 9,
      todayStr: "2026-09-17",
    });
    expect(totalMinutes).toBe(60);
    expect(chartData.reduce((a, d) => a + d.value, 0)).toBe(60);
    expect(lineD.focus.reduce((a, n) => a + n, 0)).toBe(60);
  });

  it("buildCalendarStats 篩選學習時圓餅與折線都是保留片段", () => {
    const sessions = [
      sess({ id: 1, mins: 60, date: "2026-09-17", tagIds: ["learn", "biz"] }),
      sess({ id: 2, mins: 25, date: "2026-08-01", tagIds: ["learn"] }),
    ];
    const { chartData, lineD, totalMinutes } = buildCalendarStats({
      sessions,
      sel: new Set(["learn"]),
      groupId: DOMAIN,
      tags,
      groups: GROUPS,
      period: "7天",
      anchorY: 2026,
      anchorM: 9,
      todayStr: "2026-09-17",
    });
    expect(totalMinutes).toBe(30);
    expect(chartData).toHaveLength(1);
    expect(chartData[0]?.label).toBe("學習");
    expect(chartData[0]?.value).toBe(30);
    expect(lineD.focus.reduce((a, n) => a + n, 0)).toBe(30);
  });
});
