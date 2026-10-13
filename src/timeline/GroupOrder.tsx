import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from './GroupOrder.module.css';

type Accessibility = NonNullable<ComponentProps<typeof DndContext>['accessibility']>;

export type LaneGroup = { key: string; label: string; kinds: string[] };

export type GroupOrderProps = {
  groups: LaneGroup[];
  hidden: Set<string>;
  onReorder: (from: number, to: number) => void;
};

export default function GroupOrder({ groups, hidden, onReorder }: GroupOrderProps) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const keys = groups.map((group) => group.key);
  const name = (key: string | number): string => t(groups.find((group) => group.key === key)?.label ?? String(key));
  // What screen readers hear while dragging (dnd-kit's own are English-only).
  const accessibility: Accessibility = {
    screenReaderInstructions: { draggable: t('timeline.filter.dragInstructions') },
    announcements: {
      onDragStart: ({ active }) => t('timeline.filter.dragStart', { name: name(active.id) }),
      onDragOver: ({ active, over }) =>
        over
          ? t('timeline.filter.dragOver', { name: name(active.id), position: keys.indexOf(String(over.id)) + 1 })
          : undefined,
      onDragEnd: ({ active, over }) =>
        over
          ? t('timeline.filter.dragEnd', { name: name(active.id), position: keys.indexOf(String(over.id)) + 1 })
          : undefined,
      onDragCancel: ({ active }) => t('timeline.filter.dragCancel', { name: name(active.id) }),
    },
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over) onReorder(keys.indexOf(String(active.id)), keys.indexOf(String(over.id)));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={accessibility}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={keys} strategy={verticalListSortingStrategy}>
        <ol className={styles.list}>
          {groups.map((group) => (
            <OrderItem key={group.key} group={group} off={group.kinds.every((kind) => hidden.has(kind))} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function OrderItem({ group, off }: { group: LaneGroup; off: boolean }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: group.key,
  });
  const name = t(group.label);
  return (
    // Vaul would drag the whole sheet from a row, so the rows opt out.
    <li
      ref={setNodeRef}
      className={clsx(styles.item, off && styles.off, isDragging && styles.dragging)}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-vaul-no-drag=""
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className={styles.grip}
        aria-label={t('timeline.filter.dragHandle', { name })}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={20} aria-hidden="true" />
      </button>
      <span className={styles.dot} data-tone={`kind-${group.kinds[0]}`} aria-hidden="true" />
      <span className={styles.name}>{name}</span>
      {off && <span className={styles.hiddenNote}>{t('timeline.filter.hiddenGroup')}</span>}
    </li>
  );
}
