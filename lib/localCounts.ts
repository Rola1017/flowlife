import type { Session, Todo } from "@/lib/types";

export type LocalRecordCounts = {
  todos: number;
  todosPending: number;
  todosDone: number;
  sessions: number;
  trash: number;
};

/** 純本機筆數。未完成＝phase !== done；墓碑待辦不在 todos 清單內。 */
export function localRecordCounts(
  todos: Todo[],
  sessions: Session[],
  trash: unknown[],
): LocalRecordCounts {
  const list = Array.isArray(todos) ? todos : [];
  const sess = Array.isArray(sessions) ? sessions : [];
  const bin = Array.isArray(trash) ? trash : [];
  const todosDone = list.filter((t) => t.phase === "done").length;
  return {
    todos: list.length,
    todosPending: list.length - todosDone,
    todosDone,
    sessions: sess.length,
    trash: bin.length,
  };
}
