// Keep it rendered with `open` false while it closes, or it vanishes instead of sliding away (`onClosed()` once it has).
// Its heading must be a <SheetTitle> (the accessible name).

import { type ReactNode, useEffect, useEffectEvent, useRef } from 'react';
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

type SheetState = { sheet?: unknown; below?: unknown } | null;
const historyState = (): SheetState => window.history.state as SheetState;

// The browser's back button (Android's above all) closes the open sheet instead of leaving the page: opening it marks
// the current entry and pushes one with the same address (no `hashchange`, so the router never notices; the Timeline
// then replaces its address, keeping the state). Only a `popstate` back onto the marked entry closes it: a link in the
// sheet fires one too, onto a new entry. Closing it any other way pops the pushed entry again, unless something has
// been navigated to since (then the entry on top is no longer ours). That pop waits a tick: a sheet that opens again
// at once (StrictMode's second run of a sheet mounted open) takes its entry over instead.
function useBackCloses(open: boolean, onClose: () => void) {
  const close = useEffectEvent(onClose);
  const leaving = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!open) return;
    let id = historyState()?.sheet;
    if (leaving.current !== undefined && typeof id === 'string') clearTimeout(leaving.current);
    else {
      id = crypto.randomUUID();
      window.history.replaceState({ ...window.history.state, below: id }, '');
      window.history.pushState({ ...window.history.state, below: undefined, sheet: id }, '');
    }
    leaving.current = undefined;
    let popped = false;
    const onPop = () => {
      if (historyState()?.below !== id) return;
      popped = true;
      close();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (popped) return;
      leaving.current = setTimeout(() => {
        leaving.current = undefined;
        if (historyState()?.sheet === id) window.history.back();
      });
    };
  }, [open]);
}

export default function Sheet({ open, onClose, onClosed, className, children }: SheetProps) {
  useBackCloses(open, onClose);
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
