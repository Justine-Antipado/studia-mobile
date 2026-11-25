-- 036 a purpose for the admin's sign-in code.
--
-- Its own migration on purpose: Postgres will not let a value added to an enum be USED in the same
-- transaction that adds it, and `supabase db push` runs one transaction per file. Migration 037 is
-- what uses it.
--
-- Why it is needed: the admin portal has no second factor. AuthContext.login sets the session as soon
-- as the password is accepted, because studia-api never returns `otpRequired`, and remoteAuth's
-- verifyLoginOtp/resendLoginOtp both throw 501. So one password protects the account that can read
-- every user's data and hard-delete users and classes -- while a STUDENT needs an emailed code to
-- change their own phone number. docs/api-contract.md specified both endpoints; only the server half
-- was missing.

alter type public.otp_purpose add value if not exists 'admin_login';
