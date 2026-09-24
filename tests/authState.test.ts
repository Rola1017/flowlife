import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalSession, getVerifiedUid } from "@/lib/authState";

const hoisted = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getSession: hoisted.getSession,
      getUser: hoisted.getUser,
    },
  }),
}));

const USER = { id: "uid-local", email: "a@b.c" };

beforeEach(() => {
  hoisted.getSession.mockReset();
  hoisted.getUser.mockReset();
});

describe("getLocalSession／getVerifiedUid", () => {
  it("離線（getUser 失敗）但本機有 session → 判定為已登入", async () => {
    hoisted.getSession.mockResolvedValue({ data: { session: { user: USER } }, error: null });
    hoisted.getUser.mockRejectedValue(new Error("network"));
    const s = await getLocalSession();
    expect(s.uid).toBe("uid-local");
    expect(s.email).toBe("a@b.c");
  });

  it("無 session → 未登入", async () => {
    hoisted.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const s = await getLocalSession();
    expect(s.uid).toBeNull();
    expect(s.email).toBeNull();
  });

  it("getVerifiedUid 失敗不得改變本機登入狀態", async () => {
    hoisted.getSession.mockResolvedValue({ data: { session: { user: USER } }, error: null });
    hoisted.getUser.mockResolvedValue({ data: { user: null }, error: { message: "offline" } });
    const before = await getLocalSession();
    const verified = await getVerifiedUid();
    const after = await getLocalSession();
    expect(verified).toBeNull();
    expect(before).toEqual(after);
    expect(after.uid).toBe("uid-local");
  });
});
