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
  /** Comma-separated browser origins allowed to call the API (admin site). Native apps send no Origin. */
  allowedOrigins: (): string[] =>
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
};
