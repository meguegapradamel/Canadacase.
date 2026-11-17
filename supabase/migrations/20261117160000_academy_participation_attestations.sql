create table if not exists public.academy_participation_attestations (
  id uuid primary key default gen_random_uuid(),
  verification_code text not null unique,
  learner_id uuid not null references auth.users(id) on delete restrict,
  learner_name_snapshot text not null,
  activity_type text not null check (activity_type in ('course','live_session','workshop','webinar','other')),
  activity_title text not null check (char_length(btrim(activity_title)) between 5 and 180),
  activity_date date not null,
  duration_minutes integer not null check (duration_minutes between 1 and 5000),
  evidence_note text not null check (char_length(btrim(evidence_note)) between 12 and 1000),
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  constraint academy_participation_attestation_revocation_check
    check ((revoked_at is null and revocation_reason is null) or (revoked_at is not null and nullif(btrim(revocation_reason),'') is not null))
);

create index if not exists academy_participation_attestations_learner_issued_idx
  on public.academy_participation_attestations (learner_id, issued_at desc);

alter table public.academy_participation_attestations enable row level security;

drop policy if exists academy_participation_attestations_read_own_or_admin
  on public.academy_participation_attestations;
create policy academy_participation_attestations_read_own_or_admin
  on public.academy_participation_attestations
  for select to authenticated
  using (learner_id = (select auth.uid()) or (select private.is_case_admin()));

revoke all on public.academy_participation_attestations from anon, authenticated;
grant select on public.academy_participation_attestations to authenticated;

create or replace function private.academy_admin_issue_participation_attestation(
  p_learner_id uuid,
  p_activity_type text,
  p_activity_title text,
  p_activity_date date,
  p_duration_minutes integer,
  p_evidence_note text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text;
  v_code text;
  v_id uuid;
begin
  if (select auth.uid()) is null or not private.is_case_admin() then
    raise exception 'Accès réservé à l’administration Academy.' using errcode = '42501';
  end if;

  if p_learner_id is null or p_activity_type not in ('course','live_session','workshop','webinar','other')
     or p_activity_date is null or p_activity_date > current_date
     or p_duration_minutes is null or p_duration_minutes < 1 or p_duration_minutes > 5000
     or p_activity_title is null or char_length(btrim(p_activity_title)) not between 5 and 180
     or p_evidence_note is null or char_length(btrim(p_evidence_note)) not between 12 and 1000 then
    raise exception 'Informations de participation invalides ou preuve insuffisante.' using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(ap.display_name),''), nullif(btrim(p.full_name),''), 'Apprenant')
    into v_name
  from auth.users u
  left join public.academy_profiles ap on ap.user_id = u.id
  left join public.profiles p on p.id = u.id
  where u.id = p_learner_id;

  if v_name is null then
    raise exception 'Compte apprenant introuvable.' using errcode = 'P0002';
  end if;

  v_code := 'CCA-P-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));

  insert into public.academy_participation_attestations (
    verification_code, learner_id, learner_name_snapshot, activity_type,
    activity_title, activity_date, duration_minutes, evidence_note, issued_by
  ) values (
    v_code, p_learner_id, v_name, p_activity_type,
    btrim(p_activity_title), p_activity_date, p_duration_minutes, btrim(p_evidence_note), (select auth.uid())
  ) returning id into v_id;

  return jsonb_build_object('id',v_id,'verification_code',v_code,'learner_name',v_name,'issued_at',now());
end;
$function$;

revoke all on function private.academy_admin_issue_participation_attestation(uuid,text,text,date,integer,text) from public, anon, authenticated;
grant execute on function private.academy_admin_issue_participation_attestation(uuid,text,text,date,integer,text) to authenticated;

create or replace function public.academy_admin_issue_participation_attestation(
  p_learner_id uuid,
  p_activity_type text,
  p_activity_title text,
  p_activity_date date,
  p_duration_minutes integer,
  p_evidence_note text
) returns jsonb
language sql
set search_path = ''
as $function$
  select private.academy_admin_issue_participation_attestation(
    p_learner_id,p_activity_type,p_activity_title,p_activity_date,p_duration_minutes,p_evidence_note
  );
$function$;

revoke all on function public.academy_admin_issue_participation_attestation(uuid,text,text,date,integer,text) from public, anon;
grant execute on function public.academy_admin_issue_participation_attestation(uuid,text,text,date,integer,text) to authenticated;

create or replace function private.academy_verify_certificate(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when c.id is not null then jsonb_build_object(
      'valid', c.revoked_at is null,
      'certificate_type', 'success',
      'verification_code', c.verification_code,
      'learner_name', c.learner_name_snapshot,
      'exam_title', c.exam_title_snapshot,
      'percentage', c.percentage,
      'issued_at', c.issued_at,
      'revoked', c.revoked_at is not null,
      'message', case when c.revoked_at is null then 'Certificat de réussite authentique et valide.' else 'Certificat révoqué.' end
    )
    when a.id is not null then jsonb_build_object(
      'valid', a.revoked_at is null,
      'certificate_type', 'participation',
      'verification_code', a.verification_code,
      'learner_name', a.learner_name_snapshot,
      'activity_type', a.activity_type,
      'activity_title', a.activity_title,
      'activity_date', a.activity_date,
      'duration_minutes', a.duration_minutes,
      'issued_at', a.issued_at,
      'revoked', a.revoked_at is not null,
      'message', case when a.revoked_at is null then 'Attestation de participation authentique et valide.' else 'Attestation révoquée.' end
    )
    else jsonb_build_object('valid',false,'message','Document introuvable.')
  end
  from (select 1) s
  left join public.academy_certificates c on upper(c.verification_code)=upper(btrim(p_code))
  left join public.academy_participation_attestations a on upper(a.verification_code)=upper(btrim(p_code))
$function$;

revoke all on function private.academy_verify_certificate(text) from public, anon, authenticated;
grant execute on function private.academy_verify_certificate(text) to anon, authenticated;
