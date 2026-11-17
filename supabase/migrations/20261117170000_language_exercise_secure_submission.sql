create or replace function private.language_submit_exercise_attempt(p_exercise_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
 v_user_id uuid:=(select auth.uid()); v_exercise record; v_question record;
 v_question_count integer; v_answer_count integer; v_score integer:=0;
 v_question_ids uuid[]:=array[]::uuid[]; v_details jsonb:='[]'::jsonb;
 v_selected integer; v_correct integer; v_attempt_id uuid;
begin
 if v_user_id is null or not private.is_active_user() then raise exception 'Connexion active requise.' using errcode='42501'; end if;
 if p_exercise_id is null or jsonb_typeof(p_answers)<>'object' then raise exception 'Réponses invalides.' using errcode='22023'; end if;
 select id,exam,skill,level,prompt into v_exercise from public.language_exercises where id=p_exercise_id and is_published=true;
 if not found then raise exception 'Exercice introuvable ou non publié.' using errcode='P0002'; end if;
 if v_exercise.exam not in ('TEF Canada','TCF Canada') or v_exercise.skill not in ('Compréhension écrite','Compréhension orale') or v_exercise.level not in ('A1','A2','B1','B2','C1','C2') then raise exception 'Cet exercice ne peut pas être corrigé automatiquement.' using errcode='22023'; end if;
 select count(*) into v_question_count from public.language_exercise_questions q join public.language_question_keys k on k.question_id=q.id where q.exercise_id=p_exercise_id;
 select count(*) into v_answer_count from jsonb_object_keys(p_answers);
 if v_question_count<1 or v_answer_count<>v_question_count then raise exception 'Répondez à toutes les questions de cet exercice.' using errcode='22023'; end if;
 for v_question in select q.id,q.question_text,q.options,q.explanation,k.correct_option from public.language_exercise_questions q join public.language_question_keys k on k.question_id=q.id where q.exercise_id=p_exercise_id order by q.sort_order,q.id loop
  if not (p_answers ? v_question.id::text) or jsonb_typeof(p_answers->v_question.id::text)<>'number' then raise exception 'Une réponse est manquante ou invalide.' using errcode='22023'; end if;
  v_selected:=(p_answers->>v_question.id::text)::integer; v_correct:=v_question.correct_option;
  if v_selected<0 or v_selected>=jsonb_array_length(v_question.options) then raise exception 'Une option de réponse est invalide.' using errcode='22023'; end if;
  if v_selected=v_correct then v_score:=v_score+1; end if;
  v_question_ids:=array_append(v_question_ids,v_question.id);
  v_details:=v_details||jsonb_build_array(jsonb_build_object('question_id',v_question.id,'question',v_question.question_text,'options',v_question.options,'selected_option',v_selected,'correct_option',v_correct,'is_correct',v_selected=v_correct,'explanation',v_question.explanation));
 end loop;
 insert into public.language_attempts(user_id,exam,skill,level,exercise_id,started_at,completed_at,duration_seconds,score,max_score,answers,feedback,question_ids)
 values(v_user_id,v_exercise.exam,v_exercise.skill,v_exercise.level,p_exercise_id,now(),now(),0,v_score,v_question_count,p_answers,'Correction automatique : '||v_score||' / '||v_question_count||'.',v_question_ids) returning id into v_attempt_id;
 return jsonb_build_object('attempt_id',v_attempt_id,'exam',v_exercise.exam,'skill',v_exercise.skill,'level',v_exercise.level,'score',v_score,'max_score',v_question_count,'percentage',round((v_score::numeric/v_question_count)*100,1),'corrections',v_details);
end;
$function$;
revoke all on function private.language_submit_exercise_attempt(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.language_submit_exercise_attempt(uuid,jsonb) to authenticated;
create or replace function public.language_submit_exercise_attempt(p_exercise_id uuid,p_answers jsonb)
returns jsonb language sql set search_path='' as $function$ select private.language_submit_exercise_attempt(p_exercise_id,p_answers); $function$;
revoke all on function public.language_submit_exercise_attempt(uuid,jsonb) from public,anon;
grant execute on function public.language_submit_exercise_attempt(uuid,jsonb) to authenticated;