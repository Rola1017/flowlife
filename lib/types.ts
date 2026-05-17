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
};
