# send-push

Delivers each new `notifications` row to the owner's phone via Expo Push and to their email via Gmail SMTP
(announcements, assignments, quizzes, grades, lessons, class changes).

## One-time setup

1. Apply migration `019_push_notifications.sql`.
2. Pick a long random string for `<SECRET>`, then deploy and set it on the function:
   ```bash
   supabase functions deploy send-push --no-verify-jwt
   supabase secrets set PUSH_WEBHOOK_SECRET=<SECRET> SMTP_USER=<gmail> SMTP_PASS=<app password>
   ```
   `SMTP_USER` / `SMTP_PASS` are the same Gmail account and app password used for the login codes
   (docs/AUTH-SETUP.md). Without them the function still sends the push, just no email.
3. In the SQL editor, store the same secret and the function URL in Vault (the trigger reads them):
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-push', 'push_function_url');
   select vault.create_secret('<SECRET>', 'push_webhook_secret');
   ```
   Until both exist the trigger does nothing, so notifications keep working in-app only.

## Phone side

- Needs a development/production build, not Expo Go.
- Android needs FCM credentials: add `google-services.json` and run `npx eas-cli credentials` (Android, FCM V1).
- iOS needs an Apple push key (EAS creates it on `eas build`).
