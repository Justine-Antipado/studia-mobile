// list-state.tsx — the one place loading / error / empty states are decided.
// Every list and screen renders through this so the three states are never forgotten.
import type { ReactNode } from "react";

import { EmptyState } from "@/shared/components/ui/empty-state";
import { SkeletonList } from "@/shared/components/ui/skeleton";
import type { IconName } from "@/shared/components/ui/icon";

/** Minimal shape of a user-facing error. core/logic/app-error.ts (P1b) satisfies it. */
export type DisplayError = { message: string; retryable?: boolean };

type Props = {
  loading: boolean;
  error?: DisplayError | null;
  /** True when loading finished with no items. */
  empty?: boolean;
  onRetry?: () => void;
  /** Skeleton rows while loading. */
  skeletonCount?: number;
  emptyIcon?: IconName;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  /** Shown when there is data. */
  children: ReactNode;
};

export function ListState({
  loading,
  error,
  empty = false,
  onRetry,
  skeletonCount = 4,
  emptyIcon = "file-tray-outline",
  emptyTitle = "Nothing here yet",
  emptyMessage,
  emptyActionLabel,
  onEmptyAction,
  children,
}: Props) {
  // Error first: stale data must never hide a failed refresh.
  if (error) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Could not load this"
        message={error.message}
        actionLabel={error.retryable === false || !onRetry ? undefined : "Try again"}
        onAction={error.retryable === false ? undefined : onRetry}
      />
    );
  }

  if (loading) return <SkeletonList count={skeletonCount} />;

  if (empty) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        message={emptyMessage}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return <>{children}</>;
}
