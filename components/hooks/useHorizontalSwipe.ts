"use client";

import { useRef, type PointerEvent } from "react";

export type SwipeDir = "left" | "right";

const SWIPE_MIN_PX = 60;
const SWIPE_H_RATIO = 1.5;

/** 半開門檻：|dx| > 60 且 |dx| > |dy|×1.5 才算水平滑。 */
export function classifySwipe(dx: number, dy: number): SwipeDir | null {
  if (Math.abs(dx) <= SWIPE_MIN_PX) return null;
  if (Math.abs(dx) <= Math.abs(dy) * SWIPE_H_RATIO) return null;
  return dx < 0 ? "left" : "right";
}

function shouldIgnoreSwipe(target: EventTarget | null, root: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== root) {
    if (el instanceof HTMLElement && el.dataset.noSwipe === "1") return true;
    const ox = getComputedStyle(el).overflowX;
    if (ox === "auto" || ox === "scroll") return true;
    el = el.parentElement;
  }
  return false;
}

/** 水平滑動唯一實作。pointerdown 不 capture；move 達門檻才 setPointerCapture。 */
export function useHorizontalSwipe(onSwipe: (dir: SwipeDir) => void) {
  const swipeRef = useRef<{ x: number; y: number; id: number; ignore: boolean; captured: boolean } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const ignore = shouldIgnoreSwipe(e.target, e.currentTarget);
    swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, ignore, captured: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipeRef.current;
    if (!s || s.ignore || e.pointerId !== s.id || s.captured) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!classifySwipe(dx, dy)) return;
    s.captured = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 非信任／測試事件可能沒有 active pointer */
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s || s.ignore || !s.captured || e.pointerId !== s.id) return;
    const dir = classifySwipe(e.clientX - s.x, e.clientY - s.y);
    if (!dir) return;
    onSwipe(dir);
  };

  const onPointerCancel = () => {
    swipeRef.current = null;
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
