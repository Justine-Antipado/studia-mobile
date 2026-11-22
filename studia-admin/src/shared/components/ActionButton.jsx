import { Link } from 'react-router-dom';
import { Icon } from './Icon';

/**
 * The one control used in a table's Actions column: a compact 34px icon button
 * with a hover/focus tooltip instead of a visible label, so every row's actions
 * line up on the same grid.
 *
 *   <ActionRow>
 *     <ActionButton icon="Eye" label="View" tone="primary" to={…} />
 *     <ActionButton icon="Download" label="Export" onClick={…} />
 *     <ActionButton icon="Trash" label="Delete" tone="danger" onClick={…} />
 *   </ActionRow>
 *
 * `to` renders a router Link, `onClick` a button; the tones are `neutral`
 * (default), `primary` and `danger`.
 */
export function ActionButton({ icon, label, tone = 'neutral', to, onClick, disabled = false }) {
  const IconCmp = Icon[icon] ?? Icon.Info;
  const className = `action-btn action-btn-${tone}`;
  const body = (
    <>
      <span className="action-btn-icon" aria-hidden="true">
        <IconCmp />
      </span>
      <span className="action-tip" aria-hidden="true">
        {label}
      </span>
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={className} aria-label={label}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" className={className} aria-label={label} disabled={disabled} onClick={onClick}>
      {body}
    </button>
  );
}

/** The flex row the buttons sit in: right-aligned, evenly spaced, vertically centred. */
export function ActionRow({ children }) {
  return <div className="action-row">{children}</div>;
}
