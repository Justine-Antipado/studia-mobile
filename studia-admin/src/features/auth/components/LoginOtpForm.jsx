import { useCallback, useEffect, useRef, useState } from 'react';
import { formatCountdown } from '../../../core/logic/format';
import { Icon } from '../../../shared/components/Icon';

/**
 * Step two of every admin sign-in: the 6-digit code emailed to the registered
 * address. Six boxes with auto-advance, paste support, backspace navigation and
 * auto-submit on the sixth digit, plus the expiry countdown and a Resend button
 * that stays disabled until the configured interval has passed.
 *
 * The caller owns the session: this form only reports the code it collected.
 */
const LENGTH = 6;
const EMPTY = Array.from({ length: LENGTH }, () => '');
const digitsOnly = (s) => s.replace(/\D/g, '');

export default function LoginOtpForm({
  maskedEmail,
  expiresInSec,
  resendInSec,
  onVerify,
  onResend,
  onCancel,
}) {
  const [digits, setDigits] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + expiresInSec * 1000);
  const [secondsLeft, setSecondsLeft] = useState(expiresInSec);
  const [resendAt, setResendAt] = useState(() => Date.now() + resendInSec * 1000);
  const [resendLeft, setResendLeft] = useState(resendInSec);

  const boxes = useRef([]);
  const submittedFor = useRef('');

  useEffect(() => {
    boxes.current[0]?.focus();
  }, []);

  // One ticker drives both countdowns.
  useEffect(() => {
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
      setResendLeft(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, resendAt]);

  const expired = secondsLeft === 0;

  const submit = useCallback(
    async (code) => {
      if (busy || code.length !== LENGTH) return;
      // Auto-submit must not fire twice for the same code.
      if (submittedFor.current === code) return;
      submittedFor.current = code;
      setBusy(true);
      setError('');
      try {
        await onVerify(code);
      } catch (e) {
        setError(e?.message || 'Invalid or expired code.');
        setDigits(EMPTY);
        submittedFor.current = '';
        boxes.current[0]?.focus();
      } finally {
        setBusy(false);
      }
    },
    [busy, onVerify]
  );

  const write = (next) => {
    setDigits(next);
    const code = next.join('');
    if (code.length === LENGTH && next.every(Boolean)) submit(code);
  };

  const onChangeAt = (index, raw) => {
    const typed = digitsOnly(raw);
    if (!typed) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    // Typing (or pasting) several digits fills the boxes from here on.
    const next = [...digits];
    typed.split('').forEach((d, i) => {
      if (index + i < LENGTH) next[index + i] = d;
    });
    write(next);
    const landed = Math.min(LENGTH - 1, index + typed.length);
    boxes.current[landed]?.focus();
  };

  const onKeyDownAt = (index, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        setDigits(next);
        return;
      }
      if (index > 0) {
        next[index - 1] = '';
        setDigits(next);
        boxes.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      boxes.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < LENGTH - 1) {
      e.preventDefault();
      boxes.current[index + 1]?.focus();
    }
  };

  const onPaste = (e) => {
    const pasted = digitsOnly(e.clipboardData.getData('text')).slice(0, LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = [...EMPTY];
    pasted.split('').forEach((d, i) => {
      next[i] = d;
    });
    write(next);
    boxes.current[Math.min(LENGTH - 1, pasted.length)]?.focus();
  };

  const resend = async () => {
    if (resendLeft > 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await onResend();
      setExpiresAt(Date.now() + (result?.expiresInSec ?? expiresInSec) * 1000);
      setResendAt(Date.now() + (result?.resendInSec ?? resendInSec) * 1000);
      setDigits(EMPTY);
      submittedFor.current = '';
      boxes.current[0]?.focus();
    } catch (e) {
      setError(e?.message || 'That code could not be re-sent.');
      if (e?.meta?.retryAfterSec) setResendAt(Date.now() + e.meta.retryAfterSec * 1000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="otp-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit(digits.join(''));
      }}
    >
      <div className="otp-intro">
        <span className="otp-badge" aria-hidden="true">
          <Icon.Lock />
        </span>
        <h2>Enter your login code</h2>
        <p className="muted">
          We sent a 6-digit code to <strong>{maskedEmail}</strong>. It expires in{' '}
          <strong>{formatCountdown(secondsLeft)}</strong>.
        </p>
      </div>

      <div className="otp-boxes" onPaste={onPaste} role="group" aria-label="6-digit login code">
        {digits.map((digit, index) => (
          <input
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            ref={(el) => {
              boxes.current[index] = el;
            }}
            className={'otp-box' + (error ? ' invalid' : '')}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={LENGTH}
            value={digit}
            disabled={busy || expired}
            aria-label={`Digit ${index + 1}`}
            aria-invalid={!!error || undefined}
            onChange={(e) => onChangeAt(index, e.target.value)}
            onKeyDown={(e) => onKeyDownAt(index, e)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>

      {(error || expired) && (
        <div className="form-error" id="otp-error" role="alert">
          {error || 'That code has expired. Ask for a new one.'}
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy || expired || digits.some((d) => !d)}>
        {busy ? 'Checking…' : 'Verify and sign in'}
      </button>

      <div className="otp-actions">
        <button type="button" className="link-btn" disabled={resendLeft > 0 || busy} onClick={resend}>
          {resendLeft > 0 ? `Resend code in ${formatCountdown(resendLeft)}` : 'Resend code'}
        </button>
        <button type="button" className="link-btn" onClick={onCancel}>
          Use a different account
        </button>
      </div>
    </form>
  );
}
