"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { syncSessionsFromCloud } from "@/lib/sessionsCloud";
import { ensureAccountOwnership } from "@/lib/accountOwner";
import { useCloudSyncReady } from "@/components/auth/AccountGate";

export function useSessionCloudSync() {
  const ready = useCloudSyncReady();
  useEffect(() => {
    if (!ready) return;
    const supabase = createSupabaseBrowserClient();
    void syncSessionsFromCloud();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void ensureAccountOwnership().then(() => {
        void syncSessionsFromCloud();
      });
    });
    return () => sub.subscription.unsubscribe();
  }, [ready]);
}
