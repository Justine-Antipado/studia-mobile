// Loads <repo>/.env.dev or .env.prod (both gitignored) and refuses keys that belong to the other project.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./plan.ts";

export type TargetEnv = "dev" | "prod";

/** Public project refs (not secrets). A URL or DB string for another project is rejected. */
const PROJECT_REF: Record<TargetEnv, string> = {
  dev: "chvibqjstucybirsmpwu",
  prod: "xvjahswctcarvblxgjmd",
};

export type Config = {
  env: TargetEnv;
  supabaseUrl: string;
  serviceRoleKey: string;
  dbUrl: string;
};

function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

/** Describes the key WITHOUT revealing it, and throws a plain-language error when it cannot be the service-role key. */
export function checkServiceKey(cfg: Config): string {
  const key = cfg.serviceRoleKey;
  if (key !== key.trim() || /\s/.test(key)) throw new Error("SUPABASE_SERVICE_ROLE_KEY contains spaces or a line break. Re-paste it on one line.");
  if (key.startsWith("sb_publishable_")) throw new Error("SUPABASE_SERVICE_ROLE_KEY is the PUBLISHABLE key. Use the secret key (sb_secret_...) or the legacy service_role key.");
  if (key.startsWith("sb_secret_")) return "secret key (sb_secret_...)";
  const parts = key.split(".");
  if (parts.length !== 3) throw new Error(`SUPABASE_SERVICE_ROLE_KEY is not a key I recognise (${key.length} characters, ${parts.length} part(s)). A JWT has 3 parts separated by dots; it may be truncated.`);
  let claims: { role?: string; ref?: string };
  try {
    claims = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8")) as { role?: string; ref?: string };
  } catch {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY looks like a JWT but its payload cannot be decoded. It is probably truncated or altered.");
  }
  if (claims.role !== "service_role") throw new Error(`SUPABASE_SERVICE_ROLE_KEY is a "${claims.role ?? "unknown"}" key, not "service_role". Copy the service_role key from Project Settings > API Keys.`);
  if (claims.ref && claims.ref !== PROJECT_REF[cfg.env]) throw new Error(`SUPABASE_SERVICE_ROLE_KEY belongs to project ${claims.ref}, not the ${cfg.env} project.`);
  return "legacy service_role JWT";
}

export function parseArgs(argv: readonly string[]): { env: TargetEnv; flags: Set<string> } {
  const flags = new Set(argv.filter((a) => a.startsWith("--") && a !== "--env"));
  const at = argv.indexOf("--env");
  const value = at >= 0 ? argv[at + 1] : "dev";
  if (value !== "dev" && value !== "prod") throw new Error(`--env must be dev or prod (got "${value}")`);
  flags.delete(`--${value}`);
  return { env: value, flags };
}

export function loadConfig(env: TargetEnv): Config {
  const file = join(ROOT, `.env.${env}`);
  if (!existsSync(file)) {
    throw new Error(
      `Missing ${file}\nCreate it (it is gitignored) with:\n  SUPABASE_URL=https://${PROJECT_REF[env]}.supabase.co\n  SUPABASE_SERVICE_ROLE_KEY=...\n  SUPABASE_DB_URL=postgresql://...  (Session pooler string from the dashboard)`,
    );
  }
  const vars = parseDotenv(readFileSync(file, "utf8"));
  const need = (key: string): string => {
    const v = vars[key];
    if (!v) throw new Error(`${key} is empty in .env.${env}`);
    return v;
  };
  const cfg: Config = {
    env,
    supabaseUrl: need("SUPABASE_URL").replace(/\/+$/, ""),
    serviceRoleKey: need("SUPABASE_SERVICE_ROLE_KEY"),
    dbUrl: need("SUPABASE_DB_URL"),
  };
  const ref = PROJECT_REF[env];
  if (!cfg.supabaseUrl.includes(ref)) throw new Error(`.env.${env}: SUPABASE_URL is not the ${env} project (${ref})`);
  if (!cfg.dbUrl.includes(ref)) throw new Error(`.env.${env}: SUPABASE_DB_URL is not the ${env} project (${ref})`);
  const other = PROJECT_REF[env === "dev" ? "prod" : "dev"];
  if (cfg.supabaseUrl.includes(other) || cfg.dbUrl.includes(other)) throw new Error(`.env.${env} mentions the other project (${other})`);
  return cfg;
}
