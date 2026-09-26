import { describe, expect, it } from "vitest";
import { ACTION_COOLDOWN_MS, actionBlocked } from "@/components/hooks/useActionCooldown";

/** 防日詳情換日 ghost tap：只擋 400ms、只擋動作鈕。 */
describe("actionBlocked 誤觸防護", () => {
  it("ACTION_COOLDOWN_MS＝400", () => {
    expect(ACTION_COOLDOWN_MS).toBe(400);
  });

  it("until 之前擋、剛好到點與之後放行", () => {
    const until = 1000;
    expect(actionBlocked(until, until - 1)).toBe(true);
    expect(actionBlocked(until, until)).toBe(false);
    expect(actionBlocked(until, until + ACTION_COOLDOWN_MS)).toBe(false);
  });

  it("換日當下 arm 後 400ms 內擋、400ms 後恢復", () => {
    const armedAt = 5000;
    const until = armedAt + ACTION_COOLDOWN_MS;
    expect(actionBlocked(until, armedAt)).toBe(true);
    expect(actionBlocked(until, armedAt + 399)).toBe(true);
    expect(actionBlocked(until, armedAt + 400)).toBe(false);
  });
});
