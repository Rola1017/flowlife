"use client";

import { useCallback, useRef } from "react";

export const ACTION_COOLDOWN_MS = 400;

/** now < until → 擋動作鈕。換日鍵不走這條。 */
export function actionBlocked(until: number, now: number): boolean {
  return now < until;
}

/** 換日後短暫忽略動作鈕點擊。唯一計時器實作。 */
export function useActionCooldown(ms = ACTION_COOLDOWN_MS) {
  const untilRef = useRef(0);

  const arm = useCallback(() => {
    untilRef.current = Date.now() + ms;
  }, [ms]);

  const wrap = useCallback(
    <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        if (actionBlocked(untilRef.current, Date.now())) return;
        fn(...args);
      },
    [],
  );

  return { arm, wrap };
}
