// The app's search box: a magnifier inside on the left, a clear button (×) on the right once there's text. The tier
// list's search uses it. onChange gets the new text; clearing gives "".
//
// <SearchInput value={query} onChange={setQuery} placeholder="Search" label="Search cards" clearLabel="Clear search" />

import { Search, X } from 'lucide-react';
import styles from './SearchInput.module.css';

export type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  clearLabel: string;
};

export function SearchInput({ value, onChange, placeholder, label, clearLabel }: SearchInputProps) {
  return (
    <div className={styles.search}>
      <Search className={styles.icon} size={16} aria-hidden="true" />
      <input
        type="search"
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {value && (
        <button type="button" className={styles.clear} onClick={() => onChange('')} aria-label={clearLabel}>
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
