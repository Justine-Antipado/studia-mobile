// Campus-wide announcements: send / delete. The admin's own Supabase session can only READ
// public.platform_announcements (migration 023); every write goes through here with the service role,
// after the caller's token is verified and the account is confirmed to be an active administrator.
// Inserting a row makes the database fan one `notice` notification out to every recipient (migration 022).
import { z } from "zod";
import { adminClient } from "../../src/lib/clients.js";
import { ApiError, endpoint } from "../../src/lib/http.js";
import { requireMe } from "../../src/lib/me.js";

const COURSES = ["BSIT", "BEED", "BSBA-FM", "BSBA-OM"] as const;

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().trim().min(1, "Title is required.").max(140, "Keep it under 140 characters."),
    body: z.string().trim().min(1, "Message is required.").max(500, "Keep it under 500 characters."),
    audience: z.enum(["all", "students", "instructors", "course"]),
    course: z.enum(COURSES).nullish(),
  }),
  z.object({ action: z.literal("delete"), ids: z.array(z.string().min(1).max(64)).min(1).max(100) }),
]);

export default endpoint(Body, async (input, req) => {
  const db = adminClient();
  const { profile } = await requireMe(db, req);
  // Same answer as a bad token: do not reveal that this endpoint exists for admins only.
  if (profile.role !== "admin") throw new ApiError("UNAUTHORIZED", "Please sign in again.");

  if (input.action === "delete") {
    const { error } = await db.from("platform_announcements").delete().in("id", input.ids);
    if (error) throw error;
    return { deleted: input.ids.length };
  }

  if (input.audience === "course" && !input.course) {
    throw new ApiError("VALIDATION", "Select a course.", { fields: { course: "Select a course." } });
  }
  const { data, error } = await db
    .from("platform_announcements")
    .insert({
      author_id: profile.id,
      title: input.title,
      body: input.body,
      audience: input.audience,
      course: input.audience === "course" ? input.course! : null,
    })
    .select("id, title, body, audience, course, recipients, created_at")
    .single();
  if (error) throw error;
  // `recipients` is written by the trigger after the insert; read the final row.
  const fresh = await db
    .from("platform_announcements")
    .select("id, title, body, audience, course, recipients, created_at")
    .eq("id", data.id)
    .single();
  return { announcement: fresh.data ?? data };
});
