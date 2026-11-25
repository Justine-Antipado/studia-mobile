// Google sign-up, last step: role + campus details. Only reachable with the session minted by a
// verified google_signup code, and only once (profile_completed flips to true).
// The client cannot write `role` itself (column grants), so this is the single place it is set.
import { z } from "zod";
import { adminClient } from "../../src/lib/clients.js";
import { ApiError, bearer, endpoint } from "../../src/lib/http.js";
import { getProfile, toProfileDto } from "../../src/lib/auth-core.js";
import { normalizePhone } from "../../src/lib/policy.js";

const Body = z
  .object({
    role: z.enum(["student", "instructor"]),
    fullName: z.string().transform((v) => v.trim().replace(/\s+/g, " ")).pipe(z.string().min(2, "Enter your full name.").max(80)),
    course: z.enum(["BSIT", "BEED", "BSBA-FM", "BSBA-OM"]).optional(),
    year: z.enum(["1", "2", "3", "4"]).optional(),
    section: z.enum(["A", "B", "C", "D", "E"]).optional(),
    department: z.enum(["FM", "OM", "IT", "ED"]).optional(),
    phone: z.string().max(20).optional().default(""),
  })
  .superRefine((v, ctx) => {
    const need = (k: "course" | "year" | "section" | "department", msg: string) => {
      if (!v[k]) ctx.addIssue({ code: "custom", path: [k], message: msg });
    };
    if (v.role === "student") {
      need("course", "Choose your course.");
      need("year", "Choose your year level.");
      need("section", "Choose your section.");
    } else need("department", "Choose your department.");
    if (normalizePhone(v.phone) === null) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid PH mobile number." });
    }
  });

/**
 * A Google sign-up that asks to be an instructor waits for an admin, exactly like a password sign-up
 * (migration 030 applies the same rule in private.handle_new_user). This is the only place `role` is
 * ever set from a request, so without it the Google door would still hand out instructor accounts.
 * The admin approves from the portal's Users page, which calls admin_set_user_active(ids, true).
 */
const REQUIRE_INSTRUCTOR_APPROVAL = true;

export default endpoint(Body, async (b, req) => {
  const db = adminClient();
  const { data, error } = await db.auth.getUser(bearer(req));
  if (error || !data.user) throw new ApiError("UNAUTHORIZED", "This session expired. Please start again.");

  const profile = await getProfile(db, data.user.id);
  if (!profile || profile.profile_completed) {
    throw new ApiError("EMAIL_TAKEN", "An account with this email already exists.");
  }
  if (profile.auth_provider !== "google") throw new ApiError("UNAUTHORIZED", "This session expired. Please start again.");

  const student = b.role === "student";
  const { data: updated, error: upErr } = await db
    .from("users")
    .update({
      role: b.role,
      full_name: b.fullName,
      course: student ? (b.course ?? null) : null,
      year_level: student ? (b.year ?? null) : null,
      section: student ? (b.section ?? null) : null,
      department: student ? null : (b.department ?? null),
      phone: normalizePhone(b.phone) || null,
      status: b.role === "instructor" && REQUIRE_INSTRUCTOR_APPROVAL ? "pending_approval" : "active",
      profile_completed: true,
    })
    .eq("id", profile.id)
    .eq("profile_completed", false) // single use even under concurrent calls
    .select("*")
    .single();
  // The guard above is what makes this single-use; the loser of a concurrent call matches no row and
  // PostgREST reports PGRST116. That is this endpoint's "already done", not a server fault.
  if (upErr) {
    if (upErr.code === "PGRST116") throw new ApiError("EMAIL_TAKEN", "An account with this email already exists.");
    throw upErr;
  }

  return { profile: toProfileDto(updated, data.user) };
});
