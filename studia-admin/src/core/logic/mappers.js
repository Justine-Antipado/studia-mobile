/**
 * MAPPERS — the one place where the API's snake_case meets the UI's camelCase.
 *
 * The PHP API answers snake_case (user_id, last_active_at) because that is what
 * the MySQL columns are called; every component above the data layer sees
 * camelCase only. Feature repositories call these, never components.
 */
const camel = (key) => key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const snake = (key) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

const convertKeys = (value, convert) => {
  if (Array.isArray(value)) return value.map((v) => convertKeys(v, convert));
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) out[convert(key)] = convertKeys(v, convert);
  return out;
};

/** API payload -> UI shape. */
export const toUi = (payload) => convertKeys(payload, camel);

/** UI shape -> API payload. */
export const toApi = (payload) => convertKeys(payload, snake);

export const DEFAULT_PAGE_SIZE = 20;

/**
 * Normalize a list response to { data, meta: { page, pageSize, total, totalPages } }.
 * Tolerates a bare array, so a half-built endpoint does not crash a page.
 */
export function toList(payload, { page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
  const meta = Array.isArray(payload) ? {} : (payload?.meta ?? {});
  const resolvedPageSize = Number(meta.pageSize ?? meta.page_size ?? pageSize) || DEFAULT_PAGE_SIZE;
  const total = Number(meta.total ?? rows.length);
  return {
    data: toUi(rows),
    meta: {
      page: Number(meta.page ?? page) || 1,
      pageSize: resolvedPageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / resolvedPageSize)),
    },
  };
}

/**
 * The query params every list endpoint accepts. Filters are flattened, so
 * { filters: { role: 'Student' } } is sent as role=Student.
 */
export function toListParams({ page = 1, pageSize = DEFAULT_PAGE_SIZE, sort, order, q, filters = {} } = {}) {
  return {
    page,
    page_size: pageSize,
    ...(sort ? { sort: snake(sort), order: order === 'desc' ? 'desc' : 'asc' } : {}),
    ...(q ? { q } : {}),
    ...Object.fromEntries(
      Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'All')
        .map(([k, v]) => [snake(k), v])
    ),
  };
}

/** Apply q / sort / filters / paging in memory. Used by the mock backend only. */
export function applyListParams(rows, { page = 1, pageSize = DEFAULT_PAGE_SIZE, sort, order = 'asc', q, filters = {}, searchKeys = [], match } = {}) {
  let out = [...rows];

  if (q) {
    const term = q.toLowerCase();
    const keys = searchKeys.length ? searchKeys : Object.keys(out[0] ?? {});
    out = out.filter((row) => keys.some((k) => String(row[k] ?? '').toLowerCase().includes(term)));
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '' || value === 'All') continue;
    out = match ? out.filter((row) => match(row, key, value)) : out.filter((row) => String(row[key]) === String(value));
  }

  if (sort) {
    const dir = order === 'desc' ? -1 : 1;
    out.sort((a, b) => {
      const x = a[sort];
      const y = b[sort];
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
      return String(x ?? '').localeCompare(String(y ?? ''), 'en', { numeric: true }) * dir;
    });
  }

  const total = out.length;
  const start = (page - 1) * pageSize;
  return {
    data: out.slice(start, start + pageSize),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}
