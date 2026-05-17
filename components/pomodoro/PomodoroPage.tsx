"use client";

import { type Dispatch, type SetStateAction } from "react";
import { CFG } from "@/lib/config";
import { TH } from "@/lib/theme";
import { fmt, fmtIdleTime } from "@/lib/utils";
import { Card, SL } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { CategorySelector } from "@/components/pomodoro/CategorySelector";
import { CatBadge } from "@/components/pomodoro/CatBadge";
import { RingTimer } from "@/components/pomodoro/RingTimer";
import { usePomodoro } from "@/components/pomodoro/usePomodoro";
import type { Session } from "@/lib/types";
import { WeekHeat } from "@/components/charts/WeekHeat";
import { LineChart } from "@/components/charts/LineChart";

const COIN_CRACKERS = Array.from({ length: 16 }, (_, idx) => ({
  id: idx + 1,
  animationName: `flowlifeCoinCracker${(idx % 4) + 1}`,
  delayMs: 750 + idx * 30,
  fontSize: idx % 4 < 2 ? 28 : 26,
}));

export function PomodoroPage({
  sessions,
  setSessions,
  coins,
  setCoins,
  onShowShop,
  onShowCategoryManager,
  focused,
  setFocused,
  neutral,
  setNeutral,
  distracted,
  setDistracted,
  idleTrackStart,
  setIdleTrackStart,
  idleTotalSecs,
  setIdleTotalSecs,
  restEndAt,
  setRestEndAt,
  resetVersion,
}: {
  sessions: Session[];
  setSessions: Dispatch<SetStateAction<Session[]>>;
  coins: number;
  setCoins: Dispatch<SetStateAction<number>>;
  onShowShop: () => void;
  onShowCategoryManager: () => void;
  focused: number;
  setFocused: Dispatch<SetStateAction<number>>;
  neutral: number;
  setNeutral: Dispatch<SetStateAction<number>>;
  distracted: number;
  setDistracted: Dispatch<SetStateAction<number>>;
  idleTrackStart: number | null;
  setIdleTrackStart: Dispatch<SetStateAction<number | null>>;
  idleTotalSecs: number;
  setIdleTotalSecs: Dispatch<SetStateAction<number>>;
  restEndAt: number | null;
  setRestEndAt: Dispatch<SetStateAction<number | null>>;
  resetVersion: number;
}) {
  const {
    dur,
    secs,
    mode,
    showRating,
    rated,
    restSecs,
    restTotalSecs,
    linePeriod,
    setLinePeriod,
    taskName,
    setTaskName,
    catSel,
    setCatSel,
    confirmed,
    idleSecs,
    rewardFx,
    focusReadyToBreak,
    focusOverrunSecs,
    canStart,
    countedSessions,
    tot,
    canShowRestBtn,
    yLearn,
    lineD,
    effectiveMode,
    isRestActive,
    idleTotalToday,
    todayCoinIncomeTotal,
    recentCoinIncomeLog,
    startFocus,
    endFocus,
    addRestTime,
    confirmRating,
    selectDuration,
    abandonFocus,
  } = usePomodoro({
    sessions,
    setSessions,
    setCoins,
    setFocused,
    setNeutral,
    setDistracted,
    idleTrackStart,
    setIdleTrackStart,
    idleTotalSecs,
    setIdleTotalSecs,
    restEndAt,
    setRestEndAt,
    resetVersion,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, position: "relative" }}>
      <style>{`
        @keyframes flowlifePulseDone {
          0% { transform: scale(0.92); opacity: 0; }
          25% { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        /* 總長 3s：0.5s 稍微右移 + 1.5s 停留 + 吸入右側 */
        @keyframes flowlifeTomatoTimeline {
          0% { transform: translate(-50%, -50%) scale(0.35); opacity: 0; }
          16.67% { transform: translate(calc(-50% + 28px), calc(-50% - 46px)) scale(1.2); opacity: 1; } /* 0.5s */
          66.67% { transform: translate(calc(-50% + 28px), calc(-50% - 46px)) scale(1); opacity: 1; } /* 停留 1.5s */
          100% { transform: translate(calc(-50% + 122px), calc(-50% - 64px)) scale(0.3); opacity: 0; } /* 吸入右側 */
        }
        /* 單一大金幣：只在左上位置感顯示，不再跑第二條大軌跡 */
        @keyframes flowlifeCoinMainPop {
          0% { transform: translate(calc(-50% - 28px), calc(-50% - 46px)) scale(0.25); opacity: 0; }
          16.67% { transform: translate(calc(-50% - 28px), calc(-50% - 46px)) scale(1.2); opacity: 1; } /* 0.5s */
          66.67% { transform: translate(calc(-50% - 28px), calc(-50% - 46px)) scale(1); opacity: 1; } /* 停留 1.5s */
          100% { transform: translate(calc(-50% - 122px), calc(-50% - 108px)) scale(0.3); opacity: 0; } /* 吸入左側 */
        }
        @keyframes flowlifeCoinCracker1 {
          0% { transform: translate(calc(-50% - 28px), calc(-50% - 46px)) scale(0.1); opacity: 0; }
          22% { transform: translate(calc(-50% - 54px), calc(-50% - 68px)) scale(1); opacity: 1; }
          58% { transform: translate(calc(-50% - 66px), calc(-50% - 38px)) scale(0.85); opacity: 1; }
          100% { transform: translate(calc(-50% - 122px), calc(-50% - 108px)) scale(0.2); opacity: 0; }
        }
        @keyframes flowlifeCoinCracker2 {
          0% { transform: translate(calc(-50% - 28px), calc(-50% - 46px)) scale(0.1); opacity: 0; }
          22% { transform: translate(calc(-50% + 46px), calc(-50% - 62px)) scale(1); opacity: 1; }
          58% { transform: translate(calc(-50% + 62px), calc(-50% - 34px)) scale(0.85); opacity: 1; }
          100% { transform: translate(calc(-50% - 122px), calc(-50% - 108px)) scale(0.2); opacity: 0; }
        }
        @keyframes flowlifeCoinCracker3 {
          0% { transform: translate(calc(-50% - 28px), calc(-50% - 46px)) scale(0.1); opacity: 0; }
          22% { transform: translate(calc(-50% - 42px), calc(-50% + 28px)) scale(1); opacity: 1; }
          58% { transform: translate(calc(-50% - 52px), calc(-50% + 56px)) scale(0.85); opacity: 1; }
          100% { transform: translate(calc(-50% - 122px), calc(-50% - 108px)) scale(0.2); opacity: 0; }
        }
        @keyframes flowlifeCoinCracker4 {
          0% { transform: translate(calc(-50% - 28px), calc(-50% - 46px)) scale(0.1); opacity: 0; }
          22% { transform: translate(calc(-50% + 34px), calc(-50% + 30px)) scale(1); opacity: 1; }
          58% { transform: translate(calc(-50% + 46px), calc(-50% + 58px)) scale(0.85); opacity: 1; }
          100% { transform: translate(calc(-50% - 122px), calc(-50% - 108px)) scale(0.2); opacity: 0; }
        }
      `}</style>
      {rewardFx && (
        <div
          style={{
            position: "absolute",
            top: 86,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "8px 16px",
            borderRadius: 999,
            border: `1px solid ${TH.green}55`,
            background: `${TH.green}22`,
            color: TH.green,
            fontSize: 12,
            fontWeight: 900,
            zIndex: 20,
            pointerEvents: "none",
            animation: "flowlifePulseDone 2400ms ease-out",
          }}
        >
          🎉 完成！番茄與金幣入帳
        </div>
      )}
      {rewardFx && (
        <div
          key={`tomato-${rewardFx.id}`}
          style={{
            position: "absolute",
            top: 238,
            left: "50%",
            color: TH.accent,
            fontSize: 34,
            fontWeight: 900,
            zIndex: 21,
            pointerEvents: "none",
            filter: "drop-shadow(0 0 10px rgba(249,115,22,0.45))",
            animation: "flowlifeTomatoTimeline 3000ms cubic-bezier(.2,.7,.1,1) forwards",
          }}
        >
          🍅
        </div>
      )}
      {rewardFx && (
        <div
          key={`coin-main-${rewardFx.id}`}
          style={{
            position: "absolute",
            top: 286,
            left: "50%",
            color: TH.gold,
            fontSize: 56,
            fontWeight: 900,
            textShadow: "0 0 10px rgba(251,191,36,0.35)",
            zIndex: 21,
            pointerEvents: "none",
            animation: "flowlifeCoinMainPop 3000ms cubic-bezier(.2,.7,.1,1) 1400ms both",
          }}
        >
          <span style={{ fontSize: 56, lineHeight: 1 }}>🪙</span>
          <span
            style={{
              position: "absolute",
              right: -24,
              top: -10,
              fontSize: 16,
              fontWeight: 900,
              color: TH.gold,
              textShadow: "0 0 8px rgba(251,191,36,0.35)",
            }}
          >
            +{rewardFx.amount}
          </span>
        </div>
      )}
      {rewardFx &&
        COIN_CRACKERS.map((coin) => (
          <div
            key={`coin-cracker-${coin.id}-${rewardFx.id}`}
            style={{
              position: "absolute",
              top: 286,
              left: "50%",
              color: TH.gold,
              fontSize: coin.fontSize,
              fontWeight: 900,
              textShadow: "0 0 10px rgba(251,191,36,0.35)",
              zIndex: 21,
              pointerEvents: "none",
              animation: `${coin.animationName} 1400ms cubic-bezier(.2,.7,.1,1) ${coin.delayMs}ms both`,
            }}
          >
            🪙
          </div>
        ))}
      <div style={{ display: "flex", gap: 6 }}>
        {CFG.POMO_DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => selectDuration(d)}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              border: "none",
              background: dur === d ? TH.accent : TH.card,
              color: dur === d ? "#fff" : TH.muted,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {d < 60 ? `${d}分` : `${d / 60}h`}
          </button>
        ))}
      </div>
      <input
        value={taskName}
        onChange={(e) => setTaskName(e.target.value)}
        placeholder="輸入事件名稱（可選）..."
        disabled={mode === "focus"}
        style={{
          width: "100%",
          background: TH.card,
          border: `1px solid ${TH.border}`,
          borderRadius: 8,
          padding: "8px 12px",
          color: mode === "focus" ? TH.muted : TH.text,
          fontSize: 12,
          outline: "none",
          opacity: mode === "focus" ? 0.6 : 1,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 52 }}>
          <div style={{ fontSize: 20 }}>🪙</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: TH.gold }}>{coins.toLocaleString()}</div>
          <div style={{ fontSize: 8, color: TH.muted }}>金幣</div>
        </div>
        <RingTimer
          mode={effectiveMode}
          secs={secs}
          dur={dur}
          restSecs={restSecs}
          restTotalSecs={restTotalSecs}
          idleTrackStart={idleTrackStart}
          idleSecs={idleSecs}
          confirmed={confirmed}
          focusOverrunSecs={focusOverrunSecs}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 52 }}>
          <div style={{ fontSize: 18 }}>🍅</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: TH.text }}>{sessions.length}</div>
          <div style={{ fontSize: 8, color: TH.muted }}>今日顆數</div>
        </div>
      </div>

      {(effectiveMode === "rest" || idleTrackStart) && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
          <div
            style={{
              fontSize: 9,
              color: effectiveMode === "rest" && restSecs > 0 ? TH.green : TH.yellow,
              fontWeight: 700,
            }}
          >
            {effectiveMode === "rest" && restSecs > 0 ? "💤 休息加時" : "➕ 加時繼續休息"}
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
            {[1, 3, 5, 10, 20, 30].map((mn) => (
              <button
                key={mn}
                type="button"
                onClick={() => addRestTime(mn)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 16,
                  border: `1px solid ${TH.green}55`,
                  background: TH.green + "15",
                  color: TH.green,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                +{mn}分
              </button>
            ))}
          </div>
        </div>
      )}
      {mode !== "focus" && (
        <Card style={{ width: "100%", padding: 10 }}>
          <CategorySelector
            cat1={catSel.cat1}
            cat2={catSel.cat2}
            cat3={catSel.cat3}
            onChange={setCatSel}
            onShowCategoryManager={onShowCategoryManager}
          />
          {catSel.cat1 && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: `1px solid ${TH.border}`,
                fontSize: 10,
                color: TH.muted,
              }}
            >
              已選：
              <CatBadge cat1={catSel.cat1} cat2={catSel.cat2} cat3={catSel.cat3} />
            </div>
          )}
        </Card>
      )}
      {mode !== "focus" && !(showRating && !rated) && (
        <button
          className="flowlife-pressable"
          type="button"
          onClick={startFocus}
          disabled={!canStart}
          style={{
            padding: "12px 36px",
            borderRadius: 24,
            border: "none",
            background: canStart ? `linear-gradient(135deg,${TH.accent},#EA580C)` : "#374151",
            color: canStart ? "#fff" : "#6B7280",
            fontSize: 15,
            fontWeight: 800,
            cursor: canStart ? "pointer" : "not-allowed",
            transition: "all .2s, transform .12s, filter .12s",
          }}
        >
          {canStart ? "開始專注 🍅" : "請先選擇大分類"}
        </button>
      )}
      {mode === "focus" && (
        <div style={{ display: "flex", gap: 8 }}>
          {canShowRestBtn && (
            <button
              className="flowlife-pressable"
              type="button"
              onClick={endFocus}
              style={{
                padding: "9px 14px",
                borderRadius: 20,
                border: `2px solid ${TH.green}`,
                background: TH.green + "22",
                color: TH.green,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                transition: "transform .12s, filter .12s",
              }}
            >
              休息
            </button>
          )}
          <button
            className="flowlife-pressable"
            type="button"
            onClick={abandonFocus}
            style={{
              padding: "9px 14px",
              borderRadius: 20,
              border: "2px solid #EF444444",
              background: "#EF444411",
              color: TH.red,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              transition: "transform .12s, filter .12s",
            }}
          >
            放棄
          </button>
        </div>
      )}
      {mode === "focus" && focusReadyToBreak && (
        <div
          style={{
            width: "100%",
            border: `1px solid ${TH.yellow}66`,
            background: TH.yellow + "14",
            borderRadius: 12,
            padding: "8px 12px",
            fontSize: 11,
            color: TH.yellow,
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          ⏰ 已到預定時長，正在持續專注中。按下「休息」才會進入休息畫面。
        </div>
      )}
      {showRating && !rated && (
        <Card style={{ width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: TH.muted, marginBottom: 10 }}>這次的專注狀態？</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
            {(
              [
                ["😤", "專心"],
                ["🙂", "一般"],
                ["😴", "分心"],
              ] as const
            ).map(([e, l]) => (
              <button
                key={l}
                type="button"
                onClick={() => confirmRating(e)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: `2px solid ${TH.border}`,
                  background: "transparent",
                  color: TH.text,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <span style={{ fontSize: 24 }}>{e}</span>
                <span style={{ fontSize: 11 }}>{l}</span>
              </button>
            ))}
          </div>
        </Card>
      )}
      {rated && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: "100%" }}>
          <div style={{ fontSize: 11, color: TH.green }}>✓ 已記錄</div>
        </div>
      )}
      {mode === "idle" && !idleTrackStart && !isRestActive && (
        <>
          <div
            style={{
              fontSize: 11,
              color: TH.muted,
              background: TH.card,
              padding: "5px 14px",
              borderRadius: 20,
              border: `1px solid ${TH.border}`,
              textAlign: "center",
            }}
          >
            ⏸ 等待開始
          </div>
          <div
            style={{
              fontSize: 11,
              color: tot < yLearn ? TH.yellow : TH.green,
              background: tot < yLearn ? "#F59E0B11" : "#22C55E11",
              padding: "4px 12px",
              borderRadius: 20,
              textAlign: "center",
            }}
          >
            {tot < yLearn ? `🎯 再 ${fmt(yLearn - tot)} 超越昨天學習` : `✅ 已超越昨天！+${fmt(tot - yLearn)}`}
          </div>
        </>
      )}
      {idleTrackStart && (
        <div
          style={{
            width: "100%",
            background: "#1C1C22",
            border: `1px solid #2E2E38`,
            borderRadius: 14,
            padding: "12px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <div>
              <div style={{ fontSize: 10, color: TH.red, fontWeight: 700 }}>未利用時間累積中</div>
              <div style={{ fontSize: 9, color: TH.muted }}>距離上次休息時間</div>
            </div>
            <div style={{ marginLeft: "auto", fontSize: 20, fontWeight: 900, color: TH.red }}>
              {fmtIdleTime(idleTotalToday)}
            </div>
          </div>
          <div style={{ height: 3, background: "#0D0D0F", borderRadius: 2, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min((idleSecs / 3600) * 100, 100)}%`,
                background: TH.red,
                borderRadius: 2,
                transition: "width 1s linear",
              }}
            />
          </div>
        </div>
      )}
      <Card style={{ width: "100%" }}>
        <SL>今日統計</SL>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {(
            [
              ["😤", "專心", focused],
              ["🙂", "一般", neutral],
              ["😴", "分心", distracted],
            ] as const
          ).map(([e, l, v], i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: "#0A0A0C",
                borderRadius: 10,
                padding: "8px 4px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 18 }}>{e}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: TH.text }}>{v}</div>
              <div style={{ fontSize: 9, color: TH.muted }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: TH.muted, textAlign: "center" }}>
          {countedSessions.length} 顆 · 共 {fmt(tot)}
        </div>
      </Card>
      <Card style={{ width: "100%" }}>
        <SL>金幣收支</SL>
        <div
          style={{
            background: "#0A0A0C",
            borderRadius: 10,
            padding: "9px 10px",
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 10, color: TH.muted, fontWeight: 800 }}>今日總收入</span>
          <span style={{ fontSize: 14, color: TH.gold, fontWeight: 900 }}>+{todayCoinIncomeTotal} 🪙</span>
        </div>
        {recentCoinIncomeLog.length === 0 ? (
          <div style={{ fontSize: 10, color: TH.muted, textAlign: "center", padding: 8 }}>尚無金幣收入</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentCoinIncomeLog.map((row) => (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#0A0A0C",
                  borderRadius: 8,
                  padding: "7px 9px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: TH.text, fontWeight: 800 }}>{row.taskName}</div>
                  <div style={{ fontSize: 9, color: TH.muted }}>{row.time}</div>
                </div>
                <div style={{ fontSize: 11, color: TH.gold, fontWeight: 900 }}>+{row.amount} 🪙</div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card style={{ width: "100%" }}>
        <SL>番茄鐘分佈</SL>
        <WeekHeat days={7} />
      </Card>
      <Card style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <SL style={{ marginBottom: 0 }}>番茄鐘趨勢</SL>
          <div style={{ display: "flex", gap: 3 }}>
            {CFG.TIME_RANGES.map((p) => (
              <Chip
                key={p}
                label={p}
                active={linePeriod === p}
                onClick={() => setLinePeriod(p)}
                style={{ fontSize: 9, padding: "2px 7px" }}
              />
            ))}
          </div>
        </div>
        <LineChart data={lineD.pomos} labels={lineD.labels} color={TH.green} height={60} />
      </Card>
      <button
        type="button"
        onClick={onShowShop}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 12,
          border: `1px solid ${TH.gold}44`,
          background: TH.gold + "11",
          color: TH.gold,
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        🏪 商店 · 🪙 {coins.toLocaleString()} 金幣
      </button>
    </div>
  );
}
