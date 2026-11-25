# STUDIA Admin

Admin web dashboard for STUDIA (Occidental Mindoro State University – Mamburao Campus).
Vite + React 19 + React Router 7, plain JSX. See [`../CLAUDE.md`](../CLAUDE.md) for the
architecture and [`../docs/`](../docs/) for the API contract and route map.

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # production build -> dist/
npm run lint     # oxlint
```

## Environment

Vite only reads `.env.local` — **the leading dot matters.** A build with missing values
still succeeds, but `getSupabase()` in `src/core/data/remote/remoteAuth.js` throws
"Supabase is not configured for this build" and nobody can sign in. If local sign-in fails,
check this first.

```
VITE_API_URL=https://studia-api-mu.vercel.app
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

See [`.env.example`](.env.example) for the full list, including the optional
`VITE_APP_NAME`, `VITE_MAIL_FROM` and `VITE_SESSION_IDLE_MINUTES`.

## Deploying

Vercel project `studia-admin`. A plain `npm run build`; no build-time secrets beyond the
`VITE_*` values above, which are set in the Vercel dashboard.

If a Git-triggered deployment is refused with *"the commit author did not have contributing
access"*, that is the Hobby plan declining to build a commit authored by someone other than
the project owner. Deploy from the CLI instead — it authenticates as you and skips that check:

```bash
npx vercel --prod
```

### Security headers (`vercel.json`)

`vercel.json` is validated against a strict schema that rejects unknown properties, so it
**cannot carry `"//"` comment keys** — a deployment with one fails with
`headers[0].headers[0] should NOT have additional property '//'`. The reasoning that used to
live in those keys is kept here instead.

| Header | Why |
|---|---|
| `Content-Security-Policy` | The one that counts. `index.html` carries the same policy in a `<meta>` tag, but browsers ignore `frame-ancestors` there (and meta CSP cannot be relied on generally), so this header is what actually protects the portal. |
| `X-Frame-Options: DENY` | `frame-ancestors` covers modern browsers; this is the older equivalent and costs nothing. Without either, an admin action such as deleting a user can be clickjacked through an iframe. |
| `X-Content-Type-Options: nosniff` | Standard hardening. |
| `Referrer-Policy` | Send no referrer to third parties. |
| `X-Robots-Tag: noindex, nofollow` | A private portal has no business being indexed, and the `<meta>` tag only reaches crawlers that render HTML. |
| `Strict-Transport-Security` | Standard hardening. |
| `Permissions-Policy` | Nothing in the portal uses camera, microphone, geolocation or payment. |

**`connect-src` names the two origins the app talks to** — the Supabase project and
`studia-api` — rather than a blanket `https:`. The admin's access and refresh tokens live in
`localStorage` (supabase-js `persistSession`), and a blanket `https:` would let injected
script post them anywhere. **Update both hosts if the Supabase project or the API domain
changes**, or the portal will not be able to reach its own backend and the browser console
will say so.

Verify after deploying:

```bash
curl -sI https://<admin-host>/ | grep -i content-security-policy
```
