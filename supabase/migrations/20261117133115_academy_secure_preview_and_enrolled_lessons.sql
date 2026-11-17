-- Applied to Supabase project qxaykieolvbzaxmfaack.
-- Published course lessons are visible only as explicit previews or to enrolled learners.
-- Course modules remain discoverable for published courses; lesson bodies are protected.

drop policy if exists academy_modules_read on public.academy_course_modules;
create policy academy_modules_read
on public.academy_course_modules
for select
to authenticated
using (
  (select private.is_active_user())
  and exists (
    select 1
    from public.academy_courses c
    where c.id = academy_course_modules.course_id
      and (
        c.created_by = (select auth.uid())
        or (select private.is_case_admin())
        or c.status = 'published'
      )
  )
);

drop policy if exists academy_lessons_read on public.academy_lessons;
create policy academy_lessons_read
on public.academy_lessons
for select
to authenticated
using (
  (select private.is_active_user())
  and exists (
    select 1
    from public.academy_course_modules m
    join public.academy_courses c on c.id = m.course_id
    where m.id = academy_lessons.module_id
      and (
        c.created_by = (select auth.uid())
        or (select private.is_case_admin())
        or (
          c.status = 'published'
          and (
            academy_lessons.is_preview = true
            or exists (
              select 1
              from public.academy_enrollments e
              where e.course_id = c.id
                and e.learner_id = (select auth.uid())
                and e.status in ('active','completed')
            )
          )
        )
      )
  )
);
