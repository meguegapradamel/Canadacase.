-- CanadaCase Academy Phase 3 — état final du modèle apprentissage.
-- À appliquer uniquement après les phases 1 et 2.
-- Les migrations de production sont déjà enregistrées dans Supabase.

create table if not exists public.academy_enrollments (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.academy_courses(id) on delete restrict,
 learner_id uuid not null references auth.users(id) on delete restrict,
 status text not null default 'active' check(status in ('active','completed','cancelled')),
 enrolled_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(course_id,learner_id),
 check((status='completed')=(completed_at is not null))
);
create table if not exists public.academy_lesson_progress (
 id uuid primary key default gen_random_uuid(),
 enrollment_id uuid not null references public.academy_enrollments(id) on delete cascade,
 lesson_id uuid not null references public.academy_lessons(id) on delete restrict,
 status text not null default 'in_progress' check(status in ('in_progress','completed')),
 progress_seconds integer not null default 0 check(progress_seconds>=0),
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 unique(enrollment_id,lesson_id),
 check((status='completed')=(completed_at is not null))
);
create table if not exists public.academy_assignments (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.academy_courses(id) on delete cascade,
 module_id uuid references public.academy_course_modules(id) on delete set null,
 lesson_id uuid references public.academy_lessons(id) on delete set null,
 title text not null check(length(trim(title)) between 3 and 180),
 instructions text not null check(length(trim(instructions)) between 5 and 10000),
 submission_type text not null default 'text' check(submission_type in ('text','url')),
 due_at timestamptz,
 max_score numeric(7,2) not null default 20 check(max_score>0 and max_score<=1000),
 is_published boolean not null default false,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.academy_submissions (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.academy_assignments(id) on delete restrict,
 learner_id uuid not null references auth.users(id) on delete restrict,
 answer_text text,
 answer_url text,
 status text not null default 'submitted' check(status in ('submitted','needs_revision','graded')),
 score numeric(7,2),
 feedback text,
 graded_by uuid references auth.users(id) on delete set null,
 submitted_at timestamptz not null default now(),
 graded_at timestamptz,
 updated_at timestamptz not null default now(),
 unique(assignment_id,learner_id),
 check(answer_url is null or answer_url ~ '^https://'),
 check(score is null or score>=0),
 check((status='graded')=(score is not null)),
 check((status in ('graded','needs_revision'))=(graded_at is not null))
);
create table if not exists public.academy_lesson_questions (
 id uuid primary key default gen_random_uuid(),
 lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
 question_text text not null check(length(trim(question_text)) between 3 and 2000),
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 8),
 sort_order integer not null default 10,
 created_at timestamptz not null default now()
);
create schema if not exists private;
create table if not exists private.academy_lesson_answer_keys (
 question_id uuid primary key references public.academy_lesson_questions(id) on delete cascade,
 correct_option integer not null check(correct_option between 0 and 7),
 explanation text,
 created_at timestamptz not null default now()
);
create table if not exists public.academy_quiz_attempts (
 id uuid primary key default gen_random_uuid(),
 lesson_id uuid not null references public.academy_lessons(id) on delete restrict,
 learner_id uuid not null references auth.users(id) on delete restrict,
 score integer not null check(score>=0),
 max_score integer not null check(max_score>0 and score<=max_score),
 submitted_at timestamptz not null default now()
);

create index if not exists academy_enrollments_learner_idx on public.academy_enrollments(learner_id,enrolled_at desc);
create index if not exists academy_enrollments_course_idx on public.academy_enrollments(course_id,status);
create index if not exists academy_lesson_progress_enrollment_idx on public.academy_lesson_progress(enrollment_id,status);
create index if not exists academy_lesson_progress_lesson_idx on public.academy_lesson_progress(lesson_id);
create index if not exists academy_assignments_course_idx on public.academy_assignments(course_id,is_published);
create index if not exists academy_assignments_created_by_idx on public.academy_assignments(created_by);
create index if not exists academy_assignments_lesson_idx on public.academy_assignments(lesson_id);
create index if not exists academy_assignments_module_idx on public.academy_assignments(module_id);
create index if not exists academy_submissions_learner_idx on public.academy_submissions(learner_id,submitted_at desc);
create index if not exists academy_submissions_assignment_idx on public.academy_submissions(assignment_id,status);
create index if not exists academy_submissions_graded_by_idx on public.academy_submissions(graded_by);
create index if not exists academy_lesson_questions_lesson_idx on public.academy_lesson_questions(lesson_id,sort_order);
create index if not exists academy_quiz_attempts_learner_idx on public.academy_quiz_attempts(learner_id,submitted_at desc);
create index if not exists academy_quiz_attempts_lesson_idx on public.academy_quiz_attempts(lesson_id);

