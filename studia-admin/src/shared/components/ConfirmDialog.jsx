import { useState } from 'react';
import { Modal } from './ui';

/**
 * The only way to confirm a destructive action.
 *
 * Pass `confirmWord` (the item's name, or 'DELETE') to require the admin to
 * type it first — used for permanent deletes of users and classes.
 *
 * The body is a separate component so that closing the dialog unmounts it and
 * the typed word starts empty next time, with no state to reset.
 */
export default function ConfirmDialog(props) {
  if (!props.open) return null;
  return <ConfirmDialogBody {...props} />;
}

function ConfirmDialogBody({
  title,
  description,
  children,
  confirmWord,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busy = false,
  confirmDisabled = false,
  tone = 'danger',
  onConfirm,
  onClose,
}) {
  const [typed, setTyped] = useState('');

  const ready = !confirmWord || typed.trim() === confirmWord;

  return (
    <Modal
      title={title}
      description={description}
      onClose={busy ? () => {} : onClose}
      labelledBy="confirm-title"
      actions={
        <>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-red' : 'btn-primary'}`}
            disabled={busy || confirmDisabled || !ready}
            onClick={onConfirm}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {confirmWord && (
        <label className="field confirm-field">
          <span>
            Type <code>{confirmWord}</code> to confirm
          </span>
          <input
            className="input"
            value={typed}
            autoComplete="off"
            spellCheck="false"
            aria-label={`Type ${confirmWord} to confirm`}
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
      )}
    </Modal>
  );
}
