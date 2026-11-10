import { Fragment, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCombobox, useMultipleSelection } from 'downshift';
import { matchSorter } from 'match-sorter';
import clsx from 'clsx';
import TypePill, { isStat } from '../ui/TypePill.tsx';
import { stepRow } from './gridStep.ts';
import { type Term, type TermType, termKey, textTerm } from './search.ts';
import styles from './TimelineSearch.module.css';

// The suggestions' groups, in this order (the text itself last); each its best matches first.
const GROUPS: TermType[] = ['character', 'type', 'pull', 'kind', 'name', 'item', 'race', 'text'];
const PER_GROUP = 8;

export type TimelineSearchProps = {
  terms: Term[];
  chips: Term[];
  onChange: (chips: Term[]) => void;
};

// Typing only suggests (the calendar changes when a chip is added): the calendar's terms in groups by type, and the
// text itself last, to match any field. Chips, picked and suggested alike, look like the filter's ticked chips.
export default function TimelineSearch({ terms, chips, onChange }: TimelineSearchProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const items = useMemo(() => {
    const query = input.trim();
    if (!query) return [];
    const taken = new Set(chips.map(termKey));
    const found = Map.groupBy(
      matchSorter(
        terms.filter((term) => !taken.has(termKey(term))),
        query,
        { keys: ['label', 'aliases'] }
      ),
      (term) => term.type
    );
    if (!taken.has(termKey(textTerm(query)))) found.set('text', [textTerm(query)]);
    return GROUPS.flatMap((type) => found.get(type)?.slice(0, PER_GROUP) ?? []);
  }, [input, terms, chips]);

  const { getSelectedItemProps, getDropdownProps, removeSelectedItem } = useMultipleSelection<Term>({
    selectedItems: chips,
    itemToKey: (item) => (item ? termKey(item) : ''),
    onSelectedItemsChange: ({ selectedItems }) => onChange(selectedItems),
  });
  // The suggestions' elements, to move between their rows as they wrap.
  const itemNodes = useRef<(HTMLElement | null)[]>([]);
  const { isOpen, getMenuProps, getInputProps, getItemProps, highlightedIndex, setHighlightedIndex } =
    useCombobox<Term>({
      items,
      itemToString: (item) => item?.label ?? '',
      itemToKey: (item) => (item ? termKey(item) : ''),
      inputValue: input,
      selectedItem: null,
      // Nothing is highlighted until ↓ (then ↑↓ move between rows, ←→ along them); after a pick, nothing again.
      stateReducer: (state, { changes, type }) => {
        switch (type) {
          case useCombobox.stateChangeTypes.InputKeyDownEnter:
          case useCombobox.stateChangeTypes.ItemClick:
            return { ...changes, isOpen: true, highlightedIndex: -1 };
          case useCombobox.stateChangeTypes.InputKeyDownArrowDown:
          case useCombobox.stateChangeTypes.InputKeyDownArrowUp: {
            const boxes = items.map(
              (_, i) => itemNodes.current[i]?.getBoundingClientRect() ?? { top: 0, left: 0, width: 0 }
            );
            const down = type === useCombobox.stateChangeTypes.InputKeyDownArrowDown;
            return { ...changes, highlightedIndex: stepRow(boxes, state.highlightedIndex, down ? 1 : -1) };
          }
          default:
            return changes;
        }
      },
      onStateChange: ({ type, selectedItem, inputValue }) => {
        switch (type) {
          case useCombobox.stateChangeTypes.InputChange:
            setInput(inputValue ?? '');
            break;
          case useCombobox.stateChangeTypes.InputKeyDownEnter:
          case useCombobox.stateChangeTypes.ItemClick:
            if (selectedItem) {
              onChange([...chips, selectedItem]);
              setInput('');
            }
            break;
        }
      },
    });
  const typeName = (term: Term) => t(`timeline.search.type.${term.type}`);
  // The chips' keys (Backspace removes the last, ← moves to them), called from our own handler (one beside the spread
  // would replace theirs); they wait only while suggestions show (the menu stays open after a pick, with nothing in it).
  const chipKeys = getDropdownProps({ preventKeyAction: isOpen && items.length > 0 });

  return (
    <div className={styles.search}>
      <div className={styles.field}>
        <Search className={styles.icon} size={16} aria-hidden="true" />
        {chips.map((chip, index) => (
          <button
            type="button"
            key={termKey(chip)}
            className={styles.chip}
            data-tone={chip.tone ?? ''}
            title={`${typeName(chip)}: ${chip.label}`}
            aria-label={t('timeline.search.remove', { name: chip.label })}
            {...getSelectedItemProps({ selectedItem: chip, index })}
            // Our own click, not passed through downshift: its click (focusing the chip) runs in the same batch as the
            // removal and wins, so the removal never reaches onSelectedItemsChange.
            onClick={(e) => {
              e.stopPropagation();
              removeSelectedItem(chip);
            }}
          >
            <span className={styles.chipIcon} aria-hidden="true">
              <X size={11} strokeWidth={3} />
            </span>
            <TermLabel term={chip} />
          </button>
        ))}
        <input
          className={styles.input}
          placeholder={chips.length ? undefined : t('timeline.search.placeholder')}
          {...getInputProps({
            ...chipKeys,
            'aria-label': t('timeline.search.label'),
            onKeyDown: (e) => {
              // ←→ along the suggestions' rows while one is highlighted (else they move in the text, ← to the chips).
              if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && highlightedIndex >= 0) {
                e.preventDefault();
                const next = highlightedIndex + (e.key === 'ArrowRight' ? 1 : -1);
                setHighlightedIndex(Math.min(items.length - 1, Math.max(0, next)));
                return;
              }
              chipKeys.onKeyDown?.(e);
            },
          })}
        />
        {chips.length > 0 && (
          <button
            type="button"
            className={styles.clear}
            onClick={() => onChange([])}
            aria-label={t('timeline.search.clear')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <ul className={styles.menu} {...getMenuProps()} hidden={!isOpen || !items.length}>
        {isOpen &&
          items.map((item, index) => (
            <Fragment key={termKey(item)}>
              {item.type !== items[index - 1]?.type && (
                <li className={styles.group} role="presentation">
                  {t(`timeline.search.group.${item.type}`)}
                </li>
              )}
              <li
                className={clsx(styles.chip, styles.option)}
                data-tone={item.tone ?? ''}
                data-highlighted={highlightedIndex === index || undefined}
                {...getItemProps({
                  item,
                  index,
                  ref: (node: HTMLLIElement | null) => {
                    itemNodes.current[index] = node;
                  },
                })}
              >
                <span className={styles.chipIcon} aria-hidden="true">
                  <Plus size={11} strokeWidth={3} />
                </span>
                {item.type === 'text' ? (
                  t('timeline.search.textOption', { text: item.label })
                ) : (
                  <TermLabel term={item} />
                )}
              </li>
            </Fragment>
          ))}
      </ul>
    </div>
  );
}

// A term's label; a card type's as the type pill (plain: the chip is already in its colour).
function TermLabel({ term }: { term: Term }) {
  return term.type === 'type' && isStat(term.value) ? <TypePill stat={term.value} plain /> : term.label;
}
