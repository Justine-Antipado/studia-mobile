import { useEffect, useId, useRef } from 'react';
import { initials } from '../../core/logic/format';

export function Avatar({ name, size = 36 }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {initials(name)}
    </div>
  );
}

/** Status / role words -> badge tone. Unknown words fall back to lavender. */
const STATUS_CLASS = {
  Active: 'badge-green',
  Inactive: 'badge-grey',
  Archived: 'badge-grey',
  Published: 'badge-green',
  Scheduled: 'badge-blue',
  Draft: 'badge-grey',
  Ready: 'badge-green',
  Processing: 'badge-blue',
  Failed: 'badge-red',
  Online: 'badge-green',
  Operational: 'badge-green',
  Degraded: 'badge-orange',
  Down: 'badge-red',
  Critical: 'badge-red',
  High: 'badge-orange',
  Medium: 'badge-blue',
  Low: 'badge-grey',
  Student: 'badge-lav',
  Instructor: 'badge-lav',
  Admin: 'badge-lav',
  'Up to date': 'badge-green',
};

export function Badge({ children, tone }) {
  const cls = tone ? `badge-${tone}` : STATUS_CLASS[children] || 'badge-lav';
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function Toggle({ checked, onChange, label, disabled = false, id }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      disabled={disabled}
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function Card({ id, title, subtitle, action, children, className = '', as: Tag = 'section', ...rest }) {
  // Extra props are how a page gives a card its ARIA role (role="tabpanel")
  // without adding a wrapper element around it.
  return (
    <Tag id={id} className={`card ${className}`} {...rest}>
      {(title || action) && (
        <header className="card-head">
          {title && (
            <div className="card-head-text">
              <h3>{title}</h3>
              {subtitle && <p className="muted small">{subtitle}</p>}
            </div>
          )}
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one dialog. On top of role/aria-modal/aria-labelledby it does the three
 * things keyboard and screen-reader users need and that are easy to forget:
 * move focus into the dialog when it opens, keep Tab inside it while it is up,
 * and hand focus back to whatever opened it when it closes.
 */
export function Modal({ title, description, children, onClose, actions, labelledBy = 'modal-title', wide = false }) {
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const descId = useId();

  useEffect(() => {
    openerRef.current = document.activeElement;
    const dialog = dialogRef.current;
    // A dialog can nominate its own landing spot with data-autofocus — used
    // where the safe choice is not the first control in the markup.
    const first = dialog?.querySelector('[data-autofocus]') ?? dialog?.querySelector(FOCUSABLE);
    (first ?? dialog)?.focus({ preventScroll: true });

    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) ?? [])].filter(
        (el) => el.offsetParent !== null
      );
      if (items.length === 0) {
        e.preventDefault();
        dialogRef.current?.focus({ preventScroll: true });
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (!dialogRef.current?.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? lastItem : firstItem).focus();
      } else if (e.shiftKey && active === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={description ? descId : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id={labelledBy}>{title}</h3>
        {description && (
          <p id={descId} className="muted small modal-desc">
            {description}
          </p>
        )}
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}

export function Toast({ message, kind = 'ok', onDone }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  // A failure must interrupt; a success can wait for the next pause.
  const assertive = kind === 'err';
  return (
    <div
      className={`toast toast-${kind}`}
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
    >
      {message}
    </div>
  );
}
