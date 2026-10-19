import * as Popover from '@radix-ui/react-popover';
import { Info } from 'lucide-react';
import { type PointerEvent, type ReactNode, useRef, useState } from 'react';
import clsx from 'clsx';
import styles from './InfoTip.module.css';

// Hover lets the pointer cross the gap from the icon to the text without it closing.
const CLOSE_DELAY_MS = 150;

// An (i) icon whose text opens on hover with a mouse, on tap or Enter otherwise. Not in a portal: inside a sheet (a
// modal dialog) a portalled popup couldn't be reached.
export default function InfoTip({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const mouse = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hover = (next: boolean) => (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(timer.current);
    if (next) setOpen(true);
    else timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={clsx(styles.trigger, className)}
        aria-label={label}
        onPointerDown={(e) => {
          mouse.current = e.pointerType === 'mouse';
        }}
        // A mouse opened it by hovering: its click mustn't close it again.
        onClick={(e) => mouse.current && e.preventDefault()}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
      >
        <Info size={16} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Content
        className={styles.content}
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={16}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        // Hover shouldn't pull focus away from where the reader is.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {children}
      </Popover.Content>
    </Popover.Root>
  );
}
