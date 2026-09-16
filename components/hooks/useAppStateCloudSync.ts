"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { syncAppStateFromCloud } from "@/lib/appStateCloud";
import { ensureAccountOwnership } from "@/lib/accountOwner";
import { useCloudSyncReady } from "@/components/auth/AccountGate";

export function useAppStateCloudSync() {
  const ready = useCloudSyncReady();
  useEffect(() => {
    if (!ready) return;
    const supabase = createSupabaseBrowserClient();
    void syncAppStateFromCloud();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void ensureAccountOwnership().then(() => {
        void syncAppStateFromCloud();
      });
    });
    return () => sub.subscription.unsubscribe();
  }, [ready]);
}
