// video-link.ts — parse and validate a lesson video LINK (video lessons are links, not uploads).
//
// Rules (the server repeats them; the client copy is only for fast feedback):
//   - https only, no embedded credentials, length-capped, no localhost / raw IP hosts
//   - YouTube (youtube.com/watch?v=, /shorts/, /embed/, /live/, m.youtube.com, youtu.be/) is
//     recognised and reduced to its 11-character video id, so the app builds its OWN thumbnail and
//     watch URLs and never renders a user-supplied URL inside a WebView
//   - any other https host is accepted as a plain "open link" and is never embedded
import type { VideoLink } from "@/core/types/content";

export const MAX_LINK_LENGTH = 2048;

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export type LinkParse = { ok: true; link: VideoLink } | { ok: false; error: string };

function youtubeId(u: URL): string | null {
  const host = u.hostname.toLowerCase();
  if (host === "youtu.be") return u.pathname.split("/")[1] ?? null;
  if (u.pathname === "/watch") return u.searchParams.get("v");
  const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
  return m ? (m[2] ?? null) : null;
}

export function parseVideoLink(raw: string): LinkParse {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Paste the video link." };
  if (text.length > MAX_LINK_LENGTH) return { ok: false, error: "That link is too long." };

  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, error: "That doesn't look like a link. Include https://" };
  }
  if (u.protocol !== "https:") return { ok: false, error: "Only secure https:// links are allowed." };
  if (u.username || u.password) return { ok: false, error: "Links with a username or password are not allowed." };

  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || IPV4.test(host) || host.includes(":") || !host.includes(".")) {
    return { ok: false, error: "Use a public website link." };
  }

  if (YOUTUBE_HOSTS.has(host)) {
    const id = youtubeId(u);
    if (!id || !VIDEO_ID.test(id)) return { ok: false, error: "That YouTube link has no valid video. Copy it from the Share button." };
    return { ok: true, link: { provider: "youtube", videoId: id, url: `https://www.youtube.com/watch?v=${id}` } };
  }

  return { ok: true, link: { provider: "other", videoId: null, url: u.toString() } };
}

/** Thumbnail for a YouTube link, built by us from the validated id (never from user input). */
export const youtubeThumbnail = (videoId: string) => `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
