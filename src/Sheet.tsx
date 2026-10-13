// Keep it rendered with `open` false while it closes, or it vanishes instead of sliding away (`onClosed()` once it has).
// Its heading must be a <SheetTitle> (the accessible name).

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
