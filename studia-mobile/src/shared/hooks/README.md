# shared hooks

`use-safe-back` (v2: logical-parent fallback + Android hardware back + unsaved-changes block),
`use-responsive` (compact <360 / tablet >=600), `use-color-scheme`, `use-network`
(module-level NetInfo store; `useNetwork()` for components and `isOnline()` for non-React code
such as `use-mutation`'s offline guard), `use-draft-autosave` (generic local form draft:
autosave/restore/clear), `use-file-picker` (pick + validate against a `FilePolicy`; the
student and instructor hooks are one-line bindings of it).

`use-safe-router` (drop-in `useRouter()` whose `push` is navigation-locked: ignored until the
pushing screen is focused again, 1.8 s safety unlock; pair with `dangerouslySingular` on the Stack screens).
Use it instead of `useRouter()` in any screen that pushes a sub page.
