// The app's detail sheet. On phones it slides up from the bottom, with a down arrow on top: drag it down (or tap the
// arrow) to put it away. On desktop it's a centred, nearly square dialog that fades in and out (Sheet.module.css), with an ×
// and no dragging (vaul only drags by a handle with `handleOnly`, and there's none). Either way vaul's drawer (on Radix's dialog) does the rest: the drag (only once its
// content is scrolled to the top; a flick closes it, a short drag springs back), focus kept inside, Escape and a click
// outside close it, the page doesn't scroll behind it. Its heading must be a <SheetTitle> (the accessible name).
// Keep it rendered with `open` false while it closes, so it slides away (unmounted, it would just vanish);
// `onClosed()` once it has.

import type { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { ChevronDown, X, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { DESKTOP, useMediaQuery } from './useMediaQuery.ts';
import styles from './Sheet.module.css';

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  onClosed?: () => void;
  className?: string;
  children?: ReactNode;
};

export default function Sheet({ open, onClose, onClosed, className, children }: SheetProps) {
  const { t } = useTranslation();
  const desktop = useMediaQuery(DESKTOP);
  const Icon: LucideIcon = desktop ? X : ChevronDown;
  return (
    <Drawer.Root
      open={open}
      handleOnly={desktop}
      onOpenChange={(next) => !next && onClose()}
      onAnimationEnd={(isOpen) => !isOpen && onClosed?.()}
    >
      <Drawer.Portal>
        <Drawer.Overlay className={styles.sheetBackdrop} />
        {/* No description: the sheet's content says it all. */}
        <Drawer.Content className={clsx(styles.sheet, className)} aria-describedby={undefined}>
          {/* Phones: a down arrow across the top (tap it, or drag the sheet down); desktop: an × at the top right. */}
          <Drawer.Close className={styles.sheetClose} aria-label={t('common.close')}>
            <Icon size={desktop ? 20 : 24} aria-hidden="true" />
          </Drawer.Close>
          {/* The content scrolls in here, not the sheet itself: vaul turns off touch scrolling on the sheet (it drags
              it), and draws a strip below it that a scrolling sheet would let you scroll into. Dragging from in here
              moves the sheet only once this is scrolled to the top. */}
          <div className={styles.sheetBody}>{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export const SheetTitle = Drawer.Title;

// How long the sheet takes to slide in or out (vaul's own: 0.5 s): heavy work for its content waits that long, so the
// slide doesn't stutter.
export const SHEET_ANIMATION_MS = 500;
