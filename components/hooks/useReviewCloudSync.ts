"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { syncReviewsFromCloud } from "@/lib/reviews";

export function useReviewCloudSync() {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void syncReviewsFromCloud(); // 開啟即試同步
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void syncReviewsFromCloud();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
}
