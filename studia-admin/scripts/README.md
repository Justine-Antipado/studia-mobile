# Checks

Three self-contained checks, added in phase 8. They need **no dependency and no
server** — plain `node`, run from `studia-admin/`:

```bash
node scripts/check-contrast.mjs   # WCAG AA over the palette in src/theme.js
node scripts/check-routes.mjs     # every route titled, described, breadcrumbed, mounted
node scripts/check-api.mjs        # the mock backend against what the pages assume
```

Each exits non-zero when something fails, so they drop straight into CI next to
`npm run lint` and `npm run build`.

They are deliberately **not** wired into `package.json`: this project has no test
runner, and phase 8 added no dependency. Run them by hand after touching the
palette, `navigation.js`/`routes.js`, or the mock backend.

| Script | What it would catch |
|---|---|
| `check-contrast.mjs` | A new token pair, or a palette tweak, that drops text below 4.5:1 or a control boundary below 3:1. Pairs are listed explicitly — add one when `index.css` starts combining two tokens in a new way. |
| `check-routes.mjs` | A route added to `routes.js`/`App.jsx` without a `navigation.js` entry (so: no sidebar item, no breadcrumb, no `<title>`, no meta description), a description over 160 characters, or two pages sharing a title. |
| `check-api.mjs` | A change to the mock backend that breaks a shape a page reads: list `{ data, meta }`, filtering/sorting/paging, the class-delete cascade into `/content`, the unread-notification counter, the single source of truth behind `/ai` and `/settings/ai`, and the audit trail behind deletes. |

`_load.mjs` is the shim that lets Node import the app's own ESM: it copies
`src/core` to a temp directory with extensionless imports resolved and
`import.meta.env` replaced by a literal. Nothing under `src/` is modified.
