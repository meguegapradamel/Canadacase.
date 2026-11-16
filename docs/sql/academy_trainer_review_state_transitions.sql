create or replace function public.academy_review_trainer_application(
  p_application_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $academy$
declare
  v_admin_id uuid := auth.uid();
  v_application public.academy_trainer_applications%rowtype;
begin
  if v_admin_id is null or not private.is_case_admin() then
    raise exception 'Accès réservé à un administrateur actif.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('under_review','needs_info','approved','rejected','suspended') then
    raise exception 'Décision de candidature invalide.' using errcode = '22023';
  end if;
  if p_note is not null and length(p_note) > 2000 then
    raise exception 'La note administrative ne peut pas dépasser 2000 caractères.' using errcode = '22023';
  end if;

  select * into v_application
  from public.academy_trainer_applications
  where id = p_application_id
  for update;
  if not found then
    raise exception 'Candidature introuvable.' using errcode = 'P0002';
  end if;
  if v_application.user_id = v_admin_id then
    raise exception 'Un administrateur ne peut pas examiner sa propre candidature.' using errcode = '42501';
  end if;
  if v_application.status in ('submitted','under_review','needs_info')
     and p_decision not in ('under_review','needs_info','approved','rejected') then
    raise exception 'Décision incompatible avec une candidature en cours d’examen.' using errcode = '55000';
  elsif v_application.status = 'approved'
     and p_decision not in ('approved','suspended') then
    raise exception 'Une candidature approuvée ne peut être que maintenue ou suspendue.' using errcode = '55000';
  elsif v_application.status = 'suspended'
     and p_decision not in ('approved','rejected','suspended') then
    raise exception 'Une candidature suspendue ne peut être que réactivée ou rejetée.' using errcode = '55000';
  elsif v_application.status not in ('submitted','under_review','needs_info','approved','suspended') then
    raise exception 'Cette candidature ne peut plus être modifiée depuis son état actuel.' using errcode = '55000';
  end if;

  update public.academy_trainer_applications
  set status = p_decision, reviewed_by = v_admin_id, reviewed_at = now(),
      review_note = nullif(trim(coalesce(p_note,'')),''), updated_at = now()
  where id = p_application_id;

  if p_decision = 'approved' then
    insert into public.academy_user_roles(user_id, role_code, granted_by)
    values (v_application.user_id, 'trainer', v_admin_id)
    on conflict (user_id, role_code)
    do update set granted_by = excluded.granted_by, granted_at = now();
  elsif p_decision in ('rejected','suspended') then
    if not exists (
      select 1 from public.academy_trainer_applications a
      where a.user_id = v_application.user_id and a.status = 'approved'
        and a.id <> p_application_id
    ) then
      delete from public.academy_user_roles
      where user_id = v_application.user_id and role_code = 'trainer';
    end if;
  end if;

  insert into public.admin_action_log(admin_id, target_user, action, details)
  values (v_admin_id, v_application.user_id, 'academy_trainer_application_review',
    jsonb_build_object('application_id', p_application_id, 'decision', p_decision,
      'note', nullif(trim(coalesce(p_note,'')),'')));

  return jsonb_build_object('success', true, 'application_id', p_application_id, 'status', p_decision);
end;
$academy$;

revoke all on function public.academy_review_trainer_application(uuid,text,text) from public;
revoke all on function public.academy_review_trainer_application(uuid,text,text) from anon;
grant execute on function public.academy_review_trainer_application(uuid,text,text) to authenticated;