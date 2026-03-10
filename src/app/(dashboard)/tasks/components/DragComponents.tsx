'use client';

import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Droppable Column Wrapper (fix cross-column DnD) ──
export function DroppableColumn({ id, children }: { id: string; children: React.ReactNode; isOver?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `droppable-${id}` });
  return (
    <div ref={setNodeRef} className="min-h-[40px] rounded-lg transition-colors" style={{ background: isOver ? 'var(--bg-card)' : undefined }}>
      {children}
    </div>
  );
}

// ── Sortable Column Wrapper (drag entire columns) ──
export function SortableColumnWrapper({ id, render, canDrag }: { id: string; render: (listeners: Record<string, unknown>) => React.ReactNode; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `col-${id}`, disabled: !canDrag,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="md:w-[280px] md:min-w-[280px] flex-shrink-0">
      {render(listeners ?? {})}
    </div>
  );
}
