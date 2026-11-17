-- Explicitly fail closed on unused legacy tables.
-- These tables are empty and are not referenced by the current browser application.
-- Keep authenticated and anonymous API roles blocked unless a future migration
-- introduces a reviewed, table-specific access model.

drop policy if exists legacy_deny_all on public.case_history;
create policy legacy_deny_all
on public.case_history
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists legacy_deny_all on public.case_notes;
create policy legacy_deny_all
on public.case_notes
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists legacy_deny_all on public.case_observations;
create policy legacy_deny_all
on public.case_observations
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists legacy_deny_all on public.cases;
create policy legacy_deny_all
on public.cases
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists legacy_deny_all on public.education_records;
create policy legacy_deny_all
on public.education_records
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists legacy_deny_all on public.family_members;
create policy legacy_deny_all
on public.family_members
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists legacy_deny_all on public.language_tests;
create policy legacy_deny_all
on public.language_tests
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists legacy_deny_all on public.notifications;
create policy legacy_deny_all
on public.notifications
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists legacy_deny_all on public.work_experiences;
create policy legacy_deny_all
on public.work_experiences
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists legacy_deny_all on private.academy_lesson_answer_keys;
create policy legacy_deny_all
on private.academy_lesson_answer_keys
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
