"use client";

import {
  Component,
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
  type ErrorInfo,
  type ReactNode,
  type SetStateAction,
} from "react";
import { CFG } from "@/lib/config";
import { TH } from "@/lib/theme";
import { TABS } from "@/lib/tabs";
import { LS_KEYS, loadJSON, saveJSON } from "@/lib/storage";
import { migrateCategoryIds, saveCategories, DEFAULT_CATEGORIES } from "@/lib/categories";
import { clearReviewsCloud } from "@/lib/reviews";
import type { Session, ActiveEntertainment, ShopItem } from "@/lib/types";
import { patchReflection, setSessionMins, setSessionTimes, buildManualSession, stampSession, ensureSessionUuid, splitSpanByDay } from "@/lib/sessions";
import { useReviewCloudSync } from "@/components/hooks/useReviewCloudSync";
import { useSessionCloudSync } from "@/components/hooks/useSessionCloudSync";
import { useAppStateCloudSync } from "@/components/hooks/useAppStateCloudSync";
import { subscribeSessions, syncSessionDiffToCloud } from "@/lib/sessionsCloud";
import { APP_STATE_KEYS, pushAppState, subscribeAppState } from "@/lib/appStateCloud";
import { ensureWorkplacesSeeded, ensureRoutineSeeded } from "@/lib/schedule";
import { DS, DE } from "@/lib/utils";
import { availableSegments } from "@/lib/idle";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/Header";
import { HomePage } from "@/components/home/HomePage";
import { TimelinePage } from "@/components/timeline/TimelinePage";
import { PomodoroPage } from "@/components/pomodoro/PomodoroPage";
import { CalendarPage } from "@/components/calendar/CalendarPage";
import { DayViewPage } from "@/components/calendar/DayViewPage";
import { SchedulePage } from "@/components/schedule/SchedulePage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { CategoryManager } from "@/components/category/CategoryManager";
import { ShopPage } from "@/components/shop/ShopPage";
import { CoinHistoryPage } from "@/components/pomodoro/CoinHistoryPage";
import { SessionHistoryPage } from "@/components/pomodoro/SessionHistoryPage";
import { useCoinLog } from "@/components/useCoinLog";
import { useTodos } from "@/components/todo/useTodos";
import { TodoEditSheet } from "@/components/todo/TodoEditSheet";

