// send-push: delivers one `notifications` row to the owner's devices through Expo's push service.
// Called by the trg_push_notification database trigger (migration 019) with { notification_id }.
// Deploy with --no-verify-jwt: the caller is the database, authenticated by the x-webhook-secret header.
import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
    .select("id, user_id, kind, title, body")
    .eq("id", notification_id)
    .maybeSingle();
  if (!n) return new Response("gone", { status: 200 });

  const { data: tokens } = await supabase.from("push_tokens").select("token").eq("user_id", n.user_id);
  if (!tokens?.length) return new Response("no devices", { status: 200 });

  const messages = tokens.map((t) => ({
    to: t.token,
    title: n.title,
    body: n.body || undefined,
    sound: "default",
    channelId: "default",
    data: { notificationId: n.id, kind: n.kind },
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
  if (!res.ok) return new Response("expo error", { status: 502 });

  // Drop tokens Expo says no longer exist (app uninstalled) so they are not retried forever.
  const { data: tickets } = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
  const dead = (tickets ?? [])
    .map((tk, i) => (tk.status === "error" && tk.details?.error === "DeviceNotRegistered" ? tokens[i].token : null))
    .filter((t): t is string => t !== null);
  if (dead.length) await supabase.from("push_tokens").delete().in("token", dead);

  return new Response("ok", { status: 200 });
});
