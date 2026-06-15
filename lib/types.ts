export type Session = {
  /** 穩定主鍵（新記錄才有）；未來歷史編輯／Supabase 用 */
  id?: number;
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
  /** 開始前寫下的「意圖一句話」（可選；空白不存，供未來覆盤頁比對意圖vs實際） */
  intention?: string;
  /** 單顆覆盤一句話（可選；空白不存） */
  reflection?: string;
};
