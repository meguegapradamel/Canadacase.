-- CanadaCase Cloud v0.3 — à exécuter dans Supabase > SQL Editor.
-- Ce script crée le schéma et les règles d'accès. Ne désactivez jamais RLS.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role text not null default 'candidate' check (role in ('candidate','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'À compléter',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  status text not null default 'Reçu' check (status in ('Reçu','À vérifier','Validé','À remplacer')),
  admin_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.case_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_case_admin()
returns boolean language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email, coalesce(new.raw_user_meta_data->>'phone',''))
  on conflict (id) do nothing;
  insert into public.candidate_cases(user_id) values(new.id) on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created_canadacase on auth.users;
create trigger on_auth_user_created_canadacase after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.candidate_cases enable row level security;
alter table public.case_documents enable row level security;
alter table public.case_updates enable row level security;

drop policy if exists "profile self or admin read" on public.profiles;
create policy "profile self or admin read" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_case_admin());

drop policy if exists "profile self update" on public.profiles;
create policy "profile self update" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid() and role = 'candidate');

drop policy if exists "case owner or admin read" on public.candidate_cases;
create policy "case owner or admin read" on public.candidate_cases for select to authenticated
using (user_id = auth.uid() or public.is_case_admin());

drop policy if exists "case owner insert" on public.candidate_cases;
create policy "case owner insert" on public.candidate_cases for insert to authenticated
with check (user_id = auth.uid() and status = 'À compléter');

drop policy if exists "case owner or admin update" on public.candidate_cases;
drop policy if exists "case owner updates data" on public.candidate_cases;
create policy "case owner updates data" on public.candidate_cases for update to authenticated
using (user_id = auth.uid() or public.is_case_admin())
with check (user_id = auth.uid() or public.is_case_admin());

-- Empêche un candidat de modifier lui-même le statut administratif.
revoke update on public.candidate_cases from authenticated;
grant update (data, updated_at) on public.candidate_cases to authenticated;
grant select on public.candidate_cases to authenticated;
grant insert (user_id, data) on public.candidate_cases to authenticated;

create or replace function public.admin_set_case_status(target_user uuid, new_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_case_admin() then
    raise exception 'Accès administrateur requis';
  end if;
  if new_status not in ('À compléter','À examiner','Documents manquants','En traitement','Soumis','Clôturé') then
    raise exception 'Statut non autorisé';
  end if;
  update public.candidate_cases
  set status = new_status, updated_at = now()
  where user_id = target_user;
  if not found then
    raise exception 'Dossier introuvable';
  end if;
end; $$;
grant execute on function public.admin_set_case_status(uuid,text) to authenticated;

drop policy if exists "document owner or admin read" on public.case_documents;
create policy "document owner or admin read" on public.case_documents for select to authenticated
using (user_id = auth.uid() or public.is_case_admin());

drop policy if exists "document owner insert" on public.case_documents;
create policy "document owner insert" on public.case_documents for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "document admin update" on public.case_documents;
create policy "document admin update" on public.case_documents for update to authenticated
using (public.is_case_admin()) with check (public.is_case_admin());

drop policy if exists "updates owner or admin read" on public.case_updates;
create policy "updates owner or admin read" on public.case_updates for select to authenticated
using (user_id = auth.uid() or public.is_case_admin());

drop policy if exists "admin creates updates" on public.case_updates;
create policy "admin creates updates" on public.case_updates for insert to authenticated
with check (public.is_case_admin());

-- Bucket privé : fichiers PDF/JPG/PNG, limite de 10 Mo.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('case-documents','case-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf','image/jpeg','image/png'];

drop policy if exists "candidate uploads own folder" on storage.objects;
create policy "candidate uploads own folder" on storage.objects for insert to authenticated
with check (bucket_id='case-documents' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "owner or admin reads documents" on storage.objects;
create policy "owner or admin reads documents" on storage.objects for select to authenticated
using (bucket_id='case-documents' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_case_admin()));

drop policy if exists "owner deletes own document" on storage.objects;
create policy "owner deletes own document" on storage.objects for delete to authenticated
using (bucket_id='case-documents' and (storage.foldername(name))[1]=auth.uid()::text);
