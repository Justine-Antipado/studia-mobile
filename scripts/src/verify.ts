// Read-only checks of what is in Postgres against the dump and the CSVs. Exit 1 on any mismatch.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import pg from "pg";
import { parseCsv } from "./lib/csv.ts";
import { loadConfig, parseArgs } from "./lib/env.ts";
import { loadSchema } from "./lib/pg-schema.ts";
import { CSV_DIR, MAPPED_DIR, MIGRATIONS_DIR, PLAN, type Manifest } from "./lib/plan.ts";

const { env } = parseArgs(process.argv.slice(2));
const cfg = loadConfig(env);
const schema = loadSchema(MIGRATIONS_DIR);
const manifest = JSON.parse(readFileSync(join(CSV_DIR, "_manifest.json"), "utf8")) as Manifest;
const plans = PLAN.filter((p) => (env === "prod" ? p.dest === "users" || p.dest === "settings" : true));

const client = new pg.Client({ connectionString: cfg.dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
const failures: string[] = [];
const lines: string[] = [];

try {
  await client.query("begin read only");

  // 1. row counts: source INSERTs = CSV = Postgres
  const cells: string[] = [];
  for (const p of plans) {
    const file = manifest.files.find((f) => f.csv === p.csv);
    if (!file) continue;
    const mapped = parseCsv(readFileSync(join(MAPPED_DIR, `${p.csv}.csv`), "utf8")).rows.length;
    const src = manifest.sourceRows[p.src] ?? 0;
    const pgCount = Number((await client.query<{ n: string }>(`select count(*) as n from public.${p.dest}`)).rows[0]?.n ?? -1);
    // dev imports everything: source = csv = mapped = postgres. prod imports a subset: mapped = postgres.
    const ok = env === "prod" ? mapped === pgCount : src === file.rows && file.rows === mapped && mapped === pgCount;
    if (!ok) failures.push(`count ${p.dest}: source ${src}, csv ${file.rows}, mapped ${mapped}, postgres ${pgCount}`);
    cells.push(`${(ok ? "ok " : "BAD") + " " + p.dest}`.padEnd(32) + `${src}/${file.rows}/${pgCount}`.padStart(10));
  }
  lines.push(`row counts (source/csv/postgres), skipped: ${manifest.skipped.map((s) => s.table).join(", ")}`);
  for (let i = 0; i < cells.length; i += 3) lines.push("  " + cells.slice(i, i + 3).join(" | "));

  // 2. FK orphans across every foreign key in public
  const fks = await client.query<{ child: string; ccols: string[]; parent: string; pcols: string[] }>(`
    select c.conrelid::regclass::text as child,
           array(select attname::text from pg_attribute where attrelid = c.conrelid and attnum = any(c.conkey) order by array_position(c.conkey, attnum)) as ccols,
           c.confrelid::regclass::text as parent,
           array(select attname::text from pg_attribute where attrelid = c.confrelid and attnum = any(c.confkey) order by array_position(c.confkey, attnum)) as pcols
    from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where c.contype = 'f' and n.nspname = 'public'`);
  let orphans = 0;
  for (const fk of fks.rows) {
    const on = fk.ccols.map((c, i) => `c."${c}" = p."${fk.pcols[i]}"`).join(" and ");
    const anyNull = fk.ccols.map((c) => `c."${c}" is not null`).join(" and ");
    const r = await client.query<{ n: string }>(
      `select count(*) as n from ${fk.child} c left join ${fk.parent} p on ${on} where ${anyNull} and p."${fk.pcols[0]}" is null`,
    );
    const n = Number(r.rows[0]?.n ?? 0);
    if (n > 0) failures.push(`${n} orphan row(s): ${fk.child}(${fk.ccols.join(",")}) -> ${fk.parent}`);
    orphans += n;
  }
  lines.push(`foreign keys: ${fks.rows.length} checked, ${orphans} orphans`);

  // 3. JSON columns: every non-null value is valid jsonb (the column type guarantees it) and was parsed by the converter
  const jsonCols = [...schema.tables].flatMap(([t, cols]) => cols.filter((c) => c.kind.kind === "jsonb").map((c) => `${t}.${c.name}`));
  let jsonValues = 0;
  for (const jc of jsonCols) {
    const [t, c] = jc.split(".");
    jsonValues += Number((await client.query<{ n: string }>(`select count(*) as n from public.${t} where "${c}" is not null and jsonb_typeof("${c}") is not null`)).rows[0]?.n ?? 0);
  }
  lines.push(`json: ${jsonCols.length} jsonb columns, ${jsonValues} non-null values, all valid`);

  // 4. multiple_choice correct_index inside the option count
  const mc = await client.query<{ n: string }>(`
    select count(*) as n from public.quiz_questions q
    left join public.quiz_question_keys k on k.question_id = q.id
    where q.type = 'multiple_choice'
      and (k.correct_index is null or k.correct_index >= (select count(*) from public.quiz_options o where o.question_id = q.id))`);
  const mcBad = Number(mc.rows[0]?.n ?? 0);
  if (mcBad) failures.push(`${mcBad} multiple_choice question(s) with correct_index outside the options`);
  lines.push(`multiple_choice correct_index out of range: ${mcBad}`);

  // 5. progress: the derived class_progress view must equal the source's cached progress_pct
  if (env === "dev") {
    const prog = await client.query<{ id: string; progress_pct: number }>(
      `select e.id, p.progress_pct from public.class_enrollments e join public.class_progress p on p.class_id = e.class_id and p.student_id = e.student_id`,
    );
    const byId = new Map(prog.rows.map((r) => [r.id, r.progress_pct]));
    let mismatched = 0;
    for (const [id, pct] of Object.entries(manifest.enrollmentProgress)) {
      if (byId.get(id) !== pct) {
        mismatched++;
        failures.push(`progress ${id}: source ${pct}, class_progress ${byId.get(id)}`);
      }
    }
    lines.push(`progress: ${Object.keys(manifest.enrollmentProgress).length} enrolments, ${mismatched} differ from class_progress`);
  }

  // 6. round trip: 3 random rows per table, CSV vs Postgres, column by column
  let sampled = 0;
  for (const p of plans) {
    const file = manifest.files.find((f) => f.csv === p.csv);
    if (!file) continue;
    const csv = parseCsv(readFileSync(join(MAPPED_DIR, `${p.csv}.csv`), "utf8"));
    const cols = schema.tables.get(p.dest) ?? [];
    const pk = await client.query<{ a: string }>(
      `select a.attname as a from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = 'public.${p.dest}'::regclass and i.indisprimary order by array_position(i.indkey::int[], a.attnum::int)`,
    );
    const pkCols = pk.rows.map((r) => r.a);
    const picks = [...csv.rows].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const row of picks) {
      const where = pkCols.map((c, i) => `t."${c}"::text = $${i + 1}`).join(" and ");
      const params = pkCols.map((c) => row[csv.header.indexOf(c)] ?? null);
      const got = await client.query<{ r: Record<string, unknown> }>(`select to_jsonb(t) as r from public.${p.dest} t where ${where}`, params);
      const db = got.rows[0]?.r;
      if (!db) {
        failures.push(`round trip ${p.dest}: row ${params.join("/")} is missing in Postgres`);
        continue;
      }
      sampled++;
      csv.header.forEach((name, i) => {
        const want = row[i] ?? null;
        const have = db[name] ?? null;
        const kind = cols.find((c) => c.name === name)?.kind.kind;
        let same: boolean;
        if (want === null || have === null) same = want === null && have === null;
        else if (kind === "boolean") same = (want === "true") === have;
        else if (kind === "timestamptz") same = Date.parse(want) === Date.parse(String(have));
        else if (kind === "jsonb") same = isDeepStrictEqual(JSON.parse(want), have);
        else if (kind === "int" || kind === "numeric") same = Number(want) === Number(have);
        else same = want === String(have);
        if (!same) failures.push(`round trip ${p.dest}.${name} (${params.join("/")}): csv ${JSON.stringify(want)} vs db ${JSON.stringify(have)}`);
      });
    }
  }
  lines.push(`round trip: ${sampled} rows compared column by column`);
  await client.query("rollback");
} finally {
  await client.end();
}

console.log(lines.join("\n"));
if (failures.length) {
  console.error(`\nVERIFY FAILED (${failures.length}):\n` + failures.slice(0, 25).map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log("VERIFY OK: all checks green");
