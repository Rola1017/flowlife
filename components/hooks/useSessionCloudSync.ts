"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { syncSessionsFromCloud } from "@/lib/sessionsCloud";

export function useSessionCloudSync() {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void syncSessionsFromCloud(); // 開啟即試同步
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void syncSessionsFromCloud();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
}
