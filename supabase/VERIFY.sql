-- CanadaCase — vérification Supabase
-- À exécuter dans Supabase > SQL Editor.
-- Ce script est en lecture seule : il ne modifie aucune donnée.

select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('profiles','candidate_cases','case_documents','case_updates')
order by table_name;

select tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename in ('profiles','candidate_cases','case_documents','case_updates')
order by tablename;

select policyname, tablename, cmd
from pg_policies
where schemaname='public'
  and tablename in ('profiles','candidate_cases','case_documents','case_updates')
order by tablename, policyname;

select id, name, public, file_size_limit
from storage.buckets
where id='case-documents';

select routine_name, routine_type
from information_schema.routines
where routine_schema='public'
  and routine_name in ('is_case_admin','handle_new_user','admin_set_case_status')
order by routine_name;
