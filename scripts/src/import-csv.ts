// CSV -> Supabase. Creates the Auth users, remaps every users-FK column, then COPYs everything
// in one transaction. Default target is dev. Prod needs `--env prod --confirm` and imports ONLY the
// admin account and settings.
import { randomBytes } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import copyStreams from "pg-copy-streams";
import { csvLine, parseCsv, writeCsv } from "./lib/csv.ts";
import { loadConfig, parseArgs, type Config } from "./lib/env.ts";
import { loadSchema, type Schema } from "./lib/pg-schema.ts";
import { CSV_DIR, MAPPED_DIR, MIGRATIONS_DIR, PLAN, type Manifest, type TablePlan } from "./lib/plan.ts";

const { env, flags } = parseArgs(process.argv.slice(2));
const reset = flags.has("--reset");
if (env === "prod" && !flags.has("--confirm")) fail("Refusing to touch prod without --confirm.");
if (env === "prod" && reset) fail("--reset is dev-only and never runs against prod.");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const cfg: Config = loadConfig(env);
const schema: Schema = loadSchema(MIGRATIONS_DIR);
const manifest = JSON.parse(readFileSync(join(CSV_DIR, "_manifest.json"), "utf8")) as Manifest;

type Csv = ReturnType<typeof parseCsv>;
const read = (plan: TablePlan): Csv | null => {
  const file = join(CSV_DIR, `${plan.csv}.csv`);
  return existsSync(file) ? parseCsv(readFileSync(file, "utf8")) : null;
};

// prod: the admin account and settings only, no demo data
const PROD_TABLES = new Set(["users", "settings"]);
const plans = PLAN.filter((p) => (env === "prod" ? PROD_TABLES.has(p.dest) : true));

// ---------------------------------------------------------------- 1. auth users
const usersPlan = PLAN.find((p) => p.dest === "users");
if (!usersPlan) fail("plan has no users table");
const usersCsv = read(usersPlan);
if (!usersCsv) fail("01_users.csv is missing; run the converter first.");
const col = (csv: Csv, name: string): number => {
  const at = csv.header.indexOf(name);
  if (at < 0) fail(`column ${name} missing from CSV header`);
  return at;
};
const cell = (row: (string | null)[], at: number): string => row[at] ?? "";

const idMapFile = join(CSV_DIR, "_id_map.csv");
const idMap = new Map<string, string>();
if (existsSync(idMapFile)) {
  for (const r of parseCsv(readFileSync(idMapFile, "utf8")).rows) if (r[0] && r[1]) idMap.set(r[0], r[1]);
}

const admin: SupabaseClient = createClient(cfg.supabaseUrl, cfg.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function randomPassword(): string {
  return randomBytes(15).toString("base64url") + "aA1!";
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

const iId = col(usersCsv, "id");
const iEmail = col(usersCsv, "email");
const iName = col(usersCsv, "full_name");
const iRole = col(usersCsv, "role");
const iStatus = col(usersCsv, "status");
const demoOld = new Set(manifest.demoUsers.map((d) => d.oldId));
const issued: { email: string; password: string; note: string }[] = [];

for (const row of usersCsv.rows) {
  const oldId = cell(row, iId);
  const role = cell(row, iRole);
  if (env === "prod" && role !== "admin") continue;
  const email = cell(row, iEmail).toLowerCase();

  const known = idMap.get(oldId);
  if (known) {
    const { data } = await admin.auth.admin.getUserById(known);
    if (data.user) continue;
  }

  const pending = cell(row, iStatus) === "pending_approval";
  const password = randomPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: !pending,
    ...(pending ? { ban_duration: "876000h" } : {}),
    user_metadata: { full_name: cell(row, iName), role: role === "instructor" ? "instructor" : "student" },
    app_metadata: { seed: true, demo: demoOld.has(oldId) },
  });
  if (error || !data.user) {
    const existing = await findUserIdByEmail(email);
    if (!existing) throw new Error(`createUser ${email}: ${error?.message ?? "no user returned"}`);
    idMap.set(oldId, existing);
    issued.push({ email, password: "(account already existed; password unchanged)", note: "reused" });
    continue;
  }
  idMap.set(oldId, data.user.id);
  issued.push({ email, password, note: pending ? "unconfirmed + banned (pending approval)" : demoOld.has(oldId) ? "demo" : "" });
}

