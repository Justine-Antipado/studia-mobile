// Server-only configuration. The service-role key lives ONLY here (Vercel env), never in a client bundle.
function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const env = {
  supabaseUrl: (): string => need("SUPABASE_URL"),
  anonKey: (): string => need("SUPABASE_ANON_KEY"),
  serviceKey: (): string => need("SUPABASE_SERVICE_ROLE_KEY"),
  /**
   * Comma-separated browser origins allowed to call the API (admin site). Native apps send no Origin,
   * so an empty list breaks only the admin portal -- and breaks it as an opaque CORS error in the
   * browser, with nothing on the server to explain why. Say so once per cold start instead.
   */
  allowedOrigins: (): string[] => {
    const list = (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0 && !warnedNoOrigins) {
      warnedNoOrigins = true;
      console.warn("[config] ALLOWED_ORIGINS is empty: browser callers (the admin portal) will be blocked by CORS.");
    }
    return list;
  },
};

let warnedNoOrigins = false;
