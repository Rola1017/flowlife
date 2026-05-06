"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════
// 1. CONFIG
// ═══════════════════════════════════════════════════════════
const CFG = {
  TODAY_STR: "2026-05-02",
  TODAY: new Date(2026, 4, 2),
  DAY_START: "06:30",
  DAY_END: "22:40",
  END_CONFIRM: 2000,
  LIVE_TICK: 1000,
  REST_DURATIONS: { 5: 1, 25: 5, 60: 10, 90: 15, 120: 20 },
  POMO_DURATIONS: [5, 25, 60, 90],
  COIN_TABLE: [
    { min: 5, coins: 1 }, { min: 25, coins: 10 }, { min: 60, coins: 20 },
    { min: 90, coins: 30 }, { min: 120, coins: 45 }, { min: 150, coins: 70 }, { min: 180, coins: 100 },
  ],
  MILESTONES: [
    { mins: 180, coins: 30, label: "3小時" }, { mins: 240, coins: 50, label: "4小時" },
    { mins: 300, coins: 100, label: "5小時" }, { mins: 360, coins: 200, label: "6小時" },
    { mins: 420, coins: 500, label: "7小時" },
  ],
  TIME_RANGES: ["3天", "7天", "14天", "月", "季"],
};
function toM(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
const DS = toM(CFG.DAY_START), DE = toM(CFG.DAY_END), DT = DE - DS;

// ═══════════════════════════════════════════════════════════
// 2. THEME
// ═══════════════════════════════════════════════════════════
const TH = {
  bg: "#09090B", card: "#111113", border: "#1E1E24",
  text: "#F4F4F5", muted: "#52525B",
  accent: "#F97316", green: "#22C55E", red: "#EF4444",
  yellow: "#F59E0B", blue: "#3B82F6", purple: "#8B5CF6",
  cyan: "#06B6D4", gold: "#FBBF24", pink: "#EC4899",
};

// ═══════════════════════════════════════════════════════════
// 3. CATEGORY TREE — 單一資料來源
// ═══════════════════════════════════════════════════════════
const CATEGORY_TREE = {
  學習: { color: "#F59E0B", mid: {
    法律: { color: "#7C3AED", sub: ["勞動社會法", "保險法", "民法", "行政法", "刑法", "民事訴訟法"] },
    保險: { color: "#9333EA", sub: ["意外險", "醫療險", "儲蓄險"] },
    英文: { color: "#EC4899", sub: ["口說", "文法", "寫作"] },
  }},
  事業: { color: "#3B82F6", mid: {
    架網站: { color: "#2563EB", sub: [] },
    知識萃取: { color: "#1D4ED8", sub: [] },
  }},
  閱讀: { color: "#06B6D4", mid: {
    溝通術: { color: "#0891B2", sub: [] },
    情緒療癒: { color: "#7C3AED", sub: [] },
    學習技巧: { color: "#F59E0B", sub: [] },
    金融: { color: "#10B981", sub: ["投資", "經濟學"] },
    商業: { color: "#3B82F6", sub: [] },
  }},
  健康: { color: "#10B981", mid: {
    重訓: { color: "#059669", sub: [] },
    有氧: { color: "#22C55E", sub: [] },
  }},
  兼差: { color: "#8B5CF6", mid: {
    兼差A: { color: "#7C3AED", sub: [] },
    兼差B: { color: "#6D28D9", sub: [] },
  }},
  活動: { color: "#EC4899", mid: {
    展覽: { color: "#DB2777", sub: [] },
    旅遊: { color: "#E11D48", sub: [] },
    聚會: { color: "#BE185D", sub: [] },
  }},
  未分類: { color: "#6B7280", mid: {} },
};

// CAT helpers — 所有分類查詢統一從這裡調用
const CAT = {
  cat1List: () => Object.keys(CATEGORY_TREE),
  cat1Color: (c1) => CATEGORY_TREE[c1]?.color || TH.muted,
  cat2List: (c1) => Object.keys(CATEGORY_TREE[c1]?.mid || {}),
  cat2Color: (c1, c2) => CATEGORY_TREE[c1]?.mid[c2]?.color || CATEGORY_TREE[c1]?.color || TH.muted,
  cat3List: (c1, c2) => CATEGORY_TREE[c1]?.mid[c2]?.sub || [],
  cat3Color: (c1, c2) => CATEGORY_TREE[c1]?.mid[c2]?.color || TH.muted,
  deepColor: (c1, c2) => c2 ? CAT.cat2Color(c1, c2) : CAT.cat1Color(c1),
  chartDataFor: (level, c1, c2) => {
    if (level === "all") return CAT.cat1List().filter(c => c !== "未分類").map((c, i) => ({ label: c, value: 120 + i * 55, color: CAT.cat1Color(c) }));
    if (level === "cat1" && c1) return CAT.cat2List(c1).map((c, i) => ({ label: c, value: 80 + i * 40, color: CAT.cat2Color(c1, c) }));
    if (level === "cat2" && c1 && c2) {
      const subs = CAT.cat3List(c1, c2);
      if (subs.length) return subs.map((c, i) => ({ label: c, value: 30 + i * 25, color: CAT.cat3Color(c1, c2) }));
      return [{ label: c2, value: 120, color: CAT.cat2Color(c1, c2) }];
    }
    return [];
  },
};
const CAT_COLOR = Object.fromEntries(CAT.cat1List().map(c => [c, CAT.cat1Color(c)]));

// ═══════════════════════════════════════════════════════════
// 4. MOCK DATA
// ═══════════════════════════════════════════════════════════
const MOCK = {
  schedule: {
    PLN: [
      { start: "06:30", end: "07:00", label: "起床晨間", cat1: "健康" },
      { start: "07:00", end: "09:00", label: "法律讀書", cat1: "學習" },
      { start: "09:00", end: "10:30", label: "事業規劃", cat1: "事業" },
      { start: "10:30", end: "12:00", label: "線上課程", cat1: "學習" },
      { start: "12:00", end: "13:30", label: "午餐+午覺", cat1: null },
      { start: "13:30", end: "15:30", label: "兼差工作", cat1: "兼差" },
      { start: "15:30", end: "17:00", label: "閱讀", cat1: "閱讀" },
      { start: "17:00", end: "18:00", label: "晚餐", cat1: null },
      { start: "18:00", end: "20:00", label: "重訓", cat1: "健康" },
      { start: "20:00", end: "22:00", label: "娛樂", cat1: "活動" },
      { start: "22:00", end: "22:40", label: "覆盤睡前", cat1: "學習" },
    ],
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
  yesterdayPomos: [
    { task: "法律讀書", cat1: "學習", cat2: "法律", cat3: "民法", mins: 90, rating: "😤" },
    { task: "事業規劃", cat1: "事業", cat2: "架網站", cat3: "", mins: 50, rating: "😤" },
    { task: "線上課程", cat1: "學習", cat2: "英文", cat3: "文法", mins: 60, rating: "🙂" },
    { task: "兼差工作", cat1: "兼差", cat2: "兼差A", cat3: "", mins: 75, rating: "😤" },
    { task: "閱讀", cat1: "閱讀", cat2: "金融", cat3: "投資", mins: 50, rating: "😤" },
    { task: "重訓", cat1: "健康", cat2: "重訓", cat3: "", mins: 60, rating: "🙂" },
    { task: "法律2", cat1: "學習", cat2: "法律", cat3: "刑法", mins: 45, rating: "😴" },
  ],
  todayPomos: [
    { task: "法律讀書", cat1: "學習", cat2: "法律", cat3: "民法", mins: 95, rating: "😤" },
    { task: "事業規劃", cat1: "事業", cat2: "架網站", cat3: "", mins: 60, rating: "😤" },
    { task: "兼差工作", cat1: "兼差", cat2: "兼差A", cat3: "", mins: 45, rating: "🙂" },
    { task: "閱讀溝通聖經", cat1: "閱讀", cat2: "溝通術", cat3: "", mins: 55, rating: "😤" },
  ],
  heat: [
    { day: "04/26", s: [{ s: 7, e: 10, c: "學習" }, { s: 14, e: 16, c: "閱讀" }] },
    { day: "04/27", s: [{ s: 8, e: 10, c: "學習" }, { s: 11, e: 12, c: "兼差" }, { s: 14, e: 16, c: "閱讀" }] },
    { day: "04/28", s: [{ s: 7, e: 9, c: "學習" }, { s: 10, e: 12, c: "事業" }] },
    { day: "04/29", s: [{ s: 7, e: 10, c: "學習" }, { s: 13, e: 15, c: "兼差" }, { s: 15, e: 17, c: "閱讀" }] },
    { day: "04/30", s: [{ s: 7, e: 9, c: "學習" }, { s: 9, e: 10, c: "事業" }, { s: 10, e: 11, c: "兼差" }] },
    { day: "05/01", s: [{ s: 8, e: 11, c: "學習" }, { s: 14, e: 16, c: "閱讀" }] },
    { day: "今天", s: [{ s: 9, e: 11, c: "學習" }, { s: 14, e: 15, c: "閱讀" }] },
  ],
  lineData: {
    "3天":  { labels: ["04/30", "05/01", "05/02"], focus: [460, 320, 190], pomos: [7, 5, 3] },
    "7天":  { labels: ["04/26", "04/27", "04/28", "04/29", "04/30", "05/01", "05/02"], focus: [0, 480, 510, 460, 380, 320, 190], pomos: [0, 8, 8, 7, 6, 5, 3] },
    "14天": { labels: ["04/19","04/20","04/21","04/22","04/23","04/24","04/25","04/26","04/27","04/28","04/29","04/30","05/01","05/02"], focus: [400,450,0,380,420,430,380,0,480,510,460,380,320,190], pomos: [6,7,0,6,7,7,6,0,8,8,7,6,5,3] },
    "月":   { labels: ["W1", "W2", "W3", "W4"], focus: [1800, 2100, 1950, 800], pomos: [28, 32, 30, 13] },
    "季":   { labels: ["3月", "4月", "5月"], focus: [7200, 8400, 3400], pomos: [112, 130, 55] },
  },
  initTodos: [
    { id: 1, text: "取貨",     cat: "重要+急", startTime: "",      endTime: "",      mustDo: true },
    { id: 2, text: "台中會議", cat: "事業",    startTime: "09:00", endTime: "12:00", mustDo: true },
    { id: 3, text: "法律讀書", cat: "學習",    startTime: "13:00", endTime: "15:00", mustDo: false },
    { id: 4, text: "重訓",     cat: "健康",    startTime: "18:00", endTime: "20:00", mustDo: false },
  ],
  weekdaySchedule: {
    一: [{ t: "08:00", n: "卡片盒", c: "學習" }, { t: "09:00", n: "法律", c: "學習" }, { t: "13:00", n: "法律", c: "學習" }],
    二: [{ t: "08:00", n: "英文", c: "學習" }, { t: "09:00", n: "英文", c: "學習" }],
    三: [{ t: "08:00", n: "卡片盒", c: "學習" }, { t: "13:00", n: "法律", c: "學習" }],
    四: [{ t: "08:00", n: "架網站", c: "事業" }, { t: "15:00", n: "事業", c: "事業" }],
    五: [{ t: "08:00", n: "卡片盒", c: "學習" }, { t: "13:00", n: "法律", c: "學習" }],
    六: [], 日: [],
  },
  shopItems: [
    { id: 1, name: "手搖飲☕", price: 50, desc: "勞逸結合" },
    { id: 2, name: "新書📚", price: 200, desc: "知識投資" },
    { id: 3, name: "Spotify🎵", price: 150, desc: "專注配樂" },
  ],
};

// ═══════════════════════════════════════════════════════════
// 5. UTILS
// ═══════════════════════════════════════════════════════════
const fmt = m => m === 0 ? "0m" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? m % 60 + "m" : ""}`;
const fmtMs = ms => { const s = Math.floor(ms / 1000), m = Math.floor(s / 60); return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const fmtElapsed = ms => { if (!ms) return null; const s = Math.floor(ms / 1000); if (s < 60) return `${s}秒`; const m = Math.floor(s / 60); if (m < 60) return `${m}分${s % 60 ? " " + s % 60 + "秒" : ""}`; return `${Math.floor(m / 60)}h${m % 60 ? m % 60 + "m" : ""}`; };
const nowStr = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const getPeriod = h => h < 12 ? "早" : h < 18 ? "午" : "晚";
const pctPos = t => ((toM(t) - DS) / DT) * 100;
const pctH = (s, e) => ((toM(e) - toM(s)) / DT) * 100;
const getDaysInMonth = (y, m) => new Date(y, m, 0).getDate();
const getFirstDow = (y, m) => { const d = new Date(y, m - 1, 1).getDay(); return d === 0 ? 6 : d - 1; };
function seededRng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function genMonthData(y, m, days) { const rng = seededRng(y * 100 + m); return Array.from({ length: days }, () => { const v = rng(); return v < 0.2 ? 0 : Math.floor(v * 180 + 30); }); }
const coinsForSecs = s => { const m = s / 60; const row = CFG.COIN_TABLE.slice().reverse().find(r => m >= r.min); return row ? row.coins : 0; };
const aggregateByCat1 = pomos => { const map = {}; pomos.forEach(p => { if (!map[p.cat1]) map[p.cat1] = { cat1: p.cat1, mins: 0 }; map[p.cat1].mins += p.mins; }); return CAT.cat1List().filter(c => map[c]).map(c => map[c]); };
function playRestEnd() { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); [0, .2, .4].forEach((d, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = "sine"; o.frequency.value = [523, 659, 784][i]; g.gain.setValueAtTime(.3, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + d + .5); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + .5); }); } catch (e) {} }

// ═══════════════════════════════════════════════════════════
// 6. BASE COMPONENTS
// ═══════════════════════════════════════════════════════════
const Card = ({ children, style = {} }) => (
  <div style={{ background: TH.card, border: `1px solid ${TH.border}`, borderRadius: 14, padding: 14, ...style }}>{children}</div>
);
const Chip = ({ label, active, color = TH.accent, onClick, style = {} }) => (
  <button onClick={onClick} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${active ? color : TH.border}`, background: active ? color + "22" : "transparent", color: active ? color : TH.muted, fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, ...style }}>{label}</button>
);
const SL = ({ children, style = {} }) => <div style={{ fontSize: 10, color: TH.muted, marginBottom: 7, ...style }}>{children}</div>;
const BackBtn = ({ onBack, label }) => (
  <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: TH.muted, fontSize: 13, cursor: "pointer", padding: "0 0 8px 0", fontWeight: 600 }}>← {label}</button>
);