writeFileSync(idMapFile, writeCsv(["old_id", "new_uuid"], [...idMap].map(([o, n]) => [o, n])), "utf8");

// ---------------------------------------------------------------- 2. remap users FKs -> _mapped/
mkdirSync(MAPPED_DIR, { recursive: true });
const mapId = (table: string, column: string, value: string | null): string | null => {
  if (value === null) return null;
  const next = idMap.get(value);
  if (!next) throw new Error(`${table}.${column}: "${value}" is not a known user id`);
  return next;
};

type Prepared = { plan: TablePlan; file: string; columns: string[]; rows: number };
const prepared: Prepared[] = [];
for (const plan of plans) {
  const csv = read(plan);
  if (!csv) continue;
  const cols = schema.tables.get(plan.dest) ?? [];
  const fkCols = new Set(cols.filter((c) => c.fkTable === "users").map((c) => c.name));
  if (plan.dest === "users") fkCols.add("id");
  const at = csv.header.map((h) => (fkCols.has(h) ? 1 : 0));
  const typeAt = csv.header.indexOf("target_type");
  const idsAt = csv.header.indexOf("target_ids");
  const roleAt = csv.header.indexOf("role");

  const rows: (string | null)[][] = [];
  for (const row of csv.rows) {
    if (env === "prod" && plan.dest === "users" && row[roleAt] !== "admin") continue;
    const next = row.map((v, i) => (at[i] ? mapId(plan.dest, csv.header[i] ?? "", v) : v));
    if (plan.dest === "audit_log" && row[typeAt] === "user" && idsAt >= 0 && row[idsAt]) {
      const ids = JSON.parse(row[idsAt] ?? "[]") as string[];
      next[idsAt] = JSON.stringify(ids.map((x) => idMap.get(x) ?? x));
    }
    rows.push(next);
  }
  const file = join(MAPPED_DIR, `${plan.csv}.csv`);
  writeFileSync(file, writeCsv(csv.header, rows), "utf8");
  prepared.push({ plan, file, columns: csv.header, rows: rows.length });
}

// ---------------------------------------------------------------- 3. one transaction
const UPSERT_KEYS: Record<string, string[]> = { users: ["id"], settings: ["section"] };

const client = new pg.Client({ connectionString: cfg.dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("begin");
  if (reset) {
    const all = [...new Set(PLAN.map((p) => `public.${p.dest}`))].join(", ");
    await client.query(`truncate table ${all} restart identity cascade`);
  }
  for (const p of prepared) {
    const cols = p.columns.map((c) => `"${c}"`).join(", ");
    const target = `public.${p.plan.dest}`;
    const upsert = UPSERT_KEYS[p.plan.dest];
    let into = target;
    if (upsert) {
      // Auth already created a profile row per user, and seed.sql created the settings defaults
      into = `pg_temp.stage_${p.plan.dest}`;
      await client.query(`create temp table stage_${p.plan.dest} (like ${target} including defaults) on commit drop`);
    }
    const stream = client.query(copyStreams.from(`COPY ${into} (${cols}) FROM STDIN WITH (FORMAT csv, HEADER true)`));
    await pipeline(createReadStream(p.file), stream);
    if (upsert) {
      const set = p.columns.filter((c) => !upsert.includes(c)).map((c) => `"${c}" = excluded."${c}"`).join(", ");
      await client.query(
        `insert into ${target} (${cols}) select ${cols} from ${into} on conflict (${upsert.map((k) => `"${k}"`).join(", ")}) do update set ${set}`,
      );
    }
  }
  await client.query("commit");
} catch (err) {
  await client.query("rollback");
  console.error(`import failed, rolled back: ${err instanceof Error ? err.message : String(err)}`);
  if (!reset) console.error("If rows already exist from an earlier run, re-run with --reset (dev only).");
  process.exitCode = 1;
} finally {
  await client.end();
}

if (process.exitCode !== 1) {
  console.log(`import (${env}${reset ? ", reset" : ""}): ${prepared.length} tables, ${prepared.reduce((n, p) => n + p.rows, 0)} rows, ${idMap.size} auth users mapped`);
  if (issued.length) {
    console.log("\nGenerated passwords (shown ONCE, never stored or committed; rotate them):");
    for (const i of issued) console.log(csvLine([i.email, i.password, i.note]));
  }
}
