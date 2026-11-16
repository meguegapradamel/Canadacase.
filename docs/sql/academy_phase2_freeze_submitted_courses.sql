drop policy if exists academy_courses_update on public.academy_courses;
create policy academy_courses_update on public.academy_courses
for update to authenticated using (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or (
      created_by = (select auth.uid()) and status in ('draft','needs_changes')
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
) with check (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or (
      created_by = (select auth.uid()) and status in ('draft','needs_changes','submitted_for_review')
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
);