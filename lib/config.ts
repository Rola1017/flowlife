export const CFG = {
  TODAY_STR: new Date().toISOString().slice(0, 10),
  TODAY: new Date(),
  DAY_START: "06:30",
  DAY_END: "22:40",
  END_CONFIRM: 2000,
  LIVE_TICK: 1000,
  /** 休息秒數（以番茄分鐘數作 key） */
  REST_SECONDS: { 1: 10, 5: 60, 25: 5 * 60, 60: 10 * 60, 90: 15 * 60, 120: 20 * 60 } as Record<number, number>,
  /** 顯示用番茄時長（分鐘） */
  POMO_DURATIONS: [1, 5, 25, 60, 90],
  COIN_TABLE: [
    { min: 1, coins: 1 },
    { min: 5, coins: 1 },
    { min: 25, coins: 10 },
    { min: 60, coins: 20 },
    { min: 90, coins: 30 },
    { min: 120, coins: 45 },
    { min: 150, coins: 70 },
    { min: 180, coins: 100 },
  ],
  MILESTONES: [
    { mins: 180, coins: 30, label: "3小時" },
    { mins: 240, coins: 50, label: "4小時" },
    { mins: 300, coins: 100, label: "5小時" },
    { mins: 360, coins: 200, label: "6小時" },
    { mins: 420, coins: 500, label: "7小時" },
  ],
  TIME_RANGES: ["3天", "7天", "14天", "月", "季"],
} as const;
