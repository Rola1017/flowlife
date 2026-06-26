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
  /** 是否為手動補登（非真實番茄計時） */
  manual?: boolean;
  /** S2-2a 分類穩定編號（與名字並存，過渡期；找不到名字時留空、不清舊值） */
  cat1Id?: string;
  cat2Id?: string;
  cat3Id?: string;
  /** 跨裝置唯一主鍵（上雲用；number id 仍保留給本地相容） */
  uuid?: string;
  /** 最後修改時間（ISO；雲端同步 last-write-wins 用） */
  updatedAt?: string;
};
