import { useRef } from 'react';

/**
 * A real tablist: `role="tablist"`, `aria-selected`, roving tabindex and
 * arrow-key navigation (Home/End too). Use this instead of a bare row of
 * buttons whenever the options are mutually exclusive views of the same data
 * (e.g. All / Students / Instructors).
 *
 * items: [{ key, label, badge }]
 * controls: the id of the element the tabs swap — set it so each tab points at
 * its panel with aria-controls, as the ARIA tabs pattern expects.
 */
export default function Tabs({ items, value, onChange, controls, 'aria-label': ariaLabel }) {
  const refs = useRef({});

  const focusAndSelect = (key) => {
    onChange(key);
    refs.current[key]?.focus();
  };

  const onKeyDown = (e, index) => {
    const last = items.length - 1;
    const goTo = {
      ArrowRight: () => (index === last ? 0 : index + 1),
      ArrowLeft: () => (index === 0 ? last : index - 1),
      Home: () => 0,
      End: () => last,
    }[e.key];
    if (!goTo) return;
    e.preventDefault();
    focusAndSelect(items[goTo()].key);
  };

  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item, index) => {
        const selected = item.key === value;
        return (
          <button
            key={item.key}
            ref={(el) => {
              refs.current[item.key] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${item.key}`}
            aria-selected={selected}
            aria-controls={controls}
            tabIndex={selected ? 0 : -1}
            className={`tab ${selected ? 'active' : ''}`}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {item.label}
            {item.badge != null && <span className="tab-badge">{item.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
