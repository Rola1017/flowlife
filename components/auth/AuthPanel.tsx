"use client";

import { useEffect, useState } from "react";
import { TH } from "@/lib/theme";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearAllAppData, clearOwnerUserId, loadOwnerUserId, saveOwnerUserId } from "@/lib/storage";
import { flushLocalToCloud } from "@/lib/cloudFlush";
import { inspectSessionCloudStatus } from "@/lib/sessionsCloud";

const inputStyle = {
  background: "#15151B",
  border: `1px solid ${TH.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  color: TH.text,
  fontSize: 12,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
} as const;

const btnBase = {
  padding: "8px 14px",
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
} as const;

export function AuthPanel() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [logoutWarn, setLogoutWarn] = useState<{ n: number; detail: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const submit = async () => {
    setLoading(true);
    setMsg("");
    const fn =
      mode === "signup"
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password });
    const { data, error } = await fn;
    setLoading(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    const uid = data.user?.id ?? (await supabase.auth.getUser()).data.user?.id ?? null;
    const stored = loadOwnerUserId();
    if (uid && stored !== uid) {
      clearAllAppData();
      saveOwnerUserId(uid);
      window.location.reload();
      return;
    }
    setMsg("✅ 已登入");
    setPassword("");
  };

  const finishSignOut = async () => {
    setLoading(true);
    const flushed = await flushLocalToCloud(5000);
    if (flushed.timedOut) {
      setMsg("同步逾時（5秒）。若仍登出，本機未上雲的資料會消失。");
    }
    await supabase.auth.signOut();
    clearAllAppData();
    clearOwnerUserId();
    window.location.reload();
  };

  const signOut = async () => {
    setLoading(true);
    setMsg("");
    const status = await inspectSessionCloudStatus();
    const n = status.onlyLocalCount + status.failCount;
    const unsynced = n > 0 || status.cloudUnreachable;
    setLoading(false);
    if (unsynced) {
      const bits = [
        status.onlyLocalCount > 0 ? `${status.onlyLocalCount} 筆番茄只在本機` : "",
        status.failCount > 0 ? `${status.failCount} 筆寫入失敗` : "",
        status.cloudUnreachable ? "雲端讀取失敗" : "",
      ].filter(Boolean);
      setLogoutWarn({ n: Math.max(n, 1), detail: bits.join("、") });
      return;
    }
    if (!window.confirm("登出會清除這台裝置上的本機資料（雲端資料保留）。確定登出？")) return;
    await finishSignOut();
  };

  const retryThenRecheck = async () => {
    setLoading(true);
    setMsg("");
    const flushed = await flushLocalToCloud(5000);
    if (flushed.timedOut) {
      setLoading(false);
      setMsg("同步逾時（5秒），請檢查網路後再試，或仍要登出。");
      return;
    }
    const status = await inspectSessionCloudStatus();
    setLoading(false);
    const n = status.onlyLocalCount + status.failCount;
    if (n > 0 || status.cloudUnreachable) {
      setMsg("仍有資料未上雲，請再試或仍要登出。");
      return;
    }
    setLogoutWarn(null);
    setMsg("✅ 已同步到雲端，可以登出");
  };

  if (userEmail) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, color: TH.text }}>
          已登入：<span style={{ fontWeight: 800 }}>{userEmail}</span>
        </div>
        {logoutWarn ? (
          <div
            style={{
              border: `1px solid ${TH.red}66`,
              background: TH.red + "14",
              borderRadius: 10,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 11, color: TH.red, fontWeight: 800, lineHeight: 1.5 }}>
              ⚠️ 有 {logoutWarn.n} 筆資料還沒同步到雲端（{logoutWarn.detail}），現在登出會遺失。建議先確認網路後重試，或仍要登出？
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={loading}
                onClick={() => void retryThenRecheck()}
                style={{
                  ...btnBase,
                  border: "none",
                  background: TH.accent,
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "同步中…" : "重試同步"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void finishSignOut()}
                style={{
                  ...btnBase,
                  border: `1px solid ${TH.red}66`,
                  background: "transparent",
                  color: TH.red,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                仍要登出
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setLogoutWarn(null);
                  setMsg("");
                }}
                style={{
                  ...btnBase,
                  border: `1px solid ${TH.border}`,
                  background: "transparent",
                  color: TH.muted,
                }}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => void signOut()}
            style={{
              ...btnBase,
              border: `1px solid ${TH.border}`,
              background: "transparent",
              color: TH.muted,
              alignSelf: "flex-start",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "檢查同步…" : "登出"}
          </button>
        )}
        {msg && (
          <div style={{ fontSize: 11, color: msg.startsWith("✅") ? TH.green : TH.red, lineHeight: 1.4 }}>
            {msg}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
        autoComplete="email"
        style={inputStyle}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密碼"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        style={inputStyle}
      />
      {msg && (
        <div
          style={{
            fontSize: 11,
            color: msg.startsWith("✅") ? TH.green : TH.red,
            textAlign: "center",
          }}
        >
          {msg}
        </div>
      )}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={loading || !email || !password}
        style={{
          padding: "10px",
          borderRadius: 10,
          border: "none",
          background: loading || !email || !password ? "#374151" : TH.accent,
          color: loading || !email || !password ? "#6B7280" : "#fff",
          fontSize: 12,
          fontWeight: 900,
          cursor: loading || !email || !password ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "處理中…" : mode === "signup" ? "註冊" : "登入"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "signin" ? "signup" : "signin"));
          setMsg("");
        }}
        style={{
          background: "none",
          border: "none",
          color: TH.muted,
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        {mode === "signin" ? "還沒有帳號？改用註冊" : "已有帳號？改用登入"}
      </button>
      <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4 }}>
        💡 測試階段免信箱驗證；正式上線前會開回驗證
      </div>
    </div>
  );
}
