// MariaDB dump -> one CSV per Postgres table, in FK dependency order. No database access, no secrets.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeCsv } from "./lib/csv.ts";
import { loadSchema, type Column } from "./lib/pg-schema.ts";
import { CSV_DIR, MIGRATIONS_DIR, PLAN, SKIPPED, SOURCE_SQL, type Manifest, type PlanContext, type SourceRecord } from "./lib/plan.ts";
import { parseInserts } from "./lib/sql-tokenizer.ts";

const schema = loadSchema(MIGRATIONS_DIR);
const problems: string[] = [];

function convert(table: string, col: Column, raw: string | null): string | null {
  if (raw === null) return null;
  const where = `${table}.${col.name}`;
  switch (col.kind.kind) {
    case "boolean":
      if (raw === "1" || raw.toLowerCase() === "true") return "true";
      if (raw === "0" || raw.toLowerCase() === "false") return "false";
      problems.push(`${where}: "${raw}" is not a boolean`);
      return raw;
    case "timestamptz": {
      const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(raw);
      if (!m) {
        problems.push(`${where}: "${raw}" is not a DATETIME`);
        return raw;
      }
      return `${m[1]}T${m[2]}${m[3] ?? ""}Z`;
    }
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) problems.push(`${where}: "${raw}" is not a DATE`);
      return raw;
    case "jsonb":
      try {
        return JSON.stringify(JSON.parse(raw));
      } catch {
        problems.push(`${where}: invalid JSON ${raw.slice(0, 60)}`);
        return raw;
      }
    case "int":
      if (!/^-?\d+$/.test(raw)) problems.push(`${where}: "${raw}" is not an integer`);
      return raw;
    case "numeric":
      if (!/^-?\d+(\.\d+)?$/.test(raw)) problems.push(`${where}: "${raw}" is not numeric`);
      return raw;
    case "enum":
      if (!col.kind.labels.includes(raw)) {
        problems.push(`${where}: "${raw}" is not in enum ${col.kind.name} (${col.kind.labels.join("|")})`);
      }
      return raw;
    default:
      return raw;
  }
}

// 1. parse the dump
let sql: string;
try {
  sql = readFileSync(SOURCE_SQL, "utf8");
} catch {
  console.error(`Missing ${SOURCE_SQL}. Put the MariaDB dump there first.`);
  process.exit(1);
}
const statements = parseInserts(sql);

const source = new Map<string, SourceRecord[]>();
const sourceColumns = new Map<string, string[]>();
for (const st of statements) {
  const known = sourceColumns.get(st.table);
  if (known && known.join(",") !== st.columns.join(",")) {
    problems.push(`${st.table}: INSERT at line ${st.line} lists different columns than an earlier INSERT`);
    continue;
  }
  sourceColumns.set(st.table, st.columns);
  const rows = source.get(st.table) ?? [];
  for (const values of st.rows) {
    const rec: SourceRecord = {};
    st.columns.forEach((c, idx) => {
      const v = values[idx];
      rec[c] = v === undefined || v.kind === "null" ? null : v.text;
    });
    rows.push(rec);
  }
  source.set(st.table, rows);
}

const planned = new Set(PLAN.map((p) => p.src));
for (const table of source.keys()) {
  if (!planned.has(table) && !(table in SKIPPED)) problems.push(`source table "${table}" has rows but is neither in PLAN nor SKIPPED`);
}

// 2. build the CSVs
// clear generated output only; _id_map.csv (old id -> auth uuid) must survive re-runs
function clearGenerated(): void {
  mkdirSync(CSV_DIR, { recursive: true });
  for (const f of readdirSync(CSV_DIR)) {
    if (/^\d\d_.+\.csv$/.test(f) || f === "_manifest.json") rmSync(join(CSV_DIR, f), { force: true });
  }
  rmSync(join(CSV_DIR, "_mapped"), { recursive: true, force: true });
}
clearGenerated();

const ctx: PlanContext = { source, demoUsers: [] };
const manifest: Manifest = {
  source: "supabase/seed/source/studia_db.sql",
  sourceRows: {},
  files: [],
  skipped: [],
  demoUsers: ctx.demoUsers,
  enrollmentProgress: {},
};
for (const [table, rows] of source) manifest.sourceRows[table] = rows.length;

for (const rec of source.get("class_enrollments") ?? []) {
  const id = rec["id"];
  const pct = rec["progress_pct"];
  if (id && pct !== null && pct !== undefined) manifest.enrollmentProgress[id] = Number(pct);
}

// transforms run on copies so a source table feeding two CSVs (quiz_questions) is not mutated twice
const emails = new Set<string>();
for (const plan of PLAN) {
  const srcRows = source.get(plan.src);
  if (!srcRows || srcRows.length === 0) continue;
  const destCols = schema.tables.get(plan.dest);
  if (!destCols) {
    problems.push(`${plan.dest}: no such table in supabase/migrations`);
    continue;
  }
  const out: SourceRecord[] = [];
  for (const original of srcRows) {
    const row: SourceRecord = { ...original };
    plan.transform?.(row, ctx);
    const next: SourceRecord = {};
    for (const [name, value] of Object.entries(row)) {
      if (plan.keep ? !plan.keep.includes(name) : plan.drop?.includes(name)) continue;
      next[plan.rename?.[name] ?? name] = value;
    }
    out.push(next);
  }

  const present = new Set(Object.keys(out[0] ?? {}));
  for (const name of present) {
    if (!destCols.some((c) => c.name === name)) {
      problems.push(`${plan.src}.${name} has no column in ${plan.dest}: map it, rename it or add it to "drop" in plan.ts`);
    }
  }
  const columns = destCols.filter((c) => present.has(c.name));
  const lines = out.map((row) => columns.map((c) => convert(plan.dest, c, row[c.name] ?? null)));

  if (plan.dest === "users") {
    for (const row of out) {
      const email = row["email"] ?? "";
      if (emails.has(email)) problems.push(`users: duplicate email ${email}`);
      emails.add(email);
    }
  }

  writeFileSync(join(CSV_DIR, `${plan.csv}.csv`), writeCsv(columns.map((c) => c.name), lines), "utf8");
  manifest.files.push({ csv: plan.csv, dest: plan.dest, src: plan.src, rows: lines.length, columns: columns.map((c) => c.name) });
}

for (const [table, reason] of Object.entries(SKIPPED)) {
  manifest.skipped.push({ table, rows: source.get(table)?.length ?? 0, reason });
}

if (problems.length > 0) {
  clearGenerated();
  console.error(`\n${problems.length} problem(s), nothing written:\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}

writeFileSync(join(CSV_DIR, "_manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

const csvCount = readdirSync(CSV_DIR).filter((f) => f.endsWith(".csv")).length;
console.log(`sql-to-csv: ${statements.length} INSERTs -> ${csvCount} CSV files in supabase/seed/csv`);
for (const f of manifest.files) console.log(`  ${f.csv.padEnd(30)} ${String(f.rows).padStart(4)} rows  -> ${f.dest}`);
for (const s of manifest.skipped) console.log(`  skipped ${s.table} (${s.rows} rows): ${s.reason}`);
if (manifest.demoUsers.length) console.log(`  renamed legacy demo accounts: ${manifest.demoUsers.map((d) => `${d.originalEmail} -> ${d.email}`).join(", ")}`);
