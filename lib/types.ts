export type ShopItem = {
  id: number;
  name: string;
  desc?: string;
  kind: "instant" | "time";
  price?: number; // instant：一次性金幣價
  coinsPerMin?: number; // time：每分鐘金幣
  cat1?: string;
  cat2?: string;
  cat3?: string; // time：掛的番茄分類
  productCat?: string; // 商品分類（飲食/購物/娛樂/其他，可自訂）
};

export type ActiveEntertainment = {
  name: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  coinsPerMin: number;
  boughtMinutes: number;
  startAt: number;
  spendRowId: number;
};

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
  /** 搬入垃圾桶時間（ISO；active sessions 不帶此欄） */
  deletedAt?: string;
  /** 進垃圾桶時實際退回的金幣（帳本金額；復原時對稱加回） */
  refundedCoins?: number;
};

export type TodoPhase = "pending" | "started" | "ending" | "done";

export type Todo = {
  id: number;
  text: string;
  cat: string;
  /** 已排定執行日（打算哪天做；可改、可挪） */
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  /** 可執行區間結束日（僅跨日時存；單日不存）。與 date 組成「這段期間內有空就做」 */
  endDate?: string; // YYYY-MM-DD
  /** 最晚必須完成（外部約束；與 date/endDate 獨立，計畫挪動不改它） */
  deadline?: string; // YYYY-MM-DD
  /** 預估用時（小時；1天＝8小時工作量。供提醒門檻計算） */
  estimateHours?: number;
  mustDo?: boolean;
  reminder?: string;
  phase: TodoPhase;
  startAt?: string | null;
  endAt?: string | null;
  /** 實際完成日（YYYY-MM-DD；按結束時寫入，與 endAt 時間互補） */
  doneDate?: string;
  /** 實際完成時間 HH:mm（與 doneDate 互補，可事後修改） */
  doneTime?: string;
  startTs?: number | null;
  elapsed?: number | null;
  /** 最後修改時間（ISO；雲端同步 last-write-wins 用） */
  updatedAt?: string;
};

export type TodoTombstone = { id: number; at: string };
