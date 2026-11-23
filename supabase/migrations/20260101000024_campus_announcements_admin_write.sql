-- 024 campus announcements: the admin writes with their own Supabase session again (reverts 023).
-- RLS still restricts every operation to the admin account; nobody else can read or write the table.
drop policy platform_ann_admin_select on public.platform_announcements;
create policy platform_ann_admin on public.platform_announcements for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
grant select, insert, delete on public.platform_announcements to authenticated;
