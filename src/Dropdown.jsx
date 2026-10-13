// The app's dropdown: a custom listbox instead of a <select>, so options can be styled everywhere
// (phones' native pickers ignore <option> styling) and look the same on every device. Every dropdown
// in the app uses it; ScenarioPicker.jsx is the scenario one.
//
// options: [{ value, label, icon?, pill?, group?, note?, badge?, italic?, disabled? }] — ungrouped options first,
// then each group (by its label, in order of first appearance) under a heading; `icon` an image's URL shown before
// the label (in the list and on the button); `pill` { color, ink: 'dark' | 'light' } sets the label as a pill in that
// colour (e.g. a scenario's), its text dark or light (the --ink-* tokens); `note` is a small
// hint on the right, `badge` a small accent pill there (e.g. "Current"), `italic` sets the label in
// italics (on the button too while it's selected), `disabled` shows the option greyed out and
// can't be chosen.
//
// WAI-ARIA "select-only combobox" pattern: a button opens a listbox that takes focus and tracks the
// active option with aria-activedescendant; ↑/↓, Home/End, Enter/Space, Esc, Tab, and typing a
// letter jumps to the next option starting with it. Disabled options are skipped.

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import './Dropdown.css';

export default function Dropdown({ label, value, options, onChange }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef(null);
  const list = useRef(null);
  const button = useRef(null);

  // Display order: ungrouped, then each group. `active` indexes this list.
  const groups = [...new Set(options.filter((o) => o.group).map((o) => o.group))];
  const ordered = [...options.filter((o) => !o.group), ...groups.flatMap((g) => options.filter((o) => o.group === g))];
  const selected = ordered.find((o) => o.value === value) ?? ordered[0];
  const optionId = (i) => `${id}-option-${i}`;

  // Close on a tap / click outside.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => root.current && !root.current.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // On opening, the list scrolls to the selected option, centred; after that it keeps the active one in view.
  // Only the list scrolls (scrollIntoView would move the page too).
  const justOpened = useRef(false);
  useEffect(() => {
    if (!open) return;
    const box = list.current;
    const item = document.getElementById(optionId(active));
    box?.focus({ preventScroll: true });
    if (!box || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (justOpened.current) {
      justOpened.current = false;
      box.scrollTop = top - (box.clientHeight - item.offsetHeight) / 2;
    } else if (top < box.scrollTop) {
      box.scrollTop = top;
    } else if (bottom > box.scrollTop + box.clientHeight) {
      box.scrollTop = bottom - box.clientHeight;
    }
  });

  function show() {
    setActive(Math.max(0, ordered.indexOf(selected)));
    justOpened.current = true;
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    button.current?.focus();
  }

  function choose(i) {
    if (ordered[i]?.disabled) return;
    onChange(ordered[i].value);
    hide();
  }

  // The nearest enabled option from `from` going `step` (±1), or `from` if there's none.
  const enabled = (i) => i >= 0 && i < ordered.length && !ordered[i].disabled;
  function seek(from, step) {
    for (let i = from + step; i >= 0 && i < ordered.length; i += step) if (enabled(i)) return i;
    return from;
  }

  function onButtonKeyDown(e) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      show();
    }
  }

  function onListKeyDown(e) {
    const actions = {
      ArrowDown: () => setActive((i) => seek(i, 1)),
      ArrowUp: () => setActive((i) => seek(i, -1)),
      Home: () => setActive((i) => (enabled(0) ? 0 : seek(0, 1) || i)),
      End: () =>
        setActive((i) => (enabled(ordered.length - 1) ? ordered.length - 1 : seek(ordered.length - 1, -1) || i)),
      Enter: () => choose(active),
      ' ': () => choose(active),
      Escape: hide,
    };
    if (e.key === 'Tab') {
      setOpen(false);
    } else if (actions[e.key]) {
      e.preventDefault();
      actions[e.key]();
    } else if (e.key.length === 1) {
      // Type-ahead: the next option starting with that letter (wrapping round).
      const letter = e.key.toLowerCase();
      const starts = (o) => !o.disabled && String(o.label).toLowerCase().startsWith(letter);
      const next = ordered.findIndex((o, i) => i > active && starts(o));
      const first = ordered.findIndex(starts);
      if (next >= 0 || first >= 0) setActive(next >= 0 ? next : first);
    }
  }

  const option = (o) => {
    const i = ordered.indexOf(o);
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: options aren't focusable in the aria-activedescendant pattern; the listbox has focus and handles the keyboard.
      <div
        key={o.value}
        id={optionId(i)}
        role="option"
        aria-selected={o.value === value}
        aria-disabled={o.disabled || undefined}
        className={`dropdown-option${i === active ? ' active' : ''}${o.italic ? ' italic' : ''}${o.disabled ? ' disabled' : ''}`}
        onClick={() => choose(i)}
        onPointerMove={() => !o.disabled && setActive(i)}
      >
        <Check className="dropdown-check" size={16} aria-hidden="true" />
        {o.icon && <img className="dropdown-icon" src={o.icon} alt="" />}
        <Label option={o} />
        {o.badge && <span className="dropdown-badge">{o.badge}</span>}
        {o.note && <span className="dropdown-note">{o.note}</span>}
      </div>
    );
  };

  return (
    <div className="dropdown" ref={root}>
      <span id={`${id}-label`}>{label}</span>
      <button
        ref={button}
        id={`${id}-button`}
        type="button"
        className={`dropdown-button${selected?.italic ? ' italic' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-button`}
        title={selected?.note}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onButtonKeyDown}
      >
        {selected?.icon && <img className="dropdown-icon" src={selected.icon} alt="" />}
        <Label option={selected} />
        <ChevronDown className="dropdown-chevron" size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={list}
          className="dropdown-list"
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKeyDown}
        >
          {ordered.filter((o) => !o.group).map(option)}
          {groups.map((group, g) => (
            // biome-ignore lint/a11y/useSemanticElements: a listbox groups options with role="group"; a <fieldset> isn't allowed in one.
            <div key={group} role="group" aria-labelledby={`${id}-group-${g}`}>
              <div id={`${id}-group-${g}`} className="dropdown-group">
                {group}
              </div>
              {ordered.filter((o) => o.group === group).map(option)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// An option's label: plain, or a pill in its colour.
function Label({ option }) {
  if (!option?.pill) return <span className="dropdown-label">{option?.label}</span>;
  return (
    <span className="dropdown-label">
      <span className={`dropdown-pill ink-${option.pill.ink ?? 'none'}`} style={{ '--pill-color': option.pill.color }}>
        {option.label}
      </span>
    </span>
  );
}