// ═══════════════════════════════════════════════════════════
// 7. CATEGORY SELECTOR — 可複用三層選擇器
// ═══════════════════════════════════════════════════════════
function CategorySelector({ cat1, cat2, cat3, onChange }) {
  const cat2List = CAT.cat2List(cat1);
  const cat3List = cat2 ? CAT.cat3List(cat1, cat2) : [];
  const setC1 = v => onChange({ cat1: v, cat2: "", cat3: "" });
  const setC2 = v => onChange({ cat1, cat2: cat2 === v ? "" : v, cat3: "" });
  const setC3 = v => onChange({ cat1, cat2, cat3: cat3 === v ? "" : v });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <div style={{ fontSize: 9, color: TH.muted, marginBottom: 4 }}>大分類 <span style={{ color: TH.red }}>必填</span></div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {CAT.cat1List().map(c => <Chip key={c} label={c} active={cat1 === c} color={CAT.cat1Color(c)} onClick={() => setC1(c)} style={{ fontSize: 9 }} />)}
        </div>
      </div>
      {cat1 && cat1 !== "未分類" && cat2List.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: TH.muted, marginBottom: 4 }}>中分類</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {cat2List.map(c => <Chip key={c} label={c} active={cat2 === c} color={CAT.cat2Color(cat1, c)} onClick={() => setC2(c)} style={{ fontSize: 9 }} />)}
          </div>
        </div>
      )}
      {cat2 && cat3List.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: TH.muted, marginBottom: 4 }}>小分類</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {cat3List.map(c => <Chip key={c} label={c} active={cat3 === c} color={CAT.cat3Color(cat1, cat2)} onClick={() => setC3(c)} style={{ fontSize: 9 }} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function CatBadge({ cat1, cat2, cat3 }) {
  if (!cat1) return null;
  const parts = [cat1, cat2, cat3].filter(Boolean);
  const color = CAT.deepColor(cat1, cat2, cat3);
  return <span style={{ fontSize: 9, color, background: color + "22", padding: "1px 6px", borderRadius: 8 }}>{parts.join(" › ")}</span>;
}

// ═══════════════════════════════════════════════════════════
// 8. CHART COMPONENTS
// ═══════════════════════════════════════════════════════════
function LineChart({ data, labels, color = TH.accent, height = 70 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1), W = 300, H = height, px = 16, py = 10, pw = W - px * 2;
  const pts = data.map((v, i) => ({ x: px + (i / (data.length - 1)) * pw, y: H - py - (v / max) * (H - py * 2) }));
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + `${p.x},${p.y}`).join(" ");
  const area = `${path} L${pts[pts.length - 1].x},${H - py} L${pts[0].x},${H - py} Z`;
  const gid = `g${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill={`url(#${gid})`} /><path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />)}
      </svg>
      <div style={{ display: "flex", paddingLeft: px, paddingRight: px }}>
        {labels.map((l, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 8, color: TH.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</div>)}
      </div>
    </div>
  );
}

function PieChart({ data, size = 160, title = "" }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  if (!total) return null;
  const cx = size / 2, cy = size / 2, r = size * .3, inner = size * .17;
  let cum = 0;
  const slices = data.map(d => {
    const sa = (cum / total) * 2 * Math.PI - Math.PI / 2; cum += d.value;
    const ea = (cum / total) * 2 * Math.PI - Math.PI / 2;
    const mid = (sa + ea) / 2, large = ea - sa > Math.PI ? 1 : 0;
    const [x1, y1] = [cx + r * Math.cos(sa), cy + r * Math.sin(sa)];
    const [x2, y2] = [cx + r * Math.cos(ea), cy + r * Math.sin(ea)];
    const [ix1, iy1] = [cx + inner * Math.cos(sa), cy + inner * Math.sin(sa)];
    const [ix2, iy2] = [cx + inner * Math.cos(ea), cy + inner * Math.sin(ea)];
    const path = `M ${ix1} ${iy1} A ${inner} ${inner} 0 ${large} 1 ${ix2} ${iy2} L ${x2} ${y2} A ${r} ${r} 0 ${large} 0 ${x1} ${y1} Z`;
    const pct = Math.round((d.value / total) * 100);
    const lr = r + size * .12;
    return { ...d, path, pct, lx: cx + lr * Math.cos(mid), ly: cy + lr * Math.sin(mid), skip: pct < 7 };
  });
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <g key={i}>
            <path d={s.path} fill={s.color} stroke={TH.card} strokeWidth={2} />
            {!s.skip && <text x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="middle" fill={s.color} fontSize={size * .055} fontWeight={800}>{s.pct}%</text>}
          </g>
        ))}
        <text x={cx} y={cy - 7} textAnchor="middle" fill={TH.text} fontSize={size * .1} fontWeight={900}>{Math.floor(total / 60)}h</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill={TH.muted} fontSize={size * .05}>{title}</text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: TH.muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: TH.text }}>{fmt(s.value)}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: s.color, minWidth: 24, textAlign: "right" }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CatBars({ data }) {
  const max = Math.max(...data.map(d => d.value || 0), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 56, fontSize: 9, color: TH.muted, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</div>
          <div style={{ flex: 1, height: 6, background: "#1C1C22", borderRadius: 3, overflow: "hidden", maxWidth: "55%" }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: "100%", background: d.color, borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 9, color: TH.muted, minWidth: 28, textAlign: "right" }}>{fmt(d.value)}</div>
        </div>
      ))}
    </div>
  );
}

