// send-push: delivers one `notifications` row to its owner as a phone push (Expo) AND an email (Gmail SMTP).
// Called by the trg_push_notification database trigger (migration 019) with { notification_id }.
// Deploy with --no-verify-jwt: the caller is the database, authenticated by the x-webhook-secret header.
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Kinds that are not worth an email (internal / noisy).
const NO_EMAIL = new Set(["ai", "job", "storage"]);

/**
 * A campus announcement fans out to one notification per active user (migration 022), and this
 * function runs once per notification -- so emailing them means one SMTP message per student for a
 * single announcement. Gmail allows a few hundred a day, so one campus-wide post would blow the
 * quota and then silently take down email for everything else that day, class announcements included.
 * Push and the in-app Alerts tab still deliver every one of them.
 *
 * The marker is the `meta` that migration 022 sets, which no other notification uses. Set
 * EMAIL_CAMPUS_ANNOUNCEMENTS=true to email them anyway (safe only on a Workspace account with
 * headroom for the whole campus).
 */
const CAMPUS_META = "Campus announcement";
const emailCampus = (Deno.env.get("EMAIL_CAMPUS_ANNOUNCEMENTS") ?? "").toLowerCase() === "true";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const SMTP_USER = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
const mailer = SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: SMTP_USER, pass: SMTP_PASS } })
  : null;

type Notif = { id: string; user_id: string; kind: string; title: string; body: string; link_params: { meta?: string } | null };

// Compare fixed-length digests, so neither the comparison nor an early return tells the caller
// anything about the secret -- not even its length.
const encoder = new TextEncoder();
async function sameSecret(a: string, b: string): Promise<boolean> {
  const [da, dbg] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(dbg);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const EXPO_BATCH = 100; // Expo rejects a request carrying more than 100 messages

async function sendBatch(n: Notif, tokens: readonly string[]): Promise<string[]> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(
      tokens.map((token) => ({
        to: token,
        title: n.title,
        body: n.body || undefined,
        sound: "default",
        channelId: "default",
        priority: "high",
        data: { notificationId: n.id, kind: n.kind },
      })),
    ),
  });
  if (!res.ok) throw new Error(`expo ${res.status}`);

  // Drop tokens Expo says no longer exist (app uninstalled) so they are not retried forever.
  // Tickets come back positionally, but never index into `tokens` on trust: a short or reshaped
  // array would otherwise throw here and lose the whole push for everyone in the batch.
  const body = (await res.json().catch(() => null)) as { data?: { status?: string; details?: { error?: string } }[] } | null;
  const tickets = Array.isArray(body?.data) ? body.data : [];
  const dead: string[] = [];
  tickets.forEach((tk, i) => {
    const token = tokens[i];
    if (token && tk?.status === "error" && tk.details?.error === "DeviceNotRegistered") dead.push(token);
  });
  return dead;
}

async function sendPush(n: Notif): Promise<void> {
  const { data: rows } = await supabase.from("push_tokens").select("token").eq("user_id", n.user_id);
  const tokens = (rows ?? []).map((r) => r.token);
  if (!tokens.length) return;

  const dead: string[] = [];
  const failures: unknown[] = [];
  for (let i = 0; i < tokens.length; i += EXPO_BATCH) {
    // One bad batch must not cost the others their notification.
    try {
      dead.push(...(await sendBatch(n, tokens.slice(i, i + EXPO_BATCH))));
    } catch (e) {
      failures.push(e);
    }
  }
  if (dead.length) await supabase.from("push_tokens").delete().in("token", dead);
  if (failures.length) throw new Error(`expo: ${failures.length} of ${Math.ceil(tokens.length / EXPO_BATCH)} batches failed`);
}

async function sendEmail(n: Notif): Promise<void> {
  if (!mailer || NO_EMAIL.has(n.kind)) return;
  if (!emailCampus && n.link_params?.meta === CAMPUS_META) return;
  const { data: user } = await supabase.from("users").select("email, full_name, status, deleted_at, role").eq("id", n.user_id).maybeSingle();
  // The admin inbox (registrations, failures) is read in the portal; do not email it.
  if (!user || user.role === "admin" || user.status !== "active" || user.deleted_at) return;

  const meta = n.link_params?.meta ? `<p style="margin:0 0 8px;color:#6b7280;font-size:13px">${esc(n.link_params.meta)}</p>` : "";
  const body = n.body ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${esc(n.body)}</p>` : "";
  await mailer.sendMail({
    from: `"Studia" <${SMTP_USER}>`,
    to: user.email,
    subject: n.title,
    text: [n.link_params?.meta, n.title, n.body, "", "Open the Studia app to see more."].filter(Boolean).join("\n"),
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#111827">
      ${meta}<h2 style="margin:0 0 12px;font-size:18px">${esc(n.title)}</h2>${body}
      <p style="margin:0;color:#6b7280;font-size:13px">Hi ${esc(user.full_name)}, open the Studia app to see more.</p></div>`,
  });
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";
  if (req.method !== "POST" || !secret || !(await sameSecret(req.headers.get("x-webhook-secret") ?? "", secret))) {
    return new Response("forbidden", { status: 403 });
  }

  const { notification_id } = await req.json().catch(() => ({}));
  if (typeof notification_id !== "string") return new Response("bad request", { status: 400 });

  const { data: n } = await supabase
    .from("notifications")
    .select("id, user_id, kind, title, body, link_params")
    .eq("id", notification_id)
    .maybeSingle();
  if (!n) return new Response("gone", { status: 200 });

  // Independent channels: a failing email must not block the push, and vice versa.
  const results = await Promise.allSettled([sendPush(n as Notif), sendEmail(n as Notif)]);
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(i === 0 ? "push failed" : "email failed", r.reason);
  });
  return new Response("ok", { status: 200 });
});
