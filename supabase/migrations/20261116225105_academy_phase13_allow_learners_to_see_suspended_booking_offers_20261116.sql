drop policy if exists academy_offers_read on public.academy_offers;
create policy academy_offers_read
on public.academy_offers
for select
to authenticated
using (
  (select private.is_active_user())
  and (
    status in ('active','suspended')
    or created_by=(select auth.uid())
    or (select private.is_case_admin())
  )
);
