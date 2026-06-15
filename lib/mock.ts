export const MOCK = {
  /** 迷你橫向 ACT bar（TimelinePage / DayViewPage）；VerticalTimeline 已改真實 sessions */
  schedule: {
    ACT: [
      { start: "06:45", end: "07:10", label: "起床", cat1: "健康" },
      { start: "07:10", end: "09:25", label: "法律讀書", cat1: "學習" },
      { start: "09:25", end: "09:45", label: "待機", cat1: null, idle: true },
      { start: "09:45", end: "11:10", label: "事業規劃", cat1: "事業" },
      { start: "11:10", end: "12:00", label: "線上課程", cat1: "學習" },
      { start: "12:00", end: "13:30", label: "午餐+午覺", cat1: null, deep: true },
      { start: "13:30", end: "15:00", label: "兼差工作", cat1: "兼差" },
      { start: "15:00", end: "15:30", label: "待機", cat1: null, idle: true },
      { start: "15:30", end: "17:20", label: "閱讀", cat1: "閱讀" },
    ],
  },
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
