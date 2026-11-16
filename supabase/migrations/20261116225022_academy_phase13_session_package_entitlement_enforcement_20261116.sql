create or replace function private.academy_consume_booking_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session public.academy_live_sessions%rowtype;
  v_entitlement public.academy_entitlements%rowtype;
  v_has_paid_offer boolean;
  v_units integer;
begin
  select * into v_session
  from public.academy_live_sessions
  where id=new.session_id;

  select exists(
    select 1
    from public.academy_offers o
    where o.status in ('active','suspended')
      and (
        (o.product_type='live_session' and o.session_id=v_session.id)
        or (v_session.session_type='mock_exam'
            and o.product_type='mock_exam'
            and (o.trainer_id=v_session.trainer_id or o.trainer_id is null))
        or (o.product_type in ('session_package','subscription')
            and (o.trainer_id=v_session.trainer_id or o.trainer_id is null))
      )
  ) into v_has_paid_offer;

  if not v_has_paid_offer then return new; end if;

  select e.* into v_entitlement
  from public.academy_entitlements e
  where e.user_id=new.learner_id
    and e.status='active'
    and e.starts_at<=now()
    and (e.expires_at is null or e.expires_at>now())
    and (e.units_remaining is null or e.units_remaining>0)
    and (e.trainer_id=v_session.trainer_id or e.trainer_id is null)
    and (
      (e.entitlement_type='live_session' and e.offer_id in (
        select o.id from public.academy_offers o
        where o.product_type='live_session'
          and o.session_id=v_session.id
          and o.status in ('active','suspended')
      ))
      or (e.entitlement_type='mock_exam' and v_session.session_type='mock_exam'
          and e.offer_id in (
            select o.id from public.academy_offers o
            where o.product_type='mock_exam'
              and o.status in ('active','suspended')
              and (o.trainer_id=v_session.trainer_id or o.trainer_id is null)
          ))
      or (e.entitlement_type='session_package' and e.offer_id in (
          select o.id from public.academy_offers o
          where o.product_type='session_package'
            and o.status in ('active','suspended')
            and (o.trainer_id=v_session.trainer_id or o.trainer_id is null)
      ))
      or (e.entitlement_type='subscription' and e.offer_id in (
          select o.id from public.academy_offers o
          where o.product_type='subscription'
            and o.status in ('active','suspended')
            and (o.trainer_id=v_session.trainer_id or o.trainer_id is null)
      ))
    )
  order by
    case e.entitlement_type
      when 'live_session' then 1
      when 'mock_exam' then 2
      when 'session_package' then 3
      when 'subscription' then 4
      else 5
    end,
    e.expires_at asc nulls last,
    e.created_at asc
  limit 1
  for update;

  if not found then
    raise exception 'Un droit d’accès valide est requis pour réserver cette séance payante. Achetez une offre ou un forfait correspondant.';
  end if;

  v_units := case when v_entitlement.units_remaining is null then 0 else 1 end;

  if v_units=1 then
    update public.academy_entitlements
    set units_remaining=units_remaining-1,
        status=case when units_remaining-1=0 then 'exhausted' else 'active' end
    where id=v_entitlement.id;
  end if;

  insert into public.academy_entitlement_consumptions(
    entitlement_id,user_id,consumption_type,booking_id,units
  ) values (v_entitlement.id,new.learner_id,'booking',new.id,v_units);

  return new;
end;
$function$;
