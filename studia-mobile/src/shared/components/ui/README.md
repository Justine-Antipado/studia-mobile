# shared components ui

The UI kit. Import from the barrel: `import { Card, ListRow, Badge } from "@/shared/components/ui"`.
One source of truth per primitive — `AppImage` is the only remote-image renderer, `Icon` the
only icon entry point, and `AppList` the only list (a tuned FlatList with module-level separator
and content styles, so the memoized rows are not defeated by new prop objects every render).
`AttachmentRow` and `CommentRow` live here because both roles render them identically.
`Screen` wraps every screen: header, offline banner, keyboard-safe scroll area, safe-area bottom
inset, tablet max-width and an `ErrorBoundary`.
