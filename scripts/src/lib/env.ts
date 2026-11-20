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
