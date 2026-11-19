import { useMemo } from 'react';

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Turn { page, pageSize, total } into everything a pager needs, including a
 * compacted page list: [1, '…', 4, 5, 6, '…', 20].
 */
export function usePagination({ page = 1, pageSize = DEFAULT_PAGE_SIZE, total = 0, siblings = 1 } = {}) {
  return useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(Math.max(1, page), totalPages);
    const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
    const to = Math.min(current * pageSize, total);

    const pages = [];
    const push = (v) => pages[pages.length - 1] !== v && pages.push(v);
    for (let p = 1; p <= totalPages; p += 1) {
      const nearEdge = p === 1 || p === totalPages;
      const nearCurrent = Math.abs(p - current) <= siblings;
      if (nearEdge || nearCurrent) push(p);
      else push('…');
    }

    return {
      page: current,
      pageSize,
      total,
      totalPages,
      from,
      to,
      pages,
      hasPrev: current > 1,
      hasNext: current < totalPages,
      label: total === 0 ? 'No results' : `${from}–${to} of ${total.toLocaleString()}`,
    };
  }, [page, pageSize, total, siblings]);
}
