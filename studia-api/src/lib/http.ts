import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError, z, type ZodType } from "zod";
import { env } from "./env.js";

export type ErrorCode =
  | "VALIDATION"
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "ROLE_MISMATCH"
  | "EMAIL_NOT_VERIFIED"
  | "ACCOUNT_PENDING"
  | "ACCOUNT_INACTIVE"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_LOCKED"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "CONFLICT"
  | "AI_UNAVAILABLE"
  | "UNKNOWN";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  INVALID_CREDENTIALS: 401,
  EMAIL_TAKEN: 409,
  ROLE_MISMATCH: 403,
  EMAIL_NOT_VERIFIED: 403,
  ACCOUNT_PENDING: 403,
  ACCOUNT_INACTIVE: 403,
  OTP_INVALID: 400,
  OTP_EXPIRED: 400,
  OTP_LOCKED: 429,
  RATE_LIMITED: 429,
  UNAUTHORIZED: 401,
  CONFLICT: 409,
  AI_UNAVAILABLE: 503,
  UNKNOWN: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly extra: { fields?: Record<string, string>; retryAfterSec?: number } = {},
  ) {
    super(message);
  }
}

function cors(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin;
  if (typeof origin === "string" && env.allowedOrigins().includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
}

/**
 * The caller's IP, as recorded in login_attempts, otp_codes and audit_log.
 *
 * `x-forwarded-for` is a list the client can start: anything it sends arrives on the LEFT, and the
 * platform appends the real peer on the right. Taking the leftmost value therefore records whatever
 * the caller typed, which would let an attacker forge the IP in the admin's security views. Vercel's
 * own `x-vercel-forwarded-for` cannot be spoofed, so prefer it and fall back to the RIGHTMOST
 * `x-forwarded-for` hop, which is the one the platform added.
 */
export const clientIp = (req: VercelRequest): string | null => {
  const vercel = req.headers["x-vercel-forwarded-for"];
  const trusted = Array.isArray(vercel) ? vercel[0] : vercel;
  if (trusted?.trim()) return trusted.split(",").pop()?.trim() || null;
  const f = req.headers["x-forwarded-for"];
  const raw = Array.isArray(f) ? f[0] : f;
  return raw?.split(",").pop()?.trim() || null;
};

export const bearer = (req: VercelRequest): string => {
  const h = req.headers.authorization ?? "";
  if (!h.startsWith("Bearer ") || h.length < 20) throw new ApiError("UNAUTHORIZED", "Please sign in again.");
  return h.slice(7);
};

/** POST-only JSON endpoint: CORS, zod-validated body, typed errors, never leaks internals. */
export function endpoint<T>(schema: ZodType<T, z.ZodTypeDef, unknown>, run: (body: T, req: VercelRequest) => Promise<unknown>) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    cors(req, res);
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: { code: "UNKNOWN", message: "Method not allowed" } });
      return;
    }
    try {
      const body = schema.parse(req.body ?? {});
      res.status(200).json(await run(body, req));
    } catch (e) {
      if (e instanceof ApiError) {
        res.status(STATUS[e.code]).json({ error: { code: e.code, message: e.message, ...e.extra } });
      } else if (e instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const i of e.issues) fields[String(i.path[0] ?? "form")] ??= i.message;
        res.status(400).json({
          error: { code: "VALIDATION", message: "Please fix the highlighted fields.", fields },
        });
      } else {
        console.error("[auth]", e instanceof Error ? e.name : "error"); // never log bodies, emails or codes
        res.status(500).json({ error: { code: "UNKNOWN", message: "Something went wrong. Please try again." } });
      }
    }
  };
}
