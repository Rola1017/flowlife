import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** 登入狀態唯一來源。UI 用本機 session，不得用 getUser 當「有沒有登入」。 */

export type LocalSession = {
  uid: string | null;
  email: string | null;
};

export type SignOutScope = "local" | "global";

const EMPTY: LocalSession = { uid: null, email: null };

function fromUser(user: { id?: string; email?: string } | null | undefined): LocalSession {
  return { uid: user?.id ?? null, email: user?.email ?? null };
}

/** 讀本機儲存的 session，不向伺服器驗證。 */
export async function getLocalSession(): Promise<LocalSession> {
  try {
    const { data } = await createSupabaseBrowserClient().auth.getSession();
    return fromUser(data.session?.user);
  } catch {
    return EMPTY;
  }
}

export function subscribeAuth(cb: (session: LocalSession) => void): () => void {
  const { data: sub } = createSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
    cb(fromUser(session?.user));
  });
  return () => sub.subscription.unsubscribe();
}

/** 僅在需要伺服器驗證時使用。失敗不得被拿來改本機登入判定。 */
export async function getVerifiedUid(): Promise<string | null> {
  try {
    const { data, error } = await createSupabaseBrowserClient().auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function subscribeOnline(cb: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const on = () => cb(true);
  const off = () => cb(false);
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  return () => {
    window.removeEventListener("online", on);
    window.removeEventListener("offline", off);
  };
}

export async function signOut(scope: SignOutScope): Promise<void> {
  await createSupabaseBrowserClient().auth.signOut({ scope: scope });
}
