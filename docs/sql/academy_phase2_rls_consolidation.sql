-- Consolider les politiques OR par action pour limiter les évaluations RLS répétées.
drop policy if exists academy_courses_trainer_insert on public.academy_courses;
drop policy if exists academy_courses_admin_insert on public.academy_courses;
create policy academy_courses_insert on public.academy_courses
for insert to authenticated with check (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or (
      created_by = (select auth.uid()) and status = 'draft'
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
);

drop policy if exists academy_courses_trainer_update on public.academy_courses;
drop policy if exists academy_courses_admin_update on public.academy_courses;
create policy academy_courses_update on public.academy_courses
for update to authenticated using (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or (
      created_by = (select auth.uid()) and status in ('draft','needs_changes','submitted_for_review')
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

drop policy if exists academy_courses_trainer_delete on public.academy_courses;
drop policy if exists academy_courses_admin_delete on public.academy_courses;
create policy academy_courses_delete on public.academy_courses
for delete to authenticated using (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or (
      created_by = (select auth.uid()) and status = 'draft'
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
);

drop policy if exists academy_modules_trainer_insert on public.academy_course_modules;
drop policy if exists academy_modules_admin_insert on public.academy_course_modules;
create policy academy_modules_insert on public.academy_course_modules
for insert to authenticated with check (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or exists (
      select 1 from public.academy_courses c where c.id = course_id and c.created_by = (select auth.uid())
        and c.status in ('draft','needs_changes')
        and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
);

drop policy if exists academy_modules_trainer_update on public.academy_course_modules;
drop policy if exists academy_modules_admin_update on public.academy_course_modules;
create policy academy_modules_update on public.academy_course_modules
for update to authenticated using (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or exists (
      select 1 from public.academy_courses c where c.id = course_id and c.created_by = (select auth.uid())
        and c.status in ('draft','needs_changes')
        and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
) with check (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or exists (
      select 1 from public.academy_courses c where c.id = course_id and c.created_by = (select auth.uid())
        and c.status in ('draft','needs_changes')
        and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
);

drop policy if exists academy_modules_trainer_delete on public.academy_course_modules;
drop policy if exists academy_modules_admin_delete on public.academy_course_modules;
create policy academy_modules_delete on public.academy_course_modules
for delete to authenticated using (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or exists (
      select 1 from public.academy_courses c where c.id = course_id and c.created_by = (select auth.uid())
        and c.status in ('draft','needs_changes')
        and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
);

drop policy if exists academy_lessons_trainer_insert on public.academy_lessons;
drop policy if exists academy_lessons_admin_insert on public.academy_lessons;
create policy academy_lessons_insert on public.academy_lessons
for insert to authenticated with check (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or exists (
      select 1 from public.academy_course_modules m join public.academy_courses c on c.id = m.course_id
      where m.id = module_id and c.created_by = (select auth.uid()) and c.status in ('draft','needs_changes')
        and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
);

drop policy if exists academy_lessons_trainer_update on public.academy_lessons;
drop policy if exists academy_lessons_admin_update on public.academy_lessons;
create policy academy_lessons_update on public.academy_lessons
for update to authenticated using (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or exists (
      select 1 from public.academy_course_modules m join public.academy_courses c on c.id = m.course_id
      where m.id = module_id and c.created_by = (select auth.uid()) and c.status in ('draft','needs_changes')
        and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
) with check (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or exists (
      select 1 from public.academy_course_modules m join public.academy_courses c on c.id = m.course_id
      where m.id = module_id and c.created_by = (select auth.uid()) and c.status in ('draft','needs_changes')
        and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
);

drop policy if exists academy_lessons_trainer_delete on public.academy_lessons;
drop policy if exists academy_lessons_admin_delete on public.academy_lessons;
create policy academy_lessons_delete on public.academy_lessons
for delete to authenticated using (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or exists (
      select 1 from public.academy_course_modules m join public.academy_courses c on c.id = m.course_id
      where m.id = module_id and c.created_by = (select auth.uid()) and c.status in ('draft','needs_changes')
        and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
);

drop policy if exists academy_resources_trainer_insert on public.academy_resources;
drop policy if exists academy_resources_admin_insert on public.academy_resources;
create policy academy_resources_insert on public.academy_resources
for insert to authenticated with check (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or (
      created_by = (select auth.uid()) and not is_published
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
);

drop policy if exists academy_resources_trainer_update on public.academy_resources;
drop policy if exists academy_resources_admin_update on public.academy_resources;
create policy academy_resources_update on public.academy_resources
for update to authenticated using (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or (
      created_by = (select auth.uid()) and not is_published
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
) with check (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or (
      created_by = (select auth.uid()) and not is_published
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
);

drop policy if exists academy_resources_trainer_delete on public.academy_resources;
drop policy if exists academy_resources_admin_delete on public.academy_resources;
create policy academy_resources_delete on public.academy_resources
for delete to authenticated using (
  (select private.is_active_user()) and (
    (select private.is_case_admin())
    or (
      created_by = (select auth.uid()) and not is_published
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
    )
  )
);

create index if not exists academy_domains_created_by_idx on public.academy_domains(created_by);
create index if not exists academy_programs_created_by_idx on public.academy_programs(created_by);
