import { CFG } from "@/lib/config";
import { CAT } from "@/lib/categories";

export function toM(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export const DS = toM(CFG.DAY_START);
export const DE = toM(CFG.DAY_END);
export const DT = DE - DS;

export const fmt = (m: number) =>
  m === 0 ? "0m" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? (m % 60) + "m" : ""}`;

export const fmtMs = (ms: number) => {
  const s = Math.floor(ms / 1000),
    m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export const fmtElapsed = (ms: number) => {
  if (!ms) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分${s % 60 ? " " + (s % 60) + "秒" : ""}`;
  return `${Math.floor(m / 60)}h${m % 60 ? (m % 60) + "m" : ""}`;
};

export const nowStr = () => {
  const d = new Date(),
    p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export const getPeriod = (h: number) => (h < 12 ? "早" : h < 18 ? "午" : "晚");

export const pctPos = (t: string) => ((toM(t) - DS) / DT) * 100;

export const pctH = (s: string, e: string) => ((toM(e) - toM(s)) / DT) * 100;

export const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

export const getFirstDow = (y: number, m: number) => {
  const d = new Date(y, m - 1, 1).getDay();
  return d === 0 ? 6 : d - 1;
};

export function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function genMonthData(y: number, m: number, days: number) {
  const rng = seededRng(y * 100 + m);
  return Array.from({ length: days }, () => {
    const v = rng();
    return v < 0.2 ? 0 : Math.floor(v * 180 + 30);
  });
}

export const coinsForSecs = (s: number) => {
  const m = s / 60;
  const row = [...CFG.COIN_TABLE].reverse().find((r) => m >= r.min);
  return row ? row.coins : 0;
};

export const aggregateByCat1 = (pomos: { cat1: string; mins: number }[]) => {
  const map: Record<string, { cat1: string; mins: number }> = {};
  pomos.forEach((p) => {
    if (!map[p.cat1]) map[p.cat1] = { cat1: p.cat1, mins: 0 };
    map[p.cat1].mins += p.mins;
  });
  return CAT.cat1List()
    .filter((c) => map[c])
    .map((c) => map[c]);
};

export function playRestEnd() {
  try {
    const ctx = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    [0, 0.2, 0.4].forEach((d, i) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = [523, 659, 784][i];
      g.gain.setValueAtTime(0.3, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.5);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.5);
    });
  } catch {
    /* ignore */
  }
}

export const fmtIdleTime = (s: number) => {
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60),
    sec = s % 60;
  if (m < 60) return sec ? `${m} 分 ${sec} 秒` : `${m} 分鐘`;
  const h = Math.floor(m / 60),
    min = m % 60;
  return min ? `${h} 小時 ${min} 分` : `${h} 小時`;
};

/** 時段頁左側時間刻度（06:30–22:40） */
export function buildTimelineHours() {
  const hours: { label: string; pos: number }[] = [];
  for (let h = 6; h <= 23; h++) {
    const m = h === 6 ? 30 : 0;
    const pos = ((h * 60 + m - DS) / DT) * 100;
    if (pos >= 0 && pos <= 100) hours.push({ label: `${h}:${m === 30 ? "30" : "00"}`, pos });
  }
  return hours;
}
