"use client";

import { useEffect, useState } from "react";
import { getLocalSession, isOnline, signOut as signOutAuth, subscribeAuth, subscribeOnline } from "@/lib/authState";
import { SYNC_TARGET_LABELS, syncNow, type SyncReport } from "@/lib/cloudSync";
import { clearAllAppData, clearOwnerUserId, loadOwnerUserId, saveOwnerUserId } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TH } from "@/lib/theme";

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

function unsyncedDetail(report: SyncReport): string {
  const parts: string[] = [];
  if (report.offline) parts.push("目前離線");
  if (report.timedOut) parts.push("逾時（未完成≠失敗，可重試）");
  for (const t of report.targets) {
    if (t.pending <= 0 && t.failed <= 0) continue;
    const label = SYNC_TARGET_LABELS[t.name] ?? t.name;
    const bits: string[] = [];
    if (t.pending > 0) bits.push(`待處理 ${t.pending}`);
    if (t.failed > 0) bits.push(`失敗 ${t.failed}`);
    parts.push(`${label} ${bits.join("／")}`);
  }
  return parts.join("、") || "尚有資料未同步完成";
}

export function AuthPanel() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [online, setOnline] = useState(isOnline);
  const [logoutWarn, setLogoutWarn] = useState<SyncReport | null>(null);
  const [offlineLogout, setOfflineLogout] = useState(false);
  const [globalConfirm, setGlobalConfirm] = useState(false);

  useEffect(() => {
    void getLocalSession().then((s) => setUserEmail(s.email));
    const unsubAuth = subscribeAuth((s) => setUserEmail(s.email));
    const unsubOnline = subscribeOnline(setOnline);
    return () => {
      unsubAuth();
      unsubOnline();
    };
  }, []);

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
    const uid = data.user?.id ?? (await getLocalSession()).uid;
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

  const performSignOut = async (scope: "local" | "global") => {
    setLoading(true);
    await signOutAuth(scope);
    clearAllAppData();
    clearOwnerUserId();
    window.location.reload();
  };

  const runSync = () =>
    syncNow({
      onProgress: (m) => setMsg(m),
    });

  const beginLocalSignOut = async () => {
    if (!isOnline()) {
      setLogoutWarn(null);
      setGlobalConfirm(false);
      setOfflineLogout(true);
      return;
    }
    setLoading(true);
    setMsg("同步中…");
    setLogoutWarn(null);
    setOfflineLogout(false);
    const report = await runSync();
    if (report.allClear) {
      setLoading(false);
      setMsg("");
      if (!window.confirm("登出會清除這台裝置上的本機資料（雲端資料保留）。確定登出？")) return;
      await performSignOut("local");
      return;
    }
    setLoading(false);
    setMsg("");
    setLogoutWarn(report);
  };

  const beginGlobalSignOut = async () => {
    if (!isOnline()) return;
    setLoading(true);
    setMsg("同步中…");
    setLogoutWarn(null);
    setOfflineLogout(false);
    const report = await runSync();
    setLoading(false);
    setMsg("");
    if (!report.allClear) {
      setLogoutWarn(report);
      return;
    }
    setGlobalConfirm(true);
  };

  const retryThenRecheck = async () => {
    setLoading(true);
    setMsg("同步中…");
    const report = await runSync();
    if (!report.allClear) {
      setLoading(false);
      setLogoutWarn(report);
      setMsg("⚠️ 尚有資料未同步完成，仍要登出嗎？");
      return;
    }
    setLoading(false);
    setLogoutWarn(null);
    setMsg("✅ 已同步到雲端，可以登出");
  };

  if (userEmail) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, color: TH.text }}>
          已登入：<span style={{ fontWeight: 800 }}>{userEmail}</span>
        </div>
        {offlineLogout ? (
          <div
            style={{
              border: `1px solid ${TH.yellow}66`,
              background: TH.yellow + "14",
              borderRadius: 10,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 11, color: TH.yellow, fontWeight: 800, lineHeight: 1.5 }}>
              離線登出會清除本機資料且無法先上傳，可能遺失尚未同步的資料
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={loading}
                onClick={() => setOfflineLogout(false)}
                style={{
                  ...btnBase,
                  border: `1px solid ${TH.border}`,
                  background: TH.accent,
                  color: "#fff",
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void performSignOut("local")}
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
            </div>
          </div>
        ) : globalConfirm ? (
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
              這會讓所有裝置都退出登入。確定？
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={loading}
                onClick={() => setGlobalConfirm(false)}
                style={{
                  ...btnBase,
                  border: `1px solid ${TH.border}`,
                  background: TH.accent,
                  color: "#fff",
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void performSignOut("global")}
                style={{
                  ...btnBase,
                  border: "none",
                  background: TH.red,
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                確認登出所有裝置
              </button>
            </div>
          </div>
        ) : logoutWarn ? (
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
              ⚠️ 尚有資料未同步完成，仍要登出嗎？
            </div>
            <div style={{ fontSize: 10, color: TH.muted, lineHeight: 1.5 }}>
              {unsyncedDetail(logoutWarn)}
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
                {loading ? (msg.startsWith("同步中") ? msg : "同步中…") : "重試同步"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void performSignOut("local")}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <button
              type="button"
              disabled={loading}
              onClick={() => void beginLocalSignOut()}
              style={{
                ...btnBase,
                border: `1px solid ${TH.border}`,
                background: "transparent",
                color: TH.muted,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (msg.startsWith("同步中") ? msg : "同步中…") : "登出"}
            </button>
            <button
              type="button"
              disabled={loading || !online}
              onClick={() => void beginGlobalSignOut()}
              style={{
                ...btnBase,
                border: `1px solid ${TH.red}44`,
                background: "transparent",
                color: online ? TH.red : TH.muted,
                cursor: loading || !online ? "not-allowed" : "pointer",
              }}
            >
              登出所有裝置
            </button>
          </div>
        )}
        {msg && !loading && (
          <div style={{ fontSize: 11, color: msg.startsWith("✅") ? TH.green : TH.red, lineHeight: 1.4 }}>
            {msg}
          </div>
        )}
        <div style={{ fontSize: 9, color: TH.muted, lineHeight: 1.4 }}>
          💡 登出只退出這台，其他裝置維持登入。登出所有裝置會讓每台都退出（需連網）。
        </div>
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
