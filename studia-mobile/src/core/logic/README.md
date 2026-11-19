# core logic

Cross-feature logic: `route-params.ts` (validate every deep-link param before use; `useRouteEnum`
also keeps a screen's tab selection in the URL), `use-role-guard.ts` (client-side role/session
guard; real authorization stays on the backend), `report-error.ts` (single error sink, no
sensitive data), `sign-out.ts` (the only way to end a session — clears the query and image caches
so the next account cannot see this one's data).
