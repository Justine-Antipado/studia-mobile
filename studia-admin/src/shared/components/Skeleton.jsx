/**
 * Loading placeholders. Every skeleton reserves the same height as the real
 * content so a page never jumps when the data arrives.
 */
export function Skeleton({ width = '100%', height = 14, radius = 'var(--radius-sm)', className = '' }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, width = '100%' }) {
  return (
    <span className="skeleton-stack" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : width} />
      ))}
    </span>
  );
}

export function SkeletonCards({ count = 4, height = 92 }) {
  return (
    <div className="skeleton-cards" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} radius="var(--radius-lg)" />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }) {
  return (
    <div className="skeleton-table" aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => (
        <div className="skeleton-row" key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} height={c === 0 ? 34 : 14} radius={c === 0 ? 'var(--radius-pill)' : undefined} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Shown by the route-level <Suspense> while a lazy page chunk downloads. */
export function PageSkeleton() {
  return (
    <div className="page-skeleton" role="status" aria-label="Loading page">
      <Skeleton width="180px" height={28} />
      <Skeleton width="320px" height={14} />
      <SkeletonCards count={4} />
      <Skeleton height={260} radius="var(--radius-lg)" />
    </div>
  );
}
