-- CanadaCase Academy — migration fondatrice proposée
-- STATUT : BROUILLON À APPLIQUER EN ENVIRONNEMENT DE DÉVELOPPEMENT UNIQUEMENT.
-- Ne pas exécuter en production avant revue, exposition Data API et tests RLS.

begin;

create table if not exists public.academy_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text,
  preferred_ui_language text not null default 'fr'
    check (preferred_ui_language in ('fr','en')),
  country_code char(2),
  timezone text,
  learning_goals text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_code text not null
    check (role_code in ('learner','trainer','organization_member','partner_member')),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id),
  primary key (user_id, role_code)
);

create table if not exists public.academy_trainer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft','submitted','under_review','needs_info','approved','rejected','suspended')),
  biography text,
  experience_years smallint check (experience_years between 0 and 60),
  specialties text[] not null default '{}',
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_trainer_applications_user_created_idx
  on public.academy_trainer_applications(user_id, created_at desc);
create index if not exists academy_trainer_applications_status_created_idx
  on public.academy_trainer_applications(status, created_at desc);

alter table public.academy_profiles enable row level security;
alter table public.academy_user_roles enable row level security;
alter table public.academy_trainer_applications enable row level security;

-- Profil : accès à soi-même et lecture/gestion par les administrateurs actifs.
create policy academy_profiles_owner_select
  on public.academy_profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy academy_profiles_owner_insert
  on public.academy_profiles for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_active = true
    )
  );

create policy academy_profiles_owner_update
  on public.academy_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy academy_profiles_admin_all
  on public.academy_profiles for all to authenticated
  using (
    exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true)
  )
  with check (
    exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true)
  );

-- Un compte peut s'ajouter lui-même comme apprenant, jamais comme formateur ou administrateur.
create policy academy_roles_owner_select
  on public.academy_user_roles for select to authenticated
  using (user_id = (select auth.uid()));

create policy academy_roles_owner_learner_insert
  on public.academy_user_roles for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role_code = 'learner'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_active = true
    )
  );

create policy academy_roles_admin_select
  on public.academy_user_roles for select to authenticated
  using (
    exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true)
  );

create policy academy_roles_admin_insert
  on public.academy_user_roles for insert to authenticated
  with check (
    exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true)
  );

create policy academy_roles_admin_delete
  on public.academy_user_roles for delete to authenticated
  using (
    exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true)
  );

-- Candidature : le candidat peut créer et lire ses propres dossiers.
create policy academy_trainer_application_owner_select
  on public.academy_trainer_applications for select to authenticated
  using (user_id = (select auth.uid()));

create policy academy_trainer_application_owner_insert
  on public.academy_trainer_applications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'draft'
    and reviewed_by is null
    and reviewed_at is null
    and submitted_at is null
  );

create policy academy_trainer_application_admin_select
  on public.academy_trainer_applications for select to authenticated
  using (
    exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true)
  );

-- Les décisions de validation (status, reviewer, dates, notes) sont réservées
-- aux Edge Functions/RPC serveur ; le client ne reçoit pas de droit UPDATE global.
grant select on public.academy_profiles to authenticated;
grant insert (user_id, display_name, preferred_ui_language, country_code, timezone, learning_goals)
  on public.academy_profiles to authenticated;
grant update (display_name, preferred_ui_language, country_code, timezone, learning_goals, updated_at)
  on public.academy_profiles to authenticated;

grant select, insert, delete on public.academy_user_roles to authenticated;
grant select, insert on public.academy_trainer_applications to authenticated;
grant update (biography, experience_years, specialties, updated_at)
  on public.academy_trainer_applications to authenticated;

commit;

-- À faire séparément après validation :
-- 1. Exposer explicitement les tables nécessaires dans Supabase Data API.
-- 2. Vérifier RLS/GRANT pour anon et authenticated.
-- 3. Ajouter les fonctions serveur pour soumettre/approuver une candidature.
-- 4. Tester l'isolation avec deux comptes distincts et un compte admin.
