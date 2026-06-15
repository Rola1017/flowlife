export const MOCK = {
  /** SchedulePage week_schedule 種子（localStorage 空時 fallback） */
  weekdaySchedule: {
    一: [
      { t: "08:00", n: "卡片盒", c: "學習" },
      { t: "09:00", n: "法律", c: "學習" },
      { t: "13:00", n: "法律", c: "學習" },
    ],
    二: [
      { t: "08:00", n: "英文", c: "學習" },
      { t: "09:00", n: "英文", c: "學習" },
    ],
    三: [
      { t: "08:00", n: "卡片盒", c: "學習" },
      { t: "13:00", n: "法律", c: "學習" },
    ],
    四: [
      { t: "08:00", n: "架網站", c: "事業" },
      { t: "15:00", n: "事業", c: "事業" },
    ],
    五: [
      { t: "08:00", n: "卡片盒", c: "學習" },
      { t: "13:00", n: "法律", c: "學習" },
    ],
    六: [],
    日: [],
  },
  /** ShopPage 商品種子 */
  shopItems: [
    { id: 1, name: "手搖飲☕", price: 50, desc: "勞逸結合" },
    { id: 2, name: "新書📚", price: 200, desc: "知識投資" },
    { id: 3, name: "Spotify🎵", price: 150, desc: "專注配樂" },
  ],
};