function WeekHeat({ days = 7 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {MOCK.heat.slice(-days).map((day, i) => (
        <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div style={{ width: 36, fontSize: 8, color: TH.muted, textAlign: "right", paddingRight: 4, flexShrink: 0 }}>{day.day}</div>
          <div style={{ flex: 1, height: 13, background: "#1C1C22", borderRadius: 4, position: "relative", overflow: "hidden" }}>
            {day.s.map((s, si) => { const T = 17, l = ((s.s - 6) / T) * 100, w = ((s.e - s.s) / T) * 100; return <div key={si} style={{ position: "absolute", left: `${l}%`, width: `${w}%`, top: 2, bottom: 2, borderRadius: 3, background: CAT.cat1Color(s.c) || TH.muted }} />; })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TriCharts({ chartData, lineD, period, onPeriodChange, label }) {
  const lineColor = chartData[0]?.color || TH.accent;
  return (
    <>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
        {CFG.TIME_RANGES.map(p => <Chip key={p} label={p} active={period === p} onClick={() => onPeriodChange(p)} />)}
      </div>
      <Card><SL>{period} {label} 圓餅圖</SL><PieChart data={chartData} size={160} title={period} /></Card>
      <Card><SL>{period} {label} 時長分佈</SL><CatBars data={chartData} /></Card>
      <Card><SL>{period} 專注趨勢</SL><LineChart data={lineD.focus} labels={lineD.labels} color={lineColor} height={70} /></Card>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// 9. TODO SYSTEM
// ═══════════════════════════════════════════════════════════
function makeTodo(raw) {
  return { ...raw, phase: "pending", startAt: null, endAt: null, startTs: null, elapsed: null, date: CFG.TODAY_STR };
}

function TodoCard({ todo, onStart, onEnd, onToggleDone }) {
  const { id, text, cat, startTime, endTime, mustDo, phase, startAt, startTs } = todo;
  const col = CAT_COLOR[cat] || TH.muted;
  const isStarted = phase === "started", isEnding = phase === "ending";
  const [live, setLive] = useState("00:00");
  useEffect(() => {
    if (!isStarted || !startTs) return;
    const t = setInterval(() => setLive(fmtMs(Date.now() - startTs)), CFG.LIVE_TICK);
    return () => clearInterval(t);
  }, [isStarted, startTs]);

  if (phase === "done") {
    return (
      <div style={{ background: "#0A0A0C", border: `1px solid ${TH.border}`, borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => onToggleDone(id)} title="點擊取消完成"
          style={{ width: 26, height: 26, borderRadius: "50%", background: TH.green, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "transform .15s,opacity .15s" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(.85)"; e.currentTarget.style.opacity = ".65"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.opacity = "1"; }}>
          <span style={{ fontSize: 12, color: "#fff", pointerEvents: "none" }}>✓</span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textDecoration: "line-through" }}>{text}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
            {todo.startAt && <span style={{ fontSize: 9, color: "#4ADE80" }}>▶ {todo.startAt}</span>}
            <span style={{ fontSize: 9, color: "#60A5FA" }}>■ {todo.endAt}</span>
            {todo.elapsed > 0
              ? <span style={{ fontSize: 9, color: TH.yellow, fontWeight: 700 }}>共 {fmtElapsed(todo.elapsed)}</span>
              : <span style={{ fontSize: 9, color: TH.muted }}>直接完成</span>}
          </div>
        </div>
        <span style={{ fontSize: 9, color: col, background: col + "22", padding: "2px 7px", borderRadius: 6, flexShrink: 0 }}>{cat}</span>
      </div>
    );
  }

  return (
    <div style={{ background: TH.card, border: `1px solid ${isEnding ? TH.red + "55" : isStarted ? TH.green + "44" : TH.border}`, borderRadius: 14, padding: "12px 14px", transition: "border-color .25s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TH.text, marginBottom: 4 }}>{text}</div>
          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
            {startTime && <span style={{ fontSize: 9, color: TH.muted }}>🕐 {startTime}{endTime && `~${endTime}`}</span>}
            <span style={{ fontSize: 9, color: col, background: col + "22", padding: "1px 6px", borderRadius: 8 }}>{cat}</span>
            {mustDo && <span style={{ fontSize: 9, color: TH.red, fontWeight: 700 }}>必做</span>}
          </div>
        </div>
        {isStarted && startTs && <span style={{ fontSize: 13, fontWeight: 800, color: TH.green, flexShrink: 0 }}>{live}</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onStart(id)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: "pointer", border: `2px solid ${isStarted ? TH.green : "#4B5563"}`, background: isStarted ? TH.green + "1A" : "#1C1C24", color: isStarted ? TH.green : "#6B7280", transition: "all .2s" }}>
          {isStarted ? "▶ 進行中（取消）" : "▶ 開始"}
        </button>
        <button onClick={() => onEnd(id)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: "pointer", border: `2px solid ${isEnding ? TH.red : TH.accent}`, background: isEnding ? TH.red + "1A" : TH.accent + "1A", color: isEnding ? TH.red : TH.accent, position: "relative", overflow: "hidden", transition: "border-color .2s,color .2s" }}>
          {isEnding && <div id={`end-bar-${id}`} style={{ position: "absolute", left: 0, top: 0, height: "100%", width: "100%", background: TH.red + "2A", pointerEvents: "none" }} />}
          <span style={{ position: "relative", zIndex: 1 }}>{isEnding ? "■ 再點取消" : "■ 結束"}</span>
        </button>
      </div>
      {startAt && <div style={{ marginTop: 8, paddingTop: 7, borderTop: `1px solid ${TH.border}`, fontSize: 9, color: TH.muted }}>▶ 開始：<span style={{ color: TH.green, fontWeight: 700 }}>{startAt}</span></div>}
    </div>
  );
}

function useTodos(initial) {
  const [todos, setTodos] = useState(() => initial.map(makeTodo));
  const endTimers = useRef({}), endProgTimers = useRef({});
  const clearEndTimers = id => { clearTimeout(endTimers.current[id]); clearInterval(endProgTimers.current[id]); delete endTimers.current[id]; delete endProgTimers.current[id]; };

  const handleStart = useCallback(id => {
    setTodos(ts => { const t = ts.find(x => x.id === id); if (!t) return ts;
      if (t.phase === "pending") return ts.map(x => x.id === id ? { ...x, phase: "started", startAt: nowStr(), startTs: Date.now() } : x);
      if (t.phase === "started") return ts.map(x => x.id === id ? { ...x, phase: "pending", startAt: null, startTs: null } : x);
      return ts; });
  }, []);

  const handleEnd = useCallback(id => {
    setTodos(ts => { const t = ts.find(x => x.id === id); if (!t) return ts;
      if (t.phase === "ending") { clearEndTimers(id); return ts.map(x => x.id === id ? { ...x, phase: x.startTs ? "started" : "pending" } : x); }
      const start = Date.now();
      endProgTimers.current[id] = setInterval(() => { const bar = document.getElementById(`end-bar-${id}`); if (bar) bar.style.width = Math.max(0, 1 - (Date.now() - start) / CFG.END_CONFIRM) * 100 + "%"; }, 16);
      endTimers.current[id] = setTimeout(() => { clearEndTimers(id); const endAt = nowStr();
        setTodos(prev => { const cur = prev.find(x => x.id === id); const elapsed = cur?.startTs ? Date.now() - cur.startTs : 0; return prev.map(x => x.id === id ? { ...x, phase: "done", endAt, elapsed } : x); });
      }, CFG.END_CONFIRM);
      return ts.map(x => x.id === id ? { ...x, phase: "ending" } : x); });
  }, []);

  const handleToggleDone = useCallback(id => {
    setTodos(ts => ts.map(t => t.id === id && t.phase === "done" ? { ...t, phase: "pending", startAt: null, endAt: null, startTs: null, elapsed: null } : t));
  }, []);

  const addTodo = useCallback(raw => setTodos(ts => [...ts, makeTodo({ ...raw, id: Date.now() })]), []);
  const deleteTodo = useCallback(id => setTodos(ts => ts.filter(t => t.id !== id)), []);
  return { todos, handleStart, handleEnd, handleToggleDone, addTodo, deleteTodo };
}

// ═══════════════════════════════════════════════════════════
// 10. PAGES
// ═══════════════════════════════════════════════════════════
function BattleCard({ title, pomos, prevMins, prevCount }) {
  const agg = aggregateByCat1(pomos);
  const total = pomos.reduce((s, p) => s + p.mins, 0);
  const pct = prevMins > 0 ? Math.round(((total - prevMins) / prevMins) * 100) : 0;
  const cntDiff = pomos.length - prevCount;
  const maxM = Math.max(...agg.map(a => a.mins), 1);
  return (
    <div style={{ background: TH.card, border: `1px solid ${TH.border}`, borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: TH.text, marginBottom: 5 }}>⚔️ {title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: pct >= 0 ? TH.green : TH.red }}>{pct >= 0 ? "+" : ""}{pct}%</div>
        <div style={{ fontSize: 10, color: TH.muted }}>{fmt(total)}</div>
        <div style={{ marginLeft: "auto", fontSize: 9, color: TH.muted }}>🍅{pomos.length}{cntDiff !== 0 && <span style={{ color: cntDiff > 0 ? TH.green : TH.red, fontWeight: 800 }}>{cntDiff > 0 ? "+" : ""}{cntDiff}</span>}</div>
      </div>
      {agg.map((a, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: CAT.cat1Color(a.cat1), flexShrink: 0 }} />
          <span style={{ fontSize: 9, color: TH.muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.cat1}</span>
          <div style={{ width: 36, height: 4, background: "#1C1C22", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
            <div style={{ width: `${(a.mins / maxM) * 100}%`, height: "100%", background: CAT.cat1Color(a.cat1), borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 8, color: TH.muted, minWidth: 22, textAlign: "right" }}>{fmt(a.mins)}</span>
        </div>
      ))}
    </div>
  );
}

function Header({ quote, setQuote, focused, neutral, distracted }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(quote);
  return (
    <div style={{ background: TH.card, borderBottom: `1px solid ${TH.border}`, padding: "12px 16px 8px", position: "sticky", top: 0, zIndex: 200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 900, background: `linear-gradient(135deg,${TH.accent},#FBBF24)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>FlowLife</div>
          <div style={{ fontSize: 10, color: TH.muted, marginTop: 1 }}>2026年5月2日 週六</div>
        </div>
        <div style={{ background: "#1C1C24", borderRadius: 20, padding: "4px 10px", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11 }}>😤 <b style={{ color: TH.text }}>{focused}</b></span>
          <span style={{ fontSize: 11 }}>🙂 <b style={{ color: TH.text }}>{neutral}</b></span>
          <span style={{ fontSize: 11 }}>😴 <b style={{ color: TH.text }}>{distracted}</b></span>
        </div>
      </div>
      <div style={{ marginTop: 6, borderTop: `1px solid ${TH.border}`, paddingTop: 6 }}>
        {editing
          ? <div style={{ display: "flex", gap: 6 }}>
              <input value={draft} onChange={e => setDraft(e.target.value)} style={{ flex: 1, background: "#1C1C22", border: `1px solid ${TH.accent}`, borderRadius: 8, padding: "4px 10px", color: TH.text, fontSize: 11, outline: "none" }} autoFocus onKeyDown={e => { if (e.key === "Enter") { setQuote(draft); setEditing(false); } }} />
              <button onPointerDown={e => { e.preventDefault(); setQuote(draft); setEditing(false); }} style={{ padding: "4px 14px", background: TH.accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>✓</button>
            </div>
          : <div onClick={() => { setEditing(true); setDraft(quote); }} style={{ fontSize: 11, color: "#A78BFA", fontStyle: "italic", cursor: "pointer" }}>💬 {quote} <span style={{ fontSize: 9, color: TH.muted }}>點擊編輯</span></div>}
      </div>
    </div>
  );
}

function HomePage({ todos, onStart, onEnd, onToggleDone }) {
  const [expandReview, setExpandReview] = useState(false);
  const yTot = MOCK.yesterdayPomos.reduce((s, p) => s + p.mins, 0);
  const mustDo = todos.filter(t => t.date === CFG.TODAY_STR && t.mustDo && t.phase !== "done");
  const grouped = { 早: [], 午: [], 晚: [] };
  mustDo.forEach(t => { const h = t.startTime ? parseInt(t.startTime) : 7; grouped[getPeriod(h)].push(t); });
  const PL = { 早: "🌅 早（6~12）", 午: "☀️ 午（12~18）", 晚: "🌆 晚（18~24）" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}><BattleCard title="昨日" pomos={MOCK.yesterdayPomos} prevMins={350} prevCount={6} /></div>
        <div style={{ flex: 1, minWidth: 0 }}><BattleCard title="今日" pomos={MOCK.todayPomos} prevMins={yTot} prevCount={MOCK.yesterdayPomos.length} /></div>
      </div>
      <Card>
        <div onClick={() => setExpandReview(!expandReview)} style={{ cursor: "pointer" }}>
          <SL>💡 覆盤方針 {expandReview ? "▲" : "▼"}</SL>
          <div style={{ fontSize: 12, color: TH.text }}>「法律讀完一節再休息，不要中途滑手機」</div>
        </div>
        {expandReview && <div style={{ marginTop: 8, borderTop: `1px solid ${TH.border}`, paddingTop: 8 }}><div style={{ fontSize: 10, color: TH.muted, marginBottom: 4 }}>📚 閱讀筆記</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>• 習慣堆疊可以跟晨間儀式結合</div></div>}
      </Card>
      <Card>
        <SL>🔴 今日必做</SL>
        {mustDo.length === 0 && <div style={{ fontSize: 11, color: TH.muted, textAlign: "center", padding: 8 }}>🎉 必做全部完成！</div>}
        {["早", "午", "晚"].map(p => {
          const items = grouped[p]; if (!items.length) return null;
          return (<div key={p} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: TH.muted, marginBottom: 6 }}>{PL[p]}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map(t => <TodoCard key={t.id} todo={t} onStart={onStart} onEnd={onEnd} onToggleDone={onToggleDone} />)}
            </div>
          </div>);
        })}
      </Card>
    </div>
  );
}

function TimelinePage({ todos, onStart, onEnd, onToggleDone }) {
  const now = 15 * 60 + 30, nowPct = ((now - DS) / DT) * 100;
  const active = todos.filter(t => t.date === CFG.TODAY_STR && t.phase !== "done");
  const done = todos.filter(t => t.date === CFG.TODAY_STR && t.phase === "done");
  const hours = [];
  for (let h = 6; h <= 23; h++) { const m = h === 6 ? 30 : 0; const pos = ((h * 60 + m - DS) / DT) * 100; if (pos >= 0 && pos <= 100) hours.push({ label: `${h}:${m === 30 ? "30" : "00"}`, pos }); }
  const { PLN, ACT } = MOCK.schedule;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Card style={{ padding: "8px 12px" }}>
        <SL>今日待辦</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
          {active.map(t => <TodoCard key={t.id} todo={t} onStart={onStart} onEnd={onEnd} onToggleDone={onToggleDone} />)}
        </div>
        {done.length > 0 && <><div style={{ fontSize: 9, color: TH.muted, marginBottom: 4 }}>✅ 已完成</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{done.map(t => <TodoCard key={t.id} todo={t} onStart={onStart} onEnd={onEnd} onToggleDone={onToggleDone} />)}</div></>}
        <div style={{ height: 10, borderRadius: 5, overflow: "hidden", background: "#1C1C22", position: "relative", marginTop: 8 }}>
          {ACT.map((item, i) => { const l = ((toM(item.start) - DS) / DT) * 100, w = ((toM(item.end) - toM(item.start)) / DT) * 100; return <div key={i} style={{ position: "absolute", left: `${l}%`, width: `${w}%`, height: "100%", background: item.deep ? "#1F2937" : item.idle ? "#374151" : CAT.cat1Color(item.cat1) || "#6B7280" }} />; })}
        </div>
      </Card>
      <div style={{ display: "flex" }}>
        <div style={{ width: 34, flexShrink: 0, position: "relative", height: 560 }}>
          {hours.map(h => <div key={h.label} style={{ position: "absolute", top: `${h.pos}%`, right: 4, fontSize: 8, color: TH.muted, transform: "translateY(-50%)", whiteSpace: "nowrap" }}>{h.label}</div>)}
        </div>
        <div style={{ flex: 1, position: "relative", height: 560, background: "#0D0D0F", borderRadius: 8, border: `1px solid ${TH.border}` }}>
          {PLN.map((item, i) => { const top = pctPos(item.start), h = pctH(item.start, item.end); const col = CAT.cat1Color(item.cat1); return <div key={`p${i}`} style={{ position: "absolute", top: `${top}%`, height: `${h}%`, left: 4, right: "44%", background: col ? col + "2E" : "#1F293777", borderRadius: 5, padding: "2px 5px", overflow: "hidden", zIndex: 2 }}><div style={{ fontSize: 9, color: col || "#9CA3AF", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div></div>; })}
          {ACT.map((item, i) => { const top = pctPos(item.start), h = pctH(item.start, item.end); const col = item.deep ? "#1F2937" : item.idle ? "#1E2A3A" : CAT.cat1Color(item.cat1) || "#374151"; return <div key={`a${i}`} style={{ position: "absolute", top: `${top}%`, height: `${h}%`, left: "44%", right: 4, background: col, borderRadius: 5, padding: "2px 5px", overflow: "hidden", zIndex: 3 }}><div style={{ fontSize: 9, color: item.deep || item.idle ? "#4B5563" : "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div></div>; })}
          <div style={{ position: "absolute", left: "49%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,.04)", zIndex: 4, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: `${nowPct}%`, left: 0, right: 0, height: 2, background: TH.red, zIndex: 10, pointerEvents: "none" }}>
            <div style={{ position: "absolute", left: -4, top: -4, width: 10, height: 10, borderRadius: "50%", background: TH.red }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// 格式化未利用時間
const fmtIdleTime = s => {
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60), sec = s % 60;
  if (m < 60) return sec ? `${m} 分 ${sec} 秒` : `${m} 分鐘`;
  const h = Math.floor(m / 60), min = m % 60;
  return min ? `${h} 小時 ${min} 分` : `${h} 小時`;
};

function PomodoroPage({ coins, setCoins, onShowShop, focused, setFocused, neutral, setNeutral, distracted, setDistracted, idleTrackStart, setIdleTrackStart }) {
  const [dur, setDur] = useState(25);
  const [secs, setSecs] = useState(25 * 60);
  const [mode, setMode] = useState("idle");
  const [showRating, setShowRating] = useState(false);
  const [rated, setRated] = useState(false);
  const [restSecs, setRestSecs] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [linePeriod, setLinePeriod] = useState("7天");
  const [taskName, setTaskName] = useState("");
  const [catSel, setCatSel] = useState({ cat1: "", cat2: "", cat3: "" });
  const [confirmed, setConfirmed] = useState(null);
  // idleTrackStart 從 App 傳入，跨頁面持久
  const [idleSecs, setIdleSecs] = useState(0);
  const intRef = useRef(null), restRef = useRef(null), elRef = useRef(0), hitRef = useRef(new Set());
  const canStart = catSel.cat1 !== "";

  useEffect(() => {
    if (mode === "focus") { intRef.current = setInterval(() => { elRef.current++; setSecs(s => { if (s <= 1) { clearInterval(intRef.current); setMode("rest"); setShowRating(true); setRestSecs((CFG.REST_DURATIONS[dur] || 5) * 60); return 0; } return s - 1; }); }, 1000); }
    return () => clearInterval(intRef.current);
  }, [mode, dur]);

  useEffect(() => {
    if (mode === "rest" && restSecs > 0) {
      restRef.current = setInterval(() => setRestSecs(s => {
        if (s <= 1) { clearInterval(restRef.current); playRestEnd(); setIdleTrackStart(Date.now()); return 0; }
        return s - 1;
      }), 1000);
    }
    return () => clearInterval(restRef.current);
  }, [mode, restSecs]);

  useEffect(() => {
    if (!idleTrackStart) { setIdleSecs(0); return; }
    // 進入頁面時立刻同步（補上離開期間的時間）
    setIdleSecs(Math.floor((Date.now() - idleTrackStart) / 1000));
    const t = setInterval(() => setIdleSecs(Math.floor((Date.now() - idleTrackStart) / 1000)), 1000);
    return () => clearInterval(t);
  }, [idleTrackStart]);

  const startFocus = () => {
    if (!canStart) return;
    setConfirmed({ name: taskName || catSel.cat1, ...catSel });
    setSecs(dur * 60); elRef.current = 0; setMode("focus"); setShowRating(false); setRated(false);
    setIdleTrackStart(null); setIdleSecs(0);
  };
  const endFocus = () => { clearInterval(intRef.current); setMode("rest"); setShowRating(true); setRestSecs((CFG.REST_DURATIONS[dur] || 5) * 60); setIdleTrackStart(null); };
  const addRestTime = mins => { setIdleTrackStart(null); setIdleSecs(0); setRestSecs(s => s + mins * 60); if (mode !== "rest") setMode("rest"); };
  const confirmRating = r => {
    setRated(true); const el = elRef.current;
    if (el >= 5 * 60) {
      const mins = Math.round(el / 60), earned = coinsForSecs(el);
      const ns = [...sessions, { ...confirmed, mins, rating: r }]; setSessions(ns);
      if (r === "😤") setFocused(c => c + 1); else if (r === "🙂") setNeutral(c => c + 1); else setDistracted(c => c + 1);
      setCoins(c => c + earned);
      const tot = ns.reduce((s, p) => s + p.mins, 0);
      CFG.MILESTONES.forEach(m => { if (tot >= m.mins && !hitRef.current.has(m.mins)) { hitRef.current.add(m.mins); setCoins(c => c + m.coins); } });
    }
  };

  const m = Math.floor(secs / 60), s = secs % 60;
  const rm = Math.floor(restSecs / 60), rs = restSecs % 60;
  const circ = 2 * Math.PI * 58;
  const restTotal = (CFG.REST_DURATIONS[dur] || 5) * 60;
  // ── 圓環進度：專注/休息遞減（從滿到空），未利用遞增 ──
  const prog = idleTrackStart
    ? Math.min(idleSecs / 3600, 1)               // 未利用：0→1 遞增
    : mode === "rest" && restSecs > 0
    ? restSecs / restTotal                         // 休息：1→0 遞減
    : secs / (dur * 60);                           // 專注：1→0 遞減（0時代表剛開始）
  const tot = sessions.reduce((s, p) => s + p.mins, 0);
  const yLearn = MOCK.yesterdayPomos.filter(p => p.cat1 === "學習").reduce((s, p) => s + p.mins, 0);
  const lineD = MOCK.lineData[linePeriod] || MOCK.lineData["7天"];

  // ── 圓環顏色 ────────────────────────────────────────────
  const ringColor = mode === "focus" ? TH.accent
    : (mode === "rest" && restSecs > 0) ? TH.green
    : idleTrackStart ? "#3A3A42"   // 淺灰
    : TH.muted;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {CFG.POMO_DURATIONS.map(d => (
          <button key={d} onClick={() => { if (mode !== "focus") { setDur(d); setSecs(d * 60); setMode("idle"); setShowRating(false); } }} style={{ padding: "6px 12px", borderRadius: 20, border: "none", background: dur === d ? TH.accent : TH.card, color: dur === d ? "#fff" : TH.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {d < 60 ? `${d}分` : `${d / 60}h`}
          </button>
        ))}
      </div>
      <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="輸入事件名稱（可選）..." disabled={mode === "focus"}
        style={{ width: "100%", background: TH.card, border: `1px solid ${TH.border}`, borderRadius: 8, padding: "8px 12px", color: mode === "focus" ? TH.muted : TH.text, fontSize: 12, outline: "none", opacity: mode === "focus" ? .6 : 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 52 }}>
          <div style={{ fontSize: 20 }}>🪙</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: TH.gold }}>{coins.toLocaleString()}</div>
          <div style={{ fontSize: 8, color: TH.muted }}>金幣</div>
        </div>
        <div style={{ position: "relative", width: 148, height: 148 }}>
          <svg width={148} height={148} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={74} cy={74} r={58} fill="none" stroke={TH.border} strokeWidth={8} />
            <circle cx={74} cy={74} r={58} fill="none" stroke={ringColor} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${prog * circ} ${circ}`} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            {mode === "rest" && restSecs > 0
              ? <><div style={{ fontSize: 22, fontWeight: 900, color: TH.green }}>{String(rm).padStart(2, "0")}:{String(rs).padStart(2, "0")}</div><div style={{ fontSize: 9, color: TH.green }}>💤 休息中</div></>
              : idleTrackStart
              ? <><div style={{ fontSize: 13, fontWeight: 900, color: TH.red, textAlign: "center", lineHeight: 1.3 }}>{fmtIdleTime(idleSecs)}</div><div style={{ fontSize: 8, color: TH.muted, marginTop: 2 }}>⏳ 未利用</div></>
              : <><div style={{ fontSize: 22, fontWeight: 900, color: TH.text }}>{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</div>
                <div style={{ fontSize: 9, color: TH.muted }}>{mode === "focus" ? "🔥 專注中" : "⏸ 待機"}</div>
                {mode === "focus" && confirmed && <div style={{ fontSize: 8, color: CAT.cat1Color(confirmed.cat1), marginTop: 3 }}>{confirmed.cat1}{confirmed.cat2 && " › " + confirmed.cat2}</div>}</>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 52 }}>
          <div style={{ fontSize: 18 }}>🍅</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: TH.text }}>{sessions.length}</div>
          <div style={{ fontSize: 8, color: TH.muted }}>今日顆數</div>
        </div>
      </div>

      {/* ── 休息加時按鈕 ── */}
      {(mode === "rest" || idleTrackStart) && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
          <div style={{ fontSize: 9, color: mode === "rest" && restSecs > 0 ? TH.green : TH.yellow, fontWeight: 700 }}>
            {mode === "rest" && restSecs > 0 ? "💤 休息加時" : "➕ 加時繼續休息"}
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
            {[1, 3, 5, 10, 20, 30].map(mn => (
              <button key={mn} onClick={() => addRestTime(mn)} style={{ padding: "5px 10px", borderRadius: 16, border: `1px solid ${TH.green}55`, background: TH.green + "15", color: TH.green, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+{mn}分</button>
            ))}
          </div>
        </div>
      )}
      {mode !== "focus" && (
        <Card style={{ width: "100%", padding: 10 }}>
          <CategorySelector cat1={catSel.cat1} cat2={catSel.cat2} cat3={catSel.cat3} onChange={setCatSel} />
          {catSel.cat1 && <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${TH.border}`, fontSize: 10, color: TH.muted }}>已選：<CatBadge cat1={catSel.cat1} cat2={catSel.cat2} cat3={catSel.cat3} /></div>}
        </Card>
      )}
      {mode === "idle" && (
        <button onClick={startFocus} disabled={!canStart} style={{ padding: "12px 36px", borderRadius: 24, border: "none", background: canStart ? `linear-gradient(135deg,${TH.accent},#EA580C)` : "#374151", color: canStart ? "#fff" : "#6B7280", fontSize: 15, fontWeight: 800, cursor: canStart ? "pointer" : "not-allowed", transition: "all .2s" }}>
          {canStart ? "開始專注 🍅" : "請先選擇大分類"}
        </button>
      )}
      {mode === "focus" && <div style={{ display: "flex", gap: 8 }}>
        <button onClick={endFocus} style={{ padding: "9px 14px", borderRadius: 20, border: `2px solid ${TH.border}`, background: "transparent", color: TH.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>結束番茄鐘</button>
        <button onClick={() => { clearInterval(intRef.current); setMode("idle"); setShowRating(false); }} style={{ padding: "9px 14px", borderRadius: 20, border: "2px solid #EF444444", background: "#EF444411", color: TH.red, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>放棄</button>
      </div>}
      {showRating && !rated && (
        <Card style={{ width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: TH.muted, marginBottom: 10 }}>這次的專注狀態？</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
            {[["😤", "專心"], ["🙂", "一般"], ["😴", "分心"]].map(([e, l]) => (
              <button key={l} onClick={() => confirmRating(e)} style={{ padding: "10px 14px", borderRadius: 12, border: `2px solid ${TH.border}`, background: "transparent", color: TH.text, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 24 }}>{e}</span><span style={{ fontSize: 11 }}>{l}</span>
              </button>
            ))}
          </div>
        </Card>
      )}
      {rated && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: "100%" }}>
        <div style={{ fontSize: 11, color: TH.green }}>✓ 已記錄</div>
        <button onClick={startFocus} disabled={!canStart} style={{ padding: "9px 20px", borderRadius: 20, border: `2px solid ${TH.accent}`, background: TH.accent + "22", color: TH.accent, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>開始番茄鐘 🍅</button>
      </div>}
      {mode === "idle" && !idleTrackStart && <>
        <div style={{ fontSize: 11, color: TH.muted, background: TH.card, padding: "5px 14px", borderRadius: 20, border: `1px solid ${TH.border}`, textAlign: "center" }}>⏸ 等待開始</div>
        <div style={{ fontSize: 11, color: tot < yLearn ? TH.yellow : TH.green, background: tot < yLearn ? "#F59E0B11" : "#22C55E11", padding: "4px 12px", borderRadius: 20, textAlign: "center" }}>
          {tot < yLearn ? `🎯 再 ${fmt(yLearn - tot)} 超越昨天學習` : `✅ 已超越昨天！+${fmt(tot - yLearn)}`}
        </div>
      </>}
      {/* ── 未利用時間橫幅（休息結束後未開始番茄鐘） ── */}
      {idleTrackStart && (
        <div style={{ width: "100%", background: "#1C1C22", border: `1px solid #2E2E38`, borderRadius: 14, padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <div>
              <div style={{ fontSize: 10, color: TH.red, fontWeight: 700 }}>未利用時間累積中</div>
              <div style={{ fontSize: 9, color: TH.muted }}>距上次休息結束</div>
            </div>
            <div style={{ marginLeft: "auto", fontSize: 20, fontWeight: 900, color: TH.red }}>{fmtIdleTime(idleSecs)}</div>
          </div>
          <div style={{ height: 3, background: "#0D0D0F", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min((idleSecs / 3600) * 100, 100)}%`, background: TH.red, borderRadius: 2, transition: "width 1s linear" }} />
          </div>
          <div style={{ fontSize: 9, color: TH.muted, marginTop: 5, textAlign: "center" }}>點擊「開始番茄鐘」即停止計算</div>
        </div>
      )}
      {!idleTrackStart && mode !== "focus" && tot > 0 && (
        <div style={{ fontSize: 11, color: tot < yLearn ? TH.yellow : TH.green, background: tot < yLearn ? "#F59E0B11" : "#22C55E11", padding: "4px 12px", borderRadius: 20, textAlign: "center" }}>
          {tot < yLearn ? `🎯 再 ${fmt(yLearn - tot)} 超越昨天學習` : `✅ 已超越昨天！+${fmt(tot - yLearn)}`}
        </div>
      )}
      <Card style={{ width: "100%" }}>
        <SL>今日統計</SL>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {[["😤", "專心", focused], ["🙂", "一般", neutral], ["😴", "分心", distracted]].map(([e, l, v], i) => (
            <div key={i} style={{ flex: 1, background: "#0A0A0C", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}><div style={{ fontSize: 18 }}>{e}</div><div style={{ fontSize: 16, fontWeight: 800, color: TH.text }}>{v}</div><div style={{ fontSize: 9, color: TH.muted }}>{l}</div></div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: TH.muted, textAlign: "center" }}>{sessions.length} 顆 · 共 {fmt(tot)}</div>
      </Card>
      <Card style={{ width: "100%" }}><SL>番茄鐘分佈</SL><WeekHeat days={7} /></Card>
      <Card style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <SL style={{ marginBottom: 0 }}>番茄鐘趨勢</SL>
          <div style={{ display: "flex", gap: 3 }}>{CFG.TIME_RANGES.map(p => <Chip key={p} label={p} active={linePeriod === p} onClick={() => setLinePeriod(p)} style={{ fontSize: 9, padding: "2px 7px" }} />)}</div>
        </div>
        <LineChart data={lineD.pomos} labels={lineD.labels} color={TH.green} height={60} />
      </Card>
      <button onClick={onShowShop} style={{ width: "100%", padding: "12px", borderRadius: 12, border: `1px solid ${TH.gold}44`, background: TH.gold + "11", color: TH.gold, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
        🏪 商店 · 🪙 {coins.toLocaleString()} 金幣
      </button>
    </div>
  );
}

function CalendarPage({ todos, onShowDay, onShowSchedule }) {
  const [calView, setCalView] = useState("month");
  const [selCat1, setSelCat1] = useState("");
  const [selCat2, setSelCat2] = useState("");
  const [monthOffset, setMonthOffset] = useState(1);
  const [period, setPeriod] = useState("月");
  const filterLevel = selCat2 ? "cat2" : selCat1 ? "cat1" : "all";
  const chartData = CAT.chartDataFor(filterLevel, selCat1, selCat2);
  const chartLabel = selCat2 ? selCat2 : selCat1 ? selCat1 : "全部分類";
  const activeColor = selCat1 ? CAT.cat1Color(selCat1) : TH.red;
  const totalM = (4 - 1) + monthOffset;
  const curY = 2026 + Math.floor(totalM / 12), curM = (totalM % 12) + 1;
  const dim = getDaysInMonth(curY, curM), fdow = getFirstDow(curY, curM);
  const mData = genMonthData(curY, curM, dim);
  const mTot = mData.reduce((s, v) => s + v, 0);
  const prevRaw = genMonthData(curY, curM === 1 ? 12 : curM - 1, getDaysInMonth(curY, curM === 1 ? 12 : curM - 1));
  const prevTot = prevRaw.reduce((s, v) => s + v, 0);
  const pctVsLast = prevTot ? Math.round(((mTot - prevTot) / prevTot) * 100) : 0;
  const dayCount = mData.filter(v => v > 0).length, dayAvg = dayCount ? Math.round(mTot / dayCount) : 0;
  const DOW = ["一", "二", "三", "四", "五", "六", "日"];
  const lineD = MOCK.lineData[period] || MOCK.lineData["月"];
  const MAX_AVAIL = (22.67 - 6.5) * 60;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 5 }}>
        {[["week", "週曆"], ["month", "月曆"]].map(([v, l]) => (
          <button key={v} onClick={() => setCalView(v)} style={{ flex: 1, padding: "6px", borderRadius: 10, border: `1px solid ${calView === v ? activeColor : TH.border}`, background: calView === v ? activeColor + "22" : "transparent", color: calView === v ? activeColor : TH.muted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
        <button onClick={onShowSchedule} style={{ padding: "6px 10px", borderRadius: 10, border: `2px solid ${TH.yellow}`, background: TH.yellow + "22", color: TH.yellow, fontSize: 11, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>📋</button>
      </div>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
        <Chip label="全部" active={!selCat1} color={TH.red} onClick={() => { setSelCat1(""); setSelCat2(""); }} />
        {CAT.cat1List().filter(c => c !== "未分類").map(c => (
          <Chip key={c} label={c} active={selCat1 === c} color={CAT.cat1Color(c)} onClick={() => { setSelCat1(selCat1 === c ? "" : c); setSelCat2(""); }} />
        ))}
      </div>
      {selCat1 && CAT.cat2List(selCat1).length > 0 && (
        <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
          <span style={{ fontSize: 9, color: TH.muted, flexShrink: 0, alignSelf: "center" }}>中分類：</span>
          {CAT.cat2List(selCat1).map(c => (
            <Chip key={c} label={c} active={selCat2 === c} color={CAT.cat2Color(selCat1, c)} onClick={() => setSelCat2(selCat2 === c ? "" : c)} style={{ fontSize: 9, padding: "3px 8px" }} />
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
        {[["時長", fmt(mTot), activeColor], ["日均", fmt(dayAvg), TH.text], ["有效天", `${dayCount}天`, TH.text], ["番茄數", `${dayCount * 3}`, TH.text]].map(([l, v, col]) => (
          <div key={l} style={{ background: TH.card, border: `1px solid ${TH.border}`, borderRadius: 10, padding: "6px 8px" }}>
            <div style={{ fontSize: 8, color: TH.muted }}>{l}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: col }}>{v}</div>
          </div>
        ))}
      </div>
      {calView !== "week" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => setMonthOffset(m => m - 1)} style={{ background: "none", border: "none", color: TH.muted, fontSize: 22, cursor: "pointer" }}>‹</button>
          <div style={{ fontSize: 13, fontWeight: 700, color: TH.text }}>{curY}年 {curM}月</div>
          <button onClick={() => setMonthOffset(m => m + 1)} style={{ background: "none", border: "none", color: TH.muted, fontSize: 22, cursor: "pointer" }}>›</button>
        </div>
      )}
      {calView === "month" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
          {DOW.map(d => <div key={d} style={{ textAlign: "center", fontSize: 9, color: TH.muted }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {Array.from({ length: fdow }).map((_, i) => <div key={i} />)}
          {mData.map((mins, i) => {
            const day = i + 1, circ = 2 * Math.PI * 13, dash = circ * Math.min(mins / MAX_AVAIL, 1);
            const isToday = day === CFG.TODAY.getDate() && curM === CFG.TODAY.getMonth() + 1 && curY === CFG.TODAY.getFullYear();
            const dateStr = `${curY}-${String(curM).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            return (
              <div key={i} onClick={() => onShowDay(dateStr, `${curY}年${curM}月${day}日`)} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
                <div style={{ position: "relative", width: 32, height: 32 }}>
                  <svg width={32} height={32} style={{ transform: "rotate(-90deg)" }}><circle cx={16} cy={16} r={13} fill="none" stroke={TH.border} strokeWidth={2.5} />{mins > 0 && <circle cx={16} cy={16} r={13} fill="none" stroke={activeColor} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />}</svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: isToday ? 900 : 600, color: isToday ? activeColor : mins > 0 ? TH.text : TH.muted }}>{day}</div>
                  {isToday && <div style={{ position: "absolute", bottom: -1, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: activeColor }} />}
                </div>
              </div>
            );
          })}
        </div>
        {pctVsLast !== 0 && <div style={{ fontSize: 11, color: pctVsLast >= 0 ? TH.green : TH.red, textAlign: "center", fontWeight: 700 }}>vs 上月 {pctVsLast >= 0 ? "+" : ""}{pctVsLast}%</div>}
      </>}
      <TriCharts chartData={chartData} lineD={lineD} period={period} onPeriodChange={setPeriod} label={chartLabel} />
    </div>
  );
}

function SchedulePage({ onBack }) {
  const [sched, setSched] = useState(MOCK.weekdaySchedule);
  const [wkend, setWkend] = useState({ 六: "晚班", 日: "晚班" });
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ name: "", cat: "學習" });
  const DAYS = ["一", "二", "三", "四", "五", "六", "日"];
  const SLOTS = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
  const isWE = d => d === "六" || d === "日";
  const getCell = (d, t) => (sched[d] || []).find(e => e.t === t);
  const setCell = (d, t, data) => setSched(s => { const prev = (s[d] || []).filter(e => e.t !== t); return { ...s, [d]: data ? [...prev, { t, ...data }] : prev }; });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <BackBtn onBack={onBack} label="課表" />
      <div style={{ display: "flex", gap: 8 }}>
        {["六", "日"].map(d => <div key={d} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: TH.muted }}>週{d}：</span>
          {["早班", "晚班"].map(m => <Chip key={m} label={m} active={wkend[d] === m} color={TH.cyan} onClick={() => setWkend({ ...wkend, [d]: m })} style={{ fontSize: 9 }} />)}
        </div>)}
      </div>
      {editing && <Card style={{ border: `1px solid ${TH.accent}44` }}>
        <SL>✏️ 編輯 週{editing.d} {editing.t}</SL>
        <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="科目名稱..."
          style={{ width: "100%", background: "#0A0A0C", border: `1px solid ${TH.border}`, borderRadius: 6, padding: "6px 10px", color: TH.text, fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 7 }} />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          {CAT.cat1List().map(c => <Chip key={c} label={c} active={draft.cat === c} color={CAT.cat1Color(c)} onClick={() => setDraft({ ...draft, cat: c })} style={{ fontSize: 9 }} />)}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => { setCell(editing.d, editing.t, draft.name ? draft : null); setEditing(null); }} style={{ flex: 1, padding: "7px", borderRadius: 8, background: TH.green, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>儲存</button>
          <button onClick={() => { setCell(editing.d, editing.t, null); setEditing(null); }} style={{ flex: 1, padding: "7px", borderRadius: 8, background: "#EF444422", border: "1px solid #EF444444", color: TH.red, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>清除</button>
          <button onClick={() => setEditing(null)} style={{ flex: 1, padding: "7px", borderRadius: 8, background: "transparent", border: `1px solid ${TH.border}`, color: TH.muted, fontSize: 11, cursor: "pointer" }}>取消</button>
        </div>
      </Card>}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 360 }}>
          <div style={{ display: "grid", gridTemplateColumns: "44px repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
            <div style={{ fontSize: 9, color: TH.muted, textAlign: "center" }}>時間</div>
            {DAYS.map(d => <div key={d} style={{ fontSize: 10, fontWeight: 700, textAlign: "center", padding: "4px 0", background: isWE(d) ? TH.cyan + "11" : TH.card, borderRadius: 5, color: isWE(d) ? TH.cyan : TH.muted }}>{d}</div>)}
          </div>
          {SLOTS.map(t => (
            <div key={t} style={{ display: "grid", gridTemplateColumns: "44px repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
              <div style={{ fontSize: 7, color: TH.muted, textAlign: "right", paddingRight: 4, alignSelf: "center" }}>{t}</div>
              {DAYS.map(d => {
                if (isWE(d)) { const tn = parseInt(t), slots = wkend[d] === "晚班" ? [14, 15, 16, 17] : [8, 9, 10, 11]; const inS = slots.includes(tn); return <div key={d} style={{ background: inS ? "#8B5CF644" : "#0D0D0F", borderRadius: 5, minHeight: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>{inS && slots[0] === tn && <span style={{ fontSize: 8, color: "#8B5CF6", fontWeight: 700 }}>兼差</span>}</div>; }
                const cell = getCell(d, t); const col = cell ? CAT.cat1Color(cell.c) : null;
                return <div key={d} onClick={() => { setEditing({ d, t }); setDraft(cell ? { name: cell.n, cat: cell.c } : { name: "", cat: "學習" }); }} style={{ background: col ? col + "33" : "#1C1C24", borderRadius: 5, padding: "3px 4px", minHeight: 24, border: `1px solid ${col ? col + "44" : TH.border}`, cursor: "pointer" }}>{cell && <div style={{ fontSize: 8, fontWeight: 700, color: col, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cell.n}</div>}</div>;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShopPage({ coins, onSpend, onBack }) {
  const [items, setItems] = useState(MOCK.shopItems);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", price: "", desc: "" });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackBtn onBack={onBack} label="商店" />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}><span>🪙</span><span style={{ fontSize: 18, fontWeight: 900, color: TH.gold }}>{coins.toLocaleString()}</span></div>
      </div>
      <button onClick={() => setAddOpen(!addOpen)} style={{ padding: "9px", borderRadius: 10, border: `1px dashed ${TH.accent}`, background: "transparent", color: TH.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>＋ 新增商品</button>
      {addOpen && <Card style={{ border: `1px solid ${TH.accent}44` }}>
        {[["name", "商品名稱"], ["desc", "說明"]].map(([k, ph]) => (
          <input key={k} value={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.value })} placeholder={ph} style={{ width: "100%", background: "#0A0A0C", border: `1px solid ${TH.border}`, borderRadius: 6, padding: "6px 10px", color: TH.text, fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 6 }} />
        ))}
        <input type="number" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} placeholder="金幣價格" style={{ width: "100%", background: "#0A0A0C", border: `1px solid ${TH.border}`, borderRadius: 6, padding: "6px 10px", color: TH.text, fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
        <button onClick={() => { if (!draft.name || !draft.price) return; setItems(is => [...is, { ...draft, id: Date.now(), price: Number(draft.price) }]); setDraft({ name: "", price: "", desc: "" }); setAddOpen(false); }} style={{ width: "100%", padding: "8px", borderRadius: 8, background: TH.accent, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>新增</button>
      </Card>}
      {items.map(item => (
        <Card key={item.id}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div><div style={{ fontSize: 14, fontWeight: 800, color: TH.text }}>{item.name}</div>{item.desc && <div style={{ fontSize: 10, color: TH.muted }}>{item.desc}</div>}</div>
            <button onClick={() => setItems(is => is.filter(i => i.id !== item.id))} style={{ background: "none", border: "none", color: TH.muted, cursor: "pointer", fontSize: 13 }}>🗑️</button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span>🪙</span><span style={{ fontSize: 17, fontWeight: 900, color: TH.gold }}>{item.price}</span></div>
            <button onClick={() => { if (coins >= item.price) onSpend(item.price); else alert("金幣不足！"); }} style={{ padding: "6px 16px", borderRadius: 20, border: "none", background: coins >= item.price ? `linear-gradient(135deg,${TH.gold},${TH.accent})` : "#374151", color: coins >= item.price ? "#000" : "#6B7280", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{coins >= item.price ? "兌換" : "金幣不足"}</button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 10b. DAY VIEW PAGE — 行事曆點入的日期詳情頁
// ═══════════════════════════════════════════════════════════
function DayViewPage({ date, label, todos, onStart, onEnd, onToggleDone, onBack }) {
  const dateTodos = todos.filter(t => t.date === date);
  const pendingTL = dateTodos.filter(t => t.phase !== "done" && t.startTime);
  const doneTL    = dateTodos.filter(t => t.phase === "done"  && t.startTime);
  const now = new Date(), nowMins = now.getHours() * 60 + now.getMinutes();
  const nowPct = ((nowMins - DS) / DT) * 100;
  const hours = [];
  for (let h = 6; h <= 23; h++) {
    const m = h === 6 ? 30 : 0, pos = ((h * 60 + m - DS) / DT) * 100;
    if (pos >= 0 && pos <= 100) hours.push({ label: `${h}:${m === 30 ? "30" : "00"}`, pos });
  }
  const { PLN, ACT } = MOCK.schedule;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <BackBtn onBack={onBack} label={label} />

      {/* 待辦卡片 */}
      <Card style={{ padding: "8px 12px" }}>
        <SL>📅 待辦事項</SL>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {dateTodos.map(t => <TodoCard key={t.id} todo={t} onStart={onStart} onEnd={onEnd} onToggleDone={onToggleDone} />)}
          {dateTodos.length === 0 && <div style={{ fontSize: 11, color: TH.muted, textAlign: "center", padding: 12 }}>尚無待辦</div>}
        </div>
      </Card>

      {/* 直式行程表 */}
      <div style={{ display: "flex" }}>
        {/* 時間軸 */}
        <div style={{ width: 34, flexShrink: 0, position: "relative", height: 560 }}>
          {hours.map(h => (
            <div key={h.label} style={{ position: "absolute", top: `${h.pos}%`, right: 4, fontSize: 8, color: TH.muted, transform: "translateY(-50%)", whiteSpace: "nowrap" }}>{h.label}</div>
          ))}
        </div>

        <div style={{ flex: 1, position: "relative", height: 560, background: "#0D0D0F", borderRadius: 8, border: `1px solid ${TH.border}` }}>

          {/* ── PLN 預定區塊 ── */}
          {PLN.map((item, i) => {
            const top = pctPos(item.start), h = pctH(item.start, item.end);
            const col = CAT.cat1Color(item.cat1);
            return (
              <div key={`p${i}`} style={{ position: "absolute", top: `${top}%`, height: `${h}%`, left: 4, right: "44%", background: col ? col + "2E" : "#1F293777", borderRadius: 5, padding: "2px 5px", overflow: "hidden", zIndex: 2 }}>
                <div style={{ fontSize: 9, color: col || "#9CA3AF", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
              </div>
            );
          })}

          {/* ── 待辦（未完成）→ 疊在 PLN 欄，黃框黃字，有時間段延伸黃線 ── */}
          {pendingTL.map(todo => {
            const top = pctPos(todo.startTime);
            const hasRange = todo.endTime && todo.endTime !== todo.startTime;
            const spanH = hasRange ? Math.max(pctH(todo.startTime, todo.endTime), 2) : 0;
            return (
              <div key={`td-${todo.id}`} style={{ position: "absolute", top: `${top}%`, height: hasRange ? `${spanH}%` : "auto", left: 4, right: "44%", zIndex: 6, display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
                <div style={{ border: `1.5px solid ${TH.yellow}`, borderRadius: 4, padding: "2px 6px", background: "rgba(9,9,11,0.9)", alignSelf: "stretch", marginLeft: 2, marginRight: 2 }}>
                  <div style={{ fontSize: 8, color: TH.yellow, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{todo.text}</div>
                  {todo.startTime && <div style={{ fontSize: 7, color: TH.yellow + "99" }}>{todo.startTime}{todo.endTime ? `～${todo.endTime}` : ""}</div>}
                </div>
                {hasRange && <div style={{ flex: 1, width: 2, background: TH.yellow, marginTop: 1, borderRadius: 1, alignSelf: "center" }} />}
              </div>
            );
          })}

          {/* ── ACT 實際區塊 ── */}
          {ACT.map((item, i) => {
            const top = pctPos(item.start), h = pctH(item.start, item.end);
            const col = item.deep ? "#1F2937" : item.idle ? "#1E2A3A" : CAT.cat1Color(item.cat1) || "#374151";
            return (
              <div key={`a${i}`} style={{ position: "absolute", top: `${top}%`, height: `${h}%`, left: "44%", right: 4, background: col, borderRadius: 5, padding: "2px 5px", overflow: "hidden", zIndex: 3 }}>
                <div style={{ fontSize: 9, color: item.deep || item.idle ? "#4B5563" : "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
              </div>
            );
          })}

          {/* ── 待辦（已完成）→ 疊在 ACT 欄，白底黑字黑框，有時間段延伸黑線 ── */}
          {doneTL.map(todo => {
            const top = pctPos(todo.startTime);
            const hasRange = todo.endTime && todo.endTime !== todo.startTime;
            const spanH = hasRange ? Math.max(pctH(todo.startTime, todo.endTime), 2) : 0;
            return (
              <div key={`tdd-${todo.id}`} style={{ position: "absolute", top: `${top}%`, height: hasRange ? `${spanH}%` : "auto", left: "44%", right: 4, zIndex: 6, display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
                <div style={{ border: "1.5px solid #333", borderRadius: 4, padding: "2px 6px", background: "rgba(240,240,240,0.95)", alignSelf: "stretch", marginLeft: 2, marginRight: 2 }}>
                  <div style={{ fontSize: 8, color: "#111", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{todo.text}</div>
                  {todo.startTime && <div style={{ fontSize: 7, color: "#555" }}>{todo.startTime}{todo.endTime ? `～${todo.endTime}` : ""}</div>}
                </div>
                {hasRange && <div style={{ flex: 1, width: 2, background: "#444", marginTop: 1, borderRadius: 1, alignSelf: "center" }} />}
              </div>
            );
          })}

          {/* 中間分隔線 */}
          <div style={{ position: "absolute", left: "49%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,.04)", zIndex: 4, pointerEvents: "none" }} />

          {/* 當前時間紅線 */}
          {nowPct >= 0 && nowPct <= 100 && (
            <div style={{ position: "absolute", top: `${nowPct}%`, left: 0, right: 0, height: 2, background: TH.red, zIndex: 10, pointerEvents: "none" }}>
              <div style={{ position: "absolute", left: -4, top: -4, width: 10, height: 10, borderRadius: "50%", background: TH.red }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 11. NAV TABS — 新增頁籤只改這裡
// ═══════════════════════════════════════════════════════════
const TABS = [
  { id: "home",     icon: "🏠", name: "主頁"   },
  { id: "timeline", icon: "📅", name: "時段"   },
  { id: "pomodoro", icon: "🍅", name: "番茄"   },
  { id: "calendar", icon: "📆", name: "行事曆" },
  { id: "health",   icon: "💪", name: "健康"   },
  { id: "reading",  icon: "📚", name: "閱讀"   },
];

// ═══════════════════════════════════════════════════════════
// 12. APP ROOT
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab]           = useState("home");
  const [subPage, setSubPage]   = useState(null);
  const [quote, setQuote]       = useState("每一顆番茄鐘，都是打下江山的一刀。");
  const [coins, setCoins]       = useState(1240);
  const [focused, setFocused]   = useState(4);
  const [neutral, setNeutral]   = useState(1);
  const [distracted, setDistracted] = useState(0);
  // ── 未利用時間：提升至 App 層，切頁面不消失 ──────────
  const [idleTrackStart, setIdleTrackStart] = useState(null);
  const { todos, handleStart, handleEnd, handleToggleDone, addTodo, deleteTodo } = useTodos(MOCK.initTodos);
  const push = (type, props = {}) => setSubPage({ type, props });
  const pop = () => setSubPage(null);
  const todoProps = { todos, onStart: handleStart, onEnd: handleEnd, onToggleDone: handleToggleDone };

  // 子頁面路由 — 新增只需加一筆
  const SUB_PAGE_MAP = {
    schedule: () => <SchedulePage onBack={pop} />,
    shop: () => <ShopPage coins={coins} onSpend={n => setCoins(c => c - n)} onBack={pop} />,
    dayView: ({ date, label }) => (
      <DayViewPage date={date} label={label} todos={todos}
        onStart={handleStart} onEnd={handleEnd}
        onToggleDone={handleToggleDone} onBack={pop} />
    ),
  };

  // 主頁面路由 — 新增只需加一筆
  const MAIN_PAGE_MAP = {
    home:     () => <HomePage {...todoProps} />,
    timeline: () => <TimelinePage {...todoProps} />,
    pomodoro: () => <PomodoroPage coins={coins} setCoins={setCoins} onShowShop={() => push("shop")} focused={focused} setFocused={setFocused} neutral={neutral} setNeutral={setNeutral} distracted={distracted} setDistracted={setDistracted} idleTrackStart={idleTrackStart} setIdleTrackStart={setIdleTrackStart} />,
    calendar: () => <CalendarPage todos={todos} onShowDay={(d, l) => push("dayView", { date: d, label: l })} onShowSchedule={() => push("schedule")} />,
    health:   () => <Card><div style={{ textAlign: "center", padding: 30, color: TH.muted }}>💪 健康模組 — v11 開發</div></Card>,
    reading:  () => <Card><div style={{ textAlign: "center", padding: 30, color: TH.muted }}>📚 閱讀模組 — v11 開發</div></Card>,
  };

  return (
    <div style={{ background: TH.bg, color: TH.text, fontFamily: "-apple-system,'Noto Sans TC',sans-serif", maxWidth: 430, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header quote={quote} setQuote={setQuote} focused={focused} neutral={neutral} distracted={distracted} />
      <div style={{ flex: 1, overflowY: "auto", padding: 14, paddingBottom: 90 }}>
        {subPage ? SUB_PAGE_MAP[subPage.type]?.(subPage.props) : MAIN_PAGE_MAP[tab]?.()}
      </div>
      <nav style={{ position: "sticky", bottom: 0, background: TH.card, borderTop: `1px solid ${TH.border}`, display: "flex", padding: "6px 2px 12px", zIndex: 99 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSubPage(null); }} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "2px 3px" }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span style={{ fontSize: 8, color: tab === t.id && !subPage ? TH.accent : TH.muted, fontWeight: tab === t.id && !subPage ? 800 : 400 }}>{t.name}</span>
            {tab === t.id && !subPage && <div style={{ width: 14, height: 2, background: TH.accent, borderRadius: 1 }} />}
          </button>
        ))}
      </nav>
    </div>
  );
}