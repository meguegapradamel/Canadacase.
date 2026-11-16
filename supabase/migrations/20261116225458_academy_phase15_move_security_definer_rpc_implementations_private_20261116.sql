alter function public.academy_grade_lesson_quiz(uuid,jsonb) set schema private;
alter function public.academy_review_trainer_application(uuid,text,text) set schema private;
alter function public.academy_save_lesson_quiz_question(uuid,text,jsonb,integer,text) set schema private;
alter function public.academy_submit_trainer_application(uuid) set schema private;

create or replace function public.academy_grade_lesson_quiz(p_lesson_id uuid,p_answers jsonb)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.academy_grade_lesson_quiz(p_lesson_id,p_answers); $function$;

create or replace function public.academy_review_trainer_application(p_application_id uuid,p_decision text,p_note text default null)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.academy_review_trainer_application(p_application_id,p_decision,p_note); $function$;

create or replace function public.academy_save_lesson_quiz_question(p_lesson_id uuid,p_question_text text,p_options jsonb,p_correct_option integer,p_explanation text default null)
returns uuid language sql security invoker set search_path=''
as $function$ select private.academy_save_lesson_quiz_question(p_lesson_id,p_question_text,p_options,p_correct_option,p_explanation); $function$;

create or replace function public.academy_submit_trainer_application(p_application_id uuid)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.academy_submit_trainer_application(p_application_id); $function$;

revoke all on function public.academy_grade_lesson_quiz(uuid,jsonb) from public,anon;
revoke all on function public.academy_review_trainer_application(uuid,text,text) from public,anon;
revoke all on function public.academy_save_lesson_quiz_question(uuid,text,jsonb,integer,text) from public,anon;
revoke all on function public.academy_submit_trainer_application(uuid) from public,anon;
grant execute on function public.academy_grade_lesson_quiz(uuid,jsonb) to authenticated;
grant execute on function public.academy_review_trainer_application(uuid,text,text) to authenticated;
grant execute on function public.academy_save_lesson_quiz_question(uuid,text,jsonb,integer,text) to authenticated;
grant execute on function public.academy_submit_trainer_application(uuid) to authenticated;

revoke all on function private.academy_grade_lesson_quiz(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.academy_review_trainer_application(uuid,text,text) from public,anon,authenticated;
revoke all on function private.academy_save_lesson_quiz_question(uuid,text,jsonb,integer,text) from public,anon,authenticated;
revoke all on function private.academy_submit_trainer_application(uuid) from public,anon,authenticated;
grant execute on function private.academy_grade_lesson_quiz(uuid,jsonb) to authenticated;
grant execute on function private.academy_review_trainer_application(uuid,text,text) to authenticated;
grant execute on function private.academy_save_lesson_quiz_question(uuid,text,jsonb,integer,text) to authenticated;
grant execute on function private.academy_submit_trainer_application(uuid) to authenticated;
