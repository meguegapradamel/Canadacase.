-- Réduction des politiques permissives redondantes : une politique par action et rôle.
drop policy if exists academy_profiles_owner_select on public.academy_profiles;
drop policy if exists academy_profiles_owner_insert on public.academy_profiles;
drop policy if exists academy_profiles_owner_update on public.academy_profiles;
drop policy if exists academy_profiles_admin_all on public.academy_profiles;

create policy academy_profiles_select
  on public.academy_profiles for select to authenticated
  using (
    (user_id = (select auth.uid()) and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active = true
    ))
    or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true
    )
  );

create policy academy_profiles_insert
  on public.academy_profiles for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active = true
    ))
    or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true
    )
  );

create policy academy_profiles_update
  on public.academy_profiles for update to authenticated
  using (
    (user_id = (select auth.uid()) and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active = true
    ))
    or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true
    )
  )
  with check (
    (user_id = (select auth.uid()) and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active = true
    ))
    or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true
    )
  );

drop policy if exists academy_roles_owner_select on public.academy_user_roles;
drop policy if exists academy_roles_admin_select on public.academy_user_roles;
create policy academy_roles_select
  on public.academy_user_roles for select to authenticated
  using (
    (user_id = (select auth.uid()) and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active = true
    ))
    or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true
    )
  );

drop policy if exists academy_roles_owner_learner_insert on public.academy_user_roles;
drop policy if exists academy_roles_admin_insert on public.academy_user_roles;
create policy academy_roles_insert
  on public.academy_user_roles for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and role_code = 'learner' and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active = true
    ))
    or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true
    )
  );

drop policy if exists academy_trainer_application_owner_select on public.academy_trainer_applications;
drop policy if exists academy_trainer_application_admin_select on public.academy_trainer_applications;
create policy academy_trainer_application_select
  on public.academy_trainer_applications for select to authenticated
  using (
    (user_id = (select auth.uid()) and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active = true
    ))
    or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true
    )
  );

-- Indexer les deux nouvelles clés étrangères de référence administrative.
create index if not exists academy_trainer_applications_reviewed_by_idx
  on public.academy_trainer_applications(reviewed_by);
create index if not exists academy_user_roles_granted_by_idx
  on public.academy_user_roles(granted_by);
