# shared hooks

`use-safe-back` (v2: logical-parent fallback + Android hardware back + unsaved-changes block),
`use-responsive` (compact <360 / tablet >=600), `use-color-scheme`, `use-network`
(module-level NetInfo store; `useNetwork()` for components and `isOnline()` for non-React code
such as `use-mutation`'s offline guard), `use-draft-autosave` (generic local form draft:
autosave/restore/clear), `use-file-picker` (pick + validate against a `FilePolicy`; the
student and instructor hooks are one-line bindings of it).
