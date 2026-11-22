import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';

/**
 * The only dropdown in the dashboard — there is no native <select> left.
 *
 *   <Select label="Status" value={query.status} onChange={(v) => setQuery({ status: v })}
 *           options={['All', 'Active', 'Inactive']} />
 *
 * `options` take either a bare string or { value, label, dot, disabled }, where
 * `dot` ('green' | 'grey' | 'amber' | 'red') draws a status dot. `searchable`
 * adds a filter box, for long lists like Course or Department.
 *
 * Keyboard: ↑/↓ move, Home/End jump, Enter or Space select, Esc closes,
 * typing jumps to the first match. Outside click and selecting both close it.
 */
const toOption = (o) => (typeof o === 'string' ? { value: o, label: o } : o);

export default function Select({
  value,
  onChange,
  options = [],
  label,
  placeholder = 'Select…',
  disabled = false,
  searchable = false,
  className = '',
  id,
}) {
  const items = useMemo(() => options.map(toOption), [options]);
  const selectedIndex = items.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex < 0 ? 0 : selectedIndex);
  const [search, setSearch] = useState('');

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const typed = useRef({ text: '', at: 0 });

  const autoId = useId();
  const listId = (id ?? autoId) + '-listbox';

  const visible = useMemo(() => {
    if (!searchable || !search.trim()) return items;
    const needle = search.trim().toLowerCase();
    return items.filter((o) => String(o.label).toLowerCase().includes(needle));
  }, [items, search, searchable]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setSearch('');
    if (refocus) triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setActive(selectedIndex < 0 ? 0 : selectedIndex);
    setOpen(true);
  }, [disabled, selectedIndex]);

  const pick = useCallback(
    (option) => {
      if (!option || option.disabled) return;
      if (option.value !== value) onChange?.(option.value);
      close();
    },
    [close, onChange, value]
  );

  // Outside click closes without stealing the focus back.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  // Keep the highlighted option in view, and focus the filter box when there is one.
  useEffect(() => {
    if (!open) return;
    if (searchable) searchRef.current?.focus();
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active, searchable]);

  const move = (delta) => {
    const count = visible.length;
    if (count === 0) return;
    const from = visible.findIndex((_, i) => i === active);
    const start = from < 0 ? 0 : from;
    let next = start;
    for (let step = 0; step < count; step += 1) {
      next = (next + delta + count) % count;
      if (!visible[next].disabled) break;
    }
    setActive(next);
  };

  const onKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        return;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        return;
      case 'Home':
        e.preventDefault();
        setActive(0);
        return;
      case 'End':
        e.preventDefault();
        setActive(Math.max(0, visible.length - 1));
        return;
      case 'Enter':
        e.preventDefault();
        pick(visible[active]);
        return;
      case ' ':
        // Inside the filter box a space is just a space.
        if (searchable && e.target === searchRef.current) return;
        e.preventDefault();
        pick(visible[active]);
        return;
      case 'Tab':
        close(false);
        return;
      default:
        break;
    }

    // Type-ahead: letters typed within 700ms build one prefix.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (searchable) return;
      const now = Date.now();
      typed.current = {
        text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(),
        at: now,
      };
      const hit = visible.findIndex((o) => String(o.label).toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  };

  return (
    <div
      ref={rootRef}
      className={'select' + (open ? ' open' : '') + (disabled ? ' disabled' : '') + (className ? ' ' + className : '')}
      onKeyDown={onKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
      >
        <span className={'select-value' + (selected ? '' : ' placeholder')}>
          {selected?.dot && <span className={'select-dot dot-' + selected.dot} aria-hidden="true" />}
          {selected ? selected.label : placeholder}
        </span>
        <span className="select-chevron" aria-hidden="true">
          <Icon.ChevronDown />
        </span>
      </button>

      {open && (
        <div className="select-menu">
          {searchable && (
            <div className="select-search">
              <input
                ref={searchRef}
                className="input"
                type="text"
                value={search}
                placeholder="Search…"
                aria-label={(label ? label + ': ' : '') + 'filter options'}
                autoComplete="off"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActive(0);
                }}
              />
            </div>
          )}

          <ul ref={listRef} className="select-list no-scrollbar" role="listbox" id={listId} aria-label={label}>
            {visible.length === 0 && <li className="select-empty">No matches</li>}
            {visible.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <li
                  key={String(o.value)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  data-active={i === active || undefined}
                  className={
                    'select-option' +
                    (isSelected ? ' selected' : '') +
                    (i === active ? ' active' : '') +
                    (o.disabled ? ' disabled' : '')
                  }
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                >
                  {o.dot && <span className={'select-dot dot-' + o.dot} aria-hidden="true" />}
                  <span className="select-option-label">{o.label}</span>
                  {isSelected && (
                    <span className="select-check" aria-hidden="true">
                      <Icon.Check />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
