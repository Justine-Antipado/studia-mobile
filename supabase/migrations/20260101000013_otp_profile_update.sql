-- 013: a new OTP purpose for the Account > Personal Information edit (email code before the change is
-- applied). 'password_change' already exists and is reused by Account > Password.
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as code that uses the new value, so this
-- migration does nothing else.
alter type public.otp_purpose add value if not exists 'profile_update';
