-- 023 campus announcements: the admin's session can only READ. Sending and deleting go through
-- studia-api (POST /api/admin/announcements, service role), which checks the caller is an active admin.
-- The fan-out trigger from 022 is SECURITY DEFINER, so it still runs for rows the API inserts.
drop policy platform_ann_admin on public.platform_announcements;
create policy platform_ann_admin_select on public.platform_announcements for select to authenticated
  using ((select private.is_admin()));
revoke insert, update, delete on public.platform_announcements from authenticated;
grant select on public.platform_announcements to authenticated;
