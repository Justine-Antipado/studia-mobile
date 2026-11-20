// Phase 3 checks on the REAL migrations (PGlite): domain hook, signup metadata trigger, Google profile
// flag, column grants. Run: node rls/auth.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const migDir = join(here, "..", "..", "migrations");
const db = new PGlite();
await db.exec(readFileSync(join(here, "stubs.sql"), "utf8"));
for (const f of readdirSync(migDir).filter((n) => n.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(migDir, f), "utf8"));
}

let pass = 0;
const fails = [];
const check = (name, ok, extra = "") => (ok ? pass++ : fails.push(`${name} ${extra}`));
const hook = async (email) =>
  (await db.query(`select private.hook_before_user_created($1::jsonb) as r`, [JSON.stringify({ user: { email } })])).rows[0].r;

// ---- domain hook
for (const good of ["juan@gmail.com", "juan@omsu.edu.ph", "  Juan.Dela@OMSU.edu.ph ", "a+b@omsu.edu.ph"])
  check(`hook allows ${good}`, Object.keys(await hook(good)).length === 0);
for (const bad of ["a@omsc.edu.ph", "a@yahoo.com", "a@gmail.com.evil.com", "a@omsu.edu.ph.evil.com", "a@x.omsu.edu.ph", "", "a b@omsu.edu.ph"]) {
  const r = await hook(bad);
  check(`hook rejects "${bad}"`, r.error?.http_code === 400, JSON.stringify(r));
}
check("hook missing email rejects", (await db.query(`select private.hook_before_user_created('{}'::jsonb) as r`)).rows[0].r.error !== undefined);

// ---- anon/authenticated cannot call the hook
for (const role of ["anon", "authenticated"]) {
  await db.exec("begin");
  let denied = false;
  try {
    await db.exec(`set local role ${role}`);
    await db.query(`select private.hook_before_user_created('{}'::jsonb)`);
  } catch (e) {
    denied = e.code === "42501";
  }
  await db.exec("rollback");
  check(`${role} cannot execute hook`, denied);
}

// ---- trigger: email signup carries role + campus fields; hostile metadata is ignored
const mk = async (id, email, meta, app = { provider: "email" }) => {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3, $4)`, [
    id, email, JSON.stringify(meta), JSON.stringify(app),
  ]);
  return (await db.query(`select * from public.users where id = $1`, [id])).rows[0];
};

const s = await mk("00000000-0000-0000-0000-0000000000a1", "stu@omsu.edu.ph",
  { role: "student", full_name: "Stu Dent", course: "BSIT", year: "3", section: "A", phone: "+639171234567", department: "IT" });
check("student fields", s.role === "student" && s.course === "BSIT" && s.year_level === "3" && s.section === "A" && s.phone === "+639171234567");
check("student ignores department", s.department === null);
check("email signup profile_completed", s.profile_completed === true && s.auth_provider === "password");

const i = await mk("00000000-0000-0000-0000-0000000000a2", "ins@omsu.edu.ph",
  { role: "instructor", full_name: "In Structor", department: "IT", course: "BSIT" });
check("instructor dept, no course", i.role === "instructor" && i.department === "IT" && i.course === null);

const admin = await mk("00000000-0000-0000-0000-0000000000a3", "evil@omsu.edu.ph", { role: "admin", full_name: "Evil" });
check("metadata can never grant admin", admin.role === "student");

const junk = await mk("00000000-0000-0000-0000-0000000000a4", "junk@omsu.edu.ph",
  { role: "student", full_name: "  ", course: "DROP", year: "9", section: "Z", phone: "12345" });
check("invalid enum/phone metadata -> null, signup still works",
  junk.course === null && junk.year_level === null && junk.section === null && junk.phone === null && junk.full_name === "junk");

const g = await mk("00000000-0000-0000-0000-0000000000a5", "goo@omsu.edu.ph",
  { name: "Goo Gle", role: "instructor" }, { provider: "google" });
check("google: profile incomplete, provider google, name from google", g.profile_completed === false && g.auth_provider === "google" && g.full_name === "Goo Gle");

// ---- client cannot escalate: role / status / profile_completed are not updatable by the user
for (const col of ["role = 'admin'", "status = 'active'", "profile_completed = true", "email = 'x@omsu.edu.ph'"]) {
  await db.exec("begin");
  let denied = false;
  try {
    await db.exec(`set local role authenticated`);
    await db.query(`select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true)`);
    await db.query(`update public.users set ${col} where id = '00000000-0000-0000-0000-0000000000a5'`);
  } catch (e) {
    denied = e.code === "42501";
  }
  await db.exec("rollback");
  check(`authenticated cannot update ${col}`, denied);
}

// ---- OTP counters: at most 5 attempts, service role only
await db.exec("begin");
let capped = false;
try {
  await db.query(`insert into public.otp_codes (email, purpose, expires_at, attempts) values ('a@omsu.edu.ph','signup', now() + interval '5 min', 6)`);
} catch { capped = true; }
await db.exec("rollback");
check("otp attempts capped at 5", capped);
await db.exec("begin");
let otpDenied = false;
try {
  await db.exec(`set local role authenticated`);
  await db.query(`select * from public.otp_codes`);
} catch (e) { otpDenied = e.code === "42501"; }
await db.exec("rollback");
check("authenticated cannot read otp_codes", otpDenied);

console.log(`AUTH: ${pass}/${pass + fails.length} checks passed`);
if (fails.length) {
  console.log(fails.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
