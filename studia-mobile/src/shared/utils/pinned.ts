// pinned.ts — splits a list into its pinned items and the rest, keeping the order it came in.
// Used by the Stream tabs so pinned announcements render in their own section at the top instead
// of being interleaved with (and pushed under) later posts.
export function splitPinned<T extends { pinned: boolean }>(items: readonly T[]): { pinned: T[]; rest: T[] } {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const item of items) (item.pinned ? pinned : rest).push(item);
  return { pinned, rest };
}
