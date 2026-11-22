// Applies a profile edit once the emailed code is verified. Role, email and status can never change here.
import { z } from "zod";
import { adminClient } from "../../src/lib/clients.js";
import { toProfileDto } from "../../src/lib/auth-core.js";
import { ApiError, endpoint } from "../../src/lib/http.js";
import { requireMe, spendCode } from "../../src/lib/me.js";
import { normalizePhone } from "../../src/lib/policy.js";

const Body = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
  fullName: z.string().transform((v) => v.trim().replace(/\s+/g, " ")).pipe(z.string().min(2, "Enter your full name.").max(80)),
  phone: z.string().max(20).optional().default(""),
  course: z.enum(["BSIT", "BEED", "BSBA-FM", "BSBA-OM"]).optional(),
  year: z.enum(["1", "2", "3", "4"]).optional(),
  section: z.enum(["A", "B", "C", "D", "E"]).optional(),
  department: z.enum(["FM", "OM", "IT", "ED"]).optional(),
});

export default endpoint(Body, async (b, req) => {
  const db = adminClient();
  const { user, profile, email } = await requireMe(db, req);
  const phone = normalizePhone(b.phone);
  if (phone === null) {
    throw new ApiError("VALIDATION", "Please fix the highlighted fields.", { fields: { phone: "Enter a valid PH mobile number." } });
  }

  const student = profile.role === "student";
  if (student && !(b.course && b.year && b.section)) throw new ApiError("VALIDATION", "Choose your course, year and section.");
  if (!student && !b.department) throw new ApiError("VALIDATION", "Choose your department.");

  await spendCode(db, email, "profile_update", b.code);

  const { data, error } = await db
    .from("users")
    .update({
      full_name: b.fullName,
      phone: phone || null,
      course: student ? (b.course ?? null) : null,
      year_level: student ? (b.year ?? null) : null,
      section: student ? (b.section ?? null) : null,
      department: student ? null : (b.department ?? null),
    })
    .eq("id", profile.id)
    .select("*")
    .single();
  if (error) throw error;
  return { profile: toProfileDto(data, user) };
});
