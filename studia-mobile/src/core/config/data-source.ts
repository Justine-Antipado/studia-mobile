// data-source.ts: the ONE switch between in-memory mocks and the Supabase/Vercel backend.
// Set EXPO_PUBLIC_DATA_SOURCE=mock|remote (default mock). Read the env var literally so Expo can inline it.
export type DataSource = "mock" | "remote";

export const DATA_SOURCE: DataSource =
  process.env.EXPO_PUBLIC_DATA_SOURCE === "remote" ? "remote" : "mock";

export const isRemote = DATA_SOURCE === "remote";

export const REMOTE_ENV = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, ""),
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
} as const;
