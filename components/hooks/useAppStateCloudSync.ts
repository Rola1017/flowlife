"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { syncAppStateFromCloud } from "@/lib/appStateCloud";

export function useAppStateCloudSync() {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void syncAppStateFromCloud(); // 開啟即試同步
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void syncAppStateFromCloud();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
}
