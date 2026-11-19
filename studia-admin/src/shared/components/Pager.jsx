import { Icon } from './Icon';

/**
 * Pager UI for the shape `usePagination()` returns. Purely presentational —
 * the caller owns `page` in whatever state (usually `useQueryState`).
 */
export default function Pager({ pagination, onPageChange }) {
  const { page, totalPages, pages, hasPrev, hasNext, label } = pagination;
  if (pagination.total === 0) return null;

  return (
    <nav className="pager" aria-label="Pagination">
      <p className="pager-label">{label}</p>
      <div className="pager-controls">
        <button
          type="button"
          className="pager-btn"
          disabled={!hasPrev}
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
        >
          <Icon.ChevronLeft />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="pager-ellipsis" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`pager-btn ${p === page ? 'active' : ''}`}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Page ${p}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          className="pager-btn pager-next"
          disabled={!hasNext}
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
        >
          <span className="pager-next-icon">
            <Icon.ChevronLeft />
          </span>
        </button>
      </div>
      <p className="pager-pages sr-only">
        Page {page} of {totalPages}
      </p>
    </nav>
  );
}
