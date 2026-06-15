import type { Session } from "@/lib/types";

/** 覆盤寫入單一來源：依 id 更新 reflection（空白→undefined） */
export function patchReflection(sessions: Session[], id: number, text: string): Session[] {
  const trimmed = text.trim();
  return sessions.map((s) => (s.id === id ? { ...s, reflection: trimmed || undefined } : s));
}
