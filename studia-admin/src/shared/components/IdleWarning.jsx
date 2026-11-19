import { formatCountdown } from '../../core/logic/format';
import { Modal } from './ui';

/** Shown a minute before the idle timeout logs the admin out. */
export default function IdleWarning({ open, secondsLeft, onStay, onLogout }) {
  if (!open) return null;
  return (
    <Modal
      title="Still there?"
      onClose={onStay}
      labelledBy="idle-title"
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            Log out now
          </button>
          <button type="button" className="btn btn-primary" data-autofocus onClick={onStay}>
            Stay signed in
          </button>
        </>
      }
    >
      For security, this portal signs you out after a period of inactivity. You will be logged out in{' '}
      <strong>{formatCountdown(secondsLeft)}</strong>.
    </Modal>
  );
}
