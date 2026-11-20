import { z } from "zod";
import { adminClient, anonClient } from "../../src/lib/clients.js";
import { ApiError, clientIp, endpoint } from "../../src/lib/http.js";
import { assertCanSendOtp, recordOtpSent } from "../../src/lib/auth-core.js";
import { isCampusEmail, isStrongPassword, normalizeEmail, normalizePhone } from "../../src/lib/policy.js";

const COURSES = ["BSIT", "BEED", "BSBA-FM", "BSBA-OM"] as const;
const DEPTS = ["FM", "OM", "IT", "ED"] as const;

const Body = z
  .object({
    role: z.enum(["student", "instructor"]),
    fullName: z.string().transform((v) => v.trim().replace(/\s+/g, " ")).pipe(z.string().min(2, "Enter your full name.").max(80)),
    email: z.string().max(254).transform(normalizeEmail).refine(isCampusEmail, "Use a Gmail (@gmail.com) or @omsu.edu.ph email."),
    password: z.string().max(64).refine(isStrongPassword, "Password does not meet all requirements."),
    course: z.enum(COURSES).optional(),
    year: z.enum(["1", "2", "3", "4"]).optional(),
    section: z.enum(["A", "B", "C", "D", "E"]).optional(),
    department: z.enum(DEPTS).optional(),
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
    } else {
      need("department", "Choose your department.");
    }
    if (normalizePhone(v.phone) === null) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid PH mobile number." });
    }
  });

export default endpoint(Body, async (b, req) => {
  const db = adminClient();
  await assertCanSendOtp(db, b.email, "signup");

  const { data, error } = await anonClient().auth.signUp({
    email: b.email,
    password: b.password,
    options: {
      data: {
        role: b.role,
        full_name: b.fullName,
        course: b.course,
        year: b.year,
        section: b.section,
        department: b.department,
        phone: normalizePhone(b.phone) || undefined,
      },
    },
  });

  if (error) {
    if (error.code === "user_already_exists") throw emailTaken();
    if (error.code === "weak_password") {
      throw new ApiError("VALIDATION", "Please fix the highlighted fields.", {
        fields: { password: "Password does not meet all requirements." },
      });
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      throw new ApiError("RATE_LIMITED", "Too many attempts. Try again in a moment.", { retryAfterSec: 60 });
    }
    if (error.status === 400 && /gmail\.com|omsu\.edu\.ph/i.test(error.message)) {
      throw new ApiError("VALIDATION", "Please fix the highlighted fields.", {
        fields: { email: "Use a Gmail (@gmail.com) or @omsu.edu.ph email." },
      });
    }
    throw error;
  }
  // With confirmations on, Auth answers an already-registered, verified email with an obfuscated user
  // that has no identities. Trade-off (same as the mock): the spec asks us to tell the user it is taken.
  if (data.user?.identities?.length === 0) throw emailTaken();

  return recordOtpSent(db, b.email, "signup", clientIp(req));
});

function emailTaken(): ApiError {
  return new ApiError("EMAIL_TAKEN", "An account with this email already exists. Try logging in.", {
    fields: { email: "This email is already registered." },
  });
}
