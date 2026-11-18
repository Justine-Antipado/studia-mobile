-- Copied from the documented schema in features/auth/data/auth-service.ts. NOT executed or wired to anything.
-- Only the column names are documented there; column types are still to be decided.
-- otp_codes(id, email, purpose, code_hash, expires_at, attempts, sent_at, consumed_at)
CREATE TABLE otp_codes (
  id,
  email,
  purpose,
  code_hash,
  expires_at,
  attempts,
  sent_at,
  consumed_at
);
