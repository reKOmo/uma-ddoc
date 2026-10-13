// The filter's Order tab: the calendar's lane groups as a list to drag into order by their handles (dnd-kit's pointer
// sensor: mouse and touch alike; the keyboard: Space to pick up, arrows, Space to drop). The handle has
// `touch-action: none`, so a phone never starts scrolling from it (a scroll would cancel the drag) and the rest of the
// row still scrolls the list; nothing in the list drags the sheet (`data-vaul-no-drag`).

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

// `groups`: { key, label, kinds } in order; `hidden`: the filter's Set (a group whose kinds are all hidden is greyed);
// `onReorder(from, to)`: indexes in `groups`.
export default function GroupOrder({ groups, hidden, onReorder }) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const keys = groups.map((group) => group.key);
  const name = (key) => t(groups.find((group) => group.key === key)?.label ?? key);
  // What screen readers hear while dragging (dnd-kit's own are English-only).
  const accessibility = {
    screenReaderInstructions: { draggable: t('timeline.filter.dragInstructions') },
    announcements: {
      onDragStart: ({ active }) => t('timeline.filter.dragStart', { name: name(active.id) }),
      onDragOver: ({ active, over }) =>
        over && t('timeline.filter.dragOver', { name: name(active.id), position: keys.indexOf(over.id) + 1 }),
      onDragEnd: ({ active, over }) =>
        over && t('timeline.filter.dragEnd', { name: name(active.id), position: keys.indexOf(over.id) + 1 }),
      onDragCancel: ({ active }) => t('timeline.filter.dragCancel', { name: name(active.id) }),
    },
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={accessibility}
      onDragEnd={({ active, over }) => over && onReorder(keys.indexOf(active.id), keys.indexOf(over.id))}
    >
      <SortableContext items={keys} strategy={verticalListSortingStrategy}>
        <ol className="order-list">
          {groups.map((group) => (
            <OrderItem key={group.key} group={group} off={group.kinds.every((kind) => hidden.has(kind))} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function OrderItem({ group, off }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: group.key,
  });
  const name = t(group.label);
  return (
    <li
      ref={setNodeRef}
      className={clsx('order-item', off && 'off', isDragging && 'dragging')}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-vaul-no-drag=""
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="order-grip"
        aria-label={t('timeline.filter.dragHandle', { name })}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={20} aria-hidden="true" />
      </button>
      <span className={clsx('order-dot', `kind-${group.kinds[0]}`)} aria-hidden="true" />
      <span className="order-name">{name}</span>
      {off && <span className="order-hidden">{t('timeline.filter.hiddenGroup')}</span>}
    </li>
  );
}
