import { createBrowserClient } from "@supabase/ssr";

function makeBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

let _client: ReturnType<typeof makeBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  return (_client ??= makeBrowserClient());
}
