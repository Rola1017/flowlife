"use client";

import { type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type DragHandleProps = Record<string, unknown> & { style: CSSProperties };

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handle: DragHandleProps, isDragging: boolean) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const handle: DragHandleProps = {
    ...attributes,
    ...listeners,
    ref: setActivatorNodeRef,
    style: { cursor: "grab", touchAction: "none", userSelect: "none" },
  };
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.85 : 1,
        zIndex: isDragging ? 30 : undefined,
        position: "relative",
      }}
    >
      {children(handle, isDragging)}
    </div>
  );
}

/** 垂直可排序清單（單一來源）。onReorder 回傳原索引→目標索引，由呼叫端自行搬移資料。 */
export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  gap = 8,
}: {
  items: T[];
  getId: (item: T, index: number) => string;
  onReorder: (from: number, to: number) => void;
  renderItem: (item: T, index: number, handle: DragHandleProps, isDragging: boolean) => ReactNode;
  gap?: number;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map((it, i) => getId(it, i));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div style={{ display: "flex", flexDirection: "column", gap }}>
          {items.map((item, i) => (
            <SortableRow key={ids[i]} id={ids[i]}>
              {(handle, isDragging) => renderItem(item, i, handle, isDragging)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
