// Profile photo: get / set / remove. Stored in the private avatars bucket under "<user id>/<name>"
// (migration 015); the client only ever receives a short-lived signed URL. The real file type is
// sniffed from the bytes (JPEG or PNG), never trusted from the request.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { adminClient, type Db } from "../../src/lib/clients.js";
import { ApiError, endpoint } from "../../src/lib/http.js";
import { requireMe } from "../../src/lib/me.js";

const MAX_BYTES = 2 * 1024 * 1024;
const URL_TTL_SEC = 60 * 60 * 24;

const Body = z.object({
  action: z.enum(["get", "set", "remove"]),
  data: z.string().max(3_000_000).optional(), // base64 image bytes
});

function sniff(b: Buffer): { ext: "jpg" | "png"; type: string } | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: "png", type: "image/png" };
  }
  return null;
}

async function signed(db: Db, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from("avatars").createSignedUrl(path, URL_TTL_SEC);
  return data?.signedUrl ?? null;
}

export default endpoint(Body, async ({ action, data }, req) => {
  const db = adminClient();
  const { profile } = await requireMe(db, req);

  if (action === "get") return { url: await signed(db, profile.avatar_path) };

  if (action === "remove") {
    if (profile.avatar_path) await db.storage.from("avatars").remove([profile.avatar_path]);
    const { error } = await db.from("users").update({ avatar_path: null }).eq("id", profile.id);
    if (error) throw error;
    return { url: null };
  }

  const bytes = Buffer.from(data ?? "", "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new ApiError("VALIDATION", "That photo is too large. Choose a smaller one.");
  const kind = sniff(bytes);
  if (!kind) throw new ApiError("VALIDATION", "Only JPEG or PNG photos are allowed.");

  const path = `${profile.id}/${randomUUID()}.${kind.ext}`;
  const up = await db.storage.from("avatars").upload(path, bytes, { contentType: kind.type, upsert: false });
  if (up.error) throw up.error;
  const { error } = await db.from("users").update({ avatar_path: path }).eq("id", profile.id);
  if (error) {
    await db.storage.from("avatars").remove([path]).catch(() => undefined);
    throw error;
  }
  // The new photo is already the one on the profile, so a failure here costs nothing but a leftover
  // object in the bucket. Say which one, or the orphans accumulate with no way to find them.
  if (profile.avatar_path) {
    const { error: rmErr } = await db.storage.from("avatars").remove([profile.avatar_path]);
    if (rmErr) console.error("[avatar] orphaned previous object", profile.avatar_path);
  }
  return { url: await signed(db, path) };
});
