alter function public.admin_set_case_status(uuid,text) set schema private;
alter function public.admin_set_case_status_for_case(uuid,text) set schema private;
alter function public.admin_set_document_status(uuid,text,text) set schema private;

create or replace function public.admin_set_case_status(target_user uuid,new_status text)
returns void language sql security invoker set search_path=''
as $function$ select private.admin_set_case_status(target_user,new_status); $function$;

create or replace function public.admin_set_case_status_for_case(target_case uuid,new_status text)
returns void language sql security invoker set search_path=''
as $function$ select private.admin_set_case_status_for_case(target_case,new_status); $function$;

create or replace function public.admin_set_document_status(target_document uuid,new_status text,note text default null)
returns void language sql security invoker set search_path=''
as $function$ select private.admin_set_document_status(target_document,new_status,note); $function$;

revoke all on function public.admin_set_case_status(uuid,text) from public,anon;
revoke all on function public.admin_set_case_status_for_case(uuid,text) from public,anon;
revoke all on function public.admin_set_document_status(uuid,text,text) from public,anon;
grant execute on function public.admin_set_case_status(uuid,text) to authenticated;
grant execute on function public.admin_set_case_status_for_case(uuid,text) to authenticated;
grant execute on function public.admin_set_document_status(uuid,text,text) to authenticated;

revoke all on function private.admin_set_case_status(uuid,text) from public,anon,authenticated;
revoke all on function private.admin_set_case_status_for_case(uuid,text) from public,anon,authenticated;
revoke all on function private.admin_set_document_status(uuid,text,text) from public,anon,authenticated;
grant execute on function private.admin_set_case_status(uuid,text) to authenticated;
grant execute on function private.admin_set_case_status_for_case(uuid,text) to authenticated;
grant execute on function private.admin_set_document_status(uuid,text,text) to authenticated;
