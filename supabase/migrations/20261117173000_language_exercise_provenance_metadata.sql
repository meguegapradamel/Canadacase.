alter table public.language_exercises
  add column if not exists provenance_type text not null default 'unverified',
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists source_date date,
  add column if not exists rights_status text not null default 'unknown';

do $block$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.language_exercises'::regclass and conname='language_exercises_provenance_type_check') then
    alter table public.language_exercises add constraint language_exercises_provenance_type_check
      check (provenance_type in ('original','official_example','historical_exam','unverified'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.language_exercises'::regclass and conname='language_exercises_rights_status_check') then
    alter table public.language_exercises add constraint language_exercises_rights_status_check
      check (rights_status in ('not_applicable','unknown','permission_pending','licensed','public_domain','link_only'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.language_exercises'::regclass and conname='language_exercises_source_url_check') then
    alter table public.language_exercises add constraint language_exercises_source_url_check
      check (source_url is null or source_url ~ '^https://');
  end if;
end
$block$;

update public.language_exercises
set provenance_type='original',rights_status='not_applicable'
where prompt like '[ENTRAÎNEMENT ORIGINAL CANADACASE%';

update public.language_exercises
set provenance_type='unverified',rights_status='unknown'
where provenance_type='unverified' and source_url is null;