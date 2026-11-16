-- CanadaCase Academy Phase 4 — objectifs, séances personnelles et indexes.
-- Appliqué au projet Supabase Free existant le 16 novembre 2026.

create table if not exists public.academy_learning_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 3 and 180),
  description text,
  goal_type text not null default 'general' check (goal_type in ('general','exam','skill','course')),
  target_date date,
  weekly_target_minutes integer not null default 120 check (weekly_target_minutes between 15 and 3000),
  status text not null default 'active' check (status in ('active','completed','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id)
);
create index if not exists academy_learning_goals_user_status_idx
  on public.academy_learning_goals(user_id,status,target_date);

create table if not exists public.academy_study_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid,
  course_id uuid references public.academy_courses(id) on delete set null,
  title text not null check (length(trim(title)) between 3 and 180),
  description text,
  event_type text not null default 'study' check (event_type in ('study','revision','mock_exam','lesson','other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'planned' check (status in ('planned','completed','cancelled')),
  actual_minutes integer not null default 0 check (actual_minutes between 0 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_study_events_valid_interval check (ends_at > starts_at),
  constraint academy_study_events_goal_owner_fk foreign key (goal_id,user_id)
    references public.academy_learning_goals(id,user_id) on delete set null (goal_id)
);
create index if not exists academy_study_events_user_start_idx
  on public.academy_study_events(user_id,starts_at);
create index if not exists academy_study_events_course_idx
  on public.academy_study_events(course_id);
create index if not exists academy_study_events_goal_owner_idx
  on public.academy_study_events(goal_id,user_id);

alter table public.academy_learning_goals enable row level security;
alter table public.academy_study_events enable row level security;
revoke all on public.academy_learning_goals, public.academy_study_events from anon;
grant select,insert,update,delete on public.academy_learning_goals, public.academy_study_events to authenticated;

drop policy if exists academy_learning_goals_owner_all on public.academy_learning_goals;
create policy academy_learning_goals_owner_all on public.academy_learning_goals for all to authenticated
using (user_id=(select auth.uid()) or private.is_case_admin())
with check (user_id=(select auth.uid()) or private.is_case_admin());

drop policy if exists academy_study_events_owner_all on public.academy_study_events;
create policy academy_study_events_owner_all on public.academy_study_events for all to authenticated
using (user_id=(select auth.uid()) or private.is_case_admin())
with check ((user_id=(select auth.uid()) or private.is_case_admin()) and
 (goal_id is null or exists(select 1 from public.academy_learning_goals g where g.id=goal_id and g.user_id=user_id)));

create or replace function public.academy_dashboard_touch_updated_at()
returns trigger language plpgsql security invoker set search_path=''
as $$ begin new.updated_at=now(); return new; end; $$;
revoke all on function public.academy_dashboard_touch_updated_at() from public,anon,authenticated;
drop trigger if exists academy_learning_goals_touch_updated_at on public.academy_learning_goals;
create trigger academy_learning_goals_touch_updated_at before update on public.academy_learning_goals
for each row execute function public.academy_dashboard_touch_updated_at();
drop trigger if exists academy_study_events_touch_updated_at on public.academy_study_events;
create trigger academy_study_events_touch_updated_at before update on public.academy_study_events
for each row execute function public.academy_dashboard_touch_updated_at();