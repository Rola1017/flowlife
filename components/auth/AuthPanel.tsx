"use client";

import { useEffect, useState } from "react";
import { TH } from "@/lib/theme";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

export function AuthPanel() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
    const { error } = await fn;
    setLoading(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("✅ 已登入");
    setPassword("");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
    setMsg("");
  };

  if (userEmail) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12, color: TH.text }}>
          已登入：<span style={{ fontWeight: 800 }}>{userEmail}</span>
        </div>
        <button
          type="button"
          onClick={signOut}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: `1px solid ${TH.border}`,
            background: "transparent",
            color: TH.muted,
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          登出
        </button>
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
        onClick={submit}
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