alter table public.academy_enrollments enable row level security;
alter table public.academy_lesson_progress enable row level security;
alter table public.academy_assignments enable row level security;
alter table public.academy_submissions enable row level security;
alter table public.academy_lesson_questions enable row level security;
alter table public.academy_quiz_attempts enable row level security;
alter table private.academy_lesson_answer_keys enable row level security;

revoke all on public.academy_enrollments,public.academy_lesson_progress,public.academy_assignments,
 public.academy_submissions,public.academy_lesson_questions,public.academy_quiz_attempts from anon;
grant select,insert,update on public.academy_enrollments to authenticated;
grant select,insert,update on public.academy_lesson_progress to authenticated;
grant select,insert,update,delete on public.academy_assignments to authenticated;
grant select,insert,update on public.academy_submissions to authenticated;
grant select on public.academy_lesson_questions to authenticated;
grant select on public.academy_quiz_attempts to authenticated;
revoke delete on public.academy_enrollments,public.academy_lesson_progress,public.academy_submissions from authenticated;
revoke insert,update,delete on public.academy_quiz_attempts from authenticated;
revoke insert,update,delete on public.academy_lesson_questions from authenticated;
revoke all on private.academy_lesson_answer_keys from public,anon,authenticated;

drop policy if exists academy_enrollments_read on public.academy_enrollments;
create policy academy_enrollments_read on public.academy_enrollments for select to authenticated using (
 learner_id=(select auth.uid()) or private.is_case_admin() or exists(
  select 1 from public.academy_courses c where c.id=course_id and c.created_by=(select auth.uid())
   and exists(select 1 from public.academy_user_roles r where r.user_id=(select auth.uid()) and r.role_code='trainer')
 )
);
drop policy if exists academy_enrollments_insert on public.academy_enrollments;
create policy academy_enrollments_insert on public.academy_enrollments for insert to authenticated with check (
 learner_id=(select auth.uid()) and exists(select 1 from public.academy_courses c where c.id=course_id and c.status='published' and c.created_by<>(select auth.uid()))
);
drop policy if exists academy_enrollments_update on public.academy_enrollments;
create policy academy_enrollments_update on public.academy_enrollments for update to authenticated using (
 learner_id=(select auth.uid()) and status<>'completed'
) with check(learner_id=(select auth.uid()));

drop policy if exists academy_lesson_progress_read on public.academy_lesson_progress;
create policy academy_lesson_progress_read on public.academy_lesson_progress for select to authenticated using (
 exists(select 1 from public.academy_enrollments e where e.id=enrollment_id and e.learner_id=(select auth.uid()))
 or private.is_case_admin()
 or exists(select 1 from public.academy_enrollments e join public.academy_lessons l on l.id=lesson_id
  join public.academy_course_modules m on m.id=l.module_id join public.academy_courses c on c.id=m.course_id
  where e.id=enrollment_id and c.created_by=(select auth.uid())
   and exists(select 1 from public.academy_user_roles r where r.user_id=(select auth.uid()) and r.role_code='trainer'))
);
drop policy if exists academy_lesson_progress_insert on public.academy_lesson_progress;
create policy academy_lesson_progress_insert on public.academy_lesson_progress for insert to authenticated with check (
 exists(select 1 from public.academy_enrollments e join public.academy_lessons l on l.id=lesson_id
  join public.academy_course_modules m on m.id=l.module_id join public.academy_courses c on c.id=m.course_id
  where e.id=enrollment_id and e.learner_id=(select auth.uid()) and e.status='active' and c.status='published')
);
drop policy if exists academy_lesson_progress_update on public.academy_lesson_progress;
create policy academy_lesson_progress_update on public.academy_lesson_progress for update to authenticated using (
 exists(select 1 from public.academy_enrollments e where e.id=enrollment_id and e.learner_id=(select auth.uid()) and e.status='active')
) with check (
 exists(select 1 from public.academy_enrollments e where e.id=enrollment_id and e.learner_id=(select auth.uid()) and e.status='active')
);