const DEFAULT_RATINGS = { focused: 0, neutral: 0, distracted: 0 };

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FlowLife crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: TH.bg,
            color: TH.text,
            fontFamily: "-apple-system,'Noto Sans TC',sans-serif",
            maxWidth: 430,
            margin: "0 auto",
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
          }}
        >
          <Card>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>出了點問題，請重新整理</div>
            <div style={{ color: TH.muted, fontSize: 12 }}>資料仍保存在本機，重新整理後會重新載入。</div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [tab, setTab] = useState("home");
  const [calIntent, setCalIntent] = useState<{ review: "day" } | null>(null);
  const [subPage, setSubPage] = useState<{ type: string; props?: Record<string, unknown> } | null>(null);
  const [quote, setQuote] = useState("每一顆番茄鐘，都是打下江山的一刀。");
  const {
    coinIncomeLog,
    setCoinIncomeLog,
    coinLogHydrated,
    coins,
    spendCoins,
    resetCoinLog,
    appendCoinRow,
    removeCoinRowsForSession,
    previewRefundForSession,
    upsertCoinRowForSession,
    findOrphanCoinRows,
    removeCoinRowsByIds,
    refundSpend,
    spendRows,
    spendReturningId,
    setCoinRowAmount,
    linkRowsToSessions,
  } = useCoinLog();
  const didLinkCoinRef = useRef(false);
  const [coinToast, setCoinToast] = useState<string | null>(null);
  const [ent, setEnt] = useState<ActiveEntertainment | null>(null);
  const entRef = useRef<ActiveEntertainment | null>(null);
  const [entRemain, setEntRemain] = useState(0);
  const entWarnRef = useRef<{ w2: boolean; w1: boolean }>({ w2: false, w1: false });
  const [focused, setFocused] = useState(DEFAULT_RATINGS.focused);
  const [neutral, setNeutral] = useState(DEFAULT_RATINGS.neutral);
  const [distracted, setDistracted] = useState(DEFAULT_RATINGS.distracted);
  const [idleTrackStart, setIdleTrackStart] = useState<number | null>(null);
  const idleTrackStartRef = useRef<number | null>(null);
  const [pomoRunning, setPomoRunning] = useState(false);
  useReviewCloudSync();
  useSessionCloudSync();
  useAppStateCloudSync();
  const [restEndAt, setRestEndAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);

  const { todos, handleStart, handleEnd, handleToggleDone, addTodo, updateTodo, resetTodos } = useTodos([]);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [trashedSessions, setTrashedSessions] = useState<Session[]>([]);

  const updateSessions = useCallback((updater: SetStateAction<Session[]>) => {
    setSessions((prev) => {
      const raw = typeof updater === "function" ? updater(prev) : updater;
      const next = raw.some((s) => !s.uuid || (s.cat1 && !s.cat1Id)) ? raw.map(stampSession) : raw;
      saveJSON(LS_KEYS.sessions, next);
      void syncSessionDiffToCloud(prev, next);
      return next;
    });
  }, []);

  const updateTrashed = useCallback((updater: SetStateAction<Session[]>) => {
    setTrashedSessions((prev) => {
      const next =
        typeof updater === "function"
          ? (updater as (p: Session[]) => Session[])(prev)
          : updater;
      saveJSON(LS_KEYS.trashedSessions, next);
      void pushAppState(APP_STATE_KEYS.trashedSessions, next);
      return next;
    });
  }, []);

  useEffect(() => {
    migrateCategoryIds();
    ensureWorkplacesSeeded();
    ensureRoutineSeeded();
    updateSessions(loadJSON<Session[]>(LS_KEYS.sessions, []));
    const loadedTrash = loadJSON<Session[]>(LS_KEYS.trashedSessions, []);
    const cutoff = Date.now() - 30 * 86400000;
    const keptTrash = loadedTrash.filter(
      (s) => !s.deletedAt || new Date(s.deletedAt).getTime() >= cutoff,
    );
    setTrashedSessions(keptTrash);
    if (keptTrash.length !== loadedTrash.length) {
      saveJSON(LS_KEYS.trashedSessions, keptTrash);
      void pushAppState(APP_STATE_KEYS.trashedSessions, keptTrash);
    }
    const r = loadJSON<Partial<typeof DEFAULT_RATINGS>>(LS_KEYS.ratingCounts, {});
    setFocused(typeof r.focused === "number" ? r.focused : DEFAULT_RATINGS.focused);
    setNeutral(typeof r.neutral === "number" ? r.neutral : DEFAULT_RATINGS.neutral);
    setDistracted(typeof r.distracted === "number" ? r.distracted : DEFAULT_RATINGS.distracted);
    setHydrated(true);
  }, [updateSessions]);

  useEffect(() => {
    if (hydrated && coinLogHydrated && !didLinkCoinRef.current) {
      didLinkCoinRef.current = true;
      linkRowsToSessions(sessions);
    }
  }, [hydrated, coinLogHydrated, sessions, linkRowsToSessions]);

  useEffect(() => {
    if (!coinToast) return;
    const t = setTimeout(() => setCoinToast(null), 4600);
    return () => clearTimeout(t);
  }, [coinToast]);

  useEffect(() => {
    const s = loadJSON<ActiveEntertainment | null>(LS_KEYS.activeEnt, null);
    if (s) { setEnt(s); entRef.current = s; }
  }, []);

  useEffect(() => {
    if (ent) saveJSON(LS_KEYS.activeEnt, ent);
    else localStorage.removeItem(LS_KEYS.activeEnt);
  }, [ent]);

  const endEntertainment = useCallback(() => {
    const current = entRef.current;
    if (!current) return;
    entRef.current = null; // 防重入
    setEnt(null);
    const elapsedSec = Math.floor((Date.now() - current.startAt) / 1000);
    const usedMins = Math.min(current.boughtMinutes, Math.floor(elapsedSec / 60));
    if (usedMins <= 0) {
      refundSpend(current.spendRowId);
    } else {
      setCoinRowAmount(current.spendRowId, -(usedMins * current.coinsPerMin));
    }
    const refund = (current.boughtMinutes - usedMins) * current.coinsPerMin;
    if (usedMins >= 1) {
      const segs = splitSpanByDay(current.startAt, current.startAt + usedMins * 60000);
      const rows: Session[] = segs.map((s, i) => ({
        id: Date.now() + i,
        uuid: crypto.randomUUID(),
        date: s.date,
        name: current.name,
        cat1: current.cat1 ?? "",
        cat2: current.cat2 ?? "",
        cat3: current.cat3 ?? "",
        mins: s.mins,
        rating: "",
        earnedCoins: 0,
        counted: s.mins > 1,
        startTime: s.startTime,
        endTime: s.endTime,
        updatedAt: new Date().toISOString(),
      }));
      updateSessions((prev) => [...prev, ...rows]);
    }
    setCoinToast(`「${current.name}」結束：用了 ${usedMins} 分，退回 ${refund} 金幣`);
  }, [refundSpend, setCoinRowAmount, updateSessions]);

  const handleBuyEntertainment = useCallback(
    (item: ShopItem, minutes: number): boolean => {
      if (ent) {
        setCoinToast("已有進行中的娛樂，請先結束");
        return false;
      }
      const cpm = item.coinsPerMin ?? 0;
      const cost = Math.round(minutes * cpm);
      if (minutes <= 0 || cost <= 0) return false;
      const rowId = spendReturningId(cost, item.name, item.productCat);
      if (rowId == null) {
        setCoinToast("金幣不足");
        return false;
      }
      const newEnt: ActiveEntertainment = {
        name: item.name,
        cat1: item.cat1,
        cat2: item.cat2,
        cat3: item.cat3,
        coinsPerMin: cpm,
        boughtMinutes: minutes,
        startAt: Date.now(),
        spendRowId: rowId,
      };
      entRef.current = newEnt;
      setEnt(newEnt);
      setIdleTrackStart(null);
      setCoinToast(`開始「${item.name}」${minutes} 分鐘（花 ${cost} 金幣）`);
      return true;
    },
    [ent, spendReturningId, setIdleTrackStart],
  );

  useEffect(() => {
    if (!ent) {
      setEntRemain(0);
      entWarnRef.current = { w2: false, w1: false };
      return;
    }
    const tick = () => {
      const remain = ent.boughtMinutes * 60 - Math.floor((Date.now() - ent.startAt) / 1000);
      setEntRemain(remain);
      if (remain <= 120 && remain > 60 && !entWarnRef.current.w2) {
        entWarnRef.current.w2 = true;
        setCoinToast(`⏱「${ent.name}」還剩 2 分鐘`);
      }
      if (remain <= 60 && remain > 0 && !entWarnRef.current.w1) {
        entWarnRef.current.w1 = true;
        setCoinToast(`⏱「${ent.name}」還剩 1 分鐘`);
      }
      if (remain <= 0) endEntertainment();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ent]);

  // 雲端同步回來時，把本地最新讀進畫面（用原始 setSessions，避免再次觸發推送）
  useEffect(
    () => subscribeSessions(() => setSessions(loadJSON<Session[]>(LS_KEYS.sessions, []))),
    [],
  );

  useEffect(
    () =>
      subscribeAppState(APP_STATE_KEYS.trashedSessions, () =>
        setTrashedSessions(loadJSON<Session[]>(LS_KEYS.trashedSessions, [])),
      ),
    [],
  );

  // 分類雲端同步回來 → 觸發重畫，讓所有讀分類的子元件拿到最新
  const [, bumpCat] = useState(0);
  useEffect(
    () => subscribeAppState(APP_STATE_KEYS.categories, () => bumpCat((v) => v + 1)),
    [],
  );

  // 班表雲端同步回來 → 觸發重畫，讓讀 loadWorkplaces() 的 schedule 取新值
  const [, bumpWp] = useState(0);
  useEffect(
    () => subscribeAppState(APP_STATE_KEYS.workplaces, () => bumpWp((n) => n + 1)),
    [],
  );

  // 固定作息雲端同步回來 → 觸發重畫，讓讀 loadRoutine() 的時間軸／課表取新值
  const [, bumpRoutine] = useState(0);
  useEffect(
    () => subscribeAppState(APP_STATE_KEYS.routine, () => bumpRoutine((n) => n + 1)),
    [],
  );

  const todaySessions = useMemo(
    () => sessions.filter((s) => s.date === CFG.TODAY_STR),
    [sessions],
  );

  const yesterdayStr = useMemo(() => {
    const yd = new Date(CFG.TODAY_STR + "T12:00:00");
    yd.setDate(yd.getDate() - 1);
    return `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, "0")}-${String(yd.getDate()).padStart(2, "0")}`;
  }, []);

  const yesterdaySessions = useMemo(
    () => sessions.filter((s) => s.date === yesterdayStr),
    [sessions, yesterdayStr],
  );

  const dayBeforeStr = useMemo(() => {
    const d = new Date(CFG.TODAY_STR + "T12:00:00");
    d.setDate(d.getDate() - 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const dayBeforeSessions = useMemo(
    () => sessions.filter((s) => s.date === dayBeforeStr),
    [sessions, dayBeforeStr],
  );

  const [editTodoId, setEditTodoId] = useState<number | null>(null);
  const editingTodo = editTodoId == null ? null : todos.find((x) => x.id === editTodoId);

  useEffect(() => {
    if (editTodoId != null && !todos.some((t) => t.id === editTodoId)) setEditTodoId(null);
  }, [todos, editTodoId]);

  useEffect(() => {
    if (!hydrated) return;
    saveJSON(LS_KEYS.ratingCounts, { focused, neutral, distracted });
  }, [focused, neutral, distracted, hydrated]);

  useEffect(() => {
    idleTrackStartRef.current = idleTrackStart;
  }, [idleTrackStart]);

  // 未利用規則制：落在可用時段且未在專注/娛樂 → 追蹤；否則清除
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const avail = availableSegments(CFG.TODAY_STR, DS, DE);
      const inAvail = avail.some(([a, b]) => mins >= a && mins < b);
      const shouldTrack = inAvail && !pomoRunning && !entRef.current;
      const prev = idleTrackStartRef.current;
      if (shouldTrack) {
        if (prev == null) {
          const t0 = Date.now();
          idleTrackStartRef.current = t0;
          setIdleTrackStart(t0);
        }
      } else if (prev != null) {
        idleTrackStartRef.current = null;
        setIdleTrackStart(null);
      }
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [pomoRunning, ent]);

  const push = (type: string, props: Record<string, unknown> = {}) => setSubPage({ type, props });
  const pop = () => setSubPage(null);

  const clearFlowLifeStorage = () => {
    if (typeof window === "undefined") return;
    Object.keys(localStorage)
      .filter((key) => key.startsWith("flowlife_"))
      .forEach((key) => localStorage.removeItem(key));
  };

  const handleResetAllData = () => {
    clearFlowLifeStorage();
    if (typeof window !== "undefined") {
      localStorage.removeItem("flowlife_coin_ledger_migrated");
    }
    saveCategories(DEFAULT_CATEGORIES); // 分類重置為預設並推上雲，蓋掉雲端舊分類
    void clearReviewsCloud(); // 清掉雲端覆盤，避免下次同步被拉回
    resetCoinLog();
    setFocused(DEFAULT_RATINGS.focused);
    setNeutral(DEFAULT_RATINGS.neutral);
    setDistracted(DEFAULT_RATINGS.distracted);
    setIdleTrackStart(null);
    setRestEndAt(null);
    resetTodos([]);
    updateSessions([]);
    updateTrashed([]);
    setResetVersion((v) => v + 1);
    setTab("home");
    setSubPage(null);
    setEditTodoId(null);
  };

  const handleClearRecords = () => {
    if (typeof window !== "undefined") {
      [
        LS_KEYS.sessions,
        LS_KEYS.coinIncomeLog,
        LS_KEYS.coins,
        LS_KEYS.ratingCounts,
      ].forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem("flowlife_coin_ledger_migrated");
    }
    resetCoinLog();
    setFocused(DEFAULT_RATINGS.focused);
    setNeutral(DEFAULT_RATINGS.neutral);
    setDistracted(DEFAULT_RATINGS.distracted);
    setIdleTrackStart(null);
    setRestEndAt(null);
    updateSessions([]);
    updateTrashed([]);
    setResetVersion((v) => v + 1);
  };

  const handleEditSessionMins = (id: number, newMins: number) => {
    const { sessions: next } = setSessionMins(sessions, id, newMins);
    updateSessions(next);
    const updated = next.find((s) => s.id === id);
    if (updated) upsertCoinRowForSession(updated, updated.earnedCoins ?? 0);
  };
  const handleEditSessionTimes = (id: number, startTime: string, endTime: string) => {
    const { sessions: next } = setSessionTimes(sessions, id, startTime, endTime);
    updateSessions(next);
    const updated = next.find((s) => s.id === id);
    if (updated) upsertCoinRowForSession(updated, updated.earnedCoins ?? 0);
  };
  const handleReconcileCoins = () => {
    const orphans = findOrphanCoinRows(sessions);
    if (orphans.length === 0) {
      setCoinToast("金幣紀錄與番茄一致，沒有需要清理的");
      return;
    }
    const total = orphans.reduce((s, r) => s + (r.amount ?? 0), 0);
    if (
      !window.confirm(
        `找到 ${orphans.length} 筆「番茄已不存在」的金幣紀錄，共 ${total} 金幣。\n清理後這些紀錄會刪除，金幣同步扣回 ${total}。\n確定清理？`,
      )
    )
      return;
    const removed = removeCoinRowsByIds(orphans.map((r) => r.id));
    setCoinToast(`已清理 ${orphans.length} 筆，扣回 ${removed} 金幣`);
  };
  const handleDeleteSession = (id: number) => {
    const target = sessions.find((s) => s.id === id);
    if (!target) return;
    const willRefund = previewRefundForSession(target);
    if (willRefund > 0 && coins - willRefund < 0) {
      setCoinToast(
        `無法刪除：這顆番茄的 ${willRefund} 金幣已經花掉了（目前只剩 ${coins}）。先賺回金幣或取消商店購買後再刪。`,
      );
      return;
    }
    updateSessions(sessions.filter((s) => s.id !== id));
    const logged = removeCoinRowsForSession(target); // 帳本實際入帳（含里程碑/寶箱）
    const refund = logged > 0 ? logged : (target.earnedCoins ?? 0); // 帳本查無 → 退基礎幣
    updateTrashed((prev) => [
      { ...target, deletedAt: new Date().toISOString(), refundedCoins: refund },
      ...prev.filter((s) => s.uuid !== target.uuid),
    ]);
    setCoinToast(
      refund > 0 ? `已移入垃圾桶，扣回 ${refund} 金幣` : "已移入垃圾桶（這顆沒有入帳金幣）",
    );
  };
  const handleRestoreSession = (uuid: string) => {
    const target = trashedSessions.find((s) => s.uuid === uuid);
    if (!target) return;
    const clean = { ...target };
    delete clean.deletedAt;
    delete clean.refundedCoins;
    updateSessions((prev) => [...prev, { ...clean, updatedAt: new Date().toISOString() }]);
    updateTrashed((prev) => prev.filter((s) => s.uuid !== uuid));
    const gain = target.refundedCoins ?? (target.earnedCoins ?? 0);
    if (gain > 0) {
      const t = target.startTime ?? "";
      appendCoinRow({
        id: Date.now(),
        date: target.date,
        time: t,
        at: `${target.date} ${t}`.trim(),
        taskName: target.name,
        amount: gain,
        cat1: target.cat1,
        cat2: target.cat2 || undefined,
        cat3: target.cat3 || undefined,
        startTime: target.startTime,
        endTime: target.endTime,
        sessionUuid: target.uuid,
        kind: "session",
      });
    }
    setCoinToast(gain > 0 ? `已復原，加回 ${gain} 金幣` : "已復原（這顆沒有金幣）");
  };
  const handlePurgeSession = (uuid: string) => {
    updateTrashed((prev) => prev.filter((s) => s.uuid !== uuid));
  };
  const handlePurgeAll = () => {
    updateTrashed([]);
    setCoinToast("垃圾桶已清空");
  };
  const handleAddManualSession = (input: {
    startAt: string;
    endAt: string;
    name: string;
    cat1: string;
    cat2: string;
    cat3: string;
    rating?: string;
  }) => {
    const { sessions: newRows } = buildManualSession(input);
    const stamped = newRows.map(ensureSessionUuid);
    updateSessions((prev) => [...prev, ...stamped]);
    stamped.forEach((row) => {
      const amt = row.earnedCoins ?? 0;
      if (amt <= 0) return;
      const t = row.startTime ?? "";
      appendCoinRow({
        id: Date.now() + Math.floor(Math.random() * 1000),
        date: row.date,
        time: t,
        at: `${row.date} ${t}`.trim(),
        taskName: row.name,
        amount: amt,
        cat1: row.cat1,
        cat2: row.cat2 || undefined,
        cat3: row.cat3 || undefined,
        startTime: row.startTime,
        endTime: row.endTime,
        sessionUuid: row.uuid,
        kind: "session",
      });
    });
  };

  const todoProps = {
    todos,
    onStart: handleStart,
    onEnd: handleEnd,
    onToggleDone: handleToggleDone,
    onAddTodo: addTodo,
    onEditTodo: (id: number) => setEditTodoId(id),
  };

  const SUB_PAGE_MAP: Record<string, (props?: Record<string, unknown>) => ReactNode> = {
    schedule: () => (
      <SchedulePage
        onBack={pop}
        onShowCategoryManager={() => push("categoryManager", { from: "schedule" })}
      />
    ),
    settings: () => (
      <SettingsPage
        onBack={pop}
        onResetAllData={handleResetAllData}
        onResetTodos={resetTodos}
        onClearRecords={handleClearRecords}
      />
    ),
    categoryManager: (props = {}) => (
      <CategoryManager
        onBack={() => {
          if (props.from === "schedule") push("schedule");
          else pop();
        }}
      />
    ),
    shop: () => (
      <ShopPage
        coins={coins}
        onSpend={(amount: number, label?: string, productCat?: string) =>
          spendCoins(amount, label ?? "商店消費", productCat)
        }
        spendRows={spendRows}
        allSpendRows={spendRows}
        onRefundSpend={(rowId: number) => {
          const row = spendRows.find((r) => r.id === rowId);
          refundSpend(rowId);
          if (row) {
            updateSessions((prev) =>
              prev.filter(
                (s) => !(s.name === row.taskName && s.date === row.date && (s.earnedCoins ?? 0) === 0),
              ),
            );
          }
          setCoinToast("已取消購買，金幣與時間已一併移除");
        }}
        onBuyEntertainment={handleBuyEntertainment}
        entActive={!!ent}
        onBack={pop}
      />
    ),
    coinHistory: () => (
      <CoinHistoryPage
        coinIncomeLog={coinIncomeLog}
        setCoinIncomeLog={setCoinIncomeLog}
        onBack={pop}
        onReconcile={handleReconcileCoins}
      />
    ),
    sessionHistory: () => (
      <SessionHistoryPage
        sessions={sessions}
        onBack={pop}
        onEditMins={handleEditSessionMins}
        onEditTimes={handleEditSessionTimes}
        onDelete={handleDeleteSession}
        onAddManual={handleAddManualSession}
        trashedSessions={trashedSessions}
        onRestore={handleRestoreSession}
        onPurge={handlePurgeSession}
        onPurgeAll={handlePurgeAll}
      />
    ),
    dayView: (props = {}) => (
      <DayViewPage
        date={props.date as string}
        label={props.label as string}
        todos={todos}
        onStart={handleStart}
        onEnd={handleEnd}
        onToggleDone={handleToggleDone}
        onAddTodo={addTodo}
        onEditTodo={todoProps.onEditTodo}
        onBack={pop}
      />
    ),
  };

  const MAIN_PAGE_MAP: Record<string, () => ReactNode> = {
    home: () => (
      <HomePage
        {...todoProps}
        todaySessions={todaySessions}
        yesterdaySessions={yesterdaySessions}
        dayBeforeSessions={dayBeforeSessions}
        onWriteSummary={() => {
          setTab("calendar");
          setCalIntent({ review: "day" });
        }}
      />
    ),
    timeline: () => <TimelinePage {...todoProps} onShowSchedule={() => push("schedule")} />,
    calendar: () => (
      <CalendarPage
        todos={todos}
        sessions={sessions}
        onShowDay={(d, l) => push("dayView", { date: d, label: l })}
        onPatchReflection={(id, text) =>
          updateSessions((prev) => patchReflection(prev, id, text))}
        intent={calIntent}
        onIntentConsumed={() => setCalIntent(null)}
      />
    ),
    health: () => (
      <Card>
        <div style={{ textAlign: "center", padding: 30, color: TH.muted }}>💪 健康模組 — v11 開發</div>
      </Card>
    ),
    reading: () => (
      <Card>
        <div style={{ textAlign: "center", padding: 30, color: TH.muted }}>📚 閱讀模組 — v11 開發</div>
      </Card>
    ),
  };

  const pomodoroPage = (
    <PomodoroPage
      sessions={sessions}
      setSessions={updateSessions}
      coins={coins}
      onShowShop={() => push("shop")}
      onShowCategoryManager={() => push("categoryManager")}
      onShowCoinHistory={() => push("coinHistory")}
      onShowSessionHistory={() => push("sessionHistory")}
      coinIncomeLog={coinIncomeLog}
      setCoinIncomeLog={setCoinIncomeLog}
      focused={focused}
      setFocused={setFocused}
      neutral={neutral}
      setNeutral={setNeutral}
      distracted={distracted}
      setDistracted={setDistracted}
      idleTrackStart={idleTrackStart}
      setIdleTrackStart={setIdleTrackStart}
      restEndAt={restEndAt}
      setRestEndAt={setRestEndAt}
      resetVersion={resetVersion}
      onFocusStart={() => {
        setPomoRunning(true);
        endEntertainment();
      }}
      onFocusEnd={() => setPomoRunning(false)}
      entName={ent?.name ?? null}
    />
  );

  return (
    <div
      style={{
        background: TH.bg,
        color: TH.text,
        fontFamily: "-apple-system,'Noto Sans TC',sans-serif",
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Header quote={quote} setQuote={setQuote} onShowSettings={() => push("settings")} />
      <div style={{ flex: 1, overflowY: "auto", padding: 14, paddingBottom: 90 }}>
        <div style={{ display: !subPage && tab === "pomodoro" ? "block" : "none" }}>{pomodoroPage}</div>
        {(subPage || tab !== "pomodoro") &&
          (subPage ? SUB_PAGE_MAP[subPage.type]?.(subPage.props) : MAIN_PAGE_MAP[tab]?.())}
      </div>
      <nav
        style={{
          position: "sticky",
          bottom: 0,
          background: TH.card,
          borderTop: `1px solid ${TH.border}`,
          display: "flex",
          padding: "6px 2px 12px",
          zIndex: 99,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSubPage(null);
            }}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              padding: "2px 3px",
            }}
          >
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span
              style={{
                fontSize: 8,
                color: tab === t.id && !subPage ? TH.accent : TH.muted,
                fontWeight: tab === t.id && !subPage ? 800 : 400,
              }}
            >
              {t.name}
            </span>
            {tab === t.id && !subPage && <div style={{ width: 14, height: 2, background: TH.accent, borderRadius: 1 }} />}
          </button>
        ))}
      </nav>
      {ent && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 130,
            zIndex: 200,
            background: TH.card,
            border: `1px solid ${TH.gold}66`,
            borderRadius: 14,
            padding: "8px 14px",
            boxShadow: "0 4px 16px #000A",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: TH.gold }}>
                ⏱ {ent.name} 剩 {String(Math.floor(Math.max(0, entRemain) / 60)).padStart(2, "0")}:
                {String(Math.max(0, entRemain) % 60).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={endEntertainment}
                style={{
                  border: `1px solid ${TH.red}66`,
                  borderRadius: 999,
                  padding: "3px 12px",
                  background: "#EF444422",
                  color: TH.red,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                結束
              </button>
            </div>
            <div style={{ fontSize: 9, color: TH.muted, textAlign: "center" }}>
              💡 結束後會開始累積未利用；想避免可直接按「開始專注 🍅」
            </div>
          </div>
        </div>
      )}
      {coinToast && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 84,
            background: TH.card,
            border: `1px solid ${TH.accent}66`,
            color: TH.text,
            fontSize: 12,
            fontWeight: 700,
            padding: "8px 14px",
            borderRadius: 999,
            zIndex: 200,
            boxShadow: "0 4px 16px #000A",
            maxWidth: 340,
            textAlign: "center",
          }}
        >
          {coinToast}
        </div>
      )}
      {editingTodo && (
        <TodoEditSheet
          key={editTodoId}
          todo={editingTodo}
          onClose={() => setEditTodoId(null)}
          onSave={(id, patch) => {
            updateTodo(id, patch);
            setEditTodoId(null);
          }}
        />
      )}
    </div>
  );
}
