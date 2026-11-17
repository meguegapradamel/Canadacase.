create or replace function private.academy_admin_revoke_participation_attestation(
  p_attestation_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not private.is_case_admin() then
    raise exception 'Accès réservé à l’administration Academy.' using errcode = '42501';
  end if;
  if p_attestation_id is null or p_reason is null or char_length(btrim(p_reason)) not between 8 and 500 then
    raise exception 'Un motif de révocation de 8 à 500 caractères est obligatoire.' using errcode = '22023';
  end if;
  update public.academy_participation_attestations
    set revoked_at = now(), revocation_reason = btrim(p_reason)
    where id = p_attestation_id and revoked_at is null;
  if not found then
    raise exception 'Attestation introuvable ou déjà révoquée.' using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function private.academy_admin_revoke_participation_attestation(uuid,text) from public, anon, authenticated;
grant execute on function private.academy_admin_revoke_participation_attestation(uuid,text) to authenticated;

create or replace function public.academy_admin_revoke_participation_attestation(
  p_attestation_id uuid,
  p_reason text
) returns void
language sql
set search_path = ''
as $function$
  select private.academy_admin_revoke_participation_attestation(p_attestation_id,p_reason);
$function$;

revoke all on function public.academy_admin_revoke_participation_attestation(uuid,text) from public, anon;
grant execute on function public.academy_admin_revoke_participation_attestation(uuid,text) to authenticated;