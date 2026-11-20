// RLS test runner: the REAL migrations on PGlite (Postgres compiled to WASM), no Docker needed.
//   node rls/run.mjs [--upto N]     (N = highest migration number to apply, to test an older state)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildCases, TABLES, VIEWS } from "./cases.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const migDir = join(here, "..", "..", "migrations");
const uptoArg = process.argv.indexOf("--upto");
const upto = uptoArg > -1 ? Number(process.argv[uptoArg + 1]) : Infinity;

const db = new PGlite();
await db.exec(readFileSync(join(here, "stubs.sql"), "utf8"));
for (const f of readdirSync(migDir).filter((n) => n.endsWith(".sql")).sort()) {
  if (Number(f.slice(12, 14)) > upto) continue; // 202601010000NN_name.sql
  await db.exec(readFileSync(join(migDir, f), "utf8"));
}
await db.exec(readFileSync(join(here, "fixtures.sql"), "utf8"));

/** Runs `pre` as superuser, then `sql` as the persona, in a transaction that is always rolled back. */
async function attempt({ role, uid }, pre, sql) {
  await db.exec("begin");
  try {
    if (pre) await db.exec(pre);
    await db.exec(`set local role ${role}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ""]);
    const r = await db.query(sql);
    return { n: r.rows.length, rows: r.rows };
  } catch (e) {
    return { err: e.code ?? "?", msg: String(e.message).split("\n")[0] };
  } finally {
    await db.exec("rollback");
  }
}

const cases = buildCases();
let pass = 0;
const fail = [];
for (const c of cases) {
  const r = await attempt(c.persona, c.pre, c.sql);
  let ok;
  if (c.exp === "D") ok = r.err === "42501"; // must be refused outright (no privilege / RLS violation)
  else if (c.exp === "E") ok = !!r.err; // any error
  else if (c.op === "select" || c.op === "rpc") ok = !r.err && r.n === c.exp;
  else ok = c.exp === 0 ? r.err === "42501" || (!r.err && r.n === 0) : !r.err && r.n === c.exp; // 0 = blocked either way
  if (ok) pass++;
  else fail.push(`${c.table}.${c.op} [${c.label}] as ${c.persona.name}: expected ${c.exp}, got ${r.err ? `${r.err} ${r.msg}` : r.n}`);
}

// ---- structural checks
const meta = [];
const t = await db.query(
  `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'`,
);
const noRls = t.rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
if (noRls.length) meta.push(`RLS disabled on: ${noRls.join(", ")}`);
const uncovered = t.rows.map((r) => r.relname).filter((n) => !TABLES.includes(n));
if (uncovered.length) meta.push(`tables with no test cases: ${uncovered.join(", ")}`);
const anonPriv = await db.query(
  `select table_name, privilege_type from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'`,
);
if (anonPriv.rows.length) meta.push(`anon holds ${anonPriv.rows.length} table privilege(s), e.g. ${anonPriv.rows[0].table_name}:${anonPriv.rows[0].privilege_type}`);
const sobj = await db.query(`select count(*)::int n from pg_policies where schemaname = 'storage' and tablename = 'objects'`);
if (sobj.rows[0].n) meta.push(`storage.objects has ${sobj.rows[0].n} client polic(ies); uploads must go through signed URLs`);

const adm = await db.query(`select tablename, policyname from pg_policies where schemaname in ('public','storage')
  and (coalesce(qual,'') || coalesce(with_check,'')) ilike '%is_admin%'`);
for (const r of adm.rows) meta.push(`policy ${r.tablename}.${r.policyname} still grants admin direct access`);
const fnAdm = await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname <> 'is_admin' and p.prosrc ilike '%is_admin()%'`);
for (const r of fnAdm.rows) meta.push(`private.${r.proname}() still short-circuits on is_admin()`);
// sign-up metadata can never mint an admin
await db.exec(`insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('b0000000-0000-0000-0000-000000000001','evil@omsu.edu.ph','{"role":"admin","full_name":"Evil"}','{}'),
  ('b0000000-0000-0000-0000-000000000002','legit@omsu.edu.ph','{"role":"instructor","full_name":"Ok"}','{}')`);
const roles = await db.query(`select email, role from public.users where id::text like 'b0000000%' order by email`);
if (roles.rows.find((r) => r.email === "evil@omsu.edu.ph")?.role !== "student") meta.push("sign-up metadata role=admin was honoured");
if (roles.rows.find((r) => r.email === "legit@omsu.edu.ph")?.role !== "instructor") meta.push("sign-up metadata role=instructor not applied");

console.log(`RLS: ${pass}/${cases.length} cases passed; ${TABLES.length} tables + ${VIEWS.length} views covered${upto < Infinity ? ` (migrations <= ${upto})` : ""}`);
for (const m of meta) console.log("STRUCT FAIL:", m);
for (const f of fail) console.log("FAIL:", f);
process.exit(fail.length || meta.length ? 1 : 0);
