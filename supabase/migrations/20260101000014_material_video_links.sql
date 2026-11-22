-- 014 video links: a lesson VIDEO is a link (YouTube or any https page), not an uploaded file.
-- Uploads stay for documents and slides only (pdf / slide / doc, <= 50 MB, migration 012).
--
--   materials.video_url       canonical https URL (YouTube: https://www.youtube.com/watch?v=ID)
--   materials.video_provider  'youtube' | 'other'
--   materials.video_id        11-char YouTube id; the app builds thumbnail/watch URLs from it only
--   material_summaries.regen_count   AI re-runs for one cached summary, capped (each call costs money)
--
-- Safety rules enforced here (the API validates the same things first, with better messages):
--   * https only, no credentials in the URL, length <= 2048
--   * the YouTube id has the exact 11-character shape, so it can be interpolated into URLs safely
--   * the server never FETCHES an arbitrary video_url (SSRF); for YouTube it only asks the captions
--     API for video_id. Other hosts get no transcript ('failed') and the instructor pastes one.
--
-- Existing video rows (uploaded files) are left as they are: the constraints are NOT VALID, so they
-- apply to new and updated rows only. Re-add those lessons as links, then VALIDATE.

alter table public.materials
  add column video_url      text check (char_length(video_url) <= 2048),
  add column video_provider text check (video_provider in ('youtube', 'other')),
  add column video_id       text;

alter table public.materials
  add constraint materials_link_shape check (
    (video_url is null and video_provider is null and video_id is null)
    or (video_url ~ '^https://[^/@\s]+(/.*)?$'
        and video_provider is not null
        and ((video_provider = 'youtube' and video_id ~ '^[A-Za-z0-9_-]{11}$')
             or (video_provider = 'other' and video_id is null)))
  ) not valid,
  add constraint materials_video_is_link check (
    kind <> 'video' or (video_url is not null and file_id is null)
  ) not valid,
  add constraint materials_link_only_video check (
    video_url is null or kind = 'video'
  ) not valid;

alter table public.material_summaries
  add column regen_count smallint not null default 0 check (regen_count between 0 and 3);
