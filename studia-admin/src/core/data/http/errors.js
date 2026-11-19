/**
 * One error shape for the whole app: { status, code, message, fieldErrors }.
 * Both the HTTP client and the mock backend throw ApiError, so UI code never
 * has to know which one is active.
 */
export const ERROR_CODES = {
  network: 'NETWORK_ERROR',
  timeout: 'TIMEOUT',
  aborted: 'ABORTED',
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  notFound: 'NOT_FOUND',
  validation: 'VALIDATION_FAILED',
  rateLimited: 'RATE_LIMITED',
  conflict: 'CONFLICT',
  server: 'SERVER_ERROR',
  unknown: 'UNKNOWN',
};

const DEFAULT_MESSAGES = {
  [ERROR_CODES.network]: 'Cannot reach the server. Check your connection and try again.',
  [ERROR_CODES.timeout]: 'The server took too long to respond. Please try again.',
  [ERROR_CODES.aborted]: 'Request cancelled.',
  [ERROR_CODES.unauthorized]: 'Your session has expired. Please log in again.',
  [ERROR_CODES.forbidden]: 'You do not have access to that.',
  [ERROR_CODES.notFound]: 'That record no longer exists.',
  [ERROR_CODES.validation]: 'Please check the highlighted fields.',
  [ERROR_CODES.rateLimited]: 'Too many attempts. Please wait a moment.',
  [ERROR_CODES.conflict]: 'That change conflicts with the current data.',
  [ERROR_CODES.server]: 'Something went wrong on the server.',
  [ERROR_CODES.unknown]: 'Something went wrong. Please try again.',
};

const CODE_BY_STATUS = {
  400: ERROR_CODES.validation,
  401: ERROR_CODES.unauthorized,
  403: ERROR_CODES.forbidden,
  404: ERROR_CODES.notFound,
  409: ERROR_CODES.conflict,
  422: ERROR_CODES.validation,
  429: ERROR_CODES.rateLimited,
};

export class ApiError extends Error {
  constructor({ status = 0, code = ERROR_CODES.unknown, message, fieldErrors = {}, retryable, meta = {} } = {}) {
    super(message || DEFAULT_MESSAGES[code] || DEFAULT_MESSAGES[ERROR_CODES.unknown]);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    // Non-field, non-authoritative extras a page may use for its own UI (e.g. a
    // login lockout countdown). The server is still the authority on the fact
    // itself — this is display-only.
    this.meta = meta;
    this.retryable =
      retryable ??
      (code === ERROR_CODES.network || code === ERROR_CODES.timeout || status >= 500);
  }
}

export const codeForStatus = (status) =>
  CODE_BY_STATUS[status] ?? (status >= 500 ? ERROR_CODES.server : ERROR_CODES.unknown);

/** Wrap anything thrown (including a plain Error from the mock) into an ApiError. */
export function toApiError(err) {
  if (err instanceof ApiError) return err;
  if (err?.name === 'AbortError') return new ApiError({ code: ERROR_CODES.aborted, retryable: false });
  return new ApiError({ message: err?.message, code: ERROR_CODES.unknown });
}

export const isAborted = (err) => err?.code === ERROR_CODES.aborted || err?.name === 'AbortError';

/** Shorthand used by the mock backend: fail(422, 'Incorrect OTP.', { code: ... }) */
export const fail = (status, message, extra = {}) =>
  new ApiError({ status, code: extra.code ?? codeForStatus(status), message, ...extra });
