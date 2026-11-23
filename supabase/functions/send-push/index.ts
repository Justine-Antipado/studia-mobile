// send-push: delivers one `notifications` row to its owner as a phone push (Expo) AND an email (Gmail SMTP).
// Called by the trg_push_notification database trigger (migration 019) with { notification_id }.
// Deploy with --no-verify-jwt: the caller is the database, authenticated by the x-webhook-secret header.
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Kinds that are not worth an email (internal / noisy).
const NO_EMAIL = new Set(["ai", "job", "storage"]);

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const SMTP_USER = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
const mailer = SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: SMTP_USER, pass: SMTP_PASS } })
  : null;

type Notif = { id: string; user_id: string; kind: string; title: string; body: string; link_params: { meta?: string } | null };

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function sendPush(n: Notif): Promise<void> {
  const { data: tokens } = await supabase.from("push_tokens").select("token").eq("user_id", n.user_id);
  if (!tokens?.length) return;

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(
      tokens.map((t) => ({
        to: t.token,
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
  const { data: tickets } = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
  const dead = (tickets ?? [])
    .map((tk, i) => (tk.status === "error" && tk.details?.error === "DeviceNotRegistered" ? tokens[i].token : null))
    .filter((t): t is string => t !== null);
  if (dead.length) await supabase.from("push_tokens").delete().in("token", dead);
}

async function sendEmail(n: Notif): Promise<void> {
  if (!mailer || NO_EMAIL.has(n.kind)) return;
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
  if (req.method !== "POST" || !secret || !sameSecret(req.headers.get("x-webhook-secret") ?? "", secret)) {
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
