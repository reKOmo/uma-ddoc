import { Fragment, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCombobox, useMultipleSelection } from 'downshift';
import { matchSorter } from 'match-sorter';
import clsx from 'clsx';
import { ToolbarButton } from '../ui/ToolbarButton.tsx';
import { type Term, type TermType, termKey, textTerm } from './search.ts';
import styles from './TimelineSearch.module.css';

// The suggestions' groups, in this order (the text itself last); each its best matches first.
const GROUPS: TermType[] = ['character', 'type', 'pull', 'kind', 'name', 'item', 'race', 'text'];
const PER_GROUP = 8;

export function SearchButton({ count, onClick, disabled }: { count: number; onClick: () => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <ToolbarButton
      icon={Search}
      label={t('timeline.search.button')}
      title={count ? t('timeline.search.chipCount', { count }) : undefined}
      onClick={onClick}
      disabled={disabled}
      pressed={count > 0}
      badge={count}
      iconOnly
    />
  );
}

export type TimelineSearchProps = {
  terms: Term[];
  chips: Term[];
  onChange: (chips: Term[]) => void;
  onClose: () => void;
};

// Typing only suggests (the calendar changes when a chip is added): the calendar's terms in groups by type, and the
// text itself last, to match any field. Chips, picked and suggested alike, look like the filter's ticked chips.
export default function TimelineSearch({ terms, chips, onChange, onClose }: TimelineSearchProps) {
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
  const { isOpen, getMenuProps, getInputProps, getItemProps, highlightedIndex } = useCombobox<Term>({
    items,
    itemToString: (item) => item?.label ?? '',
    itemToKey: (item) => (item ? termKey(item) : ''),
    inputValue: input,
    selectedItem: null,
    defaultHighlightedIndex: 0,
    stateReducer: (_state, { changes, type }) =>
      type === useCombobox.stateChangeTypes.InputKeyDownEnter || type === useCombobox.stateChangeTypes.ItemClick
        ? { ...changes, isOpen: true, highlightedIndex: 0 }
        : changes,
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
            {...getSelectedItemProps({
              selectedItem: chip,
              index,
              onClick: (e) => {
                e.stopPropagation();
                removeSelectedItem(chip);
              },
            })}
          >
            <span className={styles.chipIcon} aria-hidden="true">
              <X size={11} strokeWidth={3} />
            </span>
            {chip.label}
          </button>
        ))}
        <input
          className={styles.input}
          placeholder={chips.length ? undefined : t('timeline.search.placeholder')}
          // biome-ignore lint/a11y/noAutofocus: the field opens because it was asked for.
          autoFocus
          {...getInputProps({
            ...getDropdownProps({ preventKeyAction: isOpen }),
            'aria-label': t('timeline.search.label'),
            onKeyDown: (e) => {
              if (e.key === 'Escape' && !input) onClose();
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
      <button type="button" className={styles.done} onClick={onClose}>
        {t('timeline.search.close')}
      </button>
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
                {...getItemProps({ item, index })}
              >
                <span className={styles.chipIcon} aria-hidden="true">
                  <Plus size={11} strokeWidth={3} />
                </span>
                {item.type === 'text' ? t('timeline.search.textOption', { text: item.label }) : item.label}
              </li>
            </Fragment>
          ))}
      </ul>
    </div>
  );
}
