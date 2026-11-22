// data-source.ts: public configuration for the Supabase / studia-api backend. There is no mock layer:
// every repository reads and writes the real database. Read each env var literally so Expo can inline it.
export const REMOTE_ENV = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, ""),
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
} as const;
