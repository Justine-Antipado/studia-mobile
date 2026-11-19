// api-client.ts — fetch wrapper stub for the real backend. Not used by any screen yet: every
// repository's mock implementation can be swapped for one that calls `apiClient` without the
// hook/screen layer changing. Ready for an auth token once session-store persists one.
import { appError, fail, ok, type Result } from "@/core/data/errors/app-error";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
const DEFAULT_TIMEOUT_MS = 10_000;

export type ApiRequest = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  authToken?: string | null;
  timeoutMs?: number;
};

export async function apiRequest<T>({
  path,
  method = "GET",
  body,
  authToken,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiRequest): Promise<Result<T>> {
  if (!BASE_URL) {
    return fail(appError("unknown", "No API configured yet.", false));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 401) return fail(appError("unauthorized", "Please sign in again.", false));
    if (response.status === 404) return fail(appError("not_found", "Not found.", false));
    if (response.status === 409) return fail(appError("conflict", "This was already changed elsewhere.", false));
    if (!response.ok) return fail(appError("network", "The server could not process this request.", true));

    const data = (await response.json()) as T;
    return ok(data);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return fail(appError("timeout", "That took too long. Please try again.", true));
    }
    return fail(appError("network", "Could not reach the server. Check your connection.", true));
  } finally {
    clearTimeout(timer);
  }
}
