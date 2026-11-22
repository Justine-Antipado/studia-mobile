import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import Select from './Select';

/**
 * The only date control in the dashboard — a calendar popover styled like the
 * custom <Select>, so no native browser picker appears anywhere.
 *
 *   <DateField label="Start date" value={form.startDate} onChange={(v) => …} />
 *   <DateField label="Publish at" value={form.publishAt} withTime onChange={…} />
 *
 * `value` is an ISO `YYYY-MM-DD` string, or `YYYY-MM-DDTHH:mm` with `withTime`,
 * which is exactly what the native date and datetime-local inputs produced, so
 * callers and the mock backend are unchanged.
 *
 * Keyboard: ←/→ a day, ↑/↓ a week, PageUp/PageDown a month, Home/End the ends
 * of the week, Enter picks, Esc closes.
 */
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n) => String(n).padStart(2, '0');
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parse 'YYYY-MM-DD' as a local date — never `new Date(string)`, which is UTC. */
const parseIso = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

const splitValue = (value, withTime) => {
  const [date = '', time = ''] = String(value ?? '').split('T');
  return { date, time: withTime ? time.slice(0, 5) : '' };
};

/** Half-hour slots, so the time half matches the Select menu rather than a native spinner. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 ? '30' : '00';
  const value = `${pad(hour)}:${minute}`;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return { value, label: `${h12}:${minute} ${hour < 12 ? 'AM' : 'PM'}` };
});

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
/** Monday-first offset of the 1st of this month. */
const leadingBlanks = (first) => (first.getDay() + 6) % 7;

export default function DateField({
  value,
  onChange,
  label,
  placeholder = 'Pick a date',
  withTime = false,
  disabled = false,
  /** Earliest selectable day, as 'YYYY-MM-DD'. */
  min,
  id,
}) {
  const { date, time } = splitValue(value, withTime);
  const selected = parseIso(date);

  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => selected ?? new Date());
  const [month, setMonth] = useState(() => (selected ? addMonths(selected, 0) : addMonths(new Date(), 0)));

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const gridRef = useRef(null);
  const autoId = useId();
  const panelId = (id ?? autoId) + '-calendar';
  // Read once per mount: a date that changes mid-render would be impure.
  const [today] = useState(() => toIso(new Date()));

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  // Focus follows the cursor, so the arrow keys read out as a moving selection.
  useEffect(() => {
    if (open) gridRef.current?.querySelector('[data-cursor="true"]')?.focus();
  }, [open, cursor]);

  const days = useMemo(() => {
    const first = addMonths(month, 0);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: leadingBlanks(first) }, () => null),
      ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ];
  }, [month]);

  const emit = (nextDate, nextTime = time) => {
    if (!onChange) return;
    onChange(withTime ? `${nextDate}T${nextTime || '09:00'}` : nextDate);
  };

  const isBlocked = (d) => !!min && toIso(d) < min;

  const pick = (d) => {
    if (isBlocked(d)) return;
    emit(toIso(d));
    setCursor(d);
    close();
  };

  const moveCursor = (next) => {
    setCursor(next);
    if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) {
      setMonth(addMonths(next, 0));
    }
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    const step = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, -1),
      PageDown: () => addMonths(cursor, 1),
      Home: () => addDays(cursor, -((cursor.getDay() + 6) % 7)),
      End: () => addDays(cursor, 6 - ((cursor.getDay() + 6) % 7)),
    }[e.key];

    if (step) {
      e.preventDefault();
      moveCursor(step());
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      pick(cursor);
    }
  };

  const shown = selected
    ? selected.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';
  const shownTime = withTime && time ? TIME_OPTIONS.find((t) => t.value === time)?.label ?? time : '';

  return (
    <div className={'datefield' + (withTime ? ' with-time' : '')}>
      <div ref={rootRef} className={'select datefield-date' + (open ? ' open' : '')} onKeyDown={onKeyDown}>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          className="select-trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={label}
          disabled={disabled}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <span className="select-icon" aria-hidden="true">
            <Icon.Calendar />
          </span>
          <span className={'select-value' + (shown ? '' : ' placeholder')}>{shown || placeholder}</span>
          <span className="select-chevron" aria-hidden="true">
            <Icon.ChevronDown />
          </span>
        </button>

        {open && (
          <div className="select-menu calendar" id={panelId} role="dialog" aria-label={label ?? 'Choose a date'}>
            <div className="calendar-head">
              <button
                type="button"
                className="calendar-nav"
                aria-label="Previous month"
                onClick={() => setMonth(addMonths(month, -1))}
              >
                <Icon.ChevronLeft />
              </button>
              <strong aria-live="polite">
                {MONTHS[month.getMonth()]} {month.getFullYear()}
              </strong>
              <button
                type="button"
                className="calendar-nav"
                aria-label="Next month"
                onClick={() => setMonth(addMonths(month, 1))}
              >
                <Icon.Chevron />
              </button>
            </div>

            <div className="calendar-weekdays" aria-hidden="true">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div className="calendar-grid" ref={gridRef} role="grid">
              {days.map((d, i) =>
                d === null ? (
                  // eslint-disable-next-line react/no-array-index-key
                  <span key={`blank-${i}`} className="calendar-blank" />
                ) : (
                  <button
                    key={toIso(d)}
                    type="button"
                    role="gridcell"
                    className={
                      'calendar-day' +
                      (toIso(d) === date ? ' selected' : '') +
                      (toIso(d) === today ? ' today' : '')
                    }
                    disabled={isBlocked(d)}
                    data-cursor={toIso(d) === toIso(cursor) || undefined}
                    tabIndex={toIso(d) === toIso(cursor) ? 0 : -1}
                    aria-selected={toIso(d) === date}
                    onClick={() => pick(d)}
                  >
                    {d.getDate()}
                  </button>
                )
              )}
            </div>

            <div className="calendar-foot">
              <button
                type="button"
                className="link-btn"
                disabled={!!min && today < min}
                onClick={() => pick(new Date())}
              >
                Today
              </button>
              {date && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    onChange?.('');
                    close();
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {withTime && (
        <Select
          label={(label ? label + ' — ' : '') + 'time'}
          value={time || '09:00'}
          options={TIME_OPTIONS}
          placeholder={shownTime || 'Time'}
          disabled={disabled || !date}
          onChange={(t) => emit(date || toIso(new Date()), t)}
        />
      )}
    </div>
  );
}
