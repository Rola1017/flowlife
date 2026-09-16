import { describe, expect, it } from "vitest";
import { TAG_GROUP_IDS, type Tag } from "@/lib/tags";
import { splitMinutesByGroup } from "@/lib/tagStats";

const DOMAIN = TAG_GROUP_IDS.domain;
const DIFF = TAG_GROUP_IDS.difficulty;

const tags: Tag[] = [
  { id: "d1", groupId: DOMAIN, name: "學習", order: 0 },
  { id: "d2", groupId: DOMAIN, name: "法律", parentId: "d1", order: 0 },
  { id: "d3", groupId: DOMAIN, name: "聽力", parentId: "d2", order: 0 },
  { id: "hard", groupId: DIFF, name: "難", order: 0 },
  { id: "normal", groupId: DIFF, name: "普通", order: 1 },
  { id: "easy", groupId: DIFF, name: "易", order: 2 },
];

describe("splitMinutesByGroup", () => {
  it("50 分 3 標籤 → [17,17,16]", () => {
    const out = splitMinutesByGroup(50, ["d1", "d2", "d3"], DOMAIN, tags);
    expect(out.map((x) => x.minutes)).toEqual([17, 17, 16]);
    expect(out.map((x) => x.tagId)).toEqual(["d1", "d2", "d3"]);
  });

  it("40 分 3 標籤 → [14,13,13]", () => {
    const out = splitMinutesByGroup(40, ["d1", "d2", "d3"], DOMAIN, tags);
    expect(out.map((x) => x.minutes)).toEqual([14, 13, 13]);
  });

  it("不變式：任意分鐘數與任意標籤數，分攤結果總和恆等於原分鐘數", () => {
    const domainIds = ["d1", "d2", "d3"];
    for (let minutes = 0; minutes <= 120; minutes += 1) {
      for (let n = 1; n <= domainIds.length; n += 1) {
        const ids = domainIds.slice(0, n);
        const out = splitMinutesByGroup(minutes, ids, DOMAIN, tags);
        const sum = out.reduce((a, x) => a + x.minutes, 0);
        expect(sum).toBe(minutes);
      }
    }
    // 固定組合（禁止 Date.now / new Date；用寫死的分鐘與標籤數）
    const fixtures: [number, string[]][] = [
      [1, ["d1"]],
      [7, ["d1", "d2"]],
      [99, ["d1", "d2", "d3"]],
      [1000, ["d1", "d2", "d3"]],
    ];
    for (const [minutes, ids] of fixtures) {
      const sum = splitMinutesByGroup(minutes, ids, DOMAIN, tags).reduce((a, x) => a + x.minutes, 0);
      expect(sum).toBe(minutes);
    }
  });

  it("只分攤指定群組內的標籤，其他群組標籤不參與（含「難」）", () => {
    const out = splitMinutesByGroup(50, ["d1", "hard", "d2"], DOMAIN, tags);
    expect(out.map((x) => x.tagId)).toEqual(["d1", "d2"]);
    expect(out.reduce((a, x) => a + x.minutes, 0)).toBe(50);
    const diff = splitMinutesByGroup(50, ["d1", "hard", "d2"], DIFF, tags);
    expect(diff).toEqual([{ tagId: "hard", minutes: 50 }]);
  });
});