drop policy if exists academy_assignments_read on public.academy_assignments;
create policy academy_assignments_read on public.academy_assignments for select to authenticated using (
 (is_published and exists(select 1 from public.academy_enrollments e where e.course_id=academy_assignments.course_id and e.learner_id=(select auth.uid()) and e.status='active'))
 or created_by=(select auth.uid()) or private.is_case_admin()
);
drop policy if exists academy_assignments_insert on public.academy_assignments;
create policy academy_assignments_insert on public.academy_assignments for insert to authenticated with check (
 (created_by=(select auth.uid()) and exists(select 1 from public.academy_courses c where c.id=course_id and c.created_by=(select auth.uid())
  and exists(select 1 from public.academy_user_roles r where r.user_id=(select auth.uid()) and r.role_code='trainer')))
 or private.is_case_admin()
);
drop policy if exists academy_assignments_update on public.academy_assignments;
create policy academy_assignments_update on public.academy_assignments for update to authenticated using (
 private.is_case_admin() or (created_by=(select auth.uid()) and exists(select 1 from public.academy_courses c where c.id=course_id and c.created_by=(select auth.uid())
  and exists(select 1 from public.academy_user_roles r where r.user_id=(select auth.uid()) and r.role_code='trainer')))
) with check (
 private.is_case_admin() or (created_by=(select auth.uid()) and exists(select 1 from public.academy_courses c where c.id=course_id and c.created_by=(select auth.uid())
  and exists(select 1 from public.academy_user_roles r where r.user_id=(select auth.uid()) and r.role_code='trainer')))
);
drop policy if exists academy_assignments_delete on public.academy_assignments;
create policy academy_assignments_delete on public.academy_assignments for delete to authenticated using (
 private.is_case_admin() or (created_by=(select auth.uid()) and exists(select 1 from public.academy_courses c where c.id=course_id and c.created_by=(select auth.uid())
  and exists(select 1 from public.academy_user_roles r where r.user_id=(select auth.uid()) and r.role_code='trainer')))
);

drop policy if exists academy_submissions_read on public.academy_submissions;
create policy academy_submissions_read on public.academy_submissions for select to authenticated using (
 learner_id=(select auth.uid()) or private.is_case_admin() or exists(
  select 1 from public.academy_assignments a join public.academy_courses c on c.id=a.course_id
  where a.id=assignment_id and c.created_by=(select auth.uid())
   and exists(select 1 from public.academy_user_roles r where r.user_id=(select auth.uid()) and r.role_code='trainer'))
);
drop policy if exists academy_submissions_insert on public.academy_submissions;
create policy academy_submissions_insert on public.academy_submissions for insert to authenticated with check (
 learner_id=(select auth.uid()) and status='submitted' and score is null and feedback is null and graded_by is null and graded_at is null
 and exists(select 1 from public.academy_assignments a join public.academy_enrollments e on e.course_id=a.course_id
  where a.id=assignment_id and a.is_published and e.learner_id=(select auth.uid()) and e.status='active')
);
drop policy if exists academy_submissions_update on public.academy_submissions;
create policy academy_submissions_update on public.academy_submissions for update to authenticated using (
 (learner_id=(select auth.uid()) and status in ('submitted','needs_revision')) or private.is_case_admin()
 or exists(select 1 from public.academy_assignments a join public.academy_courses c on c.id=a.course_id
  where a.id=assignment_id and c.created_by=(select auth.uid())
   and exists(select 1 from public.academy_user_roles r where r.user_id=(select auth.uid()) and r.role_code='trainer'))
) with check (
 (learner_id=(select auth.uid()) and status in ('submitted','needs_revision')) or private.is_case_admin()
 or exists(select 1 from public.academy_assignments a join public.academy_courses c on c.id=a.course_id
  where a.id=assignment_id and c.created_by=(select auth.uid())
   and exists(select 1 from public.academy_user_roles r where r.user_id=(select auth.uid()) and r.role_code='trainer'))
);

drop policy if exists academy_lesson_questions_read on public.academy_lesson_questions;
create policy academy_lesson_questions_read on public.academy_lesson_questions for select to authenticated using (
 exists(select 1 from public.academy_lessons l join public.academy_course_modules m on m.id=l.module_id join public.academy_courses c on c.id=m.course_id
  where l.id=lesson_id and c.status='published' and exists(select 1 from public.academy_enrollments e where e.course_id=c.id and e.learner_id=(select auth.uid()) and e.status='active'))
 or private.is_case_admin()
 or exists(select 1 from public.academy_lessons l join public.academy_course_modules m on m.id=l.module_id join public.academy_courses c on c.id=m.course_id
  where l.id=lesson_id and c.created_by=(select auth.uid()) and exists(select 1 from public.academy_user_roles r where r.user_id=(select auth.uid()) and r.role_code='trainer'))
);
drop policy if exists academy_quiz_attempts_read on public.academy_quiz_attempts;
create policy academy_quiz_attempts_read on public.academy_quiz_attempts for select to authenticated using (
 learner_id=(select auth.uid()) or private.is_case_admin()
 or exists(select 1 from public.academy_lessons l join public.academy_course_modules m on m.id=l.module_id join public.academy_courses c on c.id=m.course_id
  where l.id=lesson_id and c.created_by=(select auth.uid()) and exists(select 1 from public.academy_user_roles r where r.user_id=(select auth.uid()) and r.role_code='trainer'))
);

-- Les fonctions de contrôle, correction et protection des réponses sont créées
-- dans les migrations Supabase enregistrées sous les noms academy_phase3_*.
