"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { TH } from "@/lib/theme";
import { ensureAccountOwnership } from "@/lib/accountOwner";
import { runG1MigrateIfNeeded } from "@/lib/cloudMigrateG1";

const CloudSyncReadyContext = createContext(false);

export function useCloudSyncReady(): boolean {
  return useContext(CloudSyncReadyContext);
}

/** 歸屬檢查完成前不掛載 App（含三個 sync hook），避免清之前就把 A 的資料推上 B。 */
export function AccountGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ensureAccountOwnership()
      .then(() => runG1MigrateIfNeeded().catch((err) => {
        console.error("[FlowLife] G1 搬家失敗", err);
      }))
      .then(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          background: TH.bg,
          color: TH.muted,
          fontFamily: "-apple-system,'Noto Sans TC',sans-serif",
          maxWidth: 430,
          margin: "0 auto",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        載入中…
      </div>
    );
  }

  return <CloudSyncReadyContext.Provider value={true}>{children}</CloudSyncReadyContext.Provider>;
}
