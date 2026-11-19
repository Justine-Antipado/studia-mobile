/**
 * HTTP CLIENT — the only module that calls fetch.
 *
 * Features: base URL from VITE_API_URL, bearer token, JSON in/out, timeout,
 * caller-supplied AbortSignal, one normalized error shape, a single refresh
 * attempt on 401 and then a redirect to /login.
 */
import { env } from '../../config/env';
import { ROUTES } from '../../config/routes';
import { ApiError, ERROR_CODES, codeForStatus } from './errors';
import { clearSession, getToken, refreshToken } from './tokenStore';

const DEFAULT_TIMEOUT_MS = 15000;

/** { page: 1, q: '', role: null } -> "?page=1" (empty values are dropped) */
export function toQueryString(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => v !== '' && search.append(key, String(v)));
    else search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

const buildUrl = (path, params) =>
  `${env.apiUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}${toQueryString(params)}`;

/** Combine the caller's signal with our timeout into one signal. */
function withTimeout(signal, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  const onAbort = () => controller.abort(signal.reason);
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
    timedOut: () => controller.signal.reason?.name === 'TimeoutError',
  };
}

async function parseBody(res) {
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) {
    const text = await res.text().catch(() => '');
    return text ? { message: text } : null;
  }
  return res.json().catch(() => null);
}

/** The server may answer { message, code, errors: { field: msg } } or { error: ... }. */
function errorFromResponse(res, body) {
  const payload = body?.error && typeof body.error === 'object' ? body.error : body;
  return new ApiError({
    status: res.status,
    code: payload?.code ?? codeForStatus(res.status),
    message: payload?.message,
    fieldErrors: payload?.errors ?? payload?.fieldErrors ?? {},
    meta: payload?.meta ?? {},
  });
}

function onSessionLost() {
  clearSession();
  if (typeof window !== 'undefined' && window.location.pathname !== ROUTES.login) {
    window.location.replace(ROUTES.login);
  }
}

/**
 * request('/api/admin/users', { params, method, body, signal, timeoutMs, auth })
 * Resolves with the parsed JSON body, rejects with an ApiError.
 */
export async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    params,
    headers = {},
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    auth = true,
    _retried = false,
  } = options;

  const token = auth ? getToken() : null;
  const t = withTimeout(signal, timeoutMs);

  let res;
  try {
    res = await fetch(buildUrl(path, params), {
      method,
      signal: t.signal,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (t.timedOut()) throw new ApiError({ code: ERROR_CODES.timeout });
    if (err?.name === 'AbortError') throw new ApiError({ code: ERROR_CODES.aborted, retryable: false });
    throw new ApiError({ code: ERROR_CODES.network });
  } finally {
    t.cleanup();
  }

  const payload = await parseBody(res);
  if (res.ok) return payload;

  if (res.status === 401 && auth && !_retried) {
    if (await refreshToken()) return request(path, { ...options, _retried: true });
    onSessionLost();
  }
  throw errorFromResponse(res, payload);
}

export const http = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
};
