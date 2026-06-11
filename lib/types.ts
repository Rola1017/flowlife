export type Session = {
  date: string;
  name: string;
  cat1: string;
  cat2: string;
  cat3: string;
  mins: number;
  rating: string;
  earnedCoins: number;
  /** 是否列入累計（> 1 分鐘才會算） */
  counted?: boolean;
  /** 番茄開始時間 HH:MM（新記錄才有） */
  startTime?: string;
  /** 番茄結束時間 HH:MM（新記錄才有） */
  endTime?: string;
};
