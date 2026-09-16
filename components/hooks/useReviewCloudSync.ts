"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { syncReviewsFromCloud } from "@/lib/reviews";
import { ensureAccountOwnership } from "@/lib/accountOwner";
import { useCloudSyncReady } from "@/components/auth/AccountGate";

export function useReviewCloudSync() {
  const ready = useCloudSyncReady();
  useEffect(() => {
    if (!ready) return;
    const supabase = createSupabaseBrowserClient();
    void syncReviewsFromCloud();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void ensureAccountOwnership().then(() => {
        void syncReviewsFromCloud();
      });
    });
    return () => sub.subscription.unsubscribe();
  }, [ready]);
}
