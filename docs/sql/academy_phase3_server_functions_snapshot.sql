-- Fonctions serveur de la Phase 3, exportées depuis la base Supabase vérifiée.
-- SECURITY DEFINER est utilisé uniquement pour conserver les clés QCM privées.
-- Les deux RPC publiques contrôlent l'identité, le rôle et l'inscription dans leur corps.

CREATE OR REPLACE FUNCTION public.academy_grade_lesson_quiz(p_lesson_id uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_question record;
  v_selected integer;
  v_score integer := 0;
  v_max integer := 0;
  v_course_id uuid;
begin
  if v_uid is null or not exists(select 1 from public.profiles p where p.id=v_uid and p.is_active=true) then
    raise exception 'Connexion à un compte actif requise.' using errcode='42501';
  end if;
  if jsonb_typeof(p_answers) <> 'array' then raise exception 'Réponses invalides.' using errcode='22023'; end if;
  select c.id into v_course_id
  from public.academy_lessons l
  join public.academy_course_modules m on m.id=l.module_id
  join public.academy_courses c on c.id=m.course_id
  join public.academy_enrollments e on e.course_id=c.id and e.learner_id=v_uid and e.status='active'
  where l.id=p_lesson_id and l.lesson_type='quiz' and c.status='published';
  if v_course_id is null then raise exception 'Inscription active et quiz publié requis.' using errcode='42501'; end if;

  for v_question in
    select q.id, k.correct_option
    from public.academy_lesson_questions q
    join private.academy_lesson_answer_keys k on k.question_id=q.id
    where q.lesson_id=p_lesson_id
  loop
    v_max := v_max + 1;
    select (a->>'selected_option')::integer into v_selected
    from jsonb_array_elements(p_answers) a
    where a->>'question_id'=v_question.id::text
    limit 1;
    if v_selected = v_question.correct_option then v_score := v_score + 1; end if;
  end loop;
  if v_max=0 then raise exception 'Ce quiz ne contient aucune question corrigée.' using errcode='55000'; end if;
  insert into public.academy_quiz_attempts(lesson_id,learner_id,score,max_score)
  values (p_lesson_id,v_uid,v_score,v_max);
  return jsonb_build_object('score',v_score,'max_score',v_max,'percentage',round((v_score::numeric/v_max)*100,1));
end;
$function$


CREATE OR REPLACE FUNCTION public.academy_guard_enrollment_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.learner_id is distinct from old.learner_id or new.course_id is distinct from old.course_id
     or old.status <> 'active' or new.status not in ('active','cancelled') then
    raise exception 'Une inscription ne peut être modifiée que pour être annulée par son apprenant.' using errcode='42501';
  end if;
  if new.status='cancelled' then new.completed_at:=null; end if;
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.academy_guard_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if not exists(
    select 1 from public.academy_enrollments e
    join public.academy_lessons l on l.id=new.lesson_id
    join public.academy_course_modules m on m.id=l.module_id
    where e.id=new.enrollment_id and e.course_id=m.course_id
  ) then
    raise exception 'La leçon ne correspond pas à cette inscription.' using errcode='23514';
  end if;
  if new.status='completed' and new.completed_at is null then new.completed_at:=now(); end if;
  if new.status='in_progress' then new.completed_at:=null; end if;
  new.updated_at:=now();
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.academy_guard_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_course_owner uuid;
  v_max_score numeric;
  v_submission_type text;
begin
  select c.created_by, a.max_score, a.submission_type
  into v_course_owner, v_max_score, v_submission_type
  from public.academy_assignments a join public.academy_courses c on c.id=a.course_id
  where a.id=new.assignment_id;
  if not found then raise exception 'Devoir introuvable.' using errcode='23503'; end if;
  if v_submission_type='text' and length(trim(coalesce(new.answer_text,'')))=0 then
    raise exception 'Une réponse écrite est requise.' using errcode='22023';
  elsif v_submission_type='url' and (new.answer_url is null or new.answer_url !~ '^https://') then
    raise exception 'Une URL HTTPS est requise.' using errcode='22023';
  end if;
  if tg_op='INSERT' then
    if new.learner_id is distinct from v_uid or new.status <> 'submitted'
       or new.score is not null or new.feedback is not null or new.graded_by is not null or new.graded_at is not null then
      raise exception 'Soumission initiale invalide.' using errcode='42501';
    end if;
  elsif v_uid = old.learner_id then
    if old.status not in ('submitted','needs_revision')
       or new.learner_id is distinct from old.learner_id
       or new.assignment_id is distinct from old.assignment_id
       or new.score is distinct from old.score
       or new.feedback is distinct from old.feedback
       or new.graded_by is distinct from old.graded_by
       or new.graded_at is distinct from old.graded_at then
      raise exception 'Vous ne pouvez modifier que votre réponse avant la correction.' using errcode='42501';
    end if;
    new.status := 'submitted';
    if old.status='needs_revision' then
      new.score:=null; new.feedback:=null; new.graded_by:=null; new.graded_at:=null;
    end if;
    new.submitted_at := now();
  elsif private.is_case_admin() or (
    v_course_owner=v_uid and exists(select 1 from public.academy_user_roles r where r.user_id=v_uid and r.role_code='trainer')
  ) then
    if new.learner_id is distinct from old.learner_id or new.assignment_id is distinct from old.assignment_id then
      raise exception 'Le correcteur ne peut pas réaffecter la soumission.' using errcode='42501';
    end if;
    if new.status='graded' then
      if new.score is null or new.score > v_max_score or length(trim(coalesce(new.feedback,'')))=0 then
        raise exception 'Une note valide et un commentaire sont requis.' using errcode='22023';
      end if;
      new.graded_by := v_uid; new.graded_at := now();
    elsif new.status='needs_revision' then
      new.score := null; new.graded_by := v_uid; new.graded_at := now();
      if length(trim(coalesce(new.feedback,'')))=0 then
        raise exception 'Un commentaire est requis pour demander une reprise.' using errcode='22023';
      end if;
    else
      raise exception 'Statut de correction invalide.' using errcode='22023';
    end if;
  else
    raise exception 'Accès refusé.' using errcode='42501';
  end if;
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.academy_save_lesson_quiz_question(p_lesson_id uuid, p_question_text text, p_options jsonb, p_correct_option integer, p_explanation text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_course_owner uuid;
  v_course_status text;
  v_question_id uuid;
begin
  if v_uid is null or not exists(select 1 from public.profiles p where p.id=v_uid and p.is_active=true) then
    raise exception 'Connexion à un compte actif requise.' using errcode='42501';
  end if;
  if p_question_text is null or length(trim(p_question_text)) not between 3 and 2000
     or jsonb_typeof(p_options) <> 'array'
     or jsonb_array_length(p_options) not between 2 and 8
     or p_correct_option is null or p_correct_option < 0 or p_correct_option >= jsonb_array_length(p_options) then
    raise exception 'Question ou choix de réponse invalide.' using errcode='22023';
  end if;
  select c.created_by,c.status into v_course_owner,v_course_status
  from public.academy_lessons l
  join public.academy_course_modules m on m.id=l.module_id
  join public.academy_courses c on c.id=m.course_id
  where l.id=p_lesson_id and l.lesson_type='quiz';
  if not found then raise exception 'Leçon de type quiz introuvable.' using errcode='P0002'; end if;
  if private.is_case_admin() then
    null;
  elsif v_course_owner=v_uid
     and v_course_status in ('draft','needs_changes')
     and exists(select 1 from public.academy_user_roles r where r.user_id=v_uid and r.role_code='trainer') then
    null;
  else
    raise exception 'Seul le formateur propriétaire d’un brouillon ou l’administration peut créer les questions.' using errcode='42501';
  end if;
  insert into public.academy_lesson_questions(lesson_id,question_text,options)
  values(p_lesson_id,trim(p_question_text),p_options)
  returning id into v_question_id;
  insert into private.academy_lesson_answer_keys(question_id,correct_option,explanation)
  values(v_question_id,p_correct_option,nullif(trim(coalesce(p_explanation,'')),''));
  return v_question_id;
end;
$function$



revoke all on function public.academy_guard_submission() from public,anon,authenticated;
revoke all on function public.academy_guard_progress() from public,anon,authenticated;
revoke all on function public.academy_guard_enrollment_update() from public,anon,authenticated;
revoke all on function public.academy_grade_lesson_quiz(uuid,jsonb) from public,anon;
grant execute on function public.academy_grade_lesson_quiz(uuid,jsonb) to authenticated;
revoke all on function public.academy_save_lesson_quiz_question(uuid,text,jsonb,integer,text) from public,anon;
grant execute on function public.academy_save_lesson_quiz_question(uuid,text,jsonb,integer,text) to authenticated;
